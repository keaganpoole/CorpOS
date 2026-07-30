import React, { useState, useEffect, useRef } from 'react';

export default function IntroOverlay() {
  // Check localStorage once on initial load.
  const [isIntroFinished, setIsIntroFinished] = useState(
    () => localStorage.getItem('introFinished') === 'true'
  );

  // State to manage the fade-out effect.
  const [isFadingOut, setIsFadingOut] = useState(false);
  const logoRef = useRef(null);

  useEffect(() => {
    // If the intro has already played, do nothing.
    if (isIntroFinished) return;

    const handleAnimationEnd = () => {
      // Start fading out the overlay
      setIsFadingOut(true);
      // Mark intro as finished for future visits
      localStorage.setItem('introFinished', 'true');
    };

    const logoElement = logoRef.current;
    logoElement.addEventListener('animationend', handleAnimationEnd);

    // Cleanup the event listener when the component unmounts
    return () => {
      logoElement.removeEventListener('animationend', handleAnimationEnd);
    };
  }, [isIntroFinished]);

  // After the overlay's fade-out transition ends, hide it completely.
  const handleTransitionEnd = () => {
    setIsIntroFinished(true);
  };
  
  // Don't render anything if the intro is finished.
  if (isIntroFinished) {
    return null;
  }

  return (
    <div
      id="logo-intro-overlay"
      onTransitionEnd={handleTransitionEnd}
      style={{ opacity: isFadingOut ? 0 : 1 }}
    >
      <img
        ref={logoRef}
        src="https://d393ec8814550259215504977855f0b8.cdn.bubble.io/f1752264967091x715653164297439500/lgooo.png"
        alt="Keyquarters Logo"
        id="intro-logo"
      />
    </div>
  );
}