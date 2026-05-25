//useLegacyAnimation.js

import { useEffect } from 'react';

const useLegacyAnimation = () => {
  useEffect(() => {
    // --- YOUR ORIGINAL SCRIPT, PASTED VERBATIM ---
    const PAGE_LOAD_DELAY = 1000;
    const NUM_SPARKS = 8;
    const TEXT_REVEAL_GLOBAL_DELAY = 1.6 + (PAGE_LOAD_DELAY / 1000);
    const CHAR_REVEAL_STAGGER_DELAY = 0.05;
    const CHAR_INITIAL_REVEAL_DURATION = 0.8;
    const CHAR_CONTINUOUS_PULSE_DURATION = 1.4;


    function initializeSynapticDataPulseAnimation() {
      const aiPoweredSpan = document.querySelector('.ai-powered-animated');
      if (!aiPoweredSpan) return;
      const originalText = aiPoweredSpan.textContent;
      aiPoweredSpan.textContent = '';
      originalText.split('').forEach((char, index) => {
        const charSpan = document.createElement('span');
        charSpan.textContent = char;
        charSpan.classList.add('ai-char');
        const charRevealDelay = index * CHAR_REVEAL_STAGGER_DELAY;
        charSpan.style.setProperty('--char-reveal-delay', `${charRevealDelay + TEXT_REVEAL_GLOBAL_DELAY}s`);
        aiPoweredSpan.appendChild(charSpan);
        charSpan.addEventListener('animationend', function handler(event) {
          if (event.animationName === 'aiCharInitialReveal') {
            this.style.animation = `aiCharDataPulse ${CHAR_CONTINUOUS_PULSE_DURATION}s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite alternate`;
            this.removeEventListener('animationend', handler);
          }
        }, { once: true });
      });
      for (let i = 0; i < NUM_SPARKS; i++) {
        const spark = document.createElement('div');
        spark.classList.add('synapse-spark');
        const sparkSize = `${Math.random() * 1 + 2}px`;
        spark.style.width = sparkSize;
        spark.style.height = sparkSize;
        spark.style.top = `${Math.random() * 100}%`;
        spark.style.left = `${Math.random() * 100}%`;
        spark.style.setProperty('--spark-delay', `${Math.random() * 2}s`);
        aiPoweredSpan.appendChild(spark);
      }
    }

    function splitTextIntoChars(element, charClass) {
      const text = element.textContent;
      element.textContent = '';
      text.split('').forEach((char, index) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.classList.add(charClass);
        span.style.setProperty(`--${charClass}-delay`, `${index * 0.06}s`);
        element.appendChild(span);
      });
    }

    function initializeAnimations() {
      const htmlContainer = document.getElementById('myHtmlContent');
      if (!htmlContainer) return;
      const emphasizedWords = htmlContainer.querySelectorAll('.emphasized-word');
      emphasizedWords.forEach(word => splitTextIntoChars(word, 'char'));
      const speedingText = htmlContainer.querySelector('.speeding-text');
      if(speedingText) {
        splitTextIntoChars(speedingText, 'speed-char');
      }
      const animatedStrokes = htmlContainer.querySelectorAll('.marker-underline path');
      animatedStrokes.forEach(path => {
        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
      });
      const animateOnScrollElements = htmlContainer.querySelectorAll('[data-animate="true"]');
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const target = entry.target;
            target.classList.add('is-visible');
            const delayInSeconds = PAGE_LOAD_DELAY / 1000;
            if (target.classList.contains('h1-part')) {
              if (target.textContent.includes("world's first")) {
                target.style.transitionDelay = `${0.2 + delayInSeconds}s`;
              } else if (target.textContent.includes("CRM")) {
                target.style.transitionDelay = `${2.0 + delayInSeconds}s`;
              }
            }
            if (target.matches('.hero-headline')) {
              const animationDelay = 2 + delayInSeconds;
              target.style.transitionDelay = `${animationDelay}s`;
            }
            if (target.matches('.hero-image')) {
              target.style.transitionDelay = `${0.6 + delayInSeconds}s`;
            }
            if (target.classList.contains('feature-card')) {
              const index = Array.from(target.parentNode.children).indexOf(target);
              target.style.transitionDelay = `${0.1 + (index * 0.1)}s`;
            }
            const emphasizedWord = target.querySelector('.emphasized-word');
            if (emphasizedWord) {
              const chars = emphasizedWord.querySelectorAll('.char');
              chars.forEach((char, index) => {
                char.style.animation = `revealChar 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards ${0.5 + (index * 0.03)}s`;
              });
            }
            observer.unobserve(target);
          }
        });
      }, { threshold: 0.2 });
      animateOnScrollElements.forEach(el => observer.observe(el));
      const headerElement = document.querySelector('.header');
      if (headerElement) {
        setTimeout(() => { headerElement.classList.add('is-visible'); }, 50 + PAGE_LOAD_DELAY);
      }
      const heroImage = document.querySelector('.hero-image');
      if (heroImage) {
        let ticking = false;
        const updateParallax = () => {
          const scrollY = window.scrollY;
          const translateY = scrollY * 0.1;
          const scale = 1 - (scrollY * 0.00005);
          if (heroImage.classList.contains('is-visible')) {
            heroImage.style.transform = `translateY(${translateY}px) scale(${scale})`;
          }
          ticking = false;
        };
        const scrollHandler = () => {
          if (!ticking) {
            window.requestAnimationFrame(updateParallax);
            ticking = true;
          }
        };
        window.addEventListener('scroll', scrollHandler);
        // Cleanup function to be returned by useEffect
        return () => window.removeEventListener('scroll', scrollHandler);
      }
    }

    // --- Initialize All Animations on Document Load ---
    const cleanup = initializeAnimations();
    initializeSynapticDataPulseAnimation();
    
    // Return the cleanup function for the parallax listener
    return cleanup;

  }, []); // The empty array ensures this effect runs only once after mount
};

export default useLegacyAnimation;