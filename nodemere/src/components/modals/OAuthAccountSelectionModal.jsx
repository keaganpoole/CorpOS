import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPlus } from '@fortawesome/free-solid-svg-icons';

const OAuthAccountSelectionModal = ({ isOpen, onClose, oauthProvider, savedLogins, onSelectAccount }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[60]" // Higher z-index than CreatePasswordModal
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.99, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.99, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="relative border border-gray-800 rounded-3xl w-full max-w-sm bg-[#1c1c1c] overflow-hidden p-6"
                    >
                        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-gray-100 transition-colors duration-200 active:scale-95 rotate-on-hover">
                            <FontAwesomeIcon icon={faTimes} size="lg" />
                        </button>

                        <h3 className="text-xl font-bold text-gray-50 mb-6 text-center">Select {oauthProvider} Account</h3>

                        <div className="space-y-3 max-h-80 overflow-y-auto hide-scrollbar pr-2">
                            {savedLogins.length > 0 ? (
                                savedLogins.map(login => (
                                    <button
                                        key={login.id}
                                        className="w-full flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-xl hover:bg-gray-700/60 transition-colors duration-200"
                                        onClick={() => {
                                            onSelectAccount(login.id, login.email, login.decryptedPassword);
                                            onClose();
                                        }}
                                    >
                                        <span className="text-gray-100 text-sm font-medium">{login.email}</span>
                                        <span className="text-gray-400 text-xs">Existing</span>
                                    </button>
                                ))
                            ) : (
                                <p className="text-gray-400 text-center text-sm">No saved {oauthProvider} accounts found.</p>
                            )}

                            <button
                                className="w-full flex items-center justify-center p-3 bg-blue-600/80 border border-blue-500 rounded-xl hover:bg-blue-700/80 transition-colors duration-200 text-white font-semibold mt-4"
                                onClick={() => {
                                    onSelectAccount('new', '', ''); // Indicate new account, clear fields
                                    onClose();
                                }}
                            >
                                <FontAwesomeIcon icon={faPlus} className="mr-2" /> Add New Account
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default OAuthAccountSelectionModal;
