import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faUnlock } from '@fortawesome/free-solid-svg-icons';
import colors from '../../../color'; // Import colors
import '../../styles/MasterPasswordModal.css';
import { fetchUserLockoutData, updateUserFailedAttempts } from '../../supabaseClient';

const digitGradients = {
    '0': 'radial-gradient(circle at 100% 0%, #888, transparent 50%)',
    '1': 'radial-gradient(circle at 100% 0%, #f472b6, transparent 50%)',
    '2': 'radial-gradient(circle at 100% 0%, #c084fc, transparent 50%)',
    '3': 'radial-gradient(circle at 100% 0%, #818cf8, transparent 50%)',
    '4': 'radial-gradient(circle at 100% 0%, #60a5fa, transparent 50%)',
    '5': 'radial-gradient(circle at 100% 0%, #38bdf8, transparent 50%)',
    '6': 'radial-gradient(circle at 100% 0%, #22d3ee, transparent 50%)',
    '7': 'radial-gradient(circle at 100% 0%, #34d399, transparent 50%)',
    '8': 'radial-gradient(circle at 100% 0%, #a3e635, transparent 50%)',
    '9': 'radial-gradient(circle at 100% 0%, #facc15, transparent 50%)',
};

const MasterPasswordModal = ({ isOpen, onAuthenticate, onClose, isLockedOut }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isShaking, setIsShaking] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [gradient, setGradient] = useState('transparent');
    const [failedAttempts, setFailedAttempts] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError('');
            setIsAuthenticating(false);
            setGradient('transparent');
            setFailedAttempts(0);
        }
    }, [isOpen]);

    const handleKeyPress = (key) => {
        if (isAuthenticating || isLockedOut) return;
        setError('');

        if (key === 'del') {
            setPin(p => p.slice(0, -1));
            return;
        }

        setGradient(digitGradients[key]);

        if (pin.length < 4) {
            setPin(p => p + key);
        }
    };

    useEffect(() => {
        if (pin.length === 4 && !isLockedOut) {
            handleSubmit();
        }
    }, [pin, isLockedOut]);
    
    const handleSubmit = async () => {
        setIsAuthenticating(true);
        try {
            const success = await onAuthenticate(pin);
            if (success) {
                // Reset failed attempts on successful authentication (handled by Supabase daily reset)
                setFailedAttempts(0);
                // Modal will close via parent component's state update
            } else {
                const newFailedAttempts = failedAttempts + 1;
                setFailedAttempts(newFailedAttempts);
                await updateUserFailedAttempts(newFailedAttempts);
                setError('Invalid PIN. Please try again.');
                setIsShaking(true);
                setTimeout(() => {
                    setPin('');
                    setError('');
                    setIsShaking(false);
                    setGradient('transparent');
                }, 1500);
            }
        } catch (err) {
            setError('Authentication failed. Please try again.');
            console.error("MasterPasswordModal.jsx:event_85");
            setIsShaking(true);
            setTimeout(() => {
                setPin('');
                setError('');
                setIsShaking(false);
                setGradient('transparent');
            }, 1500);
        } finally {
            setIsAuthenticating(false);
        }
    };

    const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        style={{ '--glow-gradient': gradient }}
                        className={`bg-black rounded-3xl w-full max-w-sm shadow-2xl border border-white/10 relative overflow-hidden ${isShaking ? 'animate-shake' : ''}`}
                    >
                        <div className="absolute inset-0 opacity-20 transition-all duration-500" style={{ background: gradient }}></div>
                        <div className="p-8 relative z-10">
                            <div className="text-center">
                                <h2 className="text-2xl font-bold text-white tracking-tight">
                                    Enter Master Key
                                </h2>
                                <p className="text-sm text-gray-400 mt-1">
                                    Please enter your 4-digit code to unlock your vault.
                                </p>
                            </div>

                            <div className="my-8 h-12 flex items-center justify-center gap-4">
                               {Array(4).fill(0).map((_, i) => {
                                   const hasDigit = i < pin.length;
                                   return (
                                     <motion.div 
                                        key={i} 
                                        className="w-4 h-4 rounded-full bg-white/20"
                                        animate={{ 
                                            backgroundColor: hasDigit ? '#ffffff' : 'rgba(255,255,255,0.2)',
                                            scale: hasDigit ? [1, 1.3, 1] : 1,
                                            boxShadow: hasDigit ? '0 0 10px #fff' : 'none'
                                        }}
                                        transition={{ duration: 0.2 }}
                                      />
                                   );
                               })}
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                {numpadKeys.map(key => (
                                    <button 
                                        key={key} 
                                        onClick={() => handleKeyPress(key)} 
                                        className="h-16 rounded-2xl bg-white/5 text-white text-2xl font-bold transition-all duration-200 backdrop-blur-sm hover:bg-white/20 active:bg-white/30 active:scale-95"
                                        disabled={isLockedOut}
                                    >
                                        {key}
                                    </button>
                                ))}
                                <div /> {/* Empty div for alignment */}
                                <button onClick={() => handleKeyPress('0')} className="h-16 rounded-2xl bg-white/5 text-white text-2xl font-bold transition-all duration-200 backdrop-blur-sm hover:bg-white/20 active:bg-white/30 active:scale-95" disabled={isLockedOut}>
                                    0
                                </button>
                                <button onClick={() => handleKeyPress('del')} className="h-16 rounded-2xl bg-white/5 text-white text-2xl font-bold transition-all duration-200 backdrop-blur-sm hover:bg-white/20 active:bg-white/30 active:scale-95" disabled={isLockedOut}>
                                    ⌫
                                </button>
                            </div>



                            <p className="text-red-400 text-sm text-center mt-4 h-5">{error}</p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default MasterPasswordModal;
