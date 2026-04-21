import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faUnlock, faKey } from '@fortawesome/free-solid-svg-icons';
import '../../styles/MasterPasswordModal.css'; // Reuse the same styles
 
const digitColors = {
    '0': 'linear-gradient(to right, #6b7280, #d1d5db)',
    '1': 'linear-gradient(to right, #ef4444, #f87171)',
    '2': 'linear-gradient(to right, #f97316, #fb923c)',
    '3': 'linear-gradient(to right, #f59e0b, #facc15)',
    '4': 'linear-gradient(to right, #84cc16, #a3e635)',
    '5': 'linear-gradient(to right, #10b981, #34d399)',
    '6': 'linear-gradient(to right, #06b6d4, #22d3ee)',
    '7': 'linear-gradient(to right, #3b82f6, #60a5fa)',
    '8': 'linear-gradient(to right, #8b5cf6, #a78bfa)',
    '9': 'linear-gradient(to right, #ec4899, #f472b6)'
};

const ChangeMasterPinModal = ({ isOpen, onClose, onChangeMasterPassword }) => {
    const [currentPin, setCurrentPin] = useState(['', '', '', '']);
    const [newPin, setNewPin] = useState(['', '', '', '']);
    const [confirmNewPin, setConfirmNewPin] = useState(['', '', '', '']);
    const [step, setStep] = useState(1); // 1: Verify current, 2: Set new
    const [statusMessage, setStatusMessage] = useState('');
    const [isShake, setIsShake] = useState(false);
    const authCardRef = useRef(null);
    const currentPinInputsRef = useRef([]);
    const newPinInputsRef = useRef([]);
    const confirmNewPinInputsRef = useRef([]);

    useEffect(() => {
        if (isOpen) {
            setCurrentPin(['', '', '', '']);
            setNewPin(['', '', '', '']);
            setConfirmNewPin(['', '', '', '']);
            setStep(1);
            setStatusMessage('');
            if (currentPinInputsRef.current[0]) {
                currentPinInputsRef.current[0].focus();
            }
        }
    }, [isOpen]);

    const handlePinChange = (pinState, setPinState, index, value, nextRef) => {
        if (!/^\d*$/.test(value)) return; // Only allow digits

        const newPin = [...pinState];
        newPin[index] = value;
        setPinState(newPin);

        if (value && index < 3) {
            nextRef.current[index + 1].focus();
        }

        if (value) {
            const gradient = digitColors[value] || 'transparent';
            if (authCardRef.current) {
                authCardRef.current.style.setProperty('--glow-gradient', gradient);
            }
        } else if (index === 0) {
            if (authCardRef.current) {
                authCardRef.current.style.setProperty('--glow-gradient', 'transparent');
            }
        }
    };

    const handleKeyDown = (pinState, index, e, prevRef) => {
        if (e.key === 'Backspace' && !pinState[index] && index > 0) {
            prevRef.current[index - 1].focus();
        }
    };

    const handlePaste = useCallback((e, setPinState, pinInputsRef) => {
        e.preventDefault();
        const paste = e.clipboardData.getData('text');
        if (!/^\d{4}$/.test(paste)) return;

        const newPin = paste.split('').slice(0, 4);
        setPinState(newPin);
        newPin.forEach((digit, i) => {
            if (pinInputsRef.current[i]) {
                pinInputsRef.current[i].value = digit;
            }
        });
        if (authCardRef.current) {
            authCardRef.current.style.setProperty('--glow-gradient', digitColors[newPin[3]] || 'transparent');
        }
    }, []);

    useEffect(() => {
        const currentInput = currentPinInputsRef.current[0];
        const newInput = newPinInputsRef.current[0];
        const confirmInput = confirmNewPinInputsRef.current[0];

        if (currentInput && step === 1) {
            currentInput.addEventListener('paste', (e) => handlePaste(e, setCurrentPin, currentPinInputsRef));
        }
        if (newInput && step === 2) {
            newInput.addEventListener('paste', (e) => handlePaste(e, setNewPin, newPinInputsRef));
        }
        if (confirmInput && step === 2) {
            confirmInput.addEventListener('paste', (e) => handlePaste(e, setConfirmNewPin, confirmNewPinInputsRef));
        }

        return () => {
            if (currentInput) currentInput.removeEventListener('paste', (e) => handlePaste(e, setCurrentPin, currentPinInputsRef));
            if (newInput) newInput.removeEventListener('paste', (e) => handlePaste(e, setNewPin, newPinInputsRef));
            if (confirmInput) confirmInput.removeEventListener('paste', (e) => handlePaste(e, setConfirmNewPin, confirmNewPinInputsRef));
        };
    }, [handlePaste, step]);

    const handleVerifyCurrentPin = async () => {
        setStatusMessage('');
        setIsShake(false);
        const enteredCurrentPin = currentPin.join('');
        if (enteredCurrentPin.length !== 4) {
            setStatusMessage('Please enter your current 4-digit PIN.');
            setIsShake(true);
            return;
        }

        const success = await onChangeMasterPassword(enteredCurrentPin, null, true); // Pass null for newPin, true for verifyOnly
        if (success) {
            setStatusMessage('Current PIN verified. Now set your new PIN.');
            setStep(2);
            setTimeout(() => {
                if (newPinInputsRef.current[0]) newPinInputsRef.current[0].focus();
            }, 0);
        } else {
            setStatusMessage('Invalid current PIN. Please try again.');
            setIsShake(true);
            setTimeout(() => {
                setIsShake(false);
                setCurrentPin(['', '', '', '']);
                if (currentPinInputsRef.current[0]) currentPinInputsRef.current[0].focus();
                if (authCardRef.current) authCardRef.current.style.setProperty('--glow-gradient', 'transparent');
            }, 1000);
        }
    };

    const handleSetNewPin = async () => {
        setStatusMessage('');
        setIsShake(false);
        const enteredNewPin = newPin.join('');
        const enteredConfirmNewPin = confirmNewPin.join('');

        if (enteredNewPin.length !== 4 || enteredConfirmNewPin.length !== 4) {
            setStatusMessage('Please enter a 4-digit new PIN and confirm it.');
            setIsShake(true);
            return;
        }

        if (enteredNewPin !== enteredConfirmNewPin) {
            setStatusMessage('New PINs do not match. Please try again.');
            setIsShake(true);
            setTimeout(() => {
                setIsShake(false);
                setNewPin(['', '', '', '']);
                setConfirmNewPin(['', '', '', '']);
                if (newPinInputsRef.current[0]) newPinInputsRef.current[0].focus();
                if (authCardRef.current) authCardRef.current.style.setProperty('--glow-gradient', 'transparent');
            }, 1000);
            return;
        }

        if (enteredNewPin === currentPin.join('')) {
            setStatusMessage('New PIN cannot be the same as the current PIN.');
            setIsShake(true);
            setTimeout(() => {
                setIsShake(false);
                setNewPin(['', '', '', '']);
                setConfirmNewPin(['', '', '', '']);
                if (newPinInputsRef.current[0]) newPinInputsRef.current[0].focus();
                if (authCardRef.current) authCardRef.current.style.setProperty('--glow-gradient', 'transparent');
            }, 1000);
            return;
        }

        const success = await onChangeMasterPassword(currentPin.join(''), enteredNewPin, false); // Pass false for verifyOnly
        if (success) {
            setStatusMessage('Master PIN changed successfully!');
            setTimeout(() => onClose(), 1500); // Close after a short delay
        } else {
            setStatusMessage('Failed to change Master PIN. Please try again.');
            setIsShake(true);
            setTimeout(() => {
                setIsShake(false);
                setNewPin(['', '', '', '']);
                setConfirmNewPin(['', '', '', '']);
                if (newPinInputsRef.current[0]) newPinInputsRef.current[0].focus();
                if (authCardRef.current) authCardRef.current.style.setProperty('--glow-gradient', 'transparent');
            }, 1000);
        }
    };

    const renderPinInputs = (pinState, setPinState, inputRefs, prevRef, nextRef) => (
        <div className="pin-container flex justify-center gap-3 sm:gap-4 mb-8">
            {pinState.map((digit, index) => (
                <input
                    key={index}
                    type="tel"
                    maxLength="1"
                    className="pin-input"
                    value={digit}
                    onChange={(e) => handlePinChange(pinState, setPinState, index, e.target.value, nextRef)}
                    onKeyDown={(e) => handleKeyDown(pinState, index, e, prevRef)}
                    ref={(el) => (inputRefs.current[index] = el)}
                    autoFocus={index === 0}
                />
            ))}
        </div>
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="master-password-modal-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        ref={authCardRef}
                        className={`auth-card ${isShake ? 'shake' : ''}`}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                    >
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-bold mb-1 transition-all duration-300">
                                {step === 1 ? 'Verify Current PIN' : 'Set New Master PIN'}
                            </h1>
                            <p className="text-slate-400 text-sm">
                                {step === 1 ? 'Please enter your current 4-digit code.' : 'Enter and confirm your new 4-digit code.'}
                            </p>
                        </div>

                        {step === 1 ? (
                            <>
                                {renderPinInputs(currentPin, setCurrentPin, currentPinInputsRef, currentPinInputsRef, currentPinInputsRef)}
                                <button
                                    onClick={handleVerifyCurrentPin}
                                    className="w-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 p-3 rounded-lg text-white font-bold transition-all shadow-lg hover:shadow-blue-500/50"
                                >
                                    <FontAwesomeIcon icon={faUnlock} className="mr-2" />
                                    Verify PIN
                                </button>
                            </>
                        ) : (
                            <>
                                <h3 className="text-xl font-semibold text-white mb-4">New PIN</h3>
                                {renderPinInputs(newPin, setNewPin, newPinInputsRef, newPinInputsRef, newPinInputsRef)}
                                <h3 className="text-xl font-semibold text-white mb-4">Confirm New PIN</h3>
                                {renderPinInputs(confirmNewPin, setConfirmNewPin, confirmNewPinInputsRef, newPinInputsRef, confirmNewPinInputsRef)}
                                <button
                                    onClick={handleSetNewPin}
                                    className="w-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 p-3 rounded-lg text-white font-bold transition-all shadow-lg hover:shadow-blue-500/50"
                                >
                                    <FontAwesomeIcon icon={faKey} className="mr-2" />
                                    Change PIN
                                </button>
                            </>
                        )}

                        <p className={`mt-4 text-center font-medium h-5 ${statusMessage.includes('Granted') || statusMessage.includes('verified') || statusMessage.includes('successfully') ? 'text-green-400' : 'text-red-400'}`}>
                            {statusMessage}
                        </p>
                        <button onClick={onClose} className="close-btn absolute top-4 right-4 text-slate-400 hover:text-white">
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ChangeMasterPinModal;
