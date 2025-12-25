-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles table (linked to auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  display_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS) for profiles
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 2. Conversations table
create table public.conversations (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_message_text text,
  last_message_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Conversation Participants table
create table public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  primary key (conversation_id, user_id)
);

-- 4. Messages table
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  text text,
  file_url text,
  file_type text,
  file_name text,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for conversations
alter table public.conversations enable row level security;

create policy "Users can view conversations they are part of."
  on conversations for select
  using (
    exists (
      select 1 from conversation_participants
      where conversation_id = conversations.id
      and user_id = auth.uid()
    )
  );

-- RLS for conversation_participants
alter table public.conversation_participants enable row level security;

create policy "Users can view participants in their conversations."
  on conversation_participants for select
  using (
    exists (
      select 1 from conversation_participants as cp
      where cp.conversation_id = conversation_participants.conversation_id
      and cp.user_id = auth.uid()
    )
  );

-- RLS for messages
alter table public.messages enable row level security;

create policy "Users can view messages in their conversations."
  on messages for select
  using (
    exists (
      select 1 from conversation_participants
      where conversation_id = messages.conversation_id
      and user_id = auth.uid()
    )
  );

create policy "Users can insert messages in their conversations."
  on messages for insert
  with check (
    exists (
      select 1 from conversation_participants
      where conversation_id = messages.conversation_id
      and user_id = auth.uid()
    )
  );

-- Trigger to create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Realtime settings
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table conversation_participants;
