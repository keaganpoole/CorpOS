import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const TIMELINE = [
  {
    id: 'mon',
    day: 'Monday',
    time: '08:32 AM',
    scenario: 'Calls Out Sick',
    human: 'Last minute call-out',
    ai: 'Never misses a day.',
    netTime: 8,
    netRev: 400
  },
  {
    id: 'tue',
    day: 'Tuesday',
    time: '12:03 PM',
    scenario: 'Breaks & Time Off',
    human: "Language barrier",
    ai: "Speaks caller's language fluently",
    netTime: 0.4,
    netRev: 240
  },
  {
    id: 'wed',
    day: 'Wednesday',
    time: '10:41 AM',
    scenario: 'Busy Phone Lines',
    human: 'Puts callers on hold',
    ai: 'Talks to callers simultaneously.',
    netTime: 1,
    netRev: 320
  },
  {
    id: 'thu',
    day: 'Thursday',
    time: '02:17 PM',
    scenario: 'Missed Opportunities',
    human: 'Spends afternoon following up',
    ai: 'Follows up automatically',
    netTime: 5,
    netRev: 275
  },
  {
    id: 'fri',
    day: 'Friday',
    time: '03:48 PM',
    scenario: 'Routine Tasks',
    human: 'Spends hours on repetitive work.',
    ai: 'Follows up automatically',
    netTime: 0.67,
    netRev: 180
  },
  {
    id: 'sat',
    day: 'Saturday',
    time: '04:58 PM',
    scenario: 'After Hours',
    human: 'Clocked out for the day',
    ai: 'Answers calls throughout the night',
    netTime: 0.33,
    netRev: 350
  },
  {
    id: 'sun',
    day: 'Sunday',
    time: '09:14 AM',
    scenario: 'Hiring & Turnover',
    human: 'Not scheduled',
    ai: '5 more appointments booked',
    netTime: 3.5,
    netRev: 1240
  }
];

const AnimatedStat = ({
  value,
  prefix = '',
  suffix = '',
  label,
  colorClass = 'text-white',
  shouldReveal = true,
  align = 'start',
  valueWidthClass = 'min-w-[7ch]'
}) => {
  const [display, setDisplay] = useState(0);
  const alignmentClass =
    align === 'end'
      ? 'items-center text-center md:items-end md:text-right'
      : 'items-center text-center md:items-start md:text-left';

  useEffect(() => {
    if (!shouldReveal) return undefined;

    let startTime;
    const startValue = display;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;

      const progress = Math.min((currentTime - startTime) / 1000, 1);
      const ease = 1 - Math.pow(1 - progress, 4);

      setDisplay(
        Math.round((startValue + (value - startValue) * ease) * 100) / 100
      );

      if (progress < 1) requestAnimationFrame(animate);
    };

    const frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [value, shouldReveal]);

  return (
    <motion.div
      className={`flex flex-col ${alignmentClass}`}
      initial={false}
      animate={shouldReveal ? 'visible' : 'hidden'}
      variants={{
        hidden: {
          opacity: 0,
          y: -18,
          scale: 0.96,
          filter: 'blur(12px)'
        },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          transition: {
            duration: 0.75,
            ease: [0.16, 1, 0.3, 1]
          }
        }
      }}
    >
      <span className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/30 md:text-xs">
        {label}
      </span>

      <span
        className={`${valueWidthClass} inline-block text-3xl font-light tracking-tighter tabular-nums md:text-5xl ${align === 'end' ? 'text-right' : 'text-left'} ${colorClass}`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {prefix}
        {display}
        {suffix}
      </span>
    </motion.div>
  );
};

const cascadeVariants = {
  initial: {
    opacity: 0
  },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.1
    }
  }
};

const textVariants = {
  initial: {
    opacity: 0,
    y: 15,
    filter: 'blur(10px)'
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1]
    }
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: 'blur(10px)',
    transition: {
      duration: 0.15
    }
  }
};

const statementVariants = {
  human: {
    initial: {
      opacity: 0,
      y: 15,
      filter: 'blur(10px)'
    },
    animate: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        delay: 0,
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1]
      }
    },
    exit: {
      opacity: 0,
      y: -10,
      filter: 'blur(10px)',
      transition: {
        duration: 0.15
      }
    }
  },
  ai: {
    initial: {
      opacity: 0,
      y: 15,
      filter: 'blur(10px)'
    },
    animate: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        delay: 0.15,
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1]
      }
    },
    exit: {
      opacity: 0,
      y: -10,
      filter: 'blur(10px)',
      transition: {
        duration: 0.15
      }
    }
  }
};

export default function WorkWeekComparison({
  scrollStep = null,
  scrollDirection = 0,
  comparisonActive = true
}) {
  const [[step, direction], setPage] = useState([0, 0]);
  const [stats, setStats] = useState({
    time: 0,
    rev: 0
  });
  const [datePhase, setDatePhase] = useState('hidden');
  const [contentReveal, setContentReveal] = useState(false);
  const [statsReveal, setStatsReveal] = useState(false);

  const stepRef = useRef(0);
  const isScrollingRef = useRef(false);
  const containerRef = useRef(null);

  const isScrollDriven = scrollStep !== null;
  const activeStep = isScrollDriven ? scrollStep : step;
  const activeDirection = isScrollDriven ? scrollDirection : direction;
  const current = TIMELINE[activeStep];

  useEffect(() => {
    setDatePhase('hidden');
    setContentReveal(false);
    setStatsReveal(false);

    if (!comparisonActive) return undefined;

    const dateCenterTimer = window.setTimeout(
      () => setDatePhase('centered'),
      120
    );

    const dateLiftTimer = window.setTimeout(
      () => setDatePhase('lifted'),
      920
    );

    const contentTimer = window.setTimeout(
      () => setContentReveal(true),
      1320
    );

    const statsTimer = window.setTimeout(
      () => setStatsReveal(true),
      1900
    );

    return () => {
      window.clearTimeout(dateCenterTimer);
      window.clearTimeout(dateLiftTimer);
      window.clearTimeout(contentTimer);
      window.clearTimeout(statsTimer);
    };
  }, [comparisonActive]);

  useEffect(() => {
    stepRef.current = activeStep;

    setStats(
      TIMELINE.slice(0, activeStep + 1).reduce(
        (totals, item) => ({
          time: totals.time + item.netTime,
          rev: totals.rev + item.netRev
        }),
        {
          time: 0,
          rev: 0
        }
      )
    );
  }, [activeStep]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return undefined;
    if (isScrollDriven) return undefined;

    const paginate = (newDirection) => {
      const nextStep = stepRef.current + newDirection;

      if (nextStep < 0 || nextStep >= TIMELINE.length) return;

      isScrollingRef.current = true;
      setPage([nextStep, newDirection]);

      window.setTimeout(() => {
        isScrollingRef.current = false;
      }, 150);
    };

    const handleWheel = (event) => {
      if (
        (event.deltaY > 0 &&
          stepRef.current === TIMELINE.length - 1) ||
        (event.deltaY < 0 && stepRef.current === 0)
      ) {
        return;
      }

      event.preventDefault();

      if (
        !isScrollingRef.current &&
        Math.abs(event.deltaY) > 20
      ) {
        paginate(event.deltaY > 0 ? 1 : -1);
      }
    };

    let touchStartY = 0;

    const handleTouchStart = (event) => {
      touchStartY = event.touches[0].clientY;
    };

    const handleTouchMove = (event) => {
      const diff = touchStartY - event.touches[0].clientY;

      if (
        (diff > 0 &&
          stepRef.current === TIMELINE.length - 1) ||
        (diff < 0 && stepRef.current === 0)
      ) {
        return;
      }

      event.preventDefault();

      if (
        !isScrollingRef.current &&
        Math.abs(diff) > 40
      ) {
        paginate(diff > 0 ? 1 : -1);
      }
    };

    const handleKeyDown = (event) => {
      const rect = container.getBoundingClientRect();
      const isActive =
        rect.top < window.innerHeight && rect.bottom > 0;

      if (!isActive || isScrollingRef.current) return;

      if (
        event.key === 'ArrowRight' ||
        event.key === 'ArrowDown' ||
        event.key === ' '
      ) {
        if (stepRef.current < TIMELINE.length - 1) {
          event.preventDefault();
        }

        paginate(1);
      } else if (
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowUp'
      ) {
        if (stepRef.current > 0) {
          event.preventDefault();
        }

        paginate(-1);
      }
    };

    container.addEventListener('wheel', handleWheel, {
      passive: false
    });

    container.addEventListener('touchstart', handleTouchStart, {
      passive: false
    });

    container.addEventListener('touchmove', handleTouchMove, {
      passive: false
    });

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener(
        'touchstart',
        handleTouchStart
      );
      container.removeEventListener(
        'touchmove',
        handleTouchMove
      );
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isScrollDriven]);

  const timePickerVariants = {
    enter: (dir) => ({
      y: dir > 0 ? 30 : -30,
      opacity: 0,
      rotateX: dir > 0 ? -45 : 45,
      filter: 'blur(4px)'
    }),
    center: {
      y: 0,
      opacity: 1,
      rotateX: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1]
      }
    },
    exit: (dir) => ({
      y: dir < 0 ? 30 : -30,
      opacity: 0,
      rotateX: dir < 0 ? -45 : 45,
      filter: 'blur(4px)',
      transition: {
        duration: 0.15,
        ease: [0.22, 1, 0.36, 1]
      }
    })
  };

  return (
    <div
      ref={containerRef}
      className="comparison-section relative flex h-[100dvh] flex-col overflow-hidden bg-[#050505] font-sans text-white selection:bg-white selection:text-black"
    >
      <header className="pointer-events-none absolute left-0 top-0 z-50 flex w-full items-start justify-between p-8 md:p-12">
        <div className="pointer-events-auto">
          <AnimatedStat
            value={stats.time}
            suffix=" hrs"
            label="Time Saved"
            shouldReveal={statsReveal}
          />
        </div>

        <div className="pointer-events-auto">
          <AnimatedStat
            value={stats.rev}
            prefix="+$"
            label="Revenue Saved"
            colorClass="text-[#34C759]"
            shouldReveal={statsReveal}
            align="end"
            valueWidthClass="min-w-[8.5ch]"
          />
        </div>
      </header>

      <main className="relative flex h-full w-full flex-col justify-center px-8 md:px-24">
        <div
          className="absolute inset-y-0 left-0 z-20 w-1/4 cursor-w-resize"
          onClick={() =>
            !isScrollDriven &&
            !isScrollingRef.current &&
            step > 0 &&
            setPage([step - 1, -1])
          }
        />

        <div
          className="absolute inset-y-0 right-0 z-20 w-3/4 cursor-e-resize"
          onClick={() =>
            !isScrollDriven &&
            !isScrollingRef.current &&
            step < TIMELINE.length - 1 &&
            setPage([step + 1, 1])
          }
        />

        <motion.div
          className="pointer-events-none relative z-10 mb-12 flex h-20 w-full items-center justify-center"
          initial={false}
          animate={datePhase}
          variants={{
            hidden: {
              y: 118,
              opacity: 0,
              scale: 1.08,
              filter: 'blur(16px)'
            },
            centered: {
              y: 118,
              opacity: 1,
              scale: 1.08,
              filter: 'blur(0px)',
              transition: {
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1]
              }
            },
            lifted: {
              y: 0,
              opacity: 1,
              scale: 1,
              filter: 'blur(0px)',
              transition: {
                duration: 0.95,
                ease: [0.16, 1, 0.3, 1]
              }
            }
          }}
          style={{
            transformStyle: 'preserve-3d',
            perspective: '1000px'
          }}
        >
          <AnimatePresence
            custom={activeDirection}
            mode="popLayout"
          >
            <motion.div
              key={`${current.id}-time`}
              custom={activeDirection}
              variants={timePickerVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute flex flex-col items-center gap-1"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/20">
                {current.day}
              </span>

              <span className="text-xs font-light tracking-[0.1em] text-white/40">
                {current.time}
              </span>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div
          variants={cascadeVariants}
          initial="initial"
          animate={contentReveal ? 'animate' : 'initial'}
          className="pointer-events-none relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-12 lg:flex-row lg:items-start lg:gap-24"
        >
          <div className="flex w-full flex-1 flex-col items-center text-center lg:items-end lg:text-right">
            <motion.span
              variants={textVariants}
              className="mb-4 text-[10px] uppercase tracking-[0.2em] text-white/20 lg:mb-6"
            >
              Human Receptionist
            </motion.span>

            <AnimatePresence mode="wait">
              <motion.p
                key={`${current.id}-human`}
                variants={statementVariants.human}
                initial="initial"
                animate={
                  contentReveal ? 'animate' : 'initial'
                }
                exit="exit"
                className="comparison-human-statement text-3xl font-light leading-snug text-white/40 lg:text-5xl"
              >
                {current.human}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="flex w-full flex-1 flex-col items-center text-center lg:items-start lg:text-left">
            <motion.span
              variants={textVariants}
              className="mb-4 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35 lg:mb-6"
            >
              <span className="bg-gradient-to-r from-[var(--brandGradientStart)] to-[var(--brandGradientEnd)] bg-clip-text text-transparent drop-shadow-[0_0_10px_color-mix(in_srgb,var(--brandGradientStart)_28%,transparent)]">
                Nodemere
              </span>{' '}
              AI Receptionist
            </motion.span>

            <AnimatePresence mode="wait">
              <motion.p
                key={`${current.id}-ai`}
                variants={statementVariants.ai}
                initial="initial"
                animate={
                  contentReveal ? 'animate' : 'initial'
                }
                exit="exit"
                className="comparison-ai-statement text-3xl font-medium leading-snug text-white lg:text-5xl"
              >
                {current.ai}

                <svg
                  className="-mt-2 ml-1 inline-block h-6 w-6 shrink-0 align-middle lg:h-8 lg:w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={3}
                >
                  <defs>
                    <linearGradient
                      id="comparison-check-gradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--brandGradientStart)"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--brandGradientEnd)"
                      />
                    </linearGradient>
                  </defs>

                  <path
                    stroke="url(#comparison-check-gradient)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>
      </main>

      <div className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-widest text-white/10">
        Results may vary.
      </div>
    </div>
  );
}
