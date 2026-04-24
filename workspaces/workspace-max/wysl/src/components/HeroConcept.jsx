import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const PALETTE = ['#818cf8', '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c', '#34d399'];

const HeroSlider = React.forwardRef(({ receptionists }, ref) => {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPlaying, setIsPlaying] = useState(null);
  const [isHoveringVoice, setIsHoveringVoice] = useState(false);
  const autoPlayRef = useRef(null);
  const audioRef = useRef(null);
  const innerRef = useRef(null);
  const shouldPause = isPlaying !== null || isHoveringVoice;

  const { scrollY } = useScroll();
  const heroHeight = typeof window !== 'undefined' ? window.innerHeight * 1.3 : 1300;
  const scrollYProgress = useTransform(scrollY, [0, heroHeight], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.15, 0.4, 0.7, 1], [1, 1.03, 1.08, 1.18, 1.3]);
  const opacity = useTransform(scrollYProgress, [0, 0.4, 0.7, 1], [1, 1, 0.6, 0]);
  const motionBlur = useTransform(scrollYProgress, [0.3, 0.8, 1], [0, 4, 10]);
  const backdropBlur = useTransform(scrollYProgress, [0.4, 0.9], [0, 20]);
  const backdropOpacity = useTransform(scrollYProgress, [0.3, 0.7], [0, 0.3]);

  const active = receptionists[index] || receptionists[0];

  const nextSlide = () => {
    setDirection(1);
    setIndex((prev) => (prev + 1) % receptionists.length);
  };

  useEffect(() => {
    if (shouldPause) {
      clearInterval(autoPlayRef.current);
      return;
    }
    autoPlayRef.current = setInterval(nextSlide, 6000);
    return () => clearInterval(autoPlayRef.current);
  }, [receptionists.length, shouldPause]);

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

  return (
    <div ref={ref} className="relative" style={{ height: '130vh' }}>
      <div ref={(el) => { innerRef.current = el; if (ref) ref.current = el; }} className="sticky top-0 h-screen overflow-hidden">
        <motion.div
          style={{ scale, opacity, filter: useTransform(motionBlur, v => `blur(${v}px)`) }}
          className="relative w-full h-full bg-black origin-bottom"
        >
          {/* Glassmorphism overlay on scroll */}
          <motion.div
            style={{
              opacity: backdropOpacity,
              backdropFilter: useTransform(backdropBlur, v => `blur(${v}px)`),
              WebkitBackdropFilter: useTransform(backdropBlur, v => `blur(${v}px)`),
            }}
            className="absolute inset-0 bg-white/[0.05] z-20 pointer-events-none"
          />

          {/* Background ambient glow */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id + '-ambient'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 75% 50%, ${active.color} 0%, rgba(0, 0, 0, 0) 70%)`
              }}
            />
          </AnimatePresence>

          {/* Dot grid overlay */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:48px_48px]" />

          <div className="relative h-full max-w-7xl mx-auto px-8 lg:px-20 flex items-center">
            {/* Left: Concept content */}
            <div className="relative z-30 w-full lg:w-1/2 flex items-center">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={active.id + '-content'}
                  custom={direction}
                  initial={{ opacity: 0, x: -30, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
                  transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
                  className="w-full"
                >
                  <div className="flex flex-col items-start gap-6">
                    {/* Position / Meta */}
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-start">
                        <p className="text-[10px] tracking-[0.3em] font-black uppercase text-white/40 mb-1">Position</p>
                        <p className="text-sm font-medium tracking-wide text-white">{active.role}</p>
                      </div>
                      <div className="w-[1px] h-8 bg-white/10" />
                      <div className="flex flex-col items-start">
                        <p className="text-[10px] tracking-[0.3em] font-black uppercase text-white/40 mb-1">Vibe</p>
                        <p className="text-sm font-medium tracking-wide text-white">{active.stereotype}</p>
                      </div>
                    </div>

                    {/* Name */}
                    <h1
                      className="hero-concept-name"
                      style={{
                        fontSize: 'clamp(5rem, 12vw, 11rem)',
                        lineHeight: 0.8,
                        letterSpacing: '-0.04em',
                        fontWeight: 400,
                        background: `linear-gradient(to right, ${active.color}, #ff1493, #9400d3, ${active.color})`,
                        backgroundSize: '200% auto',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: 'miami-flow 8s linear infinite',
                        margin: 0,
                      }}
                    >
                      {active.name}
                    </h1>

                    {/* Traits */}
                    <div className="flex items-center gap-4 text-[10px] font-black tracking-[0.2em] uppercase text-white/50">
                      {active.traits.map((trait, i) => (
                        <React.Fragment key={i}>
                          <span>{trait}</span>
                          {i < active.traits.length - 1 && <span className="opacity-40">•</span>}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Description */}
                    {active.description && (
                      <p className="text-base lg:text-lg text-white/60 leading-relaxed max-w-md font-light">
                        {active.description}
                      </p>
                    )}

                    {/* Voice preview */}
                    {active.voice && (
                      <button
                        onClick={() => playVoice(active.voice, active.id)}
                        onMouseEnter={() => setIsHoveringVoice(true)}
                        onMouseLeave={() => setIsHoveringVoice(false)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-full hover:bg-white/[0.12] transition-all cursor-pointer"
                      >
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
                        <span className="text-[10px] font-bold tracking-widest uppercase text-white/80">
                          {isPlaying === active.id ? 'Pause' : 'Preview Voice'}
                        </span>
                      </button>
                    )}

                    {/* Scroll indicator */}
                    <motion.div
                      style={{ opacity: useTransform(scrollYProgress, [0, 0.15], [1, 0]) }}
                      className="flex flex-col items-start gap-2 pointer-events-none mt-4"
                    >
                      <p className="text-[10px] tracking-[0.3em] uppercase text-white/30 font-bold">Scroll</p>
                      <div className="w-[1px] h-8 bg-gradient-to-b from-white/30 to-transparent animate-pulse" />
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right: Character visual */}
            <div className="hidden lg:flex absolute right-0 top-0 bottom-0 w-[55%] items-end justify-center pointer-events-none">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id + '-visual'}
                  initial={{ opacity: 0, scale: 0.95, x: 50 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 1.05, filter: 'blur(40px)' }}
                  transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
                  className="relative w-full h-[90%] flex items-end justify-center"
                >
                  <img
                    src={active.avatar}
                    alt={active.name}
                    className="h-full w-auto object-contain object-bottom select-none z-10"
                  />
                  <div
                    className="absolute bottom-[10%] -z-10 blur-[150px] opacity-20 rounded-full w-[60%] aspect-square"
                    style={{ backgroundColor: active.color }}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Navigation dots */}
          <div className="absolute bottom-8 inset-x-8 lg:inset-x-20 max-w-7xl mx-auto flex items-center z-50">
            <div className="flex items-center gap-2">
              {receptionists.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setDirection(i > index ? 1 : -1);
                    setIndex(i);
                  }}
                  className={`h-0.5 rounded-full transition-all duration-500 relative overflow-hidden cursor-pointer ${
                    i === index ? 'w-16 bg-white/20' : 'w-3 bg-white/10 hover:bg-white/30'
                  }`}
                >
                  {i === index && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 6, ease: "linear" }}
                      className="absolute inset-0 bg-white"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
});

const HeroConcept = React.forwardRef((props, ref) => {
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
          color: PALETTE[i % PALETTE.length],
        })));
      }
    };
    fetchHeroReceptionists();
  }, []);

  return (
    <>
      {/* Render hero only when data is ready */}
      {receptionists.length > 0 && (
        <HeroSlider ref={ref} receptionists={receptionists} />
      )}

      {/* Loading placeholder */}
      {receptionists.length === 0 && (
        <div ref={ref} className="relative bg-black" style={{ height: '130vh' }} />
      )}

      <style>{`
        @keyframes miami-flow {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </>
  );
});

export default HeroConcept;
