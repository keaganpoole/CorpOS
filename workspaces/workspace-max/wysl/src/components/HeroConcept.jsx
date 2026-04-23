import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';

const RECEPTIONISTS = [
  {
    id: 'bonnie',
    name: 'Bonnie',
    role: 'Executive Concierge',
    stereotype: 'The Professional',
    age: '30',
    traits: ['Precise', 'Elite', 'Reliable'],
    voiceName: 'Leda',
    color: '#818cf8',
    image: "https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/bonnie_transparent2.png"
  },
  {
    id: 'maggie',
    name: 'Maggie',
    role: 'Technical Support',
    stereotype: 'The Sweetheart',
    age: '28',
    traits: ['Kind', 'Approachable', 'Sincere'],
    voiceName: 'Kore',
    color: '#2dd4bf',
    image: "https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/maggie_transparent8.png"
  },
  {
    id: 'brian',
    name: 'Brian',
    role: 'Enterprise Relations',
    stereotype: 'The Stabilizer',
    age: '32',
    traits: ['Calm', 'Grounded', 'Reassuring'],
    voiceName: 'Fenrir',
    color: '#60a5fa',
    image: "https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/brian_transparent4.png"
  },
  {
    id: 'kayla',
    name: 'Kayla',
    role: 'Creative Logistics',
    stereotype: 'The Strategist',
    age: '29',
    traits: ['Creative', 'Sharp', 'Vibrant'],
    voiceName: 'Aoede',
    color: '#a78bfa',
    image: "https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/kayla_transparent.png"
  },
  {
    id: 'nikki',
    name: 'Nikki',
    role: 'Premium Sales',
    stereotype: 'The Executor',
    age: '42',
    traits: ['Direct', 'Confident', 'Authoritative'],
    voiceName: 'Callirrhoe',
    color: '#f472b6',
    image: "https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/nikki_transparent4.png"
  },
  {
    id: 'kyle',
    name: 'Kyle',
    role: 'Strategic Support',
    stereotype: 'The Bro',
    age: '23',
    traits: ['Fun', 'Energetic', 'Free-spirit'],
    voiceName: 'Puck',
    color: '#fbbf24',
    image: "https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/kyle_transparent.png"
  }
];

const HeroConcept = React.forwardRef((props, ref) => {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const autoPlayRef = useRef(null);
  const innerRef = useRef(null);
  const wrapperRef = ref || innerRef;

  // Track scroll relative to this wrapper — gives us 0→1 as user scrolls past the hero
  const { scrollYProgress } = useScroll({
    target: innerRef,
    offset: ["start start", "end start"]
  });

  // Cinematic zoom — starts immediately, accelerates smoothly
  const scale = useTransform(
    scrollYProgress,
    [0, 0.15, 0.4, 0.7, 1],
    [1, 1.03, 1.08, 1.18, 1.3]
  );
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.4, 0.7, 1],
    [1, 1, 0.6, 0]
  );
  const motionBlur = useTransform(
    scrollYProgress,
    [0.3, 0.8, 1],
    [0, 4, 10]
  );
  const backdropBlur = useTransform(
    scrollYProgress,
    [0.4, 0.9],
    [0, 20]
  );
  const backdropOpacity = useTransform(
    scrollYProgress,
    [0.3, 0.7],
    [0, 0.3]
  );

  const active = RECEPTIONISTS[index];

  const nextSlide = () => {
    setDirection(1);
    setIndex((prev) => (prev + 1) % RECEPTIONISTS.length);
  };

  useEffect(() => {
    autoPlayRef.current = setInterval(nextSlide, 6000);
    return () => clearInterval(autoPlayRef.current);
  }, []);

  return (
    <>
      {/* Hero wrapper — this is the scroll anchor */}
      <div ref={wrapperRef} className="relative" style={{ height: '130vh' }}>
        {/* Sticky viewport-filling hero */}
        <div ref={innerRef} className="sticky top-0 h-screen overflow-hidden">
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
              {/* Left: Concept content — all nested as one unit */}
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

                      {/* Name — hero headline */}
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

                      {/* Description — nested inside same unit */}
                      <p className="text-base lg:text-lg text-white/60 leading-relaxed max-w-md font-light">
                        Your AI-powered {active.role.toLowerCase()} — {active.traits.map(t => t.toLowerCase()).join(', ')}.
                        Answers every call, handles bookings, and represents your business with precision.
                      </p>

                      {/* Scroll indicator under description */}
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
                      src={active.image}
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
                {RECEPTIONISTS.map((_, i) => (
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
