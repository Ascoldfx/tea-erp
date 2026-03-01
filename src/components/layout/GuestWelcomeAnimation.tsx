import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

export default function GuestWelcomeAnimation() {
    const { user } = useAuth();
    const [show, setShow] = useState(() => {
        if (typeof window !== 'undefined') {
            return !sessionStorage.getItem('guestWelcomeShown');
        }
        return false;
    });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Only trigger for guest role if we haven't seen it yet
        if (user?.role === 'guest' && show) {
            // Trigger fade in
            const showTimer = setTimeout(() => setIsVisible(true), 100);

            // Keep it visible for 5 seconds, then fade out
            const hideTimer = setTimeout(() => {
                setIsVisible(false);
                // Remove from DOM after transition
                setTimeout(() => setShow(false), 500);
                sessionStorage.setItem('guestWelcomeShown', 'true');
            }, 5000);

            return () => {
                clearTimeout(showTimer);
                clearTimeout(hideTimer);
            };
        }
    }, [user?.role, show]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
            {/* Dark overlay backdrop */}
            <div
                className={clsx(
                    "absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-500",
                    isVisible ? "opacity-100" : "opacity-0"
                )}
            />

            <div
                className={clsx(
                    "relative flex flex-col items-center justify-center transition-all duration-500 transform",
                    isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-8"
                )}
            >
                {/* Rainbow Arch CSS effect */}
                <div className="absolute top-0 -mt-32 w-96 h-48 overflow-hidden">
                    <div className="w-full h-96 rounded-full border-[20px] border-t-red-500 border-r-orange-400 border-b-yellow-400 border-l-green-400 opacity-80 blur-[2px] animate-[spin_4s_linear_infinite]" />
                </div>

                {/* Unicorn Emoji with bounce */}
                <div className="text-9xl relative z-10 animate-bounce cursor-default select-none filter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                    🦄
                </div>

                {/* Sparkles */}
                <Sparkles className="absolute top-10 left-10 text-yellow-300 w-8 h-8 animate-pulse" />
                <Sparkles className="absolute bottom-20 right-10 text-pink-300 w-6 h-6 animate-pulse" style={{ animationDelay: '0.5s' }} />
                <Sparkles className="absolute top-20 right-5 text-cyan-300 w-10 h-10 animate-pulse" style={{ animationDelay: '1s' }} />

                {/* Greeting Text */}
                <div className="mt-8 relative z-10">
                    <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 drop-shadow-sm text-center">
                        гей Евгений, мы тебе рады!
                    </h1>
                </div>
            </div>
        </div>
    );
}
