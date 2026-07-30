import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext'; // This provides customer session/profile
import axios from 'axios';
import '../styles/marketplace.css'; // Import the stylesheet
import BreakroomLoginModal from '../components/modals/BreakroomLoginModal'; // Import the BreakroomLoginModal
import SplashScreen from '../components/SplashScreen'; // Import the SplashScreen component

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://nodemere.onrender.com';


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
        <img src={prize.image || 'https://placehold.co/800x1200/0d0d2b/ffffff?text=No+Image'} alt={prize.name} className="prize-card-image" />
        <div className="prize-card-gradient"></div>
        <div className="prize-card-content">
            <motion.h2 key={`title-${prize.id}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }} className="prize-title">
                {prize.name}
            </motion.h2>
            <motion.p key={`desc-${prize.id}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }} className="prize-description">
                {prize.description || 'No description available.'}
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
export default function MarketplacePage() {
    const [repProfile, setRepProfile] = useState(null); // Local state for rep profile
    const [showWelcome, setShowWelcome] = useState(true);
    const [userPoints, setUserPoints] = useState(0);
    const [prizes, setPrizes] = useState([]); // State to store fetched prizes
    const [index, setIndex] = useState(0);
    const [isOrdering, setIsOrdering] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showRepLogin, setShowRepLogin] = useState(false); // State to control rep login modal visibility
    const [error, setError] = useState(''); // New state for error messages

    useEffect(() => {
        const checkRepAuthAndFetchProfileAndPrizes = async () => {
            setIsLoading(true);
            setError(''); // Clear any previous errors
            const repToken = localStorage.getItem('rep_token');

            if (repToken) {
                try {
                    const repProfileResponse = await axios.get(`${API_BASE_URL}/reps/me`, {
                        headers: { Authorization: `Bearer ${repToken}` }
                    });
                    setRepProfile(repProfileResponse.data);
                    setUserPoints(repProfileResponse.data.points || 0);
                    setShowWelcome(repProfileResponse.data.marketplace_intro_popup || false);
                    setShowRepLogin(false); // Hide rep login if successfully authenticated as rep

                    // Fetch prizes after successful rep authentication
                    const prizesResponse = await axios.get(`${API_BASE_URL}/prizes`, {
                        headers: { Authorization: `Bearer ${repToken}` }
                    });
                    setPrizes(prizesResponse.data);

                } catch (error) {
                    console.error("Error fetching rep profile or prizes with rep_token:", error);
                    localStorage.removeItem('rep_token'); // Invalid token, remove it
                    setRepProfile(null);
                    setPrizes([]); // Clear prizes if rep authentication fails
                    setShowRepLogin(true); // Show rep login if token is invalid or fetch fails
                    setError(error.response?.data?.detail || "Failed to load marketplace data.");
                }
            } else {
                // No rep token, so show rep login
                setShowRepLogin(true);
                setRepProfile(null);
                setPrizes([]);
            }
            setIsLoading(false);
        };

        checkRepAuthAndFetchProfileAndPrizes();
    }, []); // No dependency on customer session

    const handleRepLoginSuccess = async () => {
        setShowRepLogin(false); // Hide the modal
        setIsLoading(true);
        setError(''); // Clear any previous errors
        const repToken = localStorage.getItem('rep_token');
        if (repToken) {
            try {
                const repProfileResponse = await axios.get(`${API_BASE_URL}/reps/me`, {
                    headers: { Authorization: `Bearer ${repToken}` }
                });
                setRepProfile(repProfileResponse.data);
                setUserPoints(repProfileResponse.data.points || 0);
                setShowWelcome(repProfileResponse.data.marketplace_intro_popup || false);

                // Fetch prizes after successful rep authentication
                const prizesResponse = await axios.get(`${API_BASE_URL}/prizes`, {
                    headers: { Authorization: `Bearer ${repToken}` }
                });
                setPrizes(prizesResponse.data);

            } catch (error) {
                console.error("Error re-fetching rep profile or prizes after login:", error);
                localStorage.removeItem('rep_token');
                setRepProfile(null);
                setPrizes([]);
                setShowRepLogin(true); // If re-fetch fails, show login again
                setError(error.response?.data?.detail || "Failed to re-authenticate rep.");
            }
        }
        setIsLoading(false);
    };

    const handleWelcomeStart = async () => {
        setShowWelcome(false);
        const repToken = localStorage.getItem('rep_token');
        if (repToken && repProfile?.marketplace_intro_popup) {
            try {
                await axios.patch(
                    `${API_BASE_URL}/reps/${repProfile.id}`,
                    { marketplace_intro_popup: false },
                    { headers: { Authorization: `Bearer ${repToken}` } }
                );
            } catch (error) {
                console.error("Error updating marketplace_intro_popup:", error);
            }
        }
    };

    const paginate = (newDirection) => { 
        if (prizes.length === 0) return; // Prevent pagination if no prizes
        setIndex((prevIndex) => (prevIndex + newDirection + prizes.length) % prizes.length); 
    };
    const handleRedeem = async () => {
        if (prizes.length === 0 || !repProfile) return; // Prevent redemption if no prizes or no rep profile
        setError(''); // Clear any previous errors
        const currentPrize = prizes[index];
        const repToken = localStorage.getItem('rep_token');

        if (!repToken) {
            setError("You must be logged in to redeem prizes.");
            setShowRepLogin(true);
            return;
        }

        try {
            const response = await axios.post(
                `${API_BASE_URL}/prizes/${currentPrize.id}/redeem`,
                {},
                { headers: { Authorization: `Bearer ${repToken}` } }
            );
            setUserPoints(response.data.points); // Update points from backend response
            setIsOrdering(true);
        } catch (error) {
            console.error("Error redeeming prize:", error);
            setError(error.response?.data?.detail || "Failed to redeem prize.");
        }
    };

    const swipeConfidenceThreshold = 10000;
    const swipePower = (offset, velocity) => Math.abs(offset.x) * velocity.x;

    const variants = {
      enter: (direction) => ({ x: direction > 0 ? 1000 : -1000, opacity: 0 }),
      center: { zIndex: 1, x: 0, opacity: 1 },
      exit: (direction) => ({ zIndex: 0, x: direction < 0 ? 1000 : -1000, opacity: 0 })
    };

    if (isLoading) { return <SplashScreen />; }

    // If no repProfile, always show the rep login modal
    if (!repProfile) {
        return <BreakroomLoginModal onLogin={handleRepLoginSuccess} />;
    }

    // If repProfile exists, proceed with marketplace content
    if (repProfile) {
        if (showWelcome) { return <WelcomePopup onStart={handleWelcomeStart} />; }

        if (prizes.length === 0) {
            return <div className="min-h-screen bg-black text-white flex items-center justify-center">No prizes available.</div>;
        }

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
                {error && <p className="text-red-500 text-center mt-4">{error}</p>}
            </main>
        );
    }
    
    // Fallback, should ideally not be reached if logic is sound
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Something went wrong.</div>;
}