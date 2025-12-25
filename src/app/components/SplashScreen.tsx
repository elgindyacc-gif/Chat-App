import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";

interface SplashScreenProps {
    onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onFinish();
        }, 2500);

        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#00a884] via-[#008069] to-[#005c4b] animate-pulse">
            <div className="relative">
                {/* Main Logo */}
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-6 shadow-2xl animate-bounce">
                    <MessageCircle className="w-20 h-20 text-[#00a884]" strokeWidth={2.5} />
                </div>

                {/* Checkmark */}
                <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-[#25d366] rounded-full flex items-center justify-center shadow-xl">
                    <span className="text-white text-3xl font-bold">✓</span>
                </div>
            </div>

            {/* App Name */}
            <h1 className="text-white text-5xl font-bold mb-2 tracking-tight">
                Chat App
            </h1>

            {/* Tagline */}
            <p className="text-white/90 text-xl mb-8">
                Connect instantly, chat freely
            </p>

            {/* Loading Indicator */}
            <div className="flex gap-2">
                <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>

            {/* Version */}
            <p className="absolute bottom-8 text-white/60 text-sm">
                v2.0 - Powered by Figma Make
            </p>
        </div>
    );
}
