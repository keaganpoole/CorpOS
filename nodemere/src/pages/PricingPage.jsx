import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, LayoutGrid, Lightbulb, Table2, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getCookie } from '../utils/cookieUtils';
import colors from '../../color';
import LegalFooter from '../components/LegalFooter';
import { api } from '../sonar/lib/api';
import { supabase } from '../supabaseClient';
import ModalSpectrumLine from '../components/ModalSpectrumLine';
import CubePreloader from '../sonar/components/CubePreloader';

// --- Data ---
const API_BASE_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE_URL}${path}`;
const paidPlanNames = new Set(['essentials', 'pro', 'ultra']);

const plansConfig = [
    {
        name: "Ultra",
        description: "Built for high-scale operations, deeper customization, and maximum control.",
        prices: {
            Standard: { monthly: 1100, annually: 990 },
            Sales: { monthly: 1100, annually: 990 },
            Social: { monthly: 1100, annually: 990 },
        },
        features: [
            { label: "Everything in Pro", description: "Includes every Pro feature with more room to grow." },
            { label: "Accept Payments", description: "Includes a 3% platform fee on customer payments processed through Nodemere," },
            { label: "Advanced AI Reasoning", description: "Gives receptionists stronger decision-making for more complex conversations." },
            { label: "Voice Studio", description: "Customize voice experience more deeply for your team and brand." },
            { label: "Professional Business Setup", description: "A dedicated onboarding specialist handles the setup, configuration, and optimization of your AI receptionist so it’s ready to start taking calls for your business." },
            { label: "24/7 Human Support", description: "Reach real support anytime when you need help fast." },
            { label: "Higher usage limits", description: "More capacity for your AI receptionists." }
        ],
        isRecommended: false
    },
    {
        name: "Pro",
        description: "Advanced AI receptionist infrastructure designed to operate beyond the limitations of traditional staffing.",
        prices: {
            Standard: { monthly: 600, annually: 540 },
            Sales: { monthly: 600, annually: 540 },
            Social: { monthly: 600, annually: 540 },
        },
        features: [
            { label: "Everything in Essentials", description: "Starts with all Essentials features already included." },
            { label: "25 Receptionists", description: "Run a larger receptionist team for different roles or workflows." },
            { label: "AI Outbound Calling", description: "Place consented operational calls for follow-ups, reminders, and service updates." },
            { label: "Accept Payments", description: "Receptionists can take payments and send invoices. A 3% platform fee applies to customer payments through Nodemere," },
            { label: "Unlock All Receptionists", description: "Full Access to the entire receptionist marketplace." },
            { label: "AI Texting Automation", description: "Not enabled at launch. Any future operational texting will require lawful consent and carrier approval." },
            { label: "Unlimited Contacts", description: "Keep your full contact list without contact-based restrictions." },
            { label: "Unlimited Scenarios", description: "Create as many workflow scenarios as your business needs." },
            { label: "Train Receptionists", description: "Customize your receptionist with business context and behavioral instructions." },
            { label: "Higher usage limits", description: "More capacity for your AI receptionists." }
        ],
        isRecommended: true
    },
    {
        name: "Essentials",
        description: "A focused AI receptionist for ordinary front-desk work, general questions, and routine scheduling.",
        prices: {
            Standard: { monthly: 200, annually: 180 },
            Sales: { monthly: 200, annually: 180 },
            Social: { monthly: 200, annually: 180 },
        },
        features: [
            { label: "3 AI Receptionists", description: "Use up to three receptionists for different call styles or duties." },
            { label: "24/7 AI Inbound Call Handling", description: "Answer incoming calls around the clock without missing opportunities." },
            { label: "10 Scenarios", description: "Build up to ten workflows for calls, appointments, records, and more." },
            { label: "Appointment Booking", description: "Book, update, and manage appointments during live conversations." },
            { label: "Accept Payments", description: "Receptionists can take payments and send invoices. A 3% platform fee applies to customer payments through Nodemere," },
            { label: "Store 1,000 Contacts", description: "Keep up to one thousand contacts in your CRM." },
            { label: "Live Call Monitoring", description: "Watch live call activity and follow what your system is doing." },
            { label: "Call Analytics", description: "See summaries and performance data from your calls." }
        ],
        isRecommended: false
    },
    {
        name: "Free",
        description: "Try Nodemere risk-free",
        prices: {
            Standard: { monthly: 0, annually: 0 },
            Sales: { monthly: 0, annually: 0 },
            Social: { monthly: 0, annually: 0 },
        },
        features: [
            "Business setup",
            "Limited use of features"
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

const PaymentTipsModal = ({ onClose }) => {
    const modal = (
    <motion.div
        className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={onClose}
    >
        <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-[620px] overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#070707] shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
            onMouseDown={(event) => event.stopPropagation()}
        >
            <ModalSpectrumLine variant="tips" />
            <div className="pointer-events-none absolute right-[-140px] top-[-180px] h-72 w-72 rounded-full bg-white/[0.035] blur-[72px]" />
            <div className="p-7 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                    <div className="relative">
                        <div className="mb-3 flex items-center gap-1.5">
                            <Lightbulb className="h-4 w-4 shrink-0 -translate-y-[5px] text-neutral-600" aria-hidden="true" />
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-600">Info</p>
                        </div>
                        <h2 className="text-xl font-semibold tracking-[-0.04em] text-white sm:text-2xl">Accept payments</h2>
                        <p className="mt-3 max-w-[520px] text-sm leading-6 text-neutral-500">
                            Let your AI receptionist take payments, collect deposits, and upsell services, all right over the phone.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center text-neutral-600 transition hover:text-white" aria-label="Close payment tips">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="relative mt-7 space-y-4 text-sm leading-6 text-neutral-400">
                    {[
                        ['How it works.', 'Your AI receptionist learns what services you offer and uses that information to help customers pay over the phone.'],
                        ['Platform fee.', 'Nodemere charges a 3% platform fee on customer payments processed through Nodemere using a supported connected provider. It does not apply to Nodemere plan or setup charges.'],
                        ['What is excluded.', 'Taxes, tips, refunded payments, and disputed payments are excluded from the platform-fee calculation. Your provider’s processing fees are separate.'],
                    ].map(([title, body], index) => (
                        <div key={title} className="flex gap-3">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: `rgba(255,255,255,${Math.max(0.35, 1 - (index * 0.14))})` }} />
                            <div><p className="text-sm font-semibold text-neutral-200">{title}</p><p className="mt-1 text-sm leading-6 text-neutral-500">{body}</p></div>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    </motion.div>
    );
    return createPortal(modal, document.body);
};

const PlanCheckmark = ({ className, featureIndex }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke="#a3a3a3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        <path className="plan-checkmark-gradient" style={featureIndex == null ? undefined : { '--checkmark-stagger': `${featureIndex * 60}ms` }} stroke="url(#checkGradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
);

// --- Plan Card ---
const usePlanAction = (plan, cycle, subscriptionStatus, isTestMode) => {
    const { session, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const [isCheckoutLoading, setCheckoutLoading] = useState(false);
    const billingManagedInStripe = !isTestMode && ['active', 'trialing', 'past_due', 'unpaid'].includes(String(subscriptionStatus || '').toLowerCase());

    const handleUpgradeClick = async () => {
        const planSlug = plan.name.toLowerCase();
        if (planSlug === 'free') {
            if (!session) {
                localStorage.removeItem('pendingPlan');
                navigate('/auth');
                return;
            }
            if (billingManagedInStripe) {
                return handleManageBilling();
            }
            setCheckoutLoading(true);
            try {
                const { error } = await supabase
                    .from('users')
                    .update({
                        plan: 'free',
                        subscription_status: 'inactive',
                    })
                    .eq('id', session.user.id);
                if (error) throw error;
                await refreshProfile?.();
            } catch (error) {
                console.error("PricingPage.jsx:event_248");
                alert(`Could not select the Free plan. Please try again. Error: ${error.message || error}`);
                setCheckoutLoading(false);
                return;
            }
            navigate('/dashboard');
            return;
        }

        if (billingManagedInStripe) {
            return handleManageBilling();
        }
        const priceId = plan.priceIds?.[cycle];
        if (!priceId) { console.error("Stripe Price ID is not defined for this plan/cycle."); return; }

        if (!session) {
            localStorage.setItem('pendingPlan', JSON.stringify({ priceId, cycle, planSlug }));
            navigate('/auth');
            return;
        }

        setCheckoutLoading(true);
        try {
            const response = await axios.post(
                apiUrl('/create-checkout-session'),
                { price_id: priceId, plan_slug: planSlug, billing_cycle: cycle },
                { headers: { Authorization: `Bearer ${session.access_token}` } }
            );
            const { url } = response.data;
            if (url) {
                window.location.href = url;
            }
        } catch (error) {
            console.error("PricingPage.jsx:event_281");
            alert(`Could not initiate checkout. Please try again. Error: ${error.message || error}`);
            setCheckoutLoading(false);
        }
    };

    const handleManageBilling = async () => {
        try {
            const result = await api.createBillingPortal();
            if (!result?.url) throw new Error('Stripe Billing Portal is unavailable.');
            window.location.assign(result.url);
        } catch (error) {
            alert(error.message || 'Could not open Stripe Billing Portal.');
        }
    };

    return { isCheckoutLoading, billingManagedInStripe, handleUpgradeClick, handleManageBilling };
};

const PlanCard = ({ plan, cycle, isInitialLoad, index, currentUserPlan, subscriptionStatus, isTestMode }) => {
    const { isCheckoutLoading, billingManagedInStripe, handleUpgradeClick, handleManageBilling } = usePlanAction(plan, cycle, subscriptionStatus, isTestMode);
    const [openFeature, setOpenFeature] = useState(null);
    const [paymentTipsOpen, setPaymentTipsOpen] = useState(false);

    const price = plan.price?.[cycle];
    const isCurrent = plan.name.toLowerCase() === currentUserPlan.toLowerCase();
    const annualSavings = ((plan.price?.monthly || 0) * 12) - ((plan.price?.annually || 0) * 12);
    const hasOverages = Boolean(plan.entitlements?.overage_enabled);
    const overageCents = Number(plan.entitlements?.overage_price_per_minute_cents ?? 30);
    const overageRate = overageCents / 100;

    const priceRef = useRef(null);
    const scrambleFx = useTextScramble(priceRef);
    const cardRef = useRef(null);
    const savingsRef = useRef(null);

    useEffect(() => {
        if (isInitialLoad || !scrambleFx.current) return;

        const savingsEl = savingsRef.current;
        savingsEl.innerHTML = '\u00A0';
        savingsEl.classList.remove('animate', 'savings-gradient-text', 'text-neutral-400');
        
        if (price > 0) {
            scrambleFx.current.setText(String(price)).then(() => {
                if (cycle === 'annually' && annualSavings > 0) {
                    setTimeout(() => {
                        savingsEl.innerHTML = `Save $${annualSavings} per year!`;
                        savingsEl.classList.add('animate', 'text-emerald-400');
                    }, 100);
                }
            });
        } else {
            scrambleFx.current.stop();
            priceRef.current.textContent = 'Free';
        }

    }, [cycle, isInitialLoad]);

    return (
        <div ref={cardRef} className={`plan-card plan-card-entry ${plan.name === 'Pro' ? 'plan-card--pro-touch' : ''} flex flex-col bg-[#111111] border border-[#303034] rounded-2xl p-6 ${isCurrent ? '' : ''} w-full max-w-[300px] md:flex-shrink-0`} style={{ '--animation-delay': `${index * 100}ms`, fontFamily: "'Inter', sans-serif" }}>
            <div className="flex-grow">
                <div className="flex justify-between items-start">
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    {plan.isRecommended && <span className="text-[13px] font-bold tracking-[0.01em] pricing-recommended-text" style={{ '--animation-delay': `${Math.random() * 2}s` }}>Recommended</span>}
                </div>
                <p className="mt-2 text-[15px] max-sm:text-sm text-neutral-400">{plan.description}</p>
                {plan.scopeNote && <p className="mt-3 text-xs leading-5 text-neutral-500">{plan.scopeNote}</p>}
                <div className="my-6">
                    <div className="flex items-baseline justify-center text-center">
                        <div className="flex items-start text-5xl font-extrabold text-white">
                            <span className={`text-xl mt-1 mr-1 ${price > 0 ? '' : 'hidden'}`}>$</span>
                            <span ref={priceRef}>{price > 0 ? price : 'Free'}</span>
                        </div>
                        <span className="text-sm text-neutral-400 ml-2">/ month</span>
                    </div>
                    <p className="relative top-2 text-center text-xs text-neutral-500 h-5 mt-2">
                        {cycle === 'annually' && price > 0 ? 'Billed annually' : ''}
                    </p>
                    <p ref={savingsRef} className="savings-text text-center text-xs font-semibold h-5">{'\u00A0'}</p>
                </div>
                <ul className="space-y-2.5">
                    {plan.features.map((feature, featureIndex) => {
                        const featureLabel = typeof feature === 'string' ? feature : feature.label;
                        const featureDescription = typeof feature === 'string' ? null : feature.description;
                        const isPaymentFeature = featureLabel.toLowerCase().includes('payment');
                        const showFeatureDescription = featureDescription && !featureLabel.toLowerCase().startsWith('everything in ') && !isPaymentFeature;

                        return (
                        <li key={featureLabel} className="relative flex items-center">
                            <PlanCheckmark className="w-5 h-5 mr-1.5 flex-shrink-0" featureIndex={featureIndex} />
                            <span className="text-neutral-300 text-sm min-w-0 overflow-hidden text-ellipsis">{featureLabel}</span>
                            {isPaymentFeature && (
                                <button
                                    type="button"
                                    onClick={() => setPaymentTipsOpen(true)}
                                    className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center text-neutral-300 transition-colors hover:text-white"
                                    aria-label={`More info about ${featureLabel}`}
                                >
                                    <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                            )}
                            {showFeatureDescription && (
                                <div className="relative ml-2 flex-shrink-0">
                                    <button
                                        type="button"
                                        onMouseEnter={() => setOpenFeature(featureIndex)}
                                        onMouseLeave={() => setOpenFeature(null)}
                                        onClick={() => setOpenFeature(openFeature === featureIndex ? null : featureIndex)}
                                        className="flex h-3 w-3 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.015] text-[7px] font-semibold text-neutral-600 transition-colors hover:border-white/[0.14] hover:bg-white/[0.03] hover:text-neutral-400"
                                        aria-label={`More info about ${featureLabel}`}
                                    >
                                        <span className="leading-none">i</span>
                                    </button>
                                    {openFeature === featureIndex && (
                                        <div
                                            onMouseEnter={() => setOpenFeature(featureIndex)}
                                            onMouseLeave={() => setOpenFeature(null)}
                                            className="absolute bottom-5 left-1/2 z-20 w-44 -translate-x-1/2 rounded-xl border border-white/[0.08] bg-[#101010]/80 px-3 py-2.5 text-left text-[11px] leading-relaxed text-neutral-300 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
                                        >
                                            <div className="absolute bottom-[-4px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-white/[0.08] bg-[#101010]/80" />
                                            {featureDescription}
                                        </div>
                                    )}
                                </div>
                            )}
                        </li>
                    )})}
                </ul>
            </div>
            <div className="mt-8">
                {['Essentials', 'Pro', 'Ultra'].includes(plan.name) && (
                    <p className="relative top-2 mb-[6px] text-center text-[11px] text-neutral-500">
                        3% fee on payments collected by receptionists,
                    </p>
                )}
                {hasOverages && (
                    <p className="mb-3 text-center text-[11px] text-neutral-500">
                        Additional minutes billed at ${overageRate.toFixed(2)}/min.
                    </p>
                )}
                {isCurrent ? (
                    plan.name === 'Free' ? (
                        <div className="w-full mt-auto font-semibold py-3 text-neutral-500 cursor-default text-center">Your current plan</div>
                    ) : (
                        <button onClick={handleManageBilling} className="pricing-neutral-button w-full mt-auto font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity btn-shine">
                            Manage billing in Stripe
                        </button>
                    )
                ) : (
                    <button 
                        onClick={handleUpgradeClick}
                        data-visitor-event="cta_click"
                        data-visitor-id={`pricing-${plan.name.toLowerCase()}`}
                        disabled={isCheckoutLoading}
                        className="pricing-neutral-button w-full mt-auto font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity btn-shine disabled:opacity-50 disabled:cursor-wait">
                        {isCheckoutLoading ? 'Redirecting...' : (
                            billingManagedInStripe ? 'Manage plan in Stripe' : (isTestMode ? 'Test this plan' : (
                                plan.name === 'Free' ? 'Choose plan' : (
                                    plan.cta || 'Start plan'
                                )
                            ))
                        )}
                    </button>
                )}
            </div>
            <AnimatePresence>{paymentTipsOpen ? <PaymentTipsModal onClose={() => setPaymentTipsOpen(false)} /> : null}</AnimatePresence>
        </div>
    );
};

const PricingToggle = ({ label, options, value, onChange, controlRef, matchHeightRef }) => {
    const pillRef = useRef(null);
    const buttonRefs = useRef({});
    const groupRef = useRef(null);
    const resolvedGroupRef = controlRef || groupRef;

    useEffect(() => {
        const activeButton = buttonRefs.current[value];
        if (pillRef.current && activeButton) {
            pillRef.current.style.width = `${activeButton.offsetWidth}px`;
            pillRef.current.style.left = `${activeButton.offsetLeft}px`;
        }
    }, [value, options]);

    useLayoutEffect(() => {
        if (!matchHeightRef) return undefined;
        const syncHeight = () => {
            const targetHeight = matchHeightRef.current?.getBoundingClientRect().height;
            if (targetHeight && groupRef.current) groupRef.current.style.height = `${targetHeight}px`;
        };
        syncHeight();
        window.addEventListener('resize', syncHeight);
        return () => window.removeEventListener('resize', syncHeight);
    }, [matchHeightRef]);

    return (
        <div ref={resolvedGroupRef} role="group" aria-label={label} className="relative flex items-center bg-[#1a1a1a] p-1 rounded-full border border-[#303034]">
            <div ref={pillRef} className="absolute h-[85%] rounded-full gradient-bg transition-all duration-300 ease-in-out" />
            {options.map((option) => (
                <button
                    key={option.value}
                    ref={(element) => { buttonRefs.current[option.value] = element; }}
                    type="button"
                    onClick={() => onChange(option.value)}
                    aria-pressed={value === option.value}
                    aria-label={option.label}
                    title={option.label}
                    className={`toggle-button relative z-10 text-xs sm:text-sm font-semibold px-2 py-1 sm:px-4 sm:py-1.5 transition-colors duration-300 ${value === option.value ? 'text-[var(--buttonText)]' : 'text-neutral-400'}`}
                >
                    {option.icon || option.label}
                </button>
            ))}
        </div>
    );
};

const PlanComparisonAction = ({ plan, cycle, currentUserPlan, subscriptionStatus, isTestMode }) => {
    const { isCheckoutLoading, billingManagedInStripe, handleUpgradeClick, handleManageBilling } = usePlanAction(plan, cycle, subscriptionStatus, isTestMode);
    const isCurrent = plan.name.toLowerCase() === currentUserPlan.toLowerCase();

    if (isCurrent && plan.name === 'Free') {
        return <span className="text-xs font-semibold text-neutral-500">Your current plan</span>;
    }

    const label = isCurrent
        ? 'Manage billing in Stripe'
        : billingManagedInStripe
            ? 'Manage plan in Stripe'
            : isTestMode
                ? 'Test this plan'
                : plan.name === 'Free'
                    ? 'Choose plan'
                    : (plan.cta || 'Start plan');

    return (
        <button
            type="button"
            onClick={isCurrent ? handleManageBilling : handleUpgradeClick}
            disabled={!isCurrent && isCheckoutLoading}
            className="pricing-neutral-button inline-flex w-[85%] max-w-full justify-center rounded-lg px-2 py-2 text-[11px] font-semibold leading-4 transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50 sm:text-xs"
        >
            {!isCurrent && isCheckoutLoading ? 'Redirecting...' : label}
        </button>
    );
};

const PlanComparisonTable = ({ plans, cycle, currentUserPlan, subscriptionStatus, isTestMode }) => {
    const formatLimit = (value) => {
        if (value === null) return 'Unlimited';
        if (typeof value === 'number') return value.toLocaleString();
        return '—';
    };
    const hasFeature = (plan, pattern) => (plan.features || []).some((feature) => {
        const label = typeof feature === 'string' ? feature : feature?.label;
        return pattern.test(String(label || ''));
    });
    const rows = [
        { label: 'Price', isPrice: true, getValue: (plan) => plan.name === 'Free' ? 'Free' : `$${Number(plan.price?.[cycle] || 0).toLocaleString()} / month` },
        { label: 'Inbound calling', getValue: (plan) => Boolean(plan.entitlements?.inbound_calling) },
        { label: 'Receptionists', getValue: (plan) => formatLimit(plan.entitlements?.max_receptionists) },
        { label: 'Contacts', getValue: (plan) => formatLimit(plan.entitlements?.max_contacts) },
        { label: 'Scenarios', getValue: (plan) => formatLimit(plan.entitlements?.max_scenarios) },
        { label: 'Outbound calling', getValue: (plan) => Boolean(plan.entitlements?.outbound_calling) },
        { label: 'Accept payments', getValue: (plan) => Boolean(plan.entitlements?.payment_processing) },
        { label: 'Voice cloning', getValue: (plan) => hasFeature(plan, /voice\s*clon/i) },
        { label: 'Dedicated onboarding specialist', getValue: (plan) => hasFeature(plan, /dedicated onboarding specialist/i) },
    ];

    return (
        <div role="region" aria-label="Plan comparison" className="pricing-comparison-scroll mx-auto max-w-[1272px] overflow-x-auto pt-4 pb-4" style={{ fontFamily: "'Inter', sans-serif" }}>
            <div className="min-w-[680px] rounded-2xl bg-[#111111]">
                <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                    <thead>
                        <tr className="text-white">
                            <th scope="col" className="w-[32%] border-b border-white/[0.08] px-4 py-3 font-semibold">Feature</th>
                            {plans.map((plan) => <th key={plan.name} scope="col" className="border-b border-white/[0.08] px-4 py-3 text-center font-semibold">{plan.name}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                        <tr key={row.label} className="card-entry" style={{ '--animation-delay': `${rowIndex * 40}ms` }}>
                            <th scope="row" className={`px-4 py-3 font-medium text-neutral-300 border-b border-white/[0.06] ${rowIndex === rows.length - 1 ? 'border-b-0' : ''}`}>{row.label}</th>
                                {plans.map((plan) => {
                                    const value = row.getValue(plan);
                                    return (
                                    <td key={plan.name} className={`px-4 py-3 text-center text-neutral-300 border-b border-white/[0.06] ${rowIndex === rows.length - 1 ? 'border-b-0' : ''}`}>
                                            {row.isPrice ? (
                                                <div className="flex min-h-10 flex-col items-center justify-center leading-5">
                                                    <span className="font-semibold text-white">{value}</span>
                                                    <span className="text-xs text-neutral-500">{plan.name === 'Free' ? 'No charge' : cycle === 'annually' ? 'Billed annually' : 'Billed monthly'}</span>
                                                </div>
                                            ) : typeof value === 'boolean' ? (value ? <span aria-label="Included" className="text-white">✓</span> : '—') : value}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="card-entry" style={{ '--animation-delay': `${rows.length * 40}ms` }}>
                            <th scope="row" className="border-t border-white/[0.08] px-4 py-3 font-semibold text-neutral-300">Choose a plan</th>
                            {plans.map((plan) => (
                                <td key={plan.name} className="border-t border-white/[0.08] px-2 py-3 text-center">
                                    <PlanComparisonAction plan={plan} cycle={cycle} currentUserPlan={currentUserPlan} subscriptionStatus={subscriptionStatus} isTestMode={isTestMode} />
                                </td>
                            ))}
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

// --- Main Pricing Page Component ---
const PricingPage = () => {
    const location = useLocation();
    const { profile } = useAuth();
    const subscriptionStatus = profile?.subscription_status;
    const subscriptionLog = profile?.log;
    const [cycle, setCycle] = useState('monthly');
    const [pricingView, setPricingView] = useState('cards');
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [source, setSource] = useState('standard');
    const [stripeData, setStripeData] = useState(null);
    const [planEntitlements, setPlanEntitlements] = useState(null);
    const [plansError, setPlansError] = useState('');
    const [plansLoading, setPlansLoading] = useState(true);
    const [isTestMode, setIsTestMode] = useState(false);
    const [carouselEdges, setCarouselEdges] = useState({ previous: false, next: false });
    const mobilePlanTrackRef = useRef(null);
    const pricingViewToggleRef = useRef(null);

    const currentUserPlan = profile?.plan || 'Free';

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await axios.get(apiUrl('/api/sonar/payments/test-mode'));
                setIsTestMode(Boolean(response.data.testMode));
            } catch (error) {
                console.error("PricingPage.jsx:event_457");
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
            document.cookie = `source=${newSource}; expires=${d.toUTCString()}; path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
        }
        
        setSource(newSource);
    }, [location]);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const { data } = await axios.get(apiUrl('/api/sonar/pricing/plans'));
                setStripeData(data);
                if (Array.isArray(data.plans) && data.plans.length) {
                    setPlanEntitlements(data.plans);
                    setPlansError('');
                } else {
                    setPlanEntitlements([]);
                    setPlansError('No public plans were returned from the pricing API.');
                }
            } catch (err) {
                console.error("PricingPage.jsx:event_505");
                setPlanEntitlements([]);
                setPlansError('Pricing plans could not be loaded from the server.');
            } finally {
                setPlansLoading(false);
            }
        };
        fetchPlans();
    }, []);

    const configuredPlans = (planEntitlements || []).map((databasePlan) => {
        const fallbackPlan = plansConfig.find((plan) => plan.name.toLowerCase() === databasePlan.name.toLowerCase()) || {};
        const display = databasePlan.display || {};
        return {
            ...fallbackPlan,
            name: databasePlan.name,
            description: display.description || '',
            scopeNote: databasePlan.name.toLowerCase() === 'essentials' ? '' : (display.scope_note || fallbackPlan.scopeNote || ''),
            features: Array.isArray(databasePlan.features) ? databasePlan.features : [],
            isRecommended: Boolean(databasePlan.is_recommended),
            entitlements: databasePlan.entitlements || {},
            cta: paidPlanNames.has(String(databasePlan.name || '').toLowerCase()) ? 'Start plan' : (display.cta || null),
        };
    });

    const plansToDisplay = configuredPlans.map(plan => {
        if (plan.name === 'Free') return { ...plan, price: { monthly: 0, annually: 0 }, priceIds: {} };
        
        if (!stripeData) return { ...plan, price: { monthly: 0, annually: 0 }, priceIds: {} };

        const product = stripeData.products?.find(p => p.name?.toLowerCase() === plan.name.toLowerCase());
        if (!product) return { ...plan, price: { monthly: plan.prices[source]?.monthly || plan.prices.Standard?.monthly || 0, annually: plan.prices[source]?.annually || plan.prices.Standard?.annually || 0 }, priceIds: {} };

        const getPrice = (interval) => {
            return stripeData.prices?.find(p => 
                p.product === product.id && 
                p.recurring?.interval === interval && 
                (p.metadata?.source || '').toLowerCase() === source.toLowerCase()
            );
        };

        const monthlyPriceObj = getPrice('month');
        const annualPriceObj = getPrice('year');

        const monthlyAmount = monthlyPriceObj ? monthlyPriceObj.unit_amount / 100 : (plan.prices[source]?.monthly || plan.prices.Standard?.monthly || 0);
        const annualAmount = annualPriceObj ? annualPriceObj.unit_amount / 1200 : (plan.prices[source]?.annually || plan.prices.Standard?.annually || 0);

        return {
            ...plan,
            price: {
                monthly: monthlyAmount,
                annually: annualAmount
            },
            priceIds: {
                monthly: monthlyPriceObj?.id,
                annually: annualPriceObj?.id
            }
        };
    });

    const updateCarouselEdges = () => {
        const track = mobilePlanTrackRef.current;
        if (!track) return;
        const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
        const previous = track.scrollLeft > 2;
        const next = track.scrollLeft < maxScrollLeft - 2;
        setCarouselEdges((current) => current.previous === previous && current.next === next ? current : { previous, next });
    };

    const moveCarousel = (direction) => {
        const track = mobilePlanTrackRef.current;
        const card = track?.children[0];
        if (!track || !card) return;
        const trackStyle = window.getComputedStyle(track);
        const gap = Number.parseFloat(trackStyle.columnGap || trackStyle.gap) || 0;
        track.scrollBy({
            left: direction * (card.getBoundingClientRect().width + gap),
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
    };

    const focusCarouselCard = (event) => {
        const track = mobilePlanTrackRef.current;
        if (!track || !window.matchMedia('(max-width: 1023px)').matches) return;
        if (event.target.closest('button, a, input, select, textarea, [role="button"]')) return;
        const card = event.target.closest('.plan-card');
        if (!card || !track.contains(card)) return;

        const trackRect = track.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const trackCenter = trackRect.left + track.clientLeft + track.clientWidth / 2;
        const offset = cardRect.left + cardRect.width / 2 - trackCenter;
        if (Math.abs(offset) < 1) return;

        track.scrollTo({
            left: track.scrollLeft + offset,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
    };

    useEffect(() => {
        const track = mobilePlanTrackRef.current;
        if (!track) return undefined;
        updateCarouselEdges();
        window.addEventListener('resize', updateCarouselEdges);
        return () => {
            window.removeEventListener('resize', updateCarouselEdges);
        };
    }, [plansToDisplay.length]);

    return (
        <div className="pricing-page-bg text-neutral-300 antialiased min-h-screen flex flex-col">
            <svg width="0" height="0" style={{ position: 'absolute' }}><defs>
                <linearGradient id="checkGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="var(--brandGradientStart)" /><stop offset="100%" stopColor="var(--brandGradientEnd)" /></linearGradient>
            </defs></svg>
            <div className="absolute top-0 left-0 right-0 pt-4">
                <div className="text-center">
                    <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
                        &larr; back to home
                    </Link>
                </div>
            </div>
            <div className="container mx-auto px-3 py-12 sm:py-20 flex-1">
                <div className="text-center max-w-3xl mx-auto mb-12 max-sm:mb-7">
                    <h1 className="text-4xl max-sm:text-3xl md:text-5xl font-extrabold text-white mb-4 max-sm:mb-2">Choose your plan</h1>
                    {subscriptionStatus === 'failed' && subscriptionLog && (
                        <p className="text-red-500 text-lg mb-4">{subscriptionLog}</p>
                    )}
                    <p className="text-lg max-sm:text-sm text-neutral-400">Choose a plan that's right for your business.</p>
                </div>
                <div className="relative mt-12 max-sm:mt-10">
                    <div className="relative z-10 -mt-5 mb-1 flex flex-wrap items-center justify-center gap-2 sm:-mt-5">
                        <PricingToggle
                            label="Pricing display"
                            options={[{ value: 'cards', label: 'Cards', icon: <LayoutGrid size={16} strokeWidth={2} aria-hidden="true" /> }, { value: 'table', label: 'Table', icon: <Table2 size={16} strokeWidth={2} aria-hidden="true" /> }]}
                            value={pricingView}
                            onChange={setPricingView}
                            controlRef={pricingViewToggleRef}
                        />
                        <PricingToggle
                            label="Billing interval"
                            options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annually', label: 'Yearly' }]}
                            value={cycle}
                            onChange={setCycle}
                            matchHeightRef={pricingViewToggleRef}
                        />
                    </div>
                    {plansLoading ? (
                        <div className="flex min-h-[55vh] items-center justify-center" aria-label="Loading pricing plans">
                            <CubePreloader size={28} />
                        </div>
                    ) : plansError ? (
                        <div className="py-10 text-sm text-neutral-500">{plansError}</div>
                    ) : (
                        pricingView === 'table' ? (
                            <PlanComparisonTable plans={plansToDisplay} cycle={cycle} currentUserPlan={currentUserPlan} subscriptionStatus={subscriptionStatus} isTestMode={isTestMode} />
                        ) : (
                            <div className="pricing-carousel-shell flex justify-center">
                                {carouselEdges.previous && <div className="pricing-carousel-edge pricing-carousel-edge--left lg:hidden" aria-hidden="true" />}
                                {carouselEdges.next && <div className="pricing-carousel-edge pricing-carousel-edge--right lg:hidden" aria-hidden="true" />}
                                <div ref={mobilePlanTrackRef} onClick={focusCarouselCard} onScroll={updateCarouselEdges} className="pricing-plan-track inline-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 py-4" aria-label="Pricing plans">
                                    {plansToDisplay.map((plan, index) => <PlanCard key={plan.name} plan={plan} cycle={cycle} isInitialLoad={isInitialLoad} index={index} currentUserPlan={currentUserPlan} subscriptionStatus={subscriptionStatus} isTestMode={isTestMode} />)}
                                </div>
                                {carouselEdges.previous && <button type="button" onClick={() => moveCarousel(-1)} aria-label="Previous pricing plans" className="pricing-carousel-arrow pricing-carousel-arrow--left lg:hidden"><ChevronLeft size={22} strokeWidth={2.5} aria-hidden="true" /></button>}
                                {carouselEdges.next && <button type="button" onClick={() => moveCarousel(1)} aria-label="Next pricing plans" className="pricing-carousel-arrow pricing-carousel-arrow--right lg:hidden"><ChevronRight size={22} strokeWidth={2.5} aria-hidden="true" /></button>}
                            </div>
                        )
                    )}
                </div>
                {!plansLoading && (
                    <>
                        <p className="mx-auto mt-20 max-w-3xl text-center text-xs leading-5 text-neutral-500">
                            By starting a subscription, you agree to the <Link to="/terms" className="underline underline-offset-2">Terms of Service</Link> and <Link to="/privacy-policy" className="underline underline-offset-2">Privacy Policy</Link>. Paid subscriptions renew automatically at the selected billing interval unless canceled before the next renewal date. You can request cancellation at <a href="mailto:support@nodemere.ai" className="underline underline-offset-2">support@nodemere.ai</a>.
                        </p>
                    </>
                )}
            </div>
            <LegalFooter />
        </div>
    );
};

export default PricingPage;
