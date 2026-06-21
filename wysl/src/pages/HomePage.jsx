// HomePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import useLegacyAnimation from '../hooks/useLegacyAnimation';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Menu as MenuIcon, X as XIcon } from 'lucide-react';
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
import AES256Stats from '../components/AES256Stats';
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
import CalendarShowcase from '../components/CalendarShowcase';
import { trackVisitor } from '../services/apiService';

const FadingImageCollage = ({ images }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [images]);

  return (
    <div className="relative w-full h-full overflow-hidden">
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
    const [isInView, setIsInView] = useState(true);
    const ref = useRef(null);

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
          <img src={logoImage} alt="Sonar" className="header-logo" />

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
        <HeroConcept ref={heroRef} />


        <section className="content-section content-section--showcase dark-bg text-center">
          <CalendarShowcase />
        </section>

        <section className="content-section content-section--showcase dark-bg text-center">
          <CalendarShowcase variant="scenarios" />
        </section>

        <section className="content-section content-section--showcase dark-bg text-center">
          <CalendarShowcase />
        </section>

        <section className="content-section dark-bg text-center">
          <h3 data-animate="true" className="typing-animation-container">
            <TypingAnimation />
          </h3>
          <p data-animate="true">
            Sonar's AI understands your business inside and out. It answers common questions, checks availability, books appointments, and escalates to your team when needed — all in real time.
          </p>
          <CyclingImageGrid allExpandedImages={allExpandedImages} className="mb-12" />

        </section>

        {/* 24/7 Assistance Section */}
        <section className="hero-section text-center">
          <h3 data-animate="true">
            Virtual&nbsp;
            <span className="animated-underline make-it-rain-container">
              Receptionist
              <svg className="marker-underline" xmlns="http://www.w3.org/2000/svg" viewBox="-1 0 100 12" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="underline-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: 'var(--gradient-start)' }} />
                    <stop offset="100%" style={{ stopColor: 'var(--gradient-end)' }} />
                  </linearGradient>
                </defs>
                <path d="M2,8 C30,4,70,5,98,7" />
              </svg>
            </span>
          </h3>
          <p className="hero-subheadline" data-animate="true">
            Meet your AI receptionist — always on, always professional. She greets every caller with a warm, natural voice, answers questions about your business, books and manages appointments, and routes urgent calls to the right person. Over time, she learns your preferences and gets even better at representing your business.
          </p>
          <div className="image-container w-full h-[490px] flex justify-center items-center" style={{ marginTop: '20px' }}>
            <FadingImageCollage images={phoneHelperCollageImages} />
          </div>
          <div className="mt-12 flex justify-center">
            <Link to="/pricing" className="text-base font-semibold gradient-button btn-shine hover:opacity-90 transition-opacity py-3 px-8">
              Try for free
            </Link>
          </div>
        </section>

        {/* Reliability Section */}
        <section className="content-section light-bg text-center flex flex-col justify-center items-center">
          <h3 data-animate="true"><span className="animated-text" style={{ fontWeight: 700 }}>99.9%</span><span className="static-text">Uptime</span></h3>
          <p data-animate="true">
            Sonar runs on enterprise-grade infrastructure trusted by thousands of businesses. Your AI receptionist is always online, always ready, with crystal-clear call quality and instant response times. Zero downtime means zero missed opportunities.
          </p>
          <AES256Stats startAnimation={true} />

        </section>
      </main>
      <footer className="bg-black text-gray-400 py-8 text-center">
        <div className="container mx-auto px-4">
          <p className="text-sm">&copy; 2025 Sonar. All rights reserved.</p>
          <p className="text-sm mt-2">
            <Link to="/privacy-policy" className="text-gray-400 hover:text-white underline">Privacy Policy</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
