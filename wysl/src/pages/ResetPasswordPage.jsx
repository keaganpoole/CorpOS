// src/pages/ResetPasswordPage.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

const ResetPasswordPage = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const { isLoading: isAuthLoading, session } = useAuth(); // Get isLoading and session from AuthContext

    useEffect(() => {
        // If AuthContext has finished loading and there's no session, redirect to auth
        if (!isAuthLoading && !session) {
            navigate('/auth', { replace: true });
        }
    }, [isAuthLoading, session, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsSubmitting(true);

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            setIsSubmitting(false);
            console.warn('Password reset attempt: Passwords do not match.');
            return;
        }

        if (password.length < 6) { // Supabase default minimum password length
            setError('Password must be at least 6 characters long.');
            setIsSubmitting(false);
            console.warn('Password reset attempt: Password too short.');
            return;
        }

        console.log('Attempting to update password...');
        try {
            // The session should be available here due to AuthContext handling
            if (!session) {
                console.error('Password update failed: Auth session missing from AuthContext.');
                throw new Error('Auth session missing!');
            }
            console.log('Auth session found, proceeding with password update.');
            const { data, error } = await supabase.auth.updateUser({ password: password });

            if (error) {
                console.error('Supabase password update failed:', error.message);
                throw error;
            }

            console.log('Password successfully updated for user:', data.user?.email);
            setSuccessMessage('Your password has been updated successfully! Redirecting to dashboard...');
            setTimeout(() => {
                navigate('/dashboard');
            }, 3000); // Redirect after 3 seconds
        } catch (apiError) {
            console.error('Password update failed in ResetPasswordPage:', apiError.message || "An unexpected error occurred.");
            setError(`Failed to update password: ${apiError.message || 'An unexpected error occurred.'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputGroupClasses = "relative group";
    const inputClasses = "relative w-full px-5 py-3 bg-[#1c1c1c] border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-transparent transition-all peer";
    const labelClasses = "absolute left-4 -top-2 text-xs text-gray-400 bg-[#1c1c1c] px-2 rounded-md transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:-top-2 peer-focus:text-xs";
    const gradientBorderClasses = "absolute -inset-px bg-gradient-to-r from-[#7b8afe] to-[#534eef] rounded-full opacity-0 group-focus-within:opacity-100 transition duration-150";

    if (isAuthLoading) {
        return (
            <div className="min-h-[var(--app-height)] bg-black text-gray-300 flex items-center justify-center px-6 py-4 font-inter antialiased">
                <p>Loading session...</p>
            </div>
        );
    }

    return (
        <div className="min-h-[var(--app-height)] bg-black text-gray-300 flex items-center justify-center px-6 py-4 font-inter antialiased">
            <div className="w-full max-w-sm mx-auto">
                <div className="flex flex-col items-center text-center">
                    <h1 className="text-2xl font-bold text-white mb-10">Set New Password</h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className={inputGroupClasses}>
                        <div className={gradientBorderClasses}></div>
                        <input
                            id="password"
                            type="password"
                            name="password"
                            placeholder=" "
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={inputClasses}
                            required
                            disabled={isSubmitting}
                        />
                        <label htmlFor="password" className={labelClasses}>New Password</label>
                    </div>

                    <div className={inputGroupClasses}>
                        <div className={gradientBorderClasses}></div>
                        <input
                            id="confirmPassword"
                            type="password"
                            name="confirmPassword"
                            placeholder=" "
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={inputClasses}
                            required
                            disabled={isSubmitting}
                        />
                        <label htmlFor="confirmPassword" className={labelClasses}>Confirm New Password</label>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 mt-6 text-sm font-semibold text-white bg-gradient-to-r from-[#7b8afe] to-[#534eef] rounded-full hover:opacity-90 transition-all duration-300 shadow-lg shadow-[#534eef]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Updating...' : 'Reset Password'}
                    </button>

                    {error && <p className="text-xs text-red-500 text-center pt-2">{error}</p>}
                    {successMessage && <p className="text-xs text-green-500 text-center pt-2">{successMessage}</p>}
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
