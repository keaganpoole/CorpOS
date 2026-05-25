import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import colors from '../../../color';

// Import OAuth provider icons
import googleIcon from '../../assets/googleicon.png';
import appleIcon from '../../assets/appleicon.png';
import facebookIcon from '../../assets/facebookicon.png';
import microsoftIcon from '../../assets/microsofticon.png';
import githubIcon from '../../assets/githubicon.png';
import { useMemo } from 'react';

const OAuthSelectionModal = ({ isOpen, onClose, oauthProviders, onSelectProvider }) => {
    const oauthIconMap = useMemo(() => ({
        'Google': googleIcon,
        'Apple': appleIcon,
        'Facebook': facebookIcon,
        'Microsoft': microsoftIcon,
        'GitHub': githubIcon,
    }), []);
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[60]"
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

                        <h3 className="text-xl font-bold text-gray-50 mb-6 text-center">Select Popular Login</h3>

                        <div className="space-y-3 max-h-80 overflow-y-auto hide-scrollbar pr-2">
                            {oauthProviders.map((provider) => (
                                <button
                                    key={provider.name}
                                    className="w-full flex items-center p-3 border border-gray-700 rounded-xl hover:bg-gray-700/60 transition-colors duration-200"
                                    onClick={() => onSelectProvider(provider.name)}
                                >
                                    {oauthIconMap[provider.name] ? (
                                        <img
                                            src={oauthIconMap[provider.name]}
                                            alt={`${provider.name} logo`}
                                            className="w-7 h-7 object-contain mr-3"
                                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/32x32/1e293b/94a3b8?text=?'; }}
                                        />
                                    ) : (
                                        <span className="w-7 h-7 flex items-center justify-center text-gray-400 text-xs mr-3">?</span>
                                    )}
                                    <span className="text-gray-100 text-sm font-medium">{provider.display || provider.name}</span>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default OAuthSelectionModal;