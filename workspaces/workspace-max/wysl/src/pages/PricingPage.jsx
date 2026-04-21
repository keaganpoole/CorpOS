import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getCookie } from '../utils/cookieUtils';
import colors from '../../color';

// --- Data ---
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const planHierarchy = { "Free": 0, "Essentials": 1, "Pro": 2, "Ultra": 3 };

const plansConfig = [
    {
        name: "Ultra",
        description: "Full-scale AI receptionist with advanced analytics, custom workflows, and priority support.",
        prices: {
            Standard: { monthly: 999, annually: 799 },
            Sales: { monthly: 1249, annually: 999 },
            Social: { monthly: 999, annually: 799 },
        },
        features: [
            "Everything in Pro",
            "Advanced call analytics & reporting",
            "Custom workflow builder",
            "Dedicated account manager",
            "Priority 24/7 support",
        ],
        isRecommended: false
    },
    {
        name: "Pro",
        description: "For growing businesses that need multi-language support, smart routing, and deeper integrations.",
        prices: {
            Standard: { monthly: 499, annually: 399 },
            Sales: { monthly: 624, annually: 499 },
            Social: { monthly: 499, annually: 399 },
        },
        features: [
            "Everything in Essentials",
            "Multi-language support",
            "Smart call routing & transfers",
            "CRM integrations",
            "SMS & email follow-ups",
        ],
        isRecommended: true
    },
    {
        name: "Essentials",
        description: "24/7 AI call answering, appointment booking, and customer Q&A for your business.",
        prices: {
            Standard: { monthly: 99, annually: 79 },
            Sales: { monthly: 124, annually: 99 },
            Social: { monthly: 99, annually: 79 },
        },
        features: [
            "24/7 AI call answering",
            "Appointment booking",
            "Customer Q&A",
            "Call summaries & transcripts",
            "Unlimited calls",
        ],
        isRecommended: false
    },
    {
        name: "Free",
        description: "Try Sonar risk-free with limited monthly minutes.",
        prices: {
            Standard: { monthly: 0, annually: 0 },
            Sales: { monthly: 0, annually: 0 },
            Social: { monthly: 0, annually: 0 },
        },
        features: [
            "Limited monthly minutes",
            "AI call answering",
            "Appointment booking",
        ],
        isRecommended: false
    },
];


// Custom Hook for Text Scramble
const useTextScramble = (ref) => {
    const fx = useRef(null);
    useEffect(() => {
        class TextScrambleEffect {
            constructor(el) { this.el = el; this.chars = '0123456789'; this.frameRequest = null; this.frame = 0; this.queue = []; this.resolve = null; this.isActive = false; }
            setText(newText) {
                if (this.isActive) return Promise.resolve();
                const oldText = this.el.innerText;
                const length = Math.max(oldText.length, newText.length);
                const promise = new Promise((resolve) => this.resolve = resolve);
                this.queue = [];
                for (let i = 0; i < length; i++) {
                    const from = oldText[i] || '';
                    const to = newText[i] || '';
                    const start = i * 4;
                    const end = start + 20;
                    this.queue.push({ from, to, start, end });
                }
                cancelAnimationFrame(this.frameRequest);
                this.frame = 0;
                this.isActive = true;
                this.update();
                return promise;
            }
            stop() { cancelAnimationFrame(this.frameRequest); this.isActive = false; }
            update() {
                let output = '';
                let complete = 0;
                for (let i = 0, n = this.queue.length; i < n; i++) {
                    let { from, to, start, end } = this.queue[i];
                    if (this.frame >= end) { complete++; output += to; }
                    else if (this.frame >= start) { output += `<span class="opacity-70">${this.chars[Math.floor(Math.random() * this.chars.length)]}</span>`; }
                    else { output += from; }
                }
                this.el.innerHTML = output;
                if (complete === this.queue.length) {
                    this.isActive = false;
                    if (this.resolve) { this.resolve(); this.resolve = null; }
                } else { this.frameRequest = requestAnimationFrame(this.update.bind(this)); this.frame++; }
            }
        }
        if (ref.current) { fx.current = new TextScrambleEffect(ref.current); }
        return () => { if(fx.current) fx.current.stop(); }
    }, [ref]);
    return fx;
};

// --- Plan Card ---
const PlanCard = ({ plan, cycle, isInitialLoad, index, currentUserPlan, hasStartedTrial, isTestMode }) => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [isCheckoutLoading, setCheckoutLoading] = useState(false);

    const price = plan.price?.[cycle];
    const isCurrent = plan.name.toLowerCase() === currentUserPlan.toLowerCase();
    const isUpgrade = planHierarchy[plan.name] > planHierarchy[currentUserPlan];
    const annualSavings = ((plan.price?.monthly || 0) * 12) - ((plan.price?.annually || 0) * 12);

    const priceRef = useRef(null);
    const scrambleFx = useTextScramble(priceRef);
    const cardRef = useRef(null);
    const savingsRef = useRef(null);

    const handleUpgradeClick = async () => {
        const priceId = plan.priceIds?.[cycle];
        if (!priceId) { console.error("Stripe Price ID is not defined for this plan/cycle."); return; }

        if (!session) {
            localStorage.setItem('pendingPlan', JSON.stringify({ priceId, cycle }));
            navigate('/auth');
            return;
        }

        setCheckoutLoading(true);
        try {
            const response = await axios.post(
                `${API_BASE_URL}/create-checkout-session`,
                { price_id: priceId },
                { headers: { Authorization: `Bearer ${session.access_token}` } }
            );
            const { url } = response.data;
            if (url) {
                if (typeof fbq === 'function') {
                    fbq('track', 'InitiateCheckout');
                }
                window.location.href = url;
            }
        } catch (error) {
            console.error("Error creating checkout session:", error);
            alert(`Could not initiate checkout. Please try again. Error: ${error.message || error}`);
            setCheckoutLoading(false);
        }
    };

    useEffect(() => {
        if (isInitialLoad || !scrambleFx.current) return;

        const savingsEl = savingsRef.current;
        savingsEl.innerHTML = '\u00A0';
        savingsEl.classList.remove('animate', 'savings-gradient-text', 'text-green-500');
        
        if (price > 0) {
            scrambleFx.current.setText(String(price)).then(() => {
                if (cycle === 'annually' && annualSavings > 0) {
                    setTimeout(() => {
                        savingsEl.innerHTML = `Save $${annualSavings} per year!`;
                        savingsEl.classList.add('animate', 'text-green-500');
                    }, 100);
                }
            });
        } else {
            scrambleFx.current.stop();
            priceRef.current.textContent = 'Free';
        }

    }, [cycle, isInitialLoad]);

    return (
        <div ref={cardRef} className={`plan-card flex flex-col bg-[#111111] border border-gray-800 rounded-2xl p-6 ${isCurrent ? '' : ''} w-full max-w-[300px] md:flex-shrink-0 card-entry`} style={{ '--animation-delay': `${index * 100}ms` }}>
            <div className="flex-grow">
                <div className="flex justify-between items-start">
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    {plan.isRecommended && <span className="text-xs font-semibold gradient-text animate-glow" style={{ '--animation-delay': `${Math.random() * 2}s` }}>Recommended</span>}
                </div>
                <p className="text-gray-400 mt-2">{plan.description}</p>
                <div className="my-6">
                    <div className="flex items-baseline justify-center text-center">
                        <div className="flex items-start text-6xl font-extrabold text-white">
                            <span className={`text-2xl mt-1 mr-1 ${price > 0 ? '' : 'hidden'}`}>$</span>
                            <span ref={priceRef}>{price > 0 ? price : 'Free'}</span>
                        </div>
                        <span className="text-gray-400 ml-2">/ month</span>
                    </div>
                    <p className="text-center text-xs text-gray-500 h-5 mt-2">
                        {cycle === 'annually' && price > 0 ? 'billed annually' : ''}
                    </p>
                    <p ref={savingsRef} className="savings-text text-center text-xs font-semibold h-5">{'\u00A0'}</p>
                </div>
                <ul className="space-y-2.5">
                    {plan.features.map(feature => (
                        <li key={feature} className="flex items-center flex-nowrap">
                            <svg className="w-5 h-5 mr-1.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                <path stroke="url(#checkGradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
                            </svg>
                            <span className="text-gray-300 text-sm min-w-0 overflow-hidden text-ellipsis">{feature}</span>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="mt-8">
                {isCurrent ? (
                    <div className="w-full mt-auto font-semibold py-3 text-gray-500 cursor-default text-center">Your current plan</div>
                ) : (
                    <button 
                        onClick={handleUpgradeClick}
                        disabled={isCheckoutLoading}
                        className="w-full mt-auto font-semibold py-3 rounded-lg text-[var(--color3)] hover:opacity-90 transition-opacity btn-shine disabled:opacity-50 disabled:cursor-wait"
                        style={{ background: 'linear-gradient(to right, var(--color1), var(--color2))' }}>
                        {isCheckoutLoading ? 'Redirecting...' : (
                            isTestMode ? 'Test this subscription' : (
                                plan.name === 'Free' ? 'Choose plan' : (
                                    hasStartedTrial ? 'Choose plan' : 'Try for 14 days'
                                )
                            )
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

// --- Main Pricing Page Component ---
const PricingPage = () => {
    const location = useLocation();
    const { profile, subscriptionStatus, subscriptionLog, startedTrial } = useAuth(); 
    const [cycle, setCycle] = useState('monthly');
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [source, setSource] = useState('standard');
    const [stripeData, setStripeData] = useState(null);
    const [isTestMode, setIsTestMode] = useState(false);
    const pillBgRef = useRef(null);
    const annualBtnRef = useRef(null);
    const monthlyBtnRef = useRef(null);

    const currentUserPlan = profile?.plan || 'Free';

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/config/status`);
                setIsTestMode(response.data.test_mode);
            } catch (error) {
                console.error("Error fetching server config:", error);
            }
        };

        fetchConfig();
        setIsInitialLoad(false);
        window.scrollTo(0, 0);
    }, []);

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
        
        setSource(newSource);
    }, [location]);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const { data } = await axios.get(`${API_BASE_URL}/plans`);
                setStripeData(data);
            } catch (err) {
                console.error("Error fetching plans:", err);
            }
        };
        fetchPlans();
    }, []);

    useEffect(() => {
        const activeButton = cycle === 'annually' ? annualBtnRef.current : monthlyBtnRef.current;
        if (pillBgRef.current && activeButton) {
            pillBgRef.current.style.width = `${activeButton.offsetWidth}px`;
            pillBgRef.current.style.left = `${activeButton.offsetLeft}px`;
        }
    }, [cycle]);

    const plansToDisplay = plansConfig.map(plan => {
        if (plan.name === 'Free') return { ...plan, price: { monthly: 0, annually: 0 }, priceIds: {} };
        
        if (!stripeData) return { ...plan, price: { monthly: 0, annually: 0 }, priceIds: {} };

        const product = stripeData.products?.find(p => p.name.toLowerCase() === plan.name.toLowerCase());
        if (!product) return { ...plan, price: { monthly: plan.prices[source]?.monthly || plan.prices.Standard?.monthly || 0, annually: plan.prices[source]?.annually || plan.prices.Standard?.annually || 0 }, priceIds: {} };

        const getPrice = (interval) => {
            return stripeData.prices?.find(p => 
                p.product === product.id && 
                p.recurring.interval === interval && 
                (p.metadata?.source || '').toLowerCase() === source.toLowerCase()
            );
        };

        const monthlyPriceObj = getPrice('month');
        const annualPriceObj = getPrice('year');

        return {
            ...plan,
            price: {
                monthly: monthlyPriceObj ? monthlyPriceObj.unit_amount / 100 : (plan.prices[source]?.monthly || plan.prices.Standard?.monthly || 0),
                annually: annualPriceObj ? annualPriceObj.unit_amount / 100 : (plan.prices[source]?.annually || plan.prices.Standard?.annually || 0)
            },
            priceIds: {
                monthly: monthlyPriceObj?.id,
                annually: annualPriceObj?.id
            }
        };
    });

    return (
        <div className="pricing-page-bg text-gray-300 antialiased min-h-screen">
            <svg width="0" height="0" style={{ position: 'absolute' }}><defs>
                <linearGradient id="checkGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#a855f7" /></linearGradient>
            </defs></svg>
            <div className="absolute top-0 left-0 right-0 pt-4">
                <div className="text-center">
                    <Link to="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                        &larr; back to home
                    </Link>
                </div>
            </div>
            <div className="container mx-auto px-3 py-12 sm:py-20"> 
                <div className="text-center max-w-3xl mx-auto mb-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Choose your plan</h1>
                    {subscriptionStatus === 'failed' && subscriptionLog && (
                        <p className="text-red-500 text-lg mb-4">{subscriptionLog}</p>
                    )}
                    <p className="text-lg text-gray-400">Choose a plan that's right for your business.</p>
                </div>
                <div className="flex justify-center items-center mb-12">
                    <div className="relative flex items-center bg-[#1a1a1a] p-1 rounded-full border border-gray-800">
                        <div ref={pillBgRef} className="absolute h-[85%] rounded-full gradient-bg transition-all duration-300 ease-in-out"></div>
                        <button ref={annualBtnRef} onClick={() => setCycle('annually')} className={`toggle-button relative z-10 text-sm font-semibold px-6 py-2 transition-colors duration-300 ${cycle === 'annually' ? '' : 'text-gray-400'}`} style={{ color: cycle === 'annually' ? 'var(--color3)' : ''}}>Annually</button>
                        <button ref={monthlyBtnRef} onClick={() => setCycle('monthly')} className={`toggle-button relative z-10 text-sm font-semibold px-6 py-2 transition-colors duration-300 ${cycle === 'monthly' ? '' : 'text-gray-400'}`} style={{ color: cycle === 'monthly' ? 'var(--color3)' : ''}}>Monthly</button>
                    </div>
                </div>
                <div className="relative text-center">
                    <div className="inline-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 py-4">
                       {plansToDisplay.map((plan, index) => <PlanCard key={plan.name} plan={plan} cycle={cycle} isInitialLoad={isInitialLoad} index={index} currentUserPlan={currentUserPlan} hasStartedTrial={startedTrial} isTestMode={isTestMode} />)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PricingPage;
