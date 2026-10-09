import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SavedAccountsModal = ({ isOpen, onClose, savedLogins, onSelectLogin, selectedOAuthProvider }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.99, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.99, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="relative border border-gray-800 rounded-3xl w-full max-w-md overflow-hidden"
                    >
                        <div className="relative z-20 rounded-3xl p-8 space-y-8 flex flex-col backdrop-blur-sm">
                            <header className="modal-header flex justify-between items-center mb-5">
                                <h2 className="text-xl font-bold text-white text-center flex-grow">Saved {selectedOAuthProvider} Accounts</h2>
                                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors rotate-on-hover">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </header>

                            <div className="space-y-2 max-h-96 overflow-y-auto pr-2 hide-scrollbar">
                                {savedLogins.map(login => (
                                    <button
                                        key={login.id}
                                        className="w-full text-left px-3 py-2 bg-[#1c1c1c] border border-gray-700 rounded-lg text-white hover:border-white transition-colors duration-200"
                                        onClick={() => {
                                            onSelectLogin(login);
                                            onClose();
                                        }}
                                    >
                                        <p className="font-medium text-sm">{login.email}</p>
                                        {login.decryptedPassword && <p className="text-xs text-gray-400">Password: {login.decryptedPassword}</p>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SavedAccountsModal;