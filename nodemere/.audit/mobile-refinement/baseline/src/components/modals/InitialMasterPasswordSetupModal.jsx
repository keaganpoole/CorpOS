import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import colors from '../../../color'; // Import colors

// --- SVG ICONS (for self-containment) ---
const AlertTriangleIcon = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
        <path d="M12 9v4"></path><path d="M12 17h.01"></path>
    </svg>
);

// --- Initial Master Password Setup Modal ---
const InitialMasterPasswordSetupModal = ({ isOpen, onClose, onSetMasterPassword }) => {
    const [step, setStep] = useState(1); // 1: Enter, 2: Confirm
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');
    const [isShaking, setIsShaking] = useState(false);
    const [hasAgreed, setHasAgreed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [gradient, setGradient] = useState('transparent');

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

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setPin('');
            setConfirmPin('');
            setError('');
            setHasAgreed(false);
            setIsSubmitting(false);
            setGradient('transparent');
        }
    }, [isOpen]);

    const handleKeyPress = (key) => {
        if (isSubmitting) return;
        setError('');

        if (key === 'del') {
            if (step === 1) setPin(p => p.slice(0, -1));
            else setConfirmPin(p => p.slice(0, -1));
            return;
        }

        setGradient(digitGradients[key]);

        if (step === 1 && pin.length < 4) {
            setPin(p => p + key);
        } else if (step === 2 && confirmPin.length < 4) {
            setConfirmPin(c => c + key);
        }
    };

    useEffect(() => {
        if (pin.length === 4 && step === 1) {
            const timer = setTimeout(() => setStep(2), 300);
            return () => clearTimeout(timer);
        }
    }, [pin, step]);
    
    const handleSubmit = async () => {
        const commonWeakPins = ['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999'];
        if (commonWeakPins.includes(pin)) {
            setError('This Master Key is too common. Please choose a stronger one.');
            setIsShaking(true);
            setTimeout(() => {
                setStep(1);
                setPin('');
                setConfirmPin('');
                setError('');
                setIsShaking(false);
            }, 1500);
            return;
        }

        if (pin !== confirmPin) {
             setError('PINs do not match. Try again!');
             setIsShaking(true);
             setTimeout(() => {
                setStep(1);
                setPin('');
                setConfirmPin('');
                setError('');
                setIsShaking(false);
             }, 1500);
             return;
        }
        
        setIsSubmitting(true);
        try {
            await onSetMasterPassword(pin);
        } catch (err) {
            setError('Failed to set PIN. Please try again.');
            setIsSubmitting(false);
        }
    };

    const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const canSubmit = pin.length === 4 && confirmPin.length === 4 && hasAgreed && !isSubmitting;
 
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        style={{ '--glow-gradient': gradient }}
                        className={`bg-[#00000] rounded-3xl w-full max-w-sm shadow-2xl border border-white/10 relative overflow-hidden ${isShaking ? 'animate-shake' : ''}`}                    >
                        <div className="absolute inset-0 opacity-20 transition-all duration-500" style={{ background: gradient }}></div>
                        <div className="p-8 relative z-10">
                            <div className="text-center">
                                <h2 className="text-2xl font-bold text-white tracking-tight">
                                    Set Your Master Key
                                </h2>
                                <p className="text-sm text-gray-400 mt-1">
                                    {step === 1 ? 'Choose a strong 4-digit code to gain access to your vault.' : 'Please confirm your 4-digit code.'}
                                </p>
                                <div className="w-full bg-white/10 rounded-full h-1.5 mt-4">
                                    <motion.div
                                        className="bg-gradient-to-r from-[#9e9e9e] to-[#ffffff] h-1.5 rounded-full"
                                        initial={{ width: '0%' }}
                                        animate={{ width: step === 1 ? `${(pin.length / 4) * 50}%` : `${50 + (confirmPin.length / 4) * 50}%` }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                    ></motion.div>
                                </div>
                            </div>

                            <div className="my-8 h-12 flex items-center justify-center gap-4">
                               {Array(4).fill(0).map((_, i) => {
                                   const currentPin = step === 1 ? pin : confirmPin;
                                   const hasDigit = i < currentPin.length;
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
                                    >
                                        {key}
                                    </button>
                                ))}
                                <div /> {/* Empty div for alignment */}
                                <button onClick={() => handleKeyPress('0')} className="h-16 rounded-2xl bg-white/5 text-white text-2xl font-bold transition-all duration-200 backdrop-blur-sm hover:bg-white/20 active:bg-white/30 active:scale-95">
                                    0
                                </button>
                                <button onClick={() => handleKeyPress('del')} className="h-16 rounded-2xl bg-white/5 text-white text-2xl font-bold transition-all duration-200 backdrop-blur-sm hover:bg-white/20 active:bg-white/30 active:scale-95">
                                    ⌫
                                </button>
                            </div>

                            <AnimatePresence>
                            {pin.length === 4 && confirmPin.length === 4 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginTop: '1.5rem' }}
                                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
                                        <AlertTriangleIcon className="w-10 h-10 text-yellow-400 flex-shrink-0" />
                                        <p className="text-xs text-yellow-200 font-semibold">
                                            We do NOT store this key anywhere. Losing it may result in loss of your data.
                                        </p>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer mt-3 text-sm text-gray-300">
                                        <input type="checkbox" checked={hasAgreed} onChange={() => setHasAgreed(!hasAgreed)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500" />
                                        I understand and accept.
                                    </label>
                                    <div className="mt-4 flex justify-center">
                                        <button 
                                            onClick={handleSubmit} 
                                            disabled={!canSubmit}
                                            className="h-14 w-full max-w-xs rounded-2xl text-black font-bold transition-all duration-200 text-lg hover:opacity-90 btn-shine disabled:opacity-40 disabled:cursor-not-allowed hover:from-cyan-400 hover:to-purple-500 active:scale-95"
                                            style={{ background: `linear-gradient(to right, ${colors[0].hex}, ${colors[1].hex})` }}
                                        >
                                            {isSubmitting ? 'Securing...' : 'Confirm'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                            </AnimatePresence>

                            <p className="text-white text-sm text-center mt-4 h-5">{error}</p>
                            

                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default InitialMasterPasswordSetupModal;
