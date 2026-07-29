// HomePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import useLegacyAnimation from '../hooks/useLegacyAnimation';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { CreditCard, FileUp, Globe2, Menu as MenuIcon, MessagesSquare, Phone, PhoneOutgoing, ShieldCheck, X as XIcon, ArrowRight, Check } from 'lucide-react';
import SplashScreen from '../components/SplashScreen';
import { getCookie } from '../utils/cookieUtils';
import '../styles/HomePage.css';
import logoImage from '@/assets/logo.png';

import ph1 from '@/assets/ph1.png';
import ph2 from '@/assets/ph2.png';
import ph3 from '@/assets/ph3.png';
import phonehelper1 from '@/assets/phonehelper1.png';
import phonehelper2 from '@/assets/phonehelper2.png';

import pgg1 from '@/assets/pgg1.png';
import pgg20 from '@/assets/pgg20.png';
import pgg3 from '@/assets/pgg3.png';
import pgg4 from '@/assets/pgg4.png';
import pgg5 from '@/assets/pgg5.png';
import pgg6 from '@/assets/pgg6.png';
import pgg7 from '@/assets/pgg7.png';
import slimYahoo from '@/assets/t1-slim-yahoo.png';
import slimHulu from '@/assets/t1-slim-hulu.png';
import slimChime from '@/assets/t1-slim-chime.png';
import slimBumble from '@/assets/t1-slim-bumble.png';
import slimVerizon from '@/assets/t2-slim-verizon.png';
import slimFacebook from '@/assets/t-slim-facebook.png';
import expandedAmazon from '@/assets/t1-expanded-amazon.png';
import expandedAnniversary from '@/assets/t1-expanded-anniversary.png';
import expandedBirthday from '@/assets/t1-expanded-birthday.png';
import expandedNetflix from '@/assets/t1-expanded-netflix.png';
import expandedPhonepassword from '@/assets/t1-expanded-phonepassword.png';
import expandedPlaystation from '@/assets/t1-expanded-playstation.png';
import expandedSnapcha from '@/assets/t1-expanded-snapcha.png';
import expandedSpectrum from '@/assets/t1-expanded-spectrum.png';
import expandedTicketmaster from '@/assets/t1-expanded-ticketmaster.png';
import expandedWifi from '@/assets/t1-expanded-wifi.png';
import expandedX from '@/assets/t1-expanded-x.png';
import TypingAnimation from '../components/TypingAnimation';
import HeroConcept from '../components/HeroConcept';
import CalendarShowcase, { RightFeatureList } from '../components/CalendarShowcase';
import WorkWeekComparison from '../components/WorkWeekComparison';
import { trackVisitor } from '../services/apiService';

const NUMBER_ICON_MASKS = {
  transfer: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14.5 5.5a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 1 1-1.06-1.06L16.47 10.5H8.5a.75.75 0 0 1 0-1.5h7.97l-1.97-1.97a.75.75 0 0 1 0-1.06Zm-5 8a.75.75 0 0 1 1.06 0A.75.75 0 0 1 10 14.56l-1.97 1.97H16a.75.75 0 0 1 0 1.5H8.03L10 19.97a.75.75 0 1 1-1.06 1.06L5.69 17.78a.75.75 0 0 1 0-1.06l3.81-3.81Z"/></svg>')}`,
  plus: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5Zm0 4.25a.75.75 0 0 1 .75.75v3.25H16a.75.75 0 0 1 0 1.5h-3.25V15a.75.75 0 0 1-1.5 0v-3.25H8a.75.75 0 0 1 0-1.5h3.25V7.25A.75.75 0 0 1 12 6.5Z"/></svg>')}`,
};

const NumberGradientIcon = ({ icon = 'transfer', colors = ['var(--brandGradientStart)', 'var(--brandGradientEnd)'] }) => {
  const iconMask = NUMBER_ICON_MASKS[icon] || NUMBER_ICON_MASKS.transfer;

  return (
    <span
      aria-hidden="true"
      className="number-gradient-icon"
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
};

const HERO_RECEPTIONIST_FEATURE_ITEMS = [
  {
    icon: <Phone className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:stroke-pink-300" />,
    colorClass: 'bg-cyan-400',
    glowClass: 'shadow-[0_0_12px_rgba(34,211,238,0.6)]',
    hoverTextClass: 'group-hover:text-pink-400',
    accentColor: '#f472b6',
    title: '24/7 Call Handling',
    copy: 'Answer inbound calls instantly, day or night, so customers reach your business instead of voicemail.',
  },
  {
    icon: <ShieldCheck className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110 group-hover:stroke-emerald-300" />,
    colorClass: 'bg-emerald-500',
    glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]',
    hoverTextClass: 'group-hover:text-emerald-400',
    title: 'Secure Verification',
    copy: 'Optionally send authentication links during inbound calls so customers can verify identity before account details or account changes are handled.',
  },
  {
    icon: <FileUp className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:stroke-amber-300" />,
    colorClass: 'bg-amber-400',
    glowClass: 'shadow-[0_0_12px_rgba(251,191,36,0.6)]',
    hoverTextClass: 'group-hover:text-amber-400',
    title: 'Real-time Docs',
    copy: 'Allow customers to securely upload documents by texting them a secure upload link during the call, eliminating the need to email files or call back later.',
  },
  {
    icon: <CreditCard className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-3 group-hover:stroke-pink-300" />,
    colorClass: 'bg-blue-500',
    glowClass: 'shadow-[0_0_12px_rgba(59,130,246,0.6)]',
    hoverTextClass: 'group-hover:text-pink-400',
    accentColor: '#f472b6',
    title: 'Payments',
    copy: 'Collect deposits, send payment links, process payments, and answer billing questions without handing the call to staff.',
  },
  {
    icon: <PhoneOutgoing className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:stroke-rose-300" />,
    colorClass: 'bg-rose-500',
    glowClass: 'shadow-[0_0_12px_rgba(244,63,94,0.6)]',
    hoverTextClass: 'group-hover:text-rose-400',
    title: 'Outbound Calling',
    copy: 'Have your AI receptionist place calls for reminders, confirmations, updates, and any custom tasks you desire, without tying up your team.',
  },
  {
    icon: <MessagesSquare className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110 group-hover:stroke-violet-300" />,
    colorClass: 'bg-violet-500',
    glowClass: 'shadow-[0_0_12px_rgba(139,92,246,0.6)]',
    hoverTextClass: 'group-hover:text-violet-400',
    title: 'Multiple Conversations',
    copy: 'Handle multiple conversations simultaneously, making hold queues virtually nonexistent.',
  },
  {
    icon: <Globe2 className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-12 group-hover:stroke-indigo-300" />,
    colorClass: 'bg-indigo-400',
    glowClass: 'shadow-[0_0_12px_rgba(129,140,248,0.6)]',
    hoverTextClass: 'group-hover:text-indigo-400',
    title: '70+ Languages',
    copy: "Detect a caller's language automatically and respond naturally without transfers, translators, or awkward misunderstandings.",
  },
];

const FadingImageCollage = ({ images }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0.25 });

  useEffect(() => {
    if (!isInView || images.length <= 1) return undefined;

    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [images.length, isInView]);

  return (
    <div ref={ref} className="relative w-full h-full overflow-hidden">
      {images.map((image, index) => (
        <motion.img
          key={index}
          src={image}
          alt="Collage image"
          className="absolute inset-0 w-full h-full object-contain"
          initial={{ opacity: 0 }}
          animate={{ opacity: index === currentImageIndex ? 1 : 0 }}
          transition={{ duration: 3.0, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
};
const AnimatedImageGrid = ({ images }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.8 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 100, damping: 10 } },
  };

  return (
    <motion.div
      ref={ref}
      className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-x-1 gap-y-4 justify-items-center mx-auto max-w-[680px]"
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {images.map((src, index) => (
        <motion.img
          key={index}
          src={src}
          alt={`Screenshot ${index + 1}`}
          className="w-full max-w-xs rounded-lg shadow-2xl drop-shadow-lg"
          variants={itemVariants}
          style={{ boxShadow: '0 10px 20px rgba(0,0,0,0.4), 0 6px 6px rgba(0,0,0,0.2)' }}
        />
      ))}
    </motion.div>
  );
};

const CyclingImageGrid = ({ allExpandedImages }) => {
  const getRandomImages = (images, count) => {
    const shuffled = [...images].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [displayedImages, setDisplayedImages] = useState(() => {
    const initialImageCount = window.innerWidth < 768 ? 1 : 2;
    return getRandomImages(allExpandedImages, initialImageCount);
  });
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      const imageCount = mobile ? 1 : 2;
      if (displayedImages.length !== imageCount) {
        setDisplayedImages(getRandomImages(allExpandedImages, imageCount));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [allExpandedImages, displayedImages.length]);

  useEffect(() => {
    if (isInView && allExpandedImages.length > 0) {
      const imageCount = isMobile ? 1 : 2;
      if (displayedImages.length === 0 || displayedImages.length !== imageCount) {
        setDisplayedImages(getRandomImages(allExpandedImages, imageCount));
      }

      const interval = setInterval(() => {
        setDisplayedImages(getRandomImages(allExpandedImages, imageCount));
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isInView, allExpandedImages, isMobile, displayedImages.length]);

  const imageVariants = {
    enter: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 100, damping: 10 } },
    exit: { opacity: 0, y: -50, scale: 0.8, transition: { duration: 0.5 } },
  };

  return (
    <motion.div
      ref={ref}
      className={`mt-12 grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-x-1 gap-y-4 justify-items-center mx-auto max-w-[680px] relative h-[200px]`}
    >
      <div className="relative w-full max-w-xs h-full">
        <AnimatePresence initial={false}>
          {displayedImages[0] && (
            <motion.img
              key={displayedImages[0]}
              src={displayedImages[0]}
              alt="Cycling Screenshot 1"
              className="absolute inset-0 w-full h-full object-contain rounded-lg shadow-2xl drop-shadow-lg max-w-sm"
              variants={imageVariants}
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate="enter"
              exit="exit"
              style={{ boxShadow: '0 10px 20px rgba(0,0,0,0.4), 0 6px 6px rgba(0,0,0,0.2)' }}
            />
          )}
        </AnimatePresence>
      </div>

      {!isMobile && (
        <div className="relative w-full max-w-xs h-full">
          <AnimatePresence initial={false}>
            {displayedImages[1] && (
              <motion.img
                key={displayedImages[1]}
                src={displayedImages[1]}
                alt="Cycling Screenshot 2"
                className="absolute inset-0 w-full h-full object-contain rounded-lg shadow-2xl drop-shadow-lg"
                variants={imageVariants}
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                animate="enter"
                exit="exit"
                style={{ boxShadow: '0 10px 20px rgba(0,0,0,0.4), 0 6px 6px rgba(0,0,0,0.2)' }}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const StackedHeroShowcase = ({ sectionRef }) => {
  const rootRef = useRef(null);
  const stickyRef = useRef(null);
  const [sectionProgress, setSectionProgress] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let frame = null;

    const updateProgress = () => {
      frame = null;
      const rect = root.getBoundingClientRect();
      const scrollableDistance = Math.max(root.offsetHeight - window.innerHeight, 1);
      const nextProgress = clamp((-rect.top) / scrollableDistance, 0, 1);
      setSectionProgress(nextProgress);
    };

    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const heroIntroExited = sectionProgress >= 0.26;
  const receptionistEntered = sectionProgress >= 0.22;
  const heroFeaturesEntered = sectionProgress >= 0.64;
  const crmOpacity = heroIntroExited ? 0 : 1;
  const receptionistOpacity = receptionistEntered ? (heroFeaturesEntered ? 0.11 : 1) : 0;
  const receptionistBlur = heroFeaturesEntered ? 13 : 0;
  const receptionistBrightness = heroFeaturesEntered ? 0.46 : 1;
  const heroFeatureProgress = heroFeaturesEntered ? 1 : 0;
  const heroFeatureOpacity = heroFeaturesEntered ? 1 : 0;

  return (
    <div ref={(el) => { rootRef.current = el; if (sectionRef) sectionRef.current = el; }} className="relative h-[280vh] bg-[#020202]">
      <div ref={stickyRef} className="sticky top-0 h-screen overflow-hidden bg-[#020202]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.055),transparent_42%)]" />

        <div
          className={`absolute inset-0 z-20 flex items-center justify-center px-6 transition-[opacity,transform] duration-500 ease-out ${crmOpacity <= 0.01 ? 'pointer-events-none' : ''}`}
          style={{
            opacity: crmOpacity,
            visibility: crmOpacity <= 0.01 ? 'hidden' : 'visible',
            transform: `translateY(${heroIntroExited ? -12 : 0}px)`,
          }}
        >
          <div className="relative z-10 mx-auto w-full max-w-[1300px] text-center md:px-10 lg:px-12">
            <div className="mx-auto max-w-[1100px]">
              <h2 className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text pb-2 text-4xl font-black leading-[0.95] tracking-[-0.06em] text-transparent md:text-7xl lg:text-[6.2rem]">
                Meet Your AI Receptionist
              </h2>
              <div className="mx-auto mt-6 max-w-[820px] text-base font-semibold leading-[1.55] tracking-[-0.02em] text-[#d4d4d8] md:text-xl">
                Revolutionize your front desk by deploying an AI Receptionist that makes and receives calls, books appointments, processes payments, manages your CRM, and handles customers 24/7. Handle multiple conversations simultaneously with incredibly natural, human-like interactions that deliver a level of speed, availability, and consistency traditional staffing simply can't match—all at a fraction of the cost.
              </div>
            </div>
          </div>
        </div>

        <div
          className={`absolute inset-0 z-10 transition-[opacity,transform] duration-500 ease-out ${receptionistOpacity <= 0.01 ? 'pointer-events-none' : ''}`}
          style={{
            opacity: receptionistOpacity,
            visibility: receptionistOpacity <= 0.01 ? 'hidden' : 'visible',
            transform: `translateY(${receptionistEntered ? 0 : 18}px) scale(${heroFeaturesEntered ? 0.988 : 1})`,
            filter: `blur(${receptionistBlur}px) brightness(${receptionistBrightness})`,
          }}
        >
          <HeroConcept />
        </div>

        <div
          className={`absolute inset-0 z-30 flex items-center justify-center px-6 transition-[opacity,transform] duration-500 ease-out ${heroFeatureOpacity <= 0.01 ? 'pointer-events-none' : ''}`}
          style={{
            opacity: heroFeatureOpacity,
            visibility: heroFeatureOpacity <= 0.01 ? 'hidden' : 'visible',
            transform: `translateY(${heroFeaturesEntered ? 0 : 18}px)`,
          }}
        >
          <div className="mx-auto w-full max-w-[1120px]">
            <RightFeatureList
              featureProgress={heroFeatureProgress}
              items={HERO_RECEPTIONIST_FEATURE_ITEMS}
              useScrollHighlight={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const NumberOptionsShowcase = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.45 });

  return (
    <div ref={sectionRef} className="relative w-full bg-[#020202]">
      <div className="relative z-10 mx-auto flex w-full max-w-[1300px] justify-center px-6 py-24 md:px-10 lg:px-12 lg:py-28">
        <div className="grid w-full max-w-[980px] grid-cols-1 gap-16 justify-items-center lg:grid-cols-[1fr_auto_1fr] lg:gap-12 lg:items-stretch">
          <div className="w-full max-w-[24rem] text-left">
              <div className="homepage-number-pill">
                <NumberGradientIcon icon="transfer" colors={['var(--brandGradientStart)', 'var(--brandGradientEnd)']} />
                <span>Forward existing line</span>
              </div>
              <h2 className="homepage-number-title">
                Keep Your Number
              </h2>
              <div className="calendar-showcase-description mt-6 max-w-[24rem] text-[0.95rem] font-semibold leading-[1.45] tracking-[-0.02em] text-[#d4d4d8] md:text-[0.95rem]">
                Keep your existing business number and route it into CorpOS. Your customers keep calling the same line, while CorpOS answers on the other end and handles the conversation for you.
              </div>
            </div>

          <motion.div
            aria-hidden="true"
            className="pointer-events-none hidden w-px self-stretch lg:block"
            initial={{ opacity: 0, scaleY: 0.2, y: 12 }}
            animate={isInView ? { opacity: 1, scaleY: 1, y: 0 } : { opacity: 0, scaleY: 0.2, y: 12 }}
            transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
            style={{
              transformOrigin: 'center',
              height: 'calc(100% - 2rem)',
              marginTop: '1rem',
              marginBottom: '1rem',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.22), rgba(255,255,255,0.22), rgba(255,255,255,0))',
              boxShadow: '0 0 18px rgba(255,255,255,0.08)',
            }}
          />

          <div className="w-full max-w-[24rem] text-left">
              <div className="homepage-number-pill">
                <NumberGradientIcon icon="plus" colors={['var(--brandGradientStart)', 'var(--brandGradientEnd)']} />
                <span>Claim a new line</span>
              </div>
              <h2 className="homepage-number-title">
                Choose New Number
              </h2>
              <div className="calendar-showcase-description mt-6 max-w-[24rem] text-[0.95rem] font-semibold leading-[1.45] tracking-[-0.02em] text-[#d4d4d8] md:text-[0.95rem]">
                If you want a clean setup, claim a new number directly in CorpOS. It becomes your dedicated business line for calls handled by the receptionist from day one.
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

const ComparisonShowcase = () => {
  const rootRef = useRef(null);
  const previousProgressRef = useRef(0);
  const [sectionProgress, setSectionProgress] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let frame = null;
    const updateProgress = () => {
      frame = null;
      const rect = root.getBoundingClientRect();
      const scrollableDistance = Math.max(root.offsetHeight - window.innerHeight, 1);
      const nextProgress = clamp((-rect.top) / scrollableDistance, 0, 1);
      setDirection(nextProgress >= previousProgressRef.current ? 1 : -1);
      previousProgressRef.current = nextProgress;
      setSectionProgress(nextProgress);
    };

    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const introExited = sectionProgress >= 0.26;
  const comparisonProgress = clamp((sectionProgress - 0.26) / 0.74, 0, 1);
  const scrollStep = Math.min(6, Math.floor(comparisonProgress * 7));

  return (
    <section ref={rootRef} aria-labelledby="comparison-section-title" className="comparison-host content-section content-section--showcase dark-bg text-center relative h-[430vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#020202]">
        <div
          className={`absolute inset-0 z-20 flex items-center justify-center px-6 transition-[opacity,transform] duration-500 ease-out ${
            introExited ? 'pointer-events-none' : ''
          }`}
          style={{
            opacity: introExited ? 0 : 1,
            visibility: introExited ? 'hidden' : 'visible',
            transform: `translateY(${introExited ? -12 : 0}px)`,
          }}
        >
          <div className="mx-auto max-w-[860px] px-2 text-center sm:px-4">
            <h2 id="comparison-section-title" className="homepage-copy-reveal is-visible bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text pb-2 text-5xl font-black leading-[0.98] tracking-[-0.05em] text-transparent md:text-7xl lg:text-[5.8rem]">
              Human vs.
              <br />
              AI Coverage
            </h2>
            <div className="homepage-copy-reveal homepage-copy-reveal--delayed is-visible mx-auto mt-6 max-w-[760px] text-base font-semibold leading-[1.55] tracking-[-0.02em] text-[#d4d4d8] md:text-xl">
              See what a full week looks like when missed calls, forgotten follow-ups, and after-hours inquiries are handled automatically instead of falling through the cracks.
            </div>
          </div>
        </div>

        <div
          className={`absolute inset-0 z-10 transition-[opacity,transform] duration-500 ease-out ${
            !introExited ? 'pointer-events-none' : ''
          }`}
          style={{
            opacity: introExited ? 1 : 0,
            visibility: introExited ? 'visible' : 'hidden',
            transform: `translateY(${introExited ? 0 : 18}px)`,
          }}
        >
          <WorkWeekComparison scrollStep={scrollStep} scrollDirection={direction} />
        </div>
      </div>
    </section>
  );
};

const HomePage = () => {
  const [showSplash, setShowSplash] = useState(true);
  useLegacyAnimation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [navOnHero, setNavOnHero] = useState(true);
  const heroRef = useRef(null);

  useEffect(() => {
    if (!heroRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setNavOnHero(entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, []);
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasTrackedVisitor = useRef(false);

  const phoneHelperCollageImages = [phonehelper1, phonehelper2];
  const slimImages = [slimYahoo, slimHulu, slimChime, slimBumble, slimVerizon, slimFacebook];

  const allExpandedImages = [
    expandedAmazon,
    expandedAnniversary,
    expandedBirthday,
    expandedNetflix,
    expandedPhonepassword,
    expandedPlaystation,
    expandedSnapcha,
    expandedSpectrum,
    expandedTicketmaster,
    expandedWifi,
    expandedX,
  ];

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const srcParam = params.get('source');
    const path = location.pathname.toLowerCase().replace(/\/$/, '');
    
    let newSource = (getCookie('source') || 'standard').toLowerCase();
    let shouldUpdateCookie = false;

    if (srcParam) {
        const s = srcParam.toLowerCase();
        if (s === 'sales') { newSource = 'sales'; shouldUpdateCookie = true; }
        else if (['meta', 'facebook', 'instagram', 'tiktok', 'social'].includes(s)) { newSource = 'social'; shouldUpdateCookie = true; }
    } else if (path.endsWith('/ios') || path.endsWith('/android')) {
        newSource = 'sales';
        shouldUpdateCookie = true;
    }

    if (shouldUpdateCookie) {
        const d = new Date();
        d.setTime(d.getTime() + (30 * 24 * 60 * 60 * 1000));
        document.cookie = `source=${newSource}; expires=${d.toUTCString()}; path=/`;
    }
  }, [location]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1000);

    const recordVisitor = async () => {
      if (hasTrackedVisitor.current) return;
      hasTrackedVisitor.current = true;
      try {
        const userAgent = navigator.userAgent;
        await trackVisitor(userAgent);
      } catch (error) {
        console.error("Error tracking visitor:", error);
      }
    };

    recordVisitor();
    return () => clearTimeout(timer);
  }, []);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const cardImages = [pgg1, pgg20, pgg3, pgg4, pgg5, pgg6, pgg7];

  const AnimatedBeautifulText = () => {
    const word = "Reliable";
    const letters = word.split('');
    const textRef = useRef(null);
    const isInView = useInView(textRef, { once: true, amount: 0.5 });
    const [animationKey, setAnimationKey] = useState(0);

    useEffect(() => {
      if (isInView) {
        setAnimationKey(prevKey => prevKey + 1);
      }
    }, [isInView]);

    const getDelay = (index) => index * 50;

    return (
      <span ref={textRef} className="anim-text anim-vapor" key={animationKey}>
        {letters.map((letter, index) => (
          <span
            key={index}
            style={{ animationDelay: `${getDelay(index)}ms` }}
          >
            {letter === ' ' ? '\u00A0' : letter}
          </span>
        ))}
      </span>
    );
  };

  const RainingImages = () => {
    const ref = useRef(null);
    const isInView = useInView(ref, { amount: 0.2 });

    const imageVariants = {
      hidden: { y: -100, opacity: 0, rotate: 0 },
      visible: (i) => ({
        y: ["-10%", "110%"],
        x: [0, Math.random() * 400 - 200, 0],
        z: [Math.random() * -500, Math.random() * 500],
        opacity: [0, 0.7, 0.7, 0],
        scale: [0.5, 1.1, 1.1, 0.5],
        rotateX: [0, Math.random() * 40 - 20, Math.random() * 40 - 20, 0],
        rotateY: [0, Math.random() * 40 - 20, Math.random() * 40 - 20, 0],
        rotateZ: [0, Math.random() * 30 - 15, Math.random() * 30 - 15, 0],
        filter: ['blur(10px)', 'blur(0px)', 'blur(0px)', 'blur(10px)'],
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        transition: {
          delay: i * 0.2 + Math.random() * 0.5,
          duration: 12 + Math.random() * 10,
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 0,
        },
      }),
    };

    return (
      <motion.div
        ref={ref}
        className="relative w-full h-[500px] mx-auto mt-10 overflow-hidden pointer-events-none"
      >
        {isInView && cardImages.map((image, index) => (
          <motion.img
            key={index}
            src={image}
            alt={`Account screenshot ${index + 1}`}
            className="absolute"
            style={{
              zIndex: 1,
              maxWidth: '320px',
              maxHeight: '270px',
              objectFit: 'contain',
              pointerEvents: 'none',
              left: `${Math.random() * 120 - 10}%`,
              top: `-20%`,
              borderRadius: '12px',
            }}
            variants={imageVariants}
            initial="hidden"
            animate="visible"
            custom={index}
          />
        ))}
      </motion.div>
    );
  };

  return (
    <div id="myHtmlContent">
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999, pointerEvents: 'none' }}
          >
            <SplashScreen />
          </motion.div>
        )}
      </AnimatePresence>
      <div className={`header${!navOnHero ? ' is-visible' : ''}`}>
        <nav className="nav-content">
          <img src={logoImage} alt="CorpOS" className="header-logo" />

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6 ml-auto">
            <Link to="/pricing" className="text-sm font-semibold text-white hover:text-gray-300">Pricing</Link>
            {session ? (
              <>
                <button
                  onClick={async () => { await logout(); navigate('/'); }}
                  className="text-sm font-semibold text-white hover:text-gray-300"
                >
                  Logout
                </button>
                <Link to="/dashboard" className="text-sm font-semibold gradient-button btn-shine hover:opacity-90 transition-opacity">Dashboard</Link>
              </>
            ) : (
              <>
                <Link to="/auth" className="text-sm font-semibold text-white hover:text-gray-300">Login</Link>
                <Link to="/auth" state={{ isSignUp: true }} className="text-sm font-semibold gradient-button btn-shine hover:opacity-90 transition-opacity">Sign Up</Link>
              </>
            )}
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center space-x-4 ml-auto">
            {!session && (
              <Link to="/auth" state={{ isSignUp: true }} className="text-sm font-semibold gradient-button btn-shine hover:opacity-90 transition-opacity">Sign Up</Link>
            )}
            <button onClick={toggleMenu} className="text-white hover:text-gray-300 focus:outline-none">
              {isMenuOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="md:hidden absolute top-full left-0 w-full bg-[var(--color-black)] shadow-lg py-4 z-50"
            >
              <div className="flex flex-col items-center space-y-4">
                {session && (
                  <Link to="/dashboard" className="text-base font-semibold text-white hover:text-gray-300" onClick={toggleMenu}>Dashboard</Link>
                )}
                <Link to="/pricing" className="text-base font-semibold text-white hover:text-gray-300" onClick={toggleMenu}>Pricing</Link>
                {session ? (
                  <button onClick={async () => { await logout(); navigate('/'); toggleMenu(); }} className="text-base font-semibold text-white hover:text-gray-300">Logout</button>
                ) : (
                  <Link to="/auth" className="text-base font-semibold text-white hover:text-gray-300" onClick={toggleMenu}>Login</Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <main>
        <StackedHeroShowcase sectionRef={heroRef} />

        <section className="content-section content-section--showcase content-section--booking dark-bg text-center">
          <CalendarShowcase />
        </section>

        <section className="content-section content-section--showcase dark-bg text-center">
          <CalendarShowcase variant="people-crm" />
        </section>

        <section className="content-section content-section--showcase dark-bg text-center">
          <NumberOptionsShowcase />
        </section>

        <section className="content-section content-section--showcase dark-bg text-center">
          <CalendarShowcase variant="live-monitoring" />
        </section>

        <ComparisonShowcase />

        <section className="content-section content-section--showcase dark-bg text-center">
          <CalendarShowcase variant="scenarios" />
        </section>

      </main>
      <footer className="bg-black text-gray-400 py-8 text-center">
        <div className="container mx-auto px-4">
          <p className="text-sm">&copy; 2025 CorpOS. All rights reserved.</p>
          <p className="text-sm mt-2">
            <Link to="/privacy-policy" className="text-gray-400 hover:text-white underline">Privacy Policy</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
