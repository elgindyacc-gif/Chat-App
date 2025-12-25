import { useState } from "react";
import { MessageCircle, UserPlus, ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface ChatRegisterProps {
    onRegister: (userId: string, name: string, password: string) => void;
    onBackToLogin: () => void;
}

export function ChatRegister({ onRegister, onBackToLogin }: ChatRegisterProps) {
    const [userId, setUserId] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!userId.trim() || !name.trim() || !password.trim()) {
            setError("All fields are required");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsLoading(true);
        onRegister(userId.trim(), name.trim(), password.trim());
        setIsLoading(false);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#00a884] via-[#008069] to-[#005c4b] px-4">
            <div className="w-full max-w-md">
                {/* Back Button */}
                <button
                    onClick={onBackToLogin}
                    className="flex items-center gap-2 text-white mb-4 hover:text-white/80 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back to Login</span>
                </button>

                {/* Logo and Title */}
                <div className="flex flex-col items-center mb-8">
                    <div className="relative">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-2xl">
                            <MessageCircle className="w-14 h-14 text-[#00a884]" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#25d366] rounded-full flex items-center justify-center">
                            <UserPlus className="w-4 h-4 text-white" />
                        </div>
                    </div>
                    <h1 className="text-white text-4xl mb-2 font-bold">Create Account</h1>
                    <p className="text-white/90 text-center text-lg">
                        Join the conversation today
                    </p>
                </div>

                {/* Register Form Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <div className="flex items-center gap-2 mb-6">
                        <UserPlus className="w-6 h-6 text-[#00a884]" />
                        <h2 className="text-2xl font-bold text-gray-800">Sign Up</h2>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-600 text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <Label htmlFor="name" className="text-gray-700 font-medium">
                                Display Name
                            </Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="Enter your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="mt-1 bg-gray-50 border-gray-200 focus:border-[#00a884] focus:ring-[#00a884]"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                This name will be visible to other users
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="userId" className="text-gray-700 font-medium">
                                User ID
                            </Label>
                            <Input
                                id="userId"
                                type="text"
                                placeholder="Choose a unique ID"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                className="mt-1 bg-gray-50 border-gray-200 focus:border-[#00a884] focus:ring-[#00a884]"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                This will be your unique identifier (e.g., john123)
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="password" className="text-gray-700 font-medium">
                                Password
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="Create a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 bg-gray-50 border-gray-200 focus:border-[#00a884] focus:ring-[#00a884]"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Minimum 6 characters
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
                                Confirm Password
                            </Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="Re-enter your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 bg-gray-50 border-gray-200 focus:border-[#00a884] focus:ring-[#00a884]"
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-[#00a884] hover:bg-[#00956f] text-white py-6 text-lg font-medium shadow-lg"
                            disabled={isLoading}
                        >
                            {isLoading ? "Creating Account..." : "Create Account"}
                        </Button>
                    </form>

                    {/* Terms */}
                    <p className="text-xs text-gray-500 text-center mt-4">
                        By signing up, you agree to our Terms of Service and Privacy Policy
                    </p>
                </div>

                {/* Footer */}
                <p className="text-center text-white/80 text-sm mt-6">
                    🔒 Your data is encrypted and secure
                </p>
            </div>
        </div>
    );
}
