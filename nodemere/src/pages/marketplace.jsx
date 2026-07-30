import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Marketplace.css'; // Import the stylesheet

// --- Helper Components & Icons ---
const Icon = ({ path, className = "icon" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d={path} />
  </svg>
);
const PointsIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="points-icon">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// --- MOCK DATA ---
const prizes = [
    { id: 1, name: 'Premium Wireless Headphones', description: 'Immerse yourself in high-fidelity audio with industry-leading noise cancellation.', points: 15000, img: 'https://placehold.co/800x1200/0d0d2b/ffffff?text=Headphones' },
    { id: 2, name: 'Smart Watch Series 9', description: 'Stay connected and track your fitness in style with this state-of-the-art smartwatch.', points: 25000, img: 'https://placehold.co/800x1200/1a0a3d/ffffff?text=Smart+Watch' },
    { id: 3, name: '4K Streaming Drone', description: 'Capture breathtaking aerial footage with a compact, powerful, and easy-to-fly drone.', points: 12000, img: 'https://placehold.co/800x1200/2c0f4f/ffffff?text=Drone' },
    { id: 4, name: 'Pro Espresso Machine', description: 'Become your own barista and craft perfect coffee with this sleek, powerful machine.', points: 8500, img: 'https://placehold.co/800x1200/4f1b7d/ffffff?text=Espresso' },
    { id: 5, name: 'Weekend Getaway Package', description: 'A relaxing two-night stay at a luxury resort, including meals and spa access.', points: 50000, img: 'https://placehold.co/800x1200/6b21a8/ffffff?text=Getaway' },
];

// --- UI Components ---
const WelcomePopup = ({ onStart }) => (
  <AnimatePresence>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="welcome-overlay">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: { delay: 0.2 } }} className="welcome-popup">
        <h1 className="welcome-title">Welcome to the Marketplace</h1>
        <p className="welcome-text">Your hard work has paid off. It's time to claim your reward. Swipe to explore.</p>
        <button onClick={onStart} className="welcome-button">Enter</button>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

const PointsHUD = ({ points }) => {
    // This animation logic remains the same
    const [displayPoints, setDisplayPoints] = useState(points);
    useEffect(() => { /* ... animation logic ... */ setDisplayPoints(points) }, [points]);
    return (
        <div className="points-hud">
            <div className="points-hud-inner">
                <PointsIcon />
                <span className="points-hud-text">{displayPoints.toLocaleString()}</span>
            </div>
        </div>
    );
};

const RedeemConfirmation = ({ onComplete }) => {
    useEffect(() => { const timer = setTimeout(onComplete, 2500); return () => clearTimeout(timer); }, [onComplete]);
    return (
        <div className="redeem-overlay">
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                 <h2 className="redeem-title">REDEEMED!</h2>
            </motion.div>
        </div>
    );
};

const PrizeCard = ({ prize, onRedeem, canAfford }) => (
    <div className="prize-card">
        <div className={`prize-card-glow ${canAfford ? 'can-afford' : 'cannot-afford'}`}></div>
        <img src={prize.img} alt={prize.name} className="prize-card-image" />
        <div className="prize-card-gradient"></div>
        <div className="prize-card-content">
            <motion.h2 key={`title-${prize.id}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }} className="prize-title">
                {prize.name}
            </motion.h2>
            <motion.p key={`desc-${prize.id}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }} className="prize-description">
                {prize.description}
            </motion.p>
            <motion.div key={`cta-${prize.id}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.5 } }} className="prize-cta-area">
                <div className="prize-points">
                    <span className="prize-points-number">{prize.points.toLocaleString()}</span>
                    <span className="prize-points-label">PTS</span>
                </div>
                <button onClick={onRedeem} disabled={!canAfford} className="redeem-button">Redeem</button>
            </motion.div>
        </div>
    </div>
);

// --- Main App Component ---
export default function Marketplace() {
    const [showWelcome, setShowWelcome] = useState(true);
    const [userPoints, setUserPoints] = useState(18500);
    const [index, setIndex] = useState(0);
    const [isOrdering, setIsOrdering] = useState(false);
    
    const paginate = (newDirection) => { setIndex((prevIndex) => (prevIndex + newDirection + prizes.length) % prizes.length); };
    const handleRedeem = () => {
        const currentPrize = prizes[index];
        if (userPoints >= currentPrize.points) {
            setUserPoints(prev => prev - currentPrize.points);
            setIsOrdering(true);
        }
    };

    const swipeConfidenceThreshold = 10000;
    const swipePower = (offset, velocity) => Math.abs(offset.x) * velocity.x;

    const variants = {
      enter: (direction) => ({ x: direction > 0 ? 1000 : -1000, opacity: 0 }),
      center: { zIndex: 1, x: 0, opacity: 1 },
      exit: (direction) => ({ zIndex: 0, x: direction < 0 ? 1000 : -1000, opacity: 0 })
    };

    if (showWelcome) { return <WelcomePopup onStart={() => setShowWelcome(false)} />; }

    return (
        <main className="marketplace-container">
            <PointsHUD points={userPoints} />
            <div className="carousel-container">
              <AnimatePresence initial={false}>
                  <motion.div
                      key={index}
                      variants={variants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={1}
                      onDragEnd={(e, { offset, velocity }) => {
                          const swipe = swipePower(offset, velocity);
                          if (swipe < -swipeConfidenceThreshold) paginate(1);
                          else if (swipe > swipeConfidenceThreshold) paginate(-1);
                      }}
                       className="carousel-slide"
                  >
                     <PrizeCard prize={prizes[index]} canAfford={userPoints >= prizes[index].points} onRedeem={handleRedeem} />
                  </motion.div>
              </AnimatePresence>
            </div>
            
            <div className="carousel-navigation">
              <button onClick={() => paginate(-1)}><Icon path="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></button>
              <button onClick={() => paginate(1)}><Icon path="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></button>
            </div>

            {isOrdering && <RedeemConfirmation onComplete={() => setIsOrdering(false)} />}
        </main>
    );
}