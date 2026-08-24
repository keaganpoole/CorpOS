// src/pages/AuthPage.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import googleIcon from '../assets/google.png'; // Import the local Google icon
import { LEGAL_ACCEPTANCE_VERSION } from '../legal/legalDocuments';

const API_BASE_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/$/, '');
const FRONTEND_PUBLIC_URL = import.meta.env.VITE_FRONTEND_PUBLIC_URL || window.location.origin;
const NODEMERE_LOGO_SRC = 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/assets/nodemere_logo2.png';

console.log('AuthPage: import.meta.env.DEV =', import.meta.env.DEV);
console.log('AuthPage: import.meta.env.VITE_FRONTEND_PUBLIC_URL =', import.meta.env.VITE_FRONTEND_PUBLIC_URL);
console.log('AuthPage: FRONTEND_PUBLIC_URL =', FRONTEND_PUBLIC_URL);

const AuthPage = () => {
    const { login, session, profile, isLoading: isAuthLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSignUp, setIsSignUp] = useState(location.state?.isSignUp || false);
    const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '' });
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [resendTimer, setResendTimer] = useState(0); // New state for resend timer
    const [canResend, setCanResend] = useState(false); // New state to control resend button
    const [isConfirmationSent, setIsConfirmationSent] = useState(false); // New state to track if confirmation was sent
    const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 10);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (session && !isAuthLoading) { // User is logged in
            if (!profile?.onboarded) {
                navigate('/onboarding');
                return;
            }

            const pendingPlan = localStorage.getItem('pendingPlan');
            if (pendingPlan) {
                localStorage.removeItem('pendingPlan');
                const { priceId, planSlug, cycle } = JSON.parse(pendingPlan);
                
                const initiateStripeCheckout = async () => {
                    try {
                        const response = await axios.post(
                            `${API_BASE_URL}/create-checkout-session`,
                            { price_id: priceId, plan_slug: planSlug, billing_cycle: cycle },
                            { headers: { Authorization: `Bearer ${session.access_token}` } }
                        );
                        const { url } = response.data;
                        if (url) {
                            window.location.href = url;
                        }
                    } catch (error) {
                        console.error("Error creating checkout session after login:", error);
                        alert("Could not initiate checkout after login. Please try again.");
                        navigate('/dashboard');
                    }
                };
                initiateStripeCheckout();
            } else {
                navigate('/dashboard');
            }
        }
    }, [session, profile, isAuthLoading, navigate]);

    useEffect(() => {
        if (resendTimer > 0) {
            const timerId = setTimeout(() => {
                setResendTimer(resendTimer - 1);
            }, 1000);
            setCanResend(false);
            return () => clearTimeout(timerId);
        } else {
            setCanResend(true);
        }
    }, [resendTimer]);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsLoading(true);

        try {
            if (isSignUp) {
                if (!hasAcceptedLegal) {
                    setError("Please accept the Nodemere legal terms to create an account.");
                    setIsLoading(false);
                    return;
                }
                if (formData.password !== formData.confirmPassword) {
                    setError("Passwords do not match.");
                    setIsLoading(false);
                    return;
                }
                await axios.post(`${API_BASE_URL}/users`, {
                    email: formData.email,
                    password: formData.password,
                    terms_accepted: true,
                    legal_version: LEGAL_ACCEPTANCE_VERSION,
                    certified_permitted_use: true,
                });
                setSuccessMessage('Please check your email inbox and spam folder for a confirmation link. ');
                setFormData(prev => ({ ...prev, password: '', confirmPassword: '' })); // Keep email, clear passwords
                setIsConfirmationSent(true);
                setResendTimer(60); // Start the 60-second timer
            } else {
                await login(formData.email, formData.password);
                // The useEffect below will handle redirection based on session and pendingPlan
            }
        } catch (apiError) {
            const detail = apiError.response?.data?.detail || "An unexpected error occurred.";
            setError(`${isSignUp ? 'Signup' : 'Login'} failed: ${detail}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const toggleAuthMode = () => {
        setIsSignUp(!isSignUp);
        setError('');
        setSuccessMessage('');
        setFormData({ email: '', password: '', confirmPassword: '' });
        setHasAcceptedLegal(false);
    };

    const handleGoogleSignIn = async () => {
        if (isSignUp && !hasAcceptedLegal) {
            setError('Please accept the Nodemere legal terms before continuing with Google.');
            return;
        }
        setError('');
        setSuccessMessage('');
        setIsLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: FRONTEND_PUBLIC_URL + '/onboarding',
                },
            });
            if (error) throw error;
            // Supabase will redirect, so no further action needed here for success
        } catch (apiError) {
            setError(`Google sign-in failed: ${apiError.message || "An unexpected error occurred."}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        setError('');
        setSuccessMessage('');
        setIsLoading(true);
        console.log('Attempting password reset for email:', formData.email);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
                redirectTo: FRONTEND_PUBLIC_URL + '/reset-password',
            });
            if (error) {
                console.error('Supabase password reset request failed:', error.message);
                throw error;
            }
            console.log('Password reset email successfully sent to:', formData.email);
            setSuccessMessage('Password reset email sent! Please check your inbox.');
        } catch (apiError) {
            console.error('Password reset failed in AuthPage:', apiError.message || "An unexpected error occurred.");
            setError(`Password reset failed: ${apiError.message || "An unexpected error occurred."}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendConfirmation = async () => {
        setError('');
        setSuccessMessage('');
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: formData.email,
            });
            if (error) throw error;
            setSuccessMessage('Confirmation email re-sent! Try checking your spam folder.');
            setResendTimer(60); // Reset timer
            setCanResend(false);
        } catch (apiError) {
            setError(`Failed to resend confirmation email: ${apiError.message || "An unexpected error occurred."}`);
        } finally {
            setIsLoading(false);
        }
    };

    // ... your existing JSX for the form ...
    const inputGroupClasses = "relative";
    const inputClasses = "relative w-full px-5 py-3 bg-[#1c1c1c] border border-zinc-700 rounded-full text-white placeholder-gray-500 outline-none ring-0 transition-colors peer focus:border-zinc-300 focus:outline-none focus:ring-0";
    const labelClasses = "absolute left-4 -top-2 text-xs text-gray-400 bg-[#1c1c1c] px-2 rounded-md transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:-top-2 peer-focus:text-xs";
    const isSubmitDisabled = isLoading || (isSignUp && !hasAcceptedLegal);

    return (
        <div className="auth-page min-h-[var(--app-height)] bg-black text-gray-300 flex items-center justify-center px-6 py-4 font-inter antialiased">
            <div className={`w-full max-w-sm mx-auto transition-all duration-700 ease-in-out ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex flex-col items-center text-center">
                    <div className="mb-4 flex h-24 items-center justify-center">
                        <img src={NODEMERE_LOGO_SRC} alt="Nodemere logo" className="h-28 w-auto object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-10">{isSignUp ? 'Create an account' : 'Welcome back'}</h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className={inputGroupClasses}>
                        <input id="email" type="email" name="email" placeholder=" " value={formData.email} onChange={handleChange} className={inputClasses} required disabled={isLoading} />
                        <label htmlFor="email" className={labelClasses}>Email</label>
                    </div>

                    <div className={inputGroupClasses}>
                        <input id="password" type="password" name="password" placeholder=" " value={formData.password} onChange={handleChange} className={inputClasses} required disabled={isLoading} />
                        <label htmlFor="password" className={labelClasses}>Password</label>
                    </div>

                    {isSignUp && (
                        <div className={inputGroupClasses}>
                            <input id="confirmPassword" type="password" name="confirmPassword" placeholder=" " value={formData.confirmPassword} onChange={handleChange} className={inputClasses} required disabled={isLoading} />
                            <label htmlFor="confirmPassword" className={labelClasses}>Confirm password</label>
                        </div>
                    )}

                    {isSignUp && <label className="flex items-start gap-3 px-1 text-left text-xs leading-5 text-gray-400">
                        <input
                            type="checkbox"
                            checked={hasAcceptedLegal}
                            onChange={(event) => setHasAcceptedLegal(event.target.checked)}
                            className="mt-1 h-4 w-4 shrink-0 accent-white"
                            disabled={isLoading}
                        />
                        <span>I am authorized to create this business account, agree to the <Link to="/terms" target="_blank" className="text-white underline underline-offset-2">Terms</Link>, <Link to="/privacy-policy" target="_blank" className="text-white underline underline-offset-2">Privacy Policy</Link>, <Link to="/acceptable-use-policy" target="_blank" className="text-white underline underline-offset-2">Acceptable Use Policy</Link>, <Link to="/communications-notice" target="_blank" className="text-white underline underline-offset-2">AI & Recording Notice</Link>, and <Link to="/data-processing-addendum" target="_blank" className="text-white underline underline-offset-2">DPA</Link>, and certify this account is for a permitted general U.S. business use.</span>
                    </label>}

                    <button type="submit" className="w-full py-3 mt-6 text-sm font-semibold text-black bg-gradient-to-r from-[#f7f7f8] to-[#b5b6c4] rounded-full hover:opacity-90 transition-all duration-300 shadow-lg shadow-[#b5b6c4]/10 disabled:opacity-35 disabled:cursor-not-allowed" disabled={isSubmitDisabled}>
                        {isLoading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
                    </button>

                    {error && <p className="text-xs text-red-500 text-center pt-2">{error}</p>}
                    {successMessage && <p className="text-xs text-green-500 text-center pt-2">{successMessage}</p>}
                    {isConfirmationSent && (
                        <p className="text-xs text-center">
                            <button 
                                onClick={handleResendConfirmation}
                                disabled={!canResend || isLoading}
                                className={`font-semibold text-center focus:outline-none transition-colors
                                    ${canResend ? 'text-green-500 hover:text-green-400' : 'text-gray-500 cursor-not-allowed'}`}
                            >
                                Resend confirmation email
                            </button>
                            {!canResend && resendTimer > 0 && (
                                <span className="text-gray-500 ml-2">({resendTimer}s)</span>
                            )}
                        </p>
                    )}
                </form>

                <div className="mt-8 space-y-4">
                    <button onClick={handleGoogleSignIn} className="w-full flex items-center justify-center px-4 py-3 bg-transparent border border-gray-700 rounded-full hover:bg-[#1c1c1c] transition-colors disabled:opacity-50" disabled={isLoading || (isSignUp && !hasAcceptedLegal)}>
                        <img src={googleIcon} alt="Google icon" className="w-5 h-5 mr-3" style={{ backgroundColor: 'transparent' }} />
                        <span className="font-semibold text-xs text-white">Continue with Google</span>
                    </button>
                    
                </div>

                <div className="mt-10 text-center text-xs">
                    <p className="text-gray-500">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                        <button onClick={toggleAuthMode} className="font-semibold text-white hover:text-[#f7f7f8] hover:underline ml-1 focus:outline-none transition-colors" disabled={isLoading}>
                            {isSignUp ? 'Log in' : 'Sign up'}
                        </button>
                    </p>
                    <p className="mt-4">
                        <button onClick={handlePasswordReset} className="font-semibold text-white hover:text-[#f7f7f8] hover:underline focus:outline-none transition-colors" disabled={isLoading}>
                            Forgot password?
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
