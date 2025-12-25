/**
 * Supabase Edge Function: Server
 * This function handles file uploads, message routing, and push notifications.
 * NOTE: "Module not found" or "Cannot find name 'Deno'" errors in your editor are normal 
 * as this code runs in a Deno environment, not standard Node.js.
 */

import { Hono, Context } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Initialize Supabase client
// @ts-ignore: Deno is a global in Supabase Edge Functions
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const BUCKET_NAME = 'make-f2fe46ac-chat-files';

// Initialize storage safely
async function initStorage() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw error;

    const bucketExists = buckets?.some((bucket: any) => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 52428800, // 50MB limit
      });
    }
  } catch (error: any) {
    console.error('Error initializing storage:', error.message || error);
  }
}
initStorage();

app.use('*', logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Improved Middleware with proper types
const authMiddleware = async (c: Context, next: () => Promise<void>) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
  await next();
};

// Health check endpoint
app.get("/make-server-f2fe46ac/health", (c: Context) => {
  return c.json({ status: "ok" });
});

// Store FCM Token
app.post("/make-server-f2fe46ac/fcm-token", authMiddleware, async (c: Context) => {
  try {
    const { user_id, fcm_token } = await c.req.json();
    if (!user_id || !fcm_token) return c.json({ error: "Missing data" }, 400);

    const { error } = await supabase
      .from("profiles")
      .update({ fcm_token })
      .eq("id", user_id);

    if (error) throw error;
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || error }, 500);
  }
});

// Helper to send FCM
async function sendPushNotification(receiverId: string, title: string, body: string) {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("fcm_token")
      .eq("id", receiverId)
      .single();

    if (error) throw error;

    if (profile?.fcm_token) {
      console.log(`Sending notification to ${receiverId}: ${title}`);
      // In a real implementation, you would call the FCM API here using a Service Account Key
      // This requires the private key to be stored in Supabase secrets.
    }
  } catch (err: any) {
    console.error("Failed to send notification:", err.message || err);
  }
}

// Send a message (Relational version)
app.post("/make-server-f2fe46ac/messages", authMiddleware, async (c: Context) => {
  try {
    const { conversation_id, sender_id, text, file_url, file_type, file_name } = await c.req.json();

    if (!conversation_id || !sender_id) {
      return c.json({ error: "conversation_id and sender_id are required" }, 400);
    }

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        sender_id,
        text: text || "",
        file_url,
        file_type,
        file_name
      })
      .select()
      .single();

    if (error) throw error;

    // Update conversation's last message
    await supabase
      .from("conversations")
      .update({
        last_message_text: text || (file_url ? "Attachment" : ""),
        last_message_at: new Date().toISOString()
      })
      .eq("id", conversation_id);

    // Notify other participants
    const { data: participants, error: pError } = await supabase
      .from("conversation_participants")
      .select("user_id, profiles(display_name)")
      .eq("conversation_id", conversation_id);

    if (pError) throw pError;

    const senderName = (participants as any[])?.find((p: any) => p.user_id === sender_id)?.profiles?.display_name || "Someone";

    (participants as any[])?.forEach((p: any) => {
      if (p.user_id !== sender_id) {
        sendPushNotification(p.user_id, `New message from ${senderName}`, text || "Sent an attachment");
      }
    });

    return c.json({ message });
  } catch (error: any) {
    console.log(`Error in /messages: ${error.message || error}`);
    return c.json({ error: `Failed to send message: ${error.message || error}` }, 500);
  }
});

// Upload file
app.post("/make-server-f2fe46ac/upload", authMiddleware, async (c: Context) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as any; // Cast to any to avoid File type conflict
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return c.json({ error: "file and userId are required" }, 400);
    }

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const fileExt = file.name ? file.name.split('.').pop() : 'bin';
    const fileName = `${userId}/${timestamp}_${randomStr}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, uint8Array, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (error) throw error;

    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 31536000);

    if (urlError) throw urlError;

    return c.json({
      fileUrl: signedUrlData?.signedUrl,
      fileName: file.name || 'unknown',
      fileType: file.type || 'application/octet-stream',
    });
  } catch (error: any) {
    console.log(`Error in /upload: ${error.message || error}`);
    return c.json({ error: `Failed to upload file: ${error.message || error}` }, 500);
  }
});

// Search for user by ID (Relational version)
app.get("/make-server-f2fe46ac/search/:userId", authMiddleware, async (c: Context) => {
  try {
    const userId = c.req.param("userId");
    const { data: user, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    return c.json({ found: !!user, user });
  } catch (error: any) {
    console.log(`Error in /search/:userId: ${error.message || error}`);
    return c.json({ error: `Failed to search user: ${error.message || error}` }, 500);
  }
});

// @ts-ignore: Deno is a global in Supabase Edge Functions
Deno.serve(app.fetch);