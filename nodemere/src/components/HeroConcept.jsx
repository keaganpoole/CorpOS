import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const HERO_GRADIENT = ['#ff1493', '#d946ef', '#7c3aed'];

const TRAIT_ICON_MASKS = {
  bulb: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 .75a8.25 8.25 0 0 0-4.135 15.39c.686.398 1.115 1.008 1.134 1.623a.75.75 0 0 0 .577.706c.352.083.71.148 1.074.195.323.041.6-.218.6-.544v-4.661a6.714 6.714 0 0 1-.937-.171.75.75 0 1 1 .374-1.453 5.261 5.261 0 0 0 2.626 0 .75.75 0 1 1 .374 1.452 6.712 6.712 0 0 1-.937.172v4.66c0 .327.277.586.6.545.364-.047.722-.112 1.074-.195a.75.75 0 0 0 .577-.706c.02-.615.448-1.225 1.134-1.623A8.25 8.25 0 0 0 12 .75Z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M9.013 19.9a.75.75 0 0 1 .877-.597 11.319 11.319 0 0 0 4.22 0 .75.75 0 1 1 .28 1.473 12.819 12.819 0 0 1-4.78 0 .75.75 0 0 1-.597-.876ZM9.754 22.344a.75.75 0 0 1 .824-.668 13.682 13.682 0 0 0 2.844 0 .75.75 0 1 1 .156 1.492 15.156 15.156 0 0 1-3.156 0 .75.75 0 0 1-.668-.824Z"/></svg>')}`,
  sparkles: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z"/></svg>')}`,
  heart: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"/></svg>')}`,
  chat: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-4.03a48.527 48.527 0 0 1-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979Z"/><path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z"/></svg>')}`,
  shield: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"/></svg>')}`,
  bolt: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z"/></svg>')}`,
};

function pickTraitIcon(traits = [], stereotype = '') {
  const descriptors = `${traits.join(' ')} ${stereotype}`.toLowerCase();

  if (/(warm|friendly|kind|sweet|gentle|caring|welcoming|easy-going)/.test(descriptors)) return 'heart';
  if (/(clever|witty|intuitive|smart|sharp|insight|bright|thoughtful)/.test(descriptors)) return 'bulb';
  if (/(professional|reliable|steady|calm|composed|polished|trust|precise)/.test(descriptors)) return 'shield';
  if (/(chatty|social|conversational|talkative|outgoing|persuasive|charming)/.test(descriptors)) return 'chat';
  if (/(fast|energetic|driven|bold|dynamic|direct|quick)/.test(descriptors)) return 'bolt';
  if (/(playful|creative|free|spirited|quirky|fun|magnetic)/.test(descriptors)) return 'sparkles';
  return 'sparkles';
}

function toTitleCase(value = '') {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function GradientIcon({ iconKey, colors, className = '' }) {
  const iconMask = TRAIT_ICON_MASKS[iconKey] || TRAIT_ICON_MASKS.sparkles;

  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${colors.join(', ')})`,
        WebkitMaskImage: `url("${iconMask}")`,
        maskImage: `url("${iconMask}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}

function MetamorphicFluidAura({ colors }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let time = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      mouseRef.current.tx = px;
      mouseRef.current.ty = py;
    };

    const onPointerLeave = () => {
      mouseRef.current.tx = 0;
      mouseRef.current.ty = 0;
    };

    const getBlobCoords = (cx, cy, rad, speedScale, offsetScale, mouseStrength) => {
      const coords = [];
      const steps = 180;
      const mouse = mouseRef.current;
      for (let i = 0; i <= steps; i += 1) {
        const angle = (i / steps) * Math.PI * 2;
        const wave1 = Math.sin(angle * 3 + time * speedScale) * 10;
        const wave2 = Math.cos(angle * 5 - time * 1.4 * speedScale) * 12;
        const wave3 = Math.sin(angle * 8 + time * 0.7) * 6;
        const mouseAngle = Math.atan2(mouse.y, mouse.x || 0.0001);
        const mouseDistance = Math.sqrt(mouse.x * mouse.x + mouse.y * mouse.y);
        const mouseWarp = Math.cos(angle - mouseAngle) * (mouseDistance * mouseStrength);
        const r = rad + (wave1 + wave2 + wave3) * offsetScale + mouseWarp;
        coords.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        });
      }
      return coords;
    };

    const drawBlob = (coords) => {
      ctx.beginPath();
      coords.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.closePath();
    };

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const mouse = mouseRef.current;
      const [primary, secondary, tertiary] = colors;

      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      time += 0.008;

      ctx.clearRect(0, 0, w, h);

      const baseRad = Math.min(w, h) * 0.28;

      const outerCoords = getBlobCoords(cx, cy, baseRad * 1.35, 0.7, 1.8, 42);
      drawBlob(outerCoords);
      const auraGrad = ctx.createRadialGradient(cx, cy, baseRad * 0.45, cx, cy, baseRad * 1.85);
      auraGrad.addColorStop(0, `${primary}33`);
      auraGrad.addColorStop(0.42, `${secondary}24`);
      auraGrad.addColorStop(0.72, `${tertiary}1a`);
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.fill();

      const midCoords = getBlobCoords(cx, cy, baseRad * 1.05, 1.2, 1.2, 30);
      drawBlob(midCoords);
      const midGrad = ctx.createLinearGradient(cx - baseRad, cy - baseRad, cx + baseRad, cy + baseRad);
      midGrad.addColorStop(0, `${primary}38`);
      midGrad.addColorStop(0.55, `${secondary}3d`);
      midGrad.addColorStop(1, `${tertiary}47`);
      ctx.fillStyle = midGrad;
      ctx.strokeStyle = `${secondary}57`;
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();

      const coreCoords = getBlobCoords(cx, cy, baseRad * 0.82, 1.5, 0.8, 18);
      drawBlob(coreCoords);
      const coreGrad = ctx.createLinearGradient(cx - baseRad, cy - baseRad, cx + baseRad, cy + baseRad);
      coreGrad.addColorStop(0, primary);
      coreGrad.addColorStop(0.5, secondary);
      coreGrad.addColorStop(1, tertiary);
      ctx.fillStyle = coreGrad;
      ctx.globalAlpha = 0.88;
      ctx.fill();
      ctx.globalAlpha = 1;

      frameRef.current = window.requestAnimationFrame(render);
    };

    resize();
    render();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('resize', resize);

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
      resizeObserver.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', resize);
    };
  }, [colors]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full rounded-full opacity-95"
      aria-hidden="true"
    />
  );
}

const HeroSlider = React.forwardRef(({ receptionists, embedded = false }, ref) => {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPlaying, setIsPlaying] = useState(null);
  const [isHoveringVoice, setIsHoveringVoice] = useState(false);
  const [mobileTimelineOpacity, setMobileTimelineOpacity] = useState(1);
  const [copyVisible, setCopyVisible] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [showArrowHint, setShowArrowHint] = useState(false);
  const [autoPlayResetKey, setAutoPlayResetKey] = useState(0);
  const [isSwipeViewport, setIsSwipeViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );
  const autoPlayRef = useRef(null);
  const audioRef = useRef(null);
  const innerRef = useRef(null);
  const touchStartRef = useRef(null);
  const shouldPause = isPlaying !== null || isHoveringVoice;

  const active = receptionists[index] || receptionists[0];
  const activeGradient = HERO_GRADIENT;
  const activeIcon = pickTraitIcon(active.traits, active.stereotype);
  const traitsPill = (className = '') => (
    <div className={`max-w-full items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.04] px-2 py-1.5 shadow-[0_14px_40px_rgba(3,7,18,0.28)] backdrop-blur-md md:px-2.5 md:py-2 lg:gap-2 lg:px-2.5 lg:py-1.5 ${className}`}>
      <GradientIcon iconKey={activeIcon} colors={activeGradient} className="h-5 w-5" />
      <div className="flex min-w-0 items-center gap-1 text-[8px] font-black tracking-[0.14em] text-white/60 md:text-[9px] lg:gap-1.5 lg:text-[9px] lg:tracking-[0.16em]">
        {active.traits.map((trait, i) => (
          <React.Fragment key={`${active.id}-${trait}-${i}`}>
            <span className="truncate">{toTitleCase(trait)}</span>
            {i < active.traits.length - 1 && <span className="text-white/30">&bull;</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  const resetAutoPlayTimer = () => {
    setAutoPlayResetKey((prev) => prev + 1);
  };

  const nextSlide = ({ manual = false } = {}) => {
    setDirection(1);
    setIndex((prev) => (prev + 1) % receptionists.length);
    if (manual) resetAutoPlayTimer();
  };

  const prevSlide = ({ manual = false } = {}) => {
    setDirection(-1);
    setIndex((prev) => (prev - 1 + receptionists.length) % receptionists.length);
    if (manual) resetAutoPlayTimer();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateViewport = () => {
      setIsSwipeViewport(window.innerWidth < 1024);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (!isInView || shouldPause) {
      clearInterval(autoPlayRef.current);
      return undefined;
    }
    autoPlayRef.current = setInterval(() => nextSlide(), 9000);
    return () => clearInterval(autoPlayRef.current);
  }, [receptionists.length, shouldPause, isInView, autoPlayResetKey]);

  useEffect(() => {
    if (!isSwipeViewport || !isInView || receptionists.length <= 1) {
      setShowArrowHint(false);
      return undefined;
    }

    let hideTimeout = null;
    const revealHint = () => {
      setShowArrowHint(true);
      hideTimeout = window.setTimeout(() => setShowArrowHint(false), 2200);
    };

    revealHint();
    const interval = window.setInterval(revealHint, 5000);
    return () => {
      window.clearInterval(interval);
      if (hideTimeout) window.clearTimeout(hideTimeout);
    };
  }, [isSwipeViewport, isInView, receptionists.length]);

  const playVoice = (voiceUrl, id) => {
    if (isPlaying === id) {
      audioRef.current?.pause();
      setIsPlaying(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(voiceUrl);
    audioRef.current = audio;
    setIsPlaying(id);
    audio.play();
    audio.onended = () => setIsPlaying(null);
  };

  useEffect(() => {
    const root = innerRef.current;
    if (!root || copyVisible) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          setCopyVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0,
        rootMargin: '0px 0px -68% 0px',
      }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [copyVisible]);

  useEffect(() => {
    const root = innerRef.current;
    if (!root) return undefined;

    let frame = null;

    const updateTimelineOpacity = () => {
      frame = null;
      if (window.innerWidth >= 768) {
        setMobileTimelineOpacity(1);
        return;
      }

      const rect = root.getBoundingClientRect();
      const nextOpacity = rect.top >= 0 ? 1 : Math.max(0, Math.min(1, 1 + rect.top / 80));
      setMobileTimelineOpacity(nextOpacity);
    };

    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(updateTimelineOpacity);
    };

    updateTimelineOpacity();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const handleTouchStart = (event) => {
    if (!isSwipeViewport) return;
    const touch = event.touches?.[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (event) => {
    if (!isSwipeViewport || !touchStartRef.current) return;

    const touch = event.changedTouches?.[0];
    const endX = touch?.clientX ?? touchStartRef.current.x;
    const endY = touch?.clientY ?? touchStartRef.current.y;
    const deltaX = endX - touchStartRef.current.x;
    const deltaY = endY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    if (deltaX < 0) nextSlide({ manual: true });
    else prevSlide({ manual: true });
  };

  const sliderFrame = (
    <motion.div
      className="relative isolate h-full w-full origin-bottom bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
          <motion.div
            style={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-20 bg-white/[0.05]"
          />

          <div className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:48px_48px]" />

          {receptionists.length > 1 && (
            <>
              <motion.div
                aria-hidden="true"
                className="hero-concept-edge-arrow hero-concept-edge-arrow--left hidden lg:flex"
                initial={false}
                animate={{ opacity: isInView ? 1 : 0 }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </motion.div>
              <motion.div
                aria-hidden="true"
                className="hero-concept-edge-arrow hero-concept-edge-arrow--right hidden lg:flex"
                initial={false}
                animate={{ opacity: isInView ? 1 : 0 }}
                transition={{ duration: 1.1, ease: 'easeOut', delay: 0.08 }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </motion.div>
            </>
          )}

          <div className="relative mx-auto flex h-full max-w-7xl items-center px-8 lg:px-20">
            <div className="relative z-30 flex w-full items-center lg:w-[46%] lg:justify-start xl:w-1/2">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={`${active.id}-content`}
                  custom={direction}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.18, ease: 'easeOut' } }}
                  exit={{ opacity: 0, transition: { duration: 0.12, ease: 'easeIn' } }}
                  className="w-full"
                >
                  <div className="flex flex-col items-center gap-5 text-center md:gap-6 lg:max-w-[34rem] lg:items-start lg:gap-5 lg:text-left">
                    {traitsPill('-mb-5 hidden lg:mx-0 lg:-mb-6 lg:inline-flex')}

                    <h1
                      aria-label={active.name}
                      className={`hero-concept-name homepage-copy-reveal lg:self-start ${copyVisible ? 'is-visible' : ''}`}
                      style={{
                        display: 'inline-block',
                        fontSize: 'clamp(5rem, 12vw, 11rem)',
                        lineHeight: 0.9,
                        letterSpacing: '-0.04em',
                        fontWeight: 400,
                        margin: 0,
                        background: `linear-gradient(90deg, ${activeGradient[0]}, ${activeGradient[1]}, ${activeGradient[2]}, ${activeGradient[0]})`,
                        backgroundSize: '200% auto',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: 'miami-flow 8s linear infinite',
                      }}
                    >
                      {active.name}
                    </h1>

                    {traitsPill('inline-flex lg:hidden')}

                    <div className="flex flex-col items-center gap-5 text-center md:gap-6 lg:items-start lg:gap-5 lg:pt-16 lg:text-left">
                      {active.description && (
                        <p className={`homepage-copy-reveal homepage-copy-reveal--delayed max-w-md text-[0.95rem] font-light leading-[1.55] text-white/60 md:max-w-[36rem] md:text-[1.16rem] md:leading-[1.62] lg:mx-0 lg:max-w-md lg:text-[1.06rem] lg:leading-[1.55] ${copyVisible ? 'is-visible' : ''}`}>
                          {active.description}
                        </p>
                      )}

                      {active.voice && (
                        <button
                          onClick={() => playVoice(active.voice, active.id)}
                          onMouseEnter={() => setIsHoveringVoice(true)}
                          onMouseLeave={() => setIsHoveringVoice(false)}
                          className="relative flex cursor-pointer items-center gap-2 overflow-hidden rounded-full border border-white/10 px-4 py-2.5 transition-all duration-500 hover:-translate-y-[1px]"
                          style={{
                            backgroundImage: `linear-gradient(135deg, ${activeGradient[0]}, ${activeGradient[1]} 52%, ${activeGradient[2]})`,
                            boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 10px 36px ${activeGradient[1]}33, 0 0 30px ${activeGradient[2]}22`,
                            animation: 'voice-button-float 6.5s ease-in-out infinite',
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 rounded-full opacity-70 blur-xl"
                            style={{
                              backgroundImage: `radial-gradient(circle at 30% 50%, ${activeGradient[0]}66, transparent 58%), radial-gradient(circle at 75% 45%, ${activeGradient[2]}55, transparent 62%)`,
                              animation: 'voice-button-glow 7s ease-in-out infinite',
                            }}
                          />
                          <span className="absolute inset-[1px] rounded-full bg-white/[0.02]" aria-hidden="true" />
                          <span className="relative z-10 flex items-center gap-2">
                            {isPlaying === active.id ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                                <rect x="6" y="4" width="4" height="16" rx="1" />
                                <rect x="14" y="4" width="4" height="16" rx="1" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                                <polygon points="5,3 19,12 5,21" />
                              </svg>
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white md:text-[11px] lg:text-[10px]">
                              {isPlaying === active.id ? 'Pause' : 'Preview Voice'}
                            </span>
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="relative flex h-[18rem] w-full items-end justify-center md:h-[29rem] lg:hidden">
                      {isSwipeViewport && receptionists.length > 1 && (
                        <>
                          <motion.div
                            aria-label="Previous receptionist"
                            className="hero-concept-edge-arrow hero-concept-edge-arrow--compact-left"
                            initial={false}
                            animate={{ opacity: showArrowHint ? 1 : 0 }}
                            transition={{ duration: 0.85, ease: 'easeOut' }}
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M15 18l-6-6 6-6" />
                            </svg>
                          </motion.div>
                          <motion.div
                            aria-label="Next receptionist"
                            className="hero-concept-edge-arrow hero-concept-edge-arrow--compact-right"
                            initial={false}
                            animate={{ opacity: showArrowHint ? 1 : 0 }}
                            transition={{ duration: 0.85, ease: 'easeOut' }}
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                          </motion.div>
                        </>
                      )}
                      <div
                        className="absolute left-1/2 top-3 h-[11.75rem] w-[11.75rem] -translate-x-1/2 rounded-full opacity-90 sm:h-[12.75rem] sm:w-[12.75rem] md:top-5 md:h-[19rem] md:w-[19rem]"
                        style={{
                          filter: `drop-shadow(0 0 38px ${activeGradient[0]}38) drop-shadow(0 0 90px ${activeGradient[1]}28) drop-shadow(0 0 130px ${activeGradient[2]}1d)`,
                        }}
                      >
                        <MetamorphicFluidAura colors={activeGradient} />
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${active.id}-visual-compact`}
                          initial={{ opacity: 0, scale: 0.95, y: 28 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 1.03, filter: 'blur(24px)' }}
                          transition={{ duration: 0.9, ease: [0.19, 1, 0.22, 1] }}
                          className="relative z-10 flex h-[15.5rem] w-full items-end justify-center sm:h-[16.75rem] md:h-[27rem]"
                        >
                          <img
                            src={active.avatar}
                            alt={active.name}
                            className="max-h-full w-auto max-w-[88vw] select-none object-contain object-bottom"
                          />
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="pointer-events-none absolute right-0 top-0 bottom-0 hidden w-[54%] items-end justify-center overflow-hidden lg:flex">
              <div
                className="absolute right-[-8%] top-[50%] -z-10 h-[102%] w-[102%] min-w-[500px] max-w-[720px] -translate-y-1/2 opacity-88 xl:right-[-6%] xl:h-[110%] xl:w-[110%] xl:max-w-[780px]"
                style={{
                  filter: `drop-shadow(0 0 46px ${activeGradient[0]}38) drop-shadow(0 0 120px ${activeGradient[1]}29) drop-shadow(0 0 170px ${activeGradient[2]}1f)`,
                }}
              >
                <MetamorphicFluidAura colors={activeGradient} />
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${active.id}-visual`}
                  initial={{ opacity: 0, scale: 0.95, x: 50 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 1.05, filter: 'blur(40px)' }}
                  transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
                  className="relative flex h-[88%] w-full items-end justify-center xl:h-[90%]"
                >
                  <img
                    src={active.avatar}
                    alt={active.name}
                    className="z-10 h-full w-auto select-none object-contain object-bottom"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div
            className="absolute bottom-8 inset-x-8 z-50 mx-auto flex max-w-7xl items-center transition-opacity duration-150 ease-out lg:inset-x-20"
            style={{ opacity: mobileTimelineOpacity }}
          >
            <div className="flex items-center gap-2">
              {receptionists.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setDirection(i > index ? 1 : -1);
                    setIndex(i);
                    resetAutoPlayTimer();
                  }}
                  className={`relative h-0.5 cursor-pointer overflow-hidden rounded-full transition-all duration-500 ${
                    i === index ? 'w-16 bg-white/20' : 'w-3 bg-white/10 hover:bg-white/30'
                  }`}
                >
                  {i === index && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 6, ease: 'linear' }}
                      className="absolute inset-0 bg-white"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
    </motion.div>
  );

  if (embedded) {
    return (
      <div ref={(el) => { innerRef.current = el; if (ref) ref.current = el; }} className="h-screen overflow-hidden">
        {sliderFrame}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative" style={{ height: '130vh' }}>
      <div ref={(el) => { innerRef.current = el; if (ref) ref.current = el; }} className="sticky top-0 h-screen overflow-hidden">
        {sliderFrame}
      </div>
    </div>
  );
});

const HeroConcept = React.forwardRef(({ embedded = false }, ref) => {
  const [receptionists, setReceptionists] = useState([]);

  useEffect(() => {
    const fetchHeroReceptionists = async () => {
      const { data, error } = await supabase
        .from('receptionist_catalog')
        .select('*')
        .not('showcase_in_hero', 'is', null)
        .order('showcase_in_hero', { ascending: true });

      if (!error && data) {
        setReceptionists(data.map((r, i) => ({
          id: r.id,
          name: r.first_name || r.full_name,
          fullName: r.full_name,
          role: r.stereotype || 'Receptionist',
          stereotype: r.stereotype,
          description: r.description,
          traits: r.traits || [],
          avatar: r.hero_avatar || r.avatar,
          voice: r.voice,
        })));
      }
    };
    fetchHeroReceptionists();
  }, []);

  return (
    <>
      {receptionists.length > 0 && (
        <HeroSlider ref={ref} receptionists={receptionists} embedded={embedded} />
      )}

      {receptionists.length === 0 && (
        <div ref={ref} className="relative bg-black" style={{ height: embedded ? '100vh' : '130vh' }} />
      )}

      <style>{`
        @keyframes miami-flow {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }

        @keyframes voice-button-glow {
          0%, 100% { opacity: 0.62; transform: scale(0.98); }
          50% { opacity: 0.84; transform: scale(1.03); }
        }

        @keyframes voice-button-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }

        .hero-concept-edge-arrow {
          pointer-events: none;
          position: absolute;
          top: 50%;
          z-index: 25;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          color: rgba(255, 255, 255, 0.22);
          transform: translateY(-50%);
          animation: hero-edge-arrow-hover 7s ease-in-out infinite;
          filter: drop-shadow(0 0 18px rgba(255, 255, 255, 0.08));
        }

        .hero-concept-edge-arrow--left {
          left: clamp(18px, 2.8vw, 48px);
          top: 54%;
        }

        .hero-concept-edge-arrow--right {
          right: clamp(18px, 2.8vw, 48px);
          top: 54%;
          animation-delay: -3.5s;
        }

        .hero-concept-edge-arrow--compact-left,
        .hero-concept-edge-arrow--compact-right {
          display: flex;
          width: 28px;
          height: 28px;
          z-index: 20;
          color: rgba(255, 255, 255, 0.26);
        }

        .hero-concept-edge-arrow--compact-left {
          left: 12px;
        }

        .hero-concept-edge-arrow--compact-right {
          right: 12px;
          animation-delay: -3.5s;
        }

        @media (min-width: 768px) {
          .hero-concept-edge-arrow--compact-left {
            left: 32px;
          }

          .hero-concept-edge-arrow--compact-right {
            right: 32px;
          }
        }

        @keyframes hero-edge-arrow-hover {
          0%, 100% { transform: translateY(-50%) translateX(0); }
          50% { transform: translateY(calc(-50% - 2px)) translateX(0); }
        }
      `}</style>
    </>
  );
});

export default HeroConcept;
