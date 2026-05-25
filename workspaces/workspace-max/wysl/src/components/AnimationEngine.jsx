import React, { useEffect, useRef, createContext, useContext, useCallback } from 'react';

const ObserverContext = createContext(null);

export function AnimationEngine({ children }) {
  const observerRef = useRef(null);
  // Use a ref to store element configs to avoid re-renders
  const elementsRef = useRef(new Map()); 

  useEffect(() => {
    const PAGE_LOAD_DELAY = 1000;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const config = elementsRef.current.get(el);
          if (config) {
            // Apply visibility class after the specified delay
            setTimeout(() => {
              el.classList.add('is-visible');
              if (config.onVisible) config.onVisible(el);
            }, config.delay || 0);
            observer.unobserve(el);
          }
        }
      });
    }, { threshold: 0.2 });

    observerRef.current = observer;

    // Handle header and parallax from original script
    const header = document.querySelector('.header');
    if (header) {
      setTimeout(() => header.classList.add('is-visible'), 50 + PAGE_LOAD_DELAY);
    }
    const heroImage = document.querySelector('.hero-image');
    let ticking = false;
    const updateParallax = () => {
      if (heroImage && heroImage.classList.contains('is-visible')) {
        const scrollY = window.scrollY;
        heroImage.style.transform = `translateY(${scrollY * 0.1}px) scale(${1 - (scrollY * 0.00005)})`;
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateParallax);
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []); // Empty array ensures this effect runs only once

  const observe = useCallback((el, config) => {
    if (el && observerRef.current) {
      elementsRef.current.set(el, config);
      observerRef.current.observe(el);
    }
  }, []);

  return (
    <ObserverContext.Provider value={{ observe }}>
      {children}
    </ObserverContext.Provider>
  );
}

// Custom hook that components will use to register for animation
export const useAnimate = (config = {}) => {
  const ref = useRef(null);
  const { observe } = useContext(ObserverContext);
  useEffect(() => {
    if (ref.current && observe) {
      observe(ref.current, config);
    }
  }, [observe, config]);
  return ref;
};