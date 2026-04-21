import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

/**
 * A modern, self-contained React component for a dynamic typing/deleting text animation.
 * It cycles through a list of words with pauses, creating a "search" like effect.
 * Uses Tailwind CSS for styling and includes the "Inter" font.
 */
export default function TypingAnimation() {
  const componentRef = useRef(null);
  const isInView = useInView(componentRef, { once: true, amount: 0.5 });

  // State for the text that is currently visible on the screen
  const [text, setText] = useState('Smart Search 💪'); // Start with "Smart Search 💪" visible

  // Refs to manage the animation state without causing re-renders
  const wordIndexRef = useRef(0); // Index of the current word in the 'words' array
  const charIndexRef = useRef('Smart Search 🧠'.length); // Current character position
  const isDeletingRef = useRef(false); // Flag to toggle between typing and deleting
  const animationStartedRef = useRef(false); // Flag to ensure animation starts only once

  // --- Animation Configuration ---
  const words = ['Smart Search 💪', 'Facebook', 'Meta', 'Social Media', 'Mark Zuckerberg', 'Smart Search 💪'];
  const typingSpeed = 120; // Time in ms between typing characters
  const deletingSpeed = 80; // Time in ms between deleting characters
  const pauseDuration = 2000; // Time in ms to pause on a completed word

  useEffect(() => {
    if (!isInView || animationStartedRef.current) return;

    animationStartedRef.current = true;

    // This function contains the core animation logic and calls itself via setTimeout
    const tick = () => {
      const currentWord = words[wordIndexRef.current];
      let delay = isDeletingRef.current ? deletingSpeed : typingSpeed;

      if (isDeletingRef.current) {
        // --- DELETING LOGIC ---
        // Get the text by removing the last character
        const newText = currentWord.substring(0, charIndexRef.current - 1);
        setText(newText);
        charIndexRef.current--;

        // Check if deleting is finished
        if (charIndexRef.current === 0) {
          isDeletingRef.current = false; // Switch to typing mode
          // Move to the next word, looping back if necessary
          wordIndexRef.current = (wordIndexRef.current + 1) % words.length;
          delay = typingSpeed; // Set delay for first typed character
        }
      } else {
        // --- TYPING LOGIC ---
        // Get the text by adding the next character
        const newText = currentWord.substring(0, charIndexRef.current + 1);
        setText(newText);
        charIndexRef.current++;

        // Check if typing is finished
        if (charIndexRef.current === currentWord.length) {
          // Check if it's the very last word in the sequence
          if (wordIndexRef.current === words.length - 1) {
            return; // Stop the animation
          }
          
          // Not the last word: pause, then switch to deleting mode
          isDeletingRef.current = true;
          delay = pauseDuration; 
        }
      }

      // Schedule the next 'tick'
      setTimeout(tick, delay);
    };

    // Start the animation loop after an initial pause
    const initialPauseTimeout = setTimeout(() => {
      isDeletingRef.current = true; // Set to delete "Smart Search 🧠" first
      tick(); // Start the first tick
    }, pauseDuration);

    // Cleanup function to clear the timeout when the component unmounts
    return () => clearTimeout(initialPauseTimeout);
  }, [isInView]); // Rerun effect when isInView changes

  return (
    <div ref={componentRef} className="flex items-center justify-center">
      {/* The text container. 
        'min-h-[1.2em]' and 'h-[1.2em]' prevent the layout from jumping 
        as the text length changes.
      */}
      <span className="min-h-[1.2em] h-[1.2em]">
        <span>{text}</span>
        
        {/* Blinking cursor effect */}
        <span className="text-white/70 animate-blink" aria-hidden="true">|</span>
      </span>
    </div>
  );
}
