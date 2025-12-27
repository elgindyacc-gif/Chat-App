import { useState, useEffect } from "react";
import { supabase } from "../../utils/supabase/client";

interface UserProfile {
    id: string;
    username: string;
    name: string;
    avatar_url?: string;
}

type LoginStep = "login" | "signup" | "pin_entry";

export function useAuth() {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loginStep, setLoginStep] = useState<LoginStep>("login");

    const fetchProfile = async (userId: string, isPinVerified = false) => {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

        if (error) {
            // Handle both 406 (RLS) and PGRST116 (no rows) errors
            if (error.code === 'PGRST116' || error.message?.includes('406')) {
                console.warn("Profile missing for user. Logging out to clear stale session.");
                // Log user out to clear the orphaned session
                await supabase.auth.signOut();
                setCurrentUser(null);
            } else {
                console.error("Error fetching profile:", error);
            }
            setIsLoading(false);
            return null;
        }

        const profile = {
            id: data.id,
            username: data.username,
            name: data.display_name || data.username,
            avatar_url: data.avatar_url
        };

        setCurrentUser(profile);

        if (!data.display_name) {
            setLoginStep("signup");
        }

        setIsLoading(false);
        return profile;
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setCurrentUser(null);
        localStorage.removeItem("chat_app_view");
        localStorage.removeItem("chat_app_selected_chat");
    };

    // Auth Subscription
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                fetchProfile(session.user.id);
            } else {
                setIsLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                fetchProfile(session.user.id);
            } else {
                setCurrentUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return {
        currentUser,
        isLoading,
        loginStep,
        setLoginStep,
        fetchProfile,
        logout
    };
}
