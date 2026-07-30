import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * Custom Hook: useAnimatedCounter
 * Animates a number from 0 to a target value over a specified duration.
 * Uses requestAnimationFrame for a smooth, performant animation.
 */
const useAnimatedCounter = (targetValue, duration = 2000, startAnimation) => {
  const [currentValue, setCurrentValue] = useState(0);
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (!startAnimation) {
      setCurrentValue(0);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      startTimeRef.current = null;
      return;
    }

    const animate = (timestamp) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out quad function for a smoother slowdown
      const easeOutProgress = progress * (2 - progress);
      const animatedValue = Math.floor(easeOutProgress * targetValue);

      setCurrentValue(animatedValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        startTimeRef.current = null; // Reset for potential re-animation
      }
    };

    // Start the animation
    frameRef.current = requestAnimationFrame(animate);

    // Cleanup function to cancel animation on component unmount
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      startTimeRef.current = null;
    };
  }, [targetValue, duration, startAnimation]);

  return currentValue.toLocaleString(); // Format with commas
};

/**
 * A single statistic card.
 */
const StatCard = ({ number, label, prefix, suffix, animationDelay, startAnimation }) => {
  return (
    <motion.div 
      className="stat-card flex flex-col items-center justify-center text-center p-4 sm:p-8"
      initial={{ opacity: 0, translateY: 20 }}
      animate={startAnimation ? { opacity: 1, translateY: 0 } : {}}
      transition={{ duration: 0.8, ease: "easeOut", delay: animationDelay }}
    >
      <div className="text-[3rem] font-bold text-black tracking-tighter">
        {prefix}
        {number}
        {suffix}
      </div>
      <div className="text-sm sm:text-lg lg:text-xl text-gray-600 mt-2 tracking-tight">
        {label}
      </div>
    </motion.div>
  );
};

/**
 * Main AES256Stats Component
 * Displays the three animated AES-256 statistics.
 */
export default function AES256Stats({ startAnimation }) {
  const animatedBreaches = 0; // No animation needed for 0
  const animatedYears = useAnimatedCounter(500, 1800, startAnimation); // New counter for years
  const animatedKeys = useAnimatedCounter(77, 2000, startAnimation);

  return (
    <div className="flex items-center justify-center w-full text-black p-4 sm:p-8 font-['Inter']">
      
      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-4 w-full max-w-7xl mx-auto">
        
        {/* Stat 1: Successful Breaches */}
        <StatCard
          number={animatedBreaches}
          label="Successful Breaches"
          animationDelay={0.1}
          startAnimation={startAnimation}
        />
        
        {/* Stat 2: Time to Crack */}
        <StatCard
          number={animatedYears}
          label="Trillion Years to Crack"
          animationDelay={0.3}
          startAnimation={startAnimation}
        />
        
        {/* Stat 3: Key Combinations (10^77) */}
        <StatCard
          prefix="10"
          number={
            <sup className="text-[1.5rem] align-top relative -top-2 -left-1">
              {animatedKeys}
            </sup>
          }
          label="Possible Key Combinations"
          animationDelay={0.5}
          startAnimation={startAnimation}
        />
        
      </div>
    </div>
  );
}
