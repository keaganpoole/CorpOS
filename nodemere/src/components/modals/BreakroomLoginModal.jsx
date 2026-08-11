// src/components/modals/BreakroomLoginModal.jsx
import React, { useState, useEffect } from 'react';
import { unauthenticatedApi } from '../../services/apiService'; // Import the new unauthenticated instance

const BreakroomLoginModal = ({ onLogin }) => {
    const [formData, setFormData] = useState({ rep_id: '', password: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 10);
        return () => clearTimeout(timer);
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'rep_id') {
            // Allow only numbers
            const numericValue = value.replace(/[^0-9]/g, '');
            setFormData(prev => ({ ...prev, [name]: numericValue }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // Use the unauthenticatedApi instance for this request
            const response = await unauthenticatedApi.post('/breakroom/login', {
                rep_id: formData.rep_id,
                password: formData.password,
            });
            
            // The actual data is in response.data
            if (response.data && response.data.access_token) {
                localStorage.setItem('rep_token', response.data.access_token);
                onLogin();
            } else {
                // This case might occur if the backend returns a 200 OK but no token.
                setError("Login failed. Please try again.");
            }
        } catch (err) {
            // --- Enhanced Error Logging ---
            console.error("Breakroom Login Error:", err);
            if (err.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                console.error("Error Response Data:", err.response.data);
                console.error("Error Response Status:", err.response.status);
                setError(err.response.data.detail || `Error: ${err.response.status}`);
            } else if (err.request) {
                // The request was made but no response was received
                console.error("Error Request:", err.request);
                setError("Network error. Could not connect to the server.");
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error("Error Message:", err.message);
                setError("An unexpected error occurred. Please try again.");
            }
            // --- End Enhanced Error Logging ---
        } finally {
            setIsLoading(false);
        }
    };
    
    const inputGroupClasses = "relative group";
    const inputClasses = "relative w-full px-5 py-3 bg-[#1c1c1c] border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-transparent transition-all peer";
    const labelClasses = "absolute left-4 -top-2 text-xs text-gray-400 bg-[#1c1c1c] px-2 rounded-md transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-focus:-top-2 peer-focus:text-xs";
    const gradientBorderClasses = "absolute -inset-px bg-gradient-to-r from-[var(--color1)] to-[var(--color2)] rounded-full opacity-0 group-focus-within:opacity-100 transition duration-150";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className={`w-full max-w-lg mx-auto transition-all duration-700 ease-in-out ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="bg-[#121212]/90 backdrop-blur-lg px-8 py-16 rounded-2xl shadow-2xl shadow-black/60 border border-gray-800/50">
                    <div className="flex flex-col items-center text-center mb-10">
                        <div style={{ width: '115px', aspectRatio: '19 / 17' }} className="mb-8">
                            <img src="https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/assets/nodemere_logo2.png" alt="Nodemere logo" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-3xl font-bold text-white">Breakroom Access</h1>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className={inputGroupClasses}>
                            <div className={gradientBorderClasses}></div>
                            <input id="rep_id" type="text" name="rep_id" placeholder=" " value={formData.rep_id} onChange={handleChange} className={inputClasses} required disabled={isLoading} />
                            <label htmlFor="rep_id" className={labelClasses}>Rep ID</label>
                        </div>

                        <div className={inputGroupClasses}>
                            <div className={gradientBorderClasses}></div>
                            <input id="password" type="password" name="password" placeholder=" " value={formData.password} onChange={handleChange} className={inputClasses} required disabled={isLoading} />
                            <label htmlFor="password" className={labelClasses}>Password</label>
                        </div>

                        <button type="submit" className="w-full py-3 mt-6 font-semibold text-white rounded-full hover:opacity-90 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: 'linear-gradient(to right, var(--color1), var(--color2))' }} disabled={isLoading}>
                            {isLoading ? 'Verifying...' : 'Authenticate'}
                        </button>

                        {error && <p className="text-sm text-red-500 text-center pt-2">{error}</p>}
                    </form>
                </div>
            </div>
        </div>
    );
};

export default BreakroomLoginModal;
