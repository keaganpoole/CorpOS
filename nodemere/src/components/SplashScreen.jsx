// src/components/SplashScreen.jsx

import React, { useState, useEffect } from 'react';

const SplashScreen = ({ onAnimationEnd }) => {
    // This state will control the phases of the animation
    const [phase, setPhase] = useState('entering'); // 'entering' -> 'holding' -> 'exiting'

    useEffect(() => {
        const fadeInTimer = setTimeout(() => {
            setPhase('holding');
        }, 1000); // 1s for the logo to fade/scale in

        // This matches your 2-second hold requirement
        const holdTimer = setTimeout(() => {
            setPhase('exiting');
        }, 3000); // 1s fade-in + 2s hold

        const exitTimer = setTimeout(() => {
            // Notify the parent component that the animation is over
            if (onAnimationEnd) {
                onAnimationEnd();
            }
        }, 4000); // 3s total + 1s for the fade-out

        // Cleanup timers on component unmount
        return () => {
            clearTimeout(fadeInTimer);
            clearTimeout(holdTimer);
            clearTimeout(exitTimer);
        };
    }, [onAnimationEnd]);

    // Determines the CSS classes based on the current animation phase
    const getAnimationClasses = () => {
        switch (phase) {
            case 'entering':
                return 'opacity-100 scale-105';
            case 'holding':
                return 'opacity-100 scale-100';
            case 'exiting':
                return 'opacity-0 scale-95';
            default:
                return 'opacity-0 scale-95';
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0B0C10] flex items-center justify-center z-[100] transition-opacity duration-1000">
            <div className={`transform transition-all duration-1000 ease-in-out ${getAnimationClasses()}`}>
                <img
                    src="https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/assets/nodemere_logo2.png"
                    alt="Sonar Logo"
                    className="w-28 h-auto"
                />
            </div>
        </div>
    );
};

export default SplashScreen;
