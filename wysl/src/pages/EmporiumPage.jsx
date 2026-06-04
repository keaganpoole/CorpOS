import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { supabase } from '../supabaseClient'; // Import Supabase client
import '../styles/EmporiumPage.css';
import BreakroomLoginModal from '../components/modals/BreakroomLoginModal';
import SplashScreen from '../components/SplashScreen';

// --- RapidAPI Configuration (SECURITY RISK: Hardcoded for prototype, move to backend in production) ---
const RAPIDAPI_HOST = 'real-time-product-search.p.rapidapi.com';
const RAPIDAPI_KEY = '631c8cadadmsh3922b228354268ep10bf9fjsn862faeeb3b51'; // Replace with your actual key

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://keyquarters.onrender.com';


// --- Helper Components & Icons ---
const Icon = ({ path, className = "icon" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d={path} />
  </svg>
);
const PointsIcon = () => (
    <img src="https://analbpbswioidemezozb.supabase.co/storage/v1/object/public/assets/coin.png" alt="Points Coin" className="points-icon" />
);

// --- UI Components ---
const PointsHUD = ({ points }) => {
    const [displayPoints, setDisplayPoints] = useState(points);
    useEffect(() => { setDisplayPoints(points) }, [points]); // Simplified for brevity
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

// Star Rating Component
const StarRating = ({ rating }) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
        <div className="star-rating">
            {[...Array(fullStars)].map((_, i) => (
                <Icon key={`full-${i}`} path="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" className="star-icon" />
            ))}
            {hasHalfStar && (
                <div className="half-star-container">
                    <Icon path="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" className="star-icon half" />
                    <div className="half-star-fill" style={{ width: `${(rating % 1) * 100}%` }}></div>
                </div>
            )}
            {[...Array(emptyStars)].map((_, i) => (
                <Icon key={`empty-${i}`} path="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" className="star-icon empty" />
            ))}
        </div>
    );
};

const ProductCard = ({ product, onRedeem, canAfford, pointsMultiplier }) => {
    const pointsCost = Math.round(parseFloat(product.price.replace(/[^0-9.-]+/g,"")) * pointsMultiplier);

    return (
        <div className="product-card">
            <div className={`product-card-glow ${canAfford ? 'can-afford' : 'cannot-afford'}`}></div>
            <img src={product.product_photo || 'https://placehold.co/800x1200/0d0d2b/ffffff?text=No+Image'} alt={product.product_title} className="product-card-image" />
            <div className="product-card-gradient"></div>
            <div className="product-card-content">
                <motion.h2 key={`title-${product.product_id}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }} className="product-title">
                    {product.product_title}
                </motion.h2>
                <motion.div key={`rating-${product.product_id}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }} className="product-meta product-rating-section">
                    <StarRating rating={product.product_rating} />
                    <span className="product-num-reviews">({product.product_num_reviews} reviews)</span>
                </motion.div>
                <motion.div key={`cta-${product.product_id}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.5 } }} className="product-cta-area">
                    <div className="product-points">
                        <span className="product-points-number">{pointsCost.toLocaleString()}</span>
                        <span className="product-points-label">PTS</span>
                    </div>
                    <button onClick={() => onRedeem(product, pointsCost)} disabled={!canAfford} className="redeem-button">Redeem</button>
                </motion.div>
            </div>
            <div className="product-id-display">ID: {product.product_id.substring(0, 8)}...</div>
        </div>
    );
};

// --- Main App Component ---
export default function EmporiumPage() {
    const [repProfile, setRepProfile] = useState(null);
    const [userPoints, setUserPoints] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [showRepLogin, setShowRepLogin] = useState(false);
    const [error, setError] = useState('');
    const [isOrdering, setIsOrdering] = useState(false);
    const [pointsMultiplier, setPointsMultiplier] = useState(1); // Default to 1
    const [isSearchActive, setIsSearchActive] = useState(false); // New state for search bar position

    useEffect(() => {
        const checkRepAuthAndFetchProfile = async () => {
            setIsLoading(true);
            setError('');
            const repToken = localStorage.getItem('rep_token');

            if (repToken) {
                try {
                    const repProfileResponse = await axios.get(`${API_BASE_URL}/reps/me`, {
                        headers: { Authorization: `Bearer ${repToken}` }
                    });
                    setRepProfile(repProfileResponse.data);
                    setUserPoints(repProfileResponse.data.points || 0);
                    setShowRepLogin(false);
                } catch (error) {
                    console.error("Error fetching rep profile with rep_token:", error);
                    localStorage.removeItem('rep_token');
                    setRepProfile(null);
                    setShowRepLogin(true);
                    setError(error.response?.data?.detail || "Failed to load emporium data.");
                }
            } else {
                setShowRepLogin(true);
                setRepProfile(null);
            }
            setIsLoading(false);
        };

        const fetchPointsMultiplier = async () => {
            try {
                const { data, error } = await supabase
                    .from('master')
                    .select('points_multiplier')
                    .eq('id', '0')
                    .single();

                if (error) throw error;
                if (data) {
                    setPointsMultiplier(data.points_multiplier || 1);
                }
            } catch (error) {
                console.error("Error fetching points multiplier:", error.message);
                setError("Failed to load points multiplier.");
            }
        };

        checkRepAuthAndFetchProfile();
        fetchPointsMultiplier();
    }, []);

    const handleRepLoginSuccess = async () => {
        setShowRepLogin(false);
        setIsLoading(true);
        setError('');
        const repToken = localStorage.getItem('rep_token');
        if (repToken) {
            try {
                const repProfileResponse = await axios.get(`${API_BASE_URL}/reps/me`, {
                    headers: { Authorization: `Bearer ${repToken}` }
                });
                setRepProfile(repProfileResponse.data);
                setUserPoints(repProfileResponse.data.points || 0);
            } catch (error) {
                console.error("Error re-fetching rep profile after login:", error);
                localStorage.removeItem('rep_token');
                setRepProfile(null);
                setShowRepLogin(true);
                setError(error.response?.data?.detail || "Failed to re-authenticate rep.");
            }
        }
        setIsLoading(false);
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchTerm.trim()) {
            setError("Please enter a search term.");
            return;
        }
        setIsSearchActive(true); // Move search bar to top
        setIsSearching(true);
        setError('');
        setSearchResults([]);

        try {
            const response = await axios.get(`https://${RAPIDAPI_HOST}/search-light-v2`, {
                headers: {
                    'X-Rapidapi-Host': RAPIDAPI_HOST,
                    'X-Rapidapi-Key': RAPIDAPI_KEY,
                },
                params: {
                    q: searchTerm,
                    limit: 10,
                    page: 1,
                    min_price: '$100',
                    max_price: '$5000',
                    product_condition: 'NEW',
                    stores: 'walmart',
                    free_shipping: true,
                    sort_by: 'BEST_MATCH'
                }
            });

            if (response.data && response.data.data && response.data.data.products) {
                setSearchResults(response.data.data.products);
            } else {
                setSearchResults([]);
                setError("No products found for your search.");
            }
        } catch (err) {
            console.error("Error searching Walmart API:", err);
            setError("Failed to search for products. Please try again later.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleRedeem = async (product, pointsCost) => {
        if (!repProfile) {
            setError("You must be logged in to redeem products.");
            setShowRepLogin(true);
            return;
        }

        if (userPoints < pointsCost) {
            setError("You don't have enough points to redeem this product.");
            return;
        }

        setError('');

        try {
            // Insert into the 'orders' table
            const { data, error: insertError } = await supabase
                .from('orders')
                .insert([
                    {
                        rep: `${repProfile.first_name} ${repProfile.last_name}`,
                        product_id: product.product_id,
                    },
                ]);

            if (insertError) throw insertError;

            // Deduct points from the rep's profile using the new backend endpoint
            const repToken = localStorage.getItem('rep_token');
            const deductPointsResponse = await axios.patch(
                `${API_BASE_URL}/reps/${repProfile.id}/deduct-points`,
                { points_to_deduct: pointsCost },
                { headers: { Authorization: `Bearer ${repToken}` } }
            );
            setUserPoints(deductPointsResponse.data.points); // Update points from backend response

            setIsOrdering(true);
        } catch (err) {
            console.error("Error redeeming product:", err);
            setError(err.message || "Failed to redeem product.");
        }
    };

    if (isLoading) { return <SplashScreen />; }

    if (!repProfile) {
        return <BreakroomLoginModal onLogin={handleRepLoginSuccess} />;
    }

    return (
        <main className={`emporium-container ${isSearchActive ? 'search-active' : ''}`}>
            <PointsHUD points={userPoints} />

            <motion.div
                className="emporium-header-content"
                initial={{ y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
            >
                <motion.h1 initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="emporium-title">
                    Emporium
                </motion.h1>

                <form onSubmit={handleSearch} className="search-bar-container">
                    <input
                        type="text"
                        placeholder="Search Emporium (e.g., '4k tv')"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                        disabled={isSearching}
                    />
                    <button type="submit" className="search-button" disabled={isSearching}>
                        {isSearching ? 'Searching...' : <Icon path="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />}
                    </button>
                </form>
            </motion.div>

            {error && <p className="text-red-500 text-center mt-4">{error}</p>}

            {isSearching && (
                <div className="loading-indicator">
                    <div className="spinner"></div>
                    <p>Searching Emporium...</p>
                </div>
            )}

            {!isSearching && searchResults.length === 0 && searchTerm.trim() && !error && (
                <p className="no-results-message">No products found. Try a different search term!</p>
            )}

            <div className="product-grid">
                <AnimatePresence>
                    {searchResults.map((product) => (
                        <motion.div
                            key={product.product_id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.3 }}
                        >
                            <ProductCard
                                product={product}
                                onRedeem={handleRedeem}
                                canAfford={userPoints >= Math.round(parseFloat(product.price.replace(/[^0-9.-]+/g,"")) * pointsMultiplier)}
                                pointsMultiplier={pointsMultiplier}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {isOrdering && <RedeemConfirmation onComplete={() => setIsOrdering(false)} />}
        </main>
    );
}