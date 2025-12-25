import { useState, useEffect } from "react";
import { MessageCircle, User, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { supabase } from "../../../utils/supabase/client";

interface ChatLoginProps {
  onLoginSuccess: () => void;
  initialStep?: "login" | "signup" | "pin_entry";
  onNavigateToRegister?: () => void;
}

export function ChatLogin({ onLoginSuccess, initialStep = "login", onNavigateToRegister }: ChatLoginProps) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(initialStep === "signup");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  // Load saved credentials on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem("chat_app_username");
    const savedPin = localStorage.getItem("chat_app_pin");
    if (savedUsername && savedPin) {
      setUsername(savedUsername);
      setPin(savedPin);
      setRememberMe(true);
    }
  }, []);

  const getDummyEmail = (uname: string) => `${uname.trim().toLowerCase()}@app.local`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !pin.trim()) return;
    if (isSignUp && !displayName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const email = getDummyEmail(username);

      if (isSignUp) {
        // Sign Up
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password: pin,
          options: {
            data: {
              username: username.trim().toLowerCase(),
              display_name: displayName.trim(),
              pin: pin
            },
          },
        });

        if (signUpError) throw signUpError;
      } else {
        // Login
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: pin,
        });

        if (signInError) {
          if (signInError.message.includes("Invalid login credentials")) {
            throw new Error("Invalid username or PIN");
          }
          throw signInError;
        }

        // Save or clear credentials based on Remember Me
        if (rememberMe) {
          localStorage.setItem("chat_app_username", username.trim());
          localStorage.setItem("chat_app_pin", pin);
        } else {
          localStorage.removeItem("chat_app_username");
          localStorage.removeItem("chat_app_pin");
        }
      }

      onLoginSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#00a884] via-[#008069] to-[#005c4b] px-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-2xl">
              <MessageCircle className="w-14 h-14 text-[#00a884]" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#25d366] rounded-full flex items-center justify-center">
              <span className="text-white text-xl">✓</span>
            </div>
          </div>
          <h1 className="text-white text-4xl mb-2 font-bold">Chat App</h1>
          <p className="text-white/90 text-center text-lg">
            Connect with anyone, anywhere
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            {isSignUp ? "Create Account" : "Welcome"}
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
              <p className="text-red-600 text-sm text-center">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-700 text-sm font-medium">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="username"
                  type="text"
                  placeholder="@username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-11 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 h-12 rounded-lg focus:border-[#00a884] focus:ring-[#00a884]"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Display Name (Sign Up Only) */}
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-gray-700 text-sm font-medium">
                  Display Name
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Your Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 h-12 rounded-lg focus:border-[#00a884] focus:ring-[#00a884]"
                  disabled={isLoading}
                  required
                />
              </div>
            )}

            {/* PIN */}
            <div className="space-y-2">
              <Label htmlFor="pin" className="text-gray-700 text-sm font-medium">
                PIN
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="6-digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={6}
                  className="pl-11 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 h-12 rounded-lg focus:border-[#00a884] focus:ring-[#00a884]"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Remember Me Checkbox */}
            {!isSignUp && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="border-gray-300"
                />
                <label
                  htmlFor="rememberMe"
                  className="text-sm text-gray-700 cursor-pointer select-none"
                >
                  Remember me
                </label>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#00a884] hover:bg-[#00956f] text-white py-6 text-lg font-medium shadow-lg"
            >
              {isLoading ? "Please wait..." : isSignUp ? "Sign Up" : "Login"}
            </Button>
          </form>

          {/* Toggle Sign Up */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                if (onNavigateToRegister && !isSignUp) {
                  onNavigateToRegister();
                } else {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }
              }}
              className="text-[#00a884] hover:text-[#00956f] text-sm font-medium transition-colors"
            >
              {isSignUp ? "Already have an account? Login" : "Create new account"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/80 text-sm mt-6">
          🔒 Your messages are secured end-to-end
        </p>
      </div>
    </div>
  );
}
