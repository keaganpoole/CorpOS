// src/pages/AuthPage.jsx

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import googleIcon from '../assets/google.png'; // Import the local Google icon
import { LEGAL_ACCEPTANCE_VERSION } from '../legal/legalDocuments';

const API_BASE_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/$/, '');
const FRONTEND_PUBLIC_URL = import.meta.env.VITE_FRONTEND_PUBLIC_URL || window.location.origin;
const NODEMERE_LOGO_SRC = 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/assets/nodemere_logo2.png';
const OAUTH_LEGAL_ACCEPTANCE_STORAGE_KEY = 'nodemere:oauth-legal-acceptance';

console.debug("AuthPage.jsx:event_15");
console.debug("AuthPage.jsx:event_16");
console.debug("AuthPage.jsx:event_17");

const AuthPage = () => {
    const { login, logout, session, profile, refreshProfile, refreshWorkforce, isLoading: isAuthLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { invitationId } = useParams();
    const isInvitation = Boolean(invitationId);
    const [isSignUp, setIsSignUp] = useState(isInvitation || location.state?.isSignUp || false);
    const [invitation, setInvitation] = useState(null);
    const invitationName = invitation?.business_name?.trim();
    const [invitationError, setInvitationError] = useState('');
    const [invitationLoading, setInvitationLoading] = useState(isInvitation);
    const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '' });
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [resendTimer, setResendTimer] = useState(0); // New state for resend timer
    const [canResend, setCanResend] = useState(false); // New state to control resend button
    const [isConfirmationSent, setIsConfirmationSent] = useState(false); // New state to track if confirmation was sent
    const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
    const oauthAcceptanceInFlight = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 10);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!invitationId) return;
        let cancelled = false;
        setInvitationLoading(true);
        axios.get(`${API_BASE_URL}/api/workforce/invitations/${invitationId}/preview`)
            .then(({ data }) => {
                if (cancelled) return;
                setInvitation(data);
                setFormData(prev => ({ ...prev, email: data.email }));
            })
            .catch((requestError) => { if (!cancelled) setInvitationError(requestError.response?.status === 404
                ? 'This invitation has expired, was already used, or access was revoked. Ask the team owner for a new link.'
                : 'We could not load this invitation right now. Please try again shortly.'); })
            .finally(() => { if (!cancelled) setInvitationLoading(false); });
        return () => { cancelled = true; };
    }, [invitationId]);

    useEffect(() => {
        let cancelled = false;
        const continueAfterAuthentication = async () => {
            if (!session || isAuthLoading || oauthAcceptanceInFlight.current || (isInvitation && invitationLoading)) return;
            if (isInvitation && (!invitation || session.user.email?.toLowerCase() !== invitation.email.toLowerCase())) {
                if (invitation) setError(`This invitation is for ${invitation.email}. Sign out and use that account to continue.`);
                return;
            }
            const pendingOAuthAcceptance = sessionStorage.getItem(OAUTH_LEGAL_ACCEPTANCE_STORAGE_KEY);
            if (pendingOAuthAcceptance === LEGAL_ACCEPTANCE_VERSION) {
                oauthAcceptanceInFlight.current = true;
                setIsLoading(true);
                try {
                    await axios.post(
                        `${API_BASE_URL}/users/me/legal-acceptance`,
                        {
                            version: LEGAL_ACCEPTANCE_VERSION,
                            accepted_terms: true,
                            certified_permitted_use: true,
                        },
                        { headers: { Authorization: `Bearer ${session.access_token}` } },
                    );
                    sessionStorage.removeItem(OAUTH_LEGAL_ACCEPTANCE_STORAGE_KEY);
                    await refreshProfile();
                } catch (acceptanceError) {
                    if (!cancelled) setError('Google sign-in completed, but we could not record your legal acceptance. Please try again.');
                    return;
                } finally {
                    oauthAcceptanceInFlight.current = false;
                    if (!cancelled) setIsLoading(false);
                }
            }
            if (cancelled) return;
            if (isInvitation) {
                const currentWorkforce = await refreshWorkforce();
                if (!currentWorkforce) {
                    if (!cancelled) setError('Could not check your team access. Please try opening the invitation again.');
                    return;
                }
                if (cancelled) return;
                navigate(`/dashboard?invite=${invitationId}`, { replace: true });
                return;
            }
            if (!profile?.onboarded) {
                navigate('/onboarding');
                return;
            }

            const pendingPlan = localStorage.getItem('pendingPlan');
            if (pendingPlan) {
                localStorage.removeItem('pendingPlan');
                const { priceId, planSlug, cycle } = JSON.parse(pendingPlan);
                try {
                    const response = await axios.post(
                        `${API_BASE_URL}/create-checkout-session`,
                        { price_id: priceId, plan_slug: planSlug, billing_cycle: cycle },
                        { headers: { Authorization: `Bearer ${session.access_token}` } }
                    );
                    const { url } = response.data;
                    if (url) window.location.href = url;
                } catch (checkoutError) {
                    console.error("AuthPage.jsx:event_63");
                    alert("Could not initiate checkout after login. Please try again.");
                    navigate('/dashboard');
                }
            } else {
                navigate('/dashboard');
            }
        };
        void continueAfterAuthentication();
        return () => { cancelled = true; };
    }, [session, profile?.onboarded, isAuthLoading, navigate, refreshProfile, refreshWorkforce, isInvitation, invitation, invitationLoading, invitationId]);

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
        let invitedAccountCreated = false;

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
                    email: invitation?.email || formData.email,
                    password: formData.password,
                    terms_accepted: true,
                    legal_version: LEGAL_ACCEPTANCE_VERSION,
                    certified_permitted_use: true,
                    ...(invitationId ? { invitation_id: invitationId } : {}),
                });
                if (isInvitation) {
                    invitedAccountCreated = true;
                    await login(invitation.email, formData.password);
                    setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
                    // The invitation route redirects to acceptance after sign-in.
                } else {
                    setSuccessMessage('Please check your email inbox and spam folder for a confirmation link. ');
                    setFormData(prev => ({ ...prev, password: '', confirmPassword: '' })); // Keep email, clear passwords
                    setIsConfirmationSent(true);
                    setResendTimer(60); // Start the 60-second timer
                }
            } else {
                await login(invitation?.email || formData.email, formData.password);
                // The useEffect below will handle redirection based on session and pendingPlan
            }
        } catch (apiError) {
            if (invitedAccountCreated) {
                setIsSignUp(false);
                setError('Your account was created, but sign-in did not finish. Sign in with the password you just chose.');
                return;
            }
            const detail = apiError.response?.data?.detail || "An unexpected error occurred.";
            if (isInvitation && isSignUp && apiError.response?.status === 409) {
                setIsSignUp(false);
                setError(detail);
                return;
            }
            setError(`${isSignUp ? 'Signup' : 'Login'} failed: ${detail}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const toggleAuthMode = () => {
        setIsSignUp(!isSignUp);
        setError('');
        setSuccessMessage('');
        setFormData({ email: invitation?.email || '', password: '', confirmPassword: '' });
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
            if (isSignUp) sessionStorage.setItem(OAUTH_LEGAL_ACCEPTANCE_STORAGE_KEY, LEGAL_ACCEPTANCE_VERSION);
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: FRONTEND_PUBLIC_URL + (invitationId ? `/invite/${invitationId}` : (isSignUp ? '/auth' : '/onboarding')),
                },
            });
            if (error) throw error;
            // Supabase will redirect, so no further action needed here for success
        } catch (apiError) {
            sessionStorage.removeItem(OAUTH_LEGAL_ACCEPTANCE_STORAGE_KEY);
            setError(`Google sign-in failed: ${apiError.message || "An unexpected error occurred."}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        setError('');
        setSuccessMessage('');
        setIsLoading(true);
        console.debug("AuthPage.jsx:event_168");
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
                redirectTo: FRONTEND_PUBLIC_URL + '/reset-password',
            });
            if (error) {
                console.error("AuthPage.jsx:event_174");
                throw error;
            }
            console.debug("AuthPage.jsx:event_177");
            setSuccessMessage('Password reset email sent! Please check your inbox.');
        } catch (apiError) {
            console.error("AuthPage.jsx:event_180");
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
    const inputClasses = "relative w-full pl-6 pr-5 py-3 max-sm:pl-5 max-sm:pr-4 max-sm:py-2.5 max-sm:text-base placeholder:text-[15px] bg-[#1c1c1c] border border-zinc-700 rounded-full text-white placeholder-gray-500 outline-none ring-0 transition-colors peer focus:border-zinc-300 focus:outline-none focus:ring-0";
    const labelClasses = "absolute left-4 -top-2 text-xs text-gray-400 bg-[#1c1c1c] px-2 rounded-md transition-all peer-placeholder-shown:top-3.5 max-sm:peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:-top-2 peer-focus:text-xs";
    const isSubmitDisabled = isLoading || (isSignUp && !hasAcceptedLegal);

    const handleUseDifferentEmail = () => {
        setIsConfirmationSent(false);
        setSuccessMessage('');
        setError('');
        setFormData({ email: '', password: '', confirmPassword: '' });
    };

    if (isInvitation && (invitationLoading || invitationError || (session && invitation && session.user.email?.toLowerCase() !== invitation.email.toLowerCase()))) {
        return <main className="auth-page min-h-[var(--app-height)] bg-black text-gray-300 flex items-center justify-center px-6 font-inter">
            <div className="w-full max-w-sm text-center">
                <img src={NODEMERE_LOGO_SRC} alt="Nodemere" className="mx-auto mb-6 h-20 w-auto object-contain" />
                <h1 className="text-xl font-bold text-white">{invitationLoading ? 'Opening invitation' : invitationError ? 'Invitation unavailable' : invitationName ? `Your invitation to ${invitationName}` : 'Your invitation'}</h1>
                {!invitationLoading && <p className="mt-3 text-sm leading-6 text-zinc-400">{invitationError || `This invitation is for ${invitation.email}. Sign out and continue with that email.`}</p>}
                {session && !invitationError && <button type="button" onClick={logout} className="dashboard-gradient-button mt-6 w-full rounded-full py-3 text-sm font-semibold">Sign out</button>}
            </div>
        </main>;
    }

    if (isConfirmationSent && isSignUp) {
        return (
            <div className="auth-page min-h-[var(--app-height)] bg-black text-gray-300 flex items-center justify-center px-6 py-4 max-sm:px-5 max-sm:py-6 font-inter antialiased">
                <div className={`w-full max-w-md mx-auto transition-all duration-700 ease-in-out ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="rounded-[2rem] border border-zinc-800 bg-[#101010] px-8 py-10 max-sm:px-6 max-sm:py-8 text-center shadow-2xl shadow-black/40">
                        <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white">
                            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75A2.25 2.25 0 0 1 6 4.5h12a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 18 19.5H6a2.25 2.25 0 0 1-2.25-2.25V6.75Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 6 6.18 5.151a2.063 2.063 0 0 0 2.64 0L19.5 6" />
                            </svg>
                        </div>
                        <h1 className="text-3xl max-sm:text-2xl font-bold text-white">Check your email</h1>
                        <p className="mt-4 text-sm leading-6 text-gray-400">
                            {isInvitation ? (invitationName ? `Confirm your email to join ${invitationName}.` : 'Confirm your email to accept the invitation.') : 'We sent a confirmation link to'}
                            <span className="block mt-1 font-semibold text-white break-all">{formData.email}</span>
                        </p>
                        {!isInvitation && <p className="mt-5 text-sm leading-6 text-gray-500">
                            Open the email and click the confirmation button to finish creating your Nodemere account. If you don’t see it, check your spam folder.
                        </p>}
                        <button
                            type="button"
                            onClick={handleResendConfirmation}
                            disabled={!canResend || isLoading}
                            className="mt-8 w-full rounded-full border border-zinc-700 bg-transparent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {isLoading ? 'Sending...' : 'Resend confirmation email'}
                        </button>
                        {!canResend && resendTimer > 0 && <p className="mt-3 text-xs text-gray-500">You can resend in {resendTimer} seconds.</p>}
                        {!isInvitation && <button
                            type="button"
                            onClick={handleUseDifferentEmail}
                            disabled={isLoading}
                            className="mt-5 text-sm font-semibold text-gray-400 transition-colors hover:text-white disabled:opacity-40"
                        >
                            Use a different email
                        </button>}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page min-h-[var(--app-height)] bg-black text-gray-300 flex items-center justify-center px-6 py-4 max-sm:px-5 max-sm:py-6 font-inter antialiased">
            <div className={`w-full max-w-sm mx-auto transition-all duration-700 ease-in-out ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex flex-col items-center text-center">
                    <div className="mb-4 flex h-24 max-sm:mb-2 max-sm:h-16 items-center justify-center">
                        <img src={NODEMERE_LOGO_SRC} alt="Nodemere logo" className="h-28 max-sm:h-20 w-auto object-contain" />
                    </div>
                    {isInvitation ? <div className="mb-8 max-sm:mb-6">
                        <h1 className="max-w-md text-[28px] leading-tight max-sm:text-2xl font-bold tracking-tight text-white">{invitationName ? `Join ${invitationName}` : 'You’re invited'} <span aria-hidden="true">🎉</span></h1>
                        <p className="mt-2 text-sm text-zinc-400">{invitationName ? 'on Nodemere' : 'to Nodemere'}</p>
                    </div> : <h1 className="text-2xl max-sm:text-xl font-bold text-white mb-10 max-sm:mb-6">{isSignUp ? 'Create an account' : 'Welcome back'}</h1>}
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 max-sm:space-y-3.5">
                    {!isInvitation && <div className={inputGroupClasses}>
                        <input id="email" type="email" name="email" placeholder="Email address" value={formData.email} onChange={handleChange} className={inputClasses} required disabled={isLoading} />
                    </div>}

                    <div className={inputGroupClasses}>
                        <input id="password" type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} className={inputClasses} required disabled={isLoading} />
                    </div>

                    {isSignUp && (
                        <div className={inputGroupClasses}>
                            <input id="confirmPassword" type="password" name="confirmPassword" placeholder="Confirm password" value={formData.confirmPassword} onChange={handleChange} className={inputClasses} required disabled={isLoading} />
                        </div>
                    )}

                    {isSignUp && <label className="flex items-start gap-3 px-1 text-left text-xs leading-5 max-sm:leading-[1.35rem] text-gray-400">
                        <input
                            type="checkbox"
                            checked={hasAcceptedLegal}
                            onChange={(event) => setHasAcceptedLegal(event.target.checked)}
                            className="mt-1 h-4 w-4 shrink-0 accent-white"
                            disabled={isLoading}
                        />
                        <span>{isInvitation ? 'I accept the ' : 'I am authorized to create this business account, agree to the '}<Link to="/terms" target="_blank" className="text-white underline underline-offset-2">Terms</Link>, <Link to="/privacy-policy" target="_blank" className="text-white underline underline-offset-2">Privacy Policy</Link>, <Link to="/acceptable-use-policy" target="_blank" className="text-white underline underline-offset-2">Acceptable Use Policy</Link>, <Link to="/communications-notice" target="_blank" className="text-white underline underline-offset-2">AI & Recording Notice</Link>, and <Link to="/data-processing-addendum" target="_blank" className="text-white underline underline-offset-2">DPA</Link>. {isInvitation ? 'I’ll use Nodemere only for permitted business workflows.' : 'I certify this account will be used only for permitted ordinary business workflows; restricted automated workflows require separate approval.'}</span>
                    </label>}

                    <button type="submit" className="dashboard-gradient-button w-full py-3 max-sm:py-2.5 max-sm:min-h-11 mt-6 max-sm:mt-4 text-sm font-semibold rounded-full hover:opacity-90 transition-all duration-300 disabled:opacity-35 disabled:cursor-not-allowed" disabled={isSubmitDisabled}>
                        {isLoading ? 'Processing...' : (isInvitation ? (isSignUp ? 'Create account' : 'Sign in') : (isSignUp ? 'Sign Up' : 'Log In'))}
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

                <div className="mt-8 max-sm:mt-5 space-y-4">
                    <button onClick={handleGoogleSignIn} className="w-full flex items-center justify-center px-4 py-3 max-sm:py-2.5 max-sm:min-h-11 bg-transparent border border-gray-700 rounded-full hover:bg-[#1c1c1c] transition-colors disabled:opacity-50" disabled={isLoading || (isSignUp && !hasAcceptedLegal)}>
                        <img src={googleIcon} alt="Google icon" className="w-5 h-5 mr-3" style={{ backgroundColor: 'transparent' }} />
                        <span className="font-semibold text-xs text-white">Continue with Google</span>
                    </button>
                    
                </div>

                <div className="mt-10 max-sm:mt-6 text-center text-xs">
                    <p className="text-gray-500">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                        <button onClick={toggleAuthMode} className="font-semibold text-white hover:text-[#f7f7f8] hover:underline ml-1 focus:outline-none transition-colors" disabled={isLoading}>
                            {isSignUp ? 'Log in' : 'Sign up'}
                        </button>
                    </p>
                    {!isSignUp && <p className="mt-4 max-sm:mt-3">
                        <button onClick={handlePasswordReset} className="font-semibold text-white hover:text-[#f7f7f8] hover:underline focus:outline-none transition-colors" disabled={isLoading}>
                            Forgot password?
                        </button>
                    </p>}
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
