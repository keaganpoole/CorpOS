// src/pages/PasswordsPage.jsx
import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { faPlus, faTimes, faKey, faSearch, faExclamationTriangle, faPaintBrush, faBoxesStacked } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Link } from 'react-router-dom';
import AccountSettings from '../components/dashboard/AccountSettings';
import { getPasswords, createPassword, updatePassword, deletePassword, getUserProfile, updateIntroMasterKey, getOAuthAccounts, fetchPlanDetails } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import LimitReachedModal from '../components/modals/LimitReachedModal';
import MasterPasswordModal from '../components/modals/MasterPasswordModal';
import CreatePasswordModal from '../components/modals/CreatePasswordModal';
import OAuthAccountModal from '../components/modals/OAuthAccountModal'; // New import for OAuthAccountModal
import OAuthSelectionModal from '../components/modals/OAuthSelectionModal'; // Import the new OAuthSelectionModal
import InitialMasterPasswordSetupModal from '../components/modals/InitialMasterPasswordSetupModal'; // New import
import ChangeMasterPinModal from '../components/modals/ChangeMasterPinModal'; // Import the new modal
import SplashScreen from '../components/SplashScreen';
import {
  deriveKeyFromPin,
  encrypt,
  decrypt,
  getPinHash,
  uint8ArrayToHex,
  hexToUint8Array,
} from '../utils/crypto';
import { supabase, fetchMasterKeyData, updateMasterKeyData, fetchUserLockoutData, updateUserFailedAttempts, updateUserLockoutData } from '../supabaseClient';
import '../styles/PasswordsPage.css';
import '../styles/MasterPasswordModal.css';

// Import OAuth provider icons
import googleIcon from '../assets/googleicon.png';
import appleIcon from '../assets/appleicon.png';
import facebookIcon from '../assets/facebookicon.png';
import microsoftIcon from '../assets/microsofticon.png';
import githubIcon from '../assets/githubicon.png';


// --- ICON LIBRARY (Replacing Font Awesome with Inline SVGs) ---

const Icon = ({ name, className = 'w-5 h-5', style = {}, isFilled = false }) => {
    // Lucide/simple style SVG paths
    const iconPaths = {
        // SVG paths are stroke-based (strokeLinecap="round" strokeLinejoin="round")
        'Copy': "M9 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4 M14 5l6 6M13 11a3 3 0 0 1 3-3H9M11 11V5a3 3 0 0 1 3-3h7a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3h-3",
        'Trash': "M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6",
        'Star': "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2Z",
        'CheckCircle': "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z M9 12l2 2 4-4",
        'ChevronDown': "M6 9l6 6 6-6",
        'ExternalLink': "M15 3h6v6 M10 14l11-11 M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
        // New icons for show/hide
        'Eye': "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
        'EyeOff': "M17.94 17.94A10 10 0 0 1 12 20c-7 0-10-7-10-7a1.07 1.07 0 0 1 0-1.46 M10 5.4A8 8 0 0 1 12 5c7 0 10 7 10 7a.78.78 0 0 1-1.34 1.12 M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M2 2l20 20",
        'Phone': "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-0.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-0.45 12.84 12.84 0 0 0 2.81 0.7A2 2 0 0 1 22 16.92Z"
    };

    const SVG = ({ d }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill={isFilled ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className} style={style}>
            <path strokeLinecap="round" strokeLinejoin="round" d={d} />
        </svg>
    );

    const iconData = iconPaths[name];

    if (!iconData) return <span className={className}>?</span>;

    return <SVG d={iconData} />;
};

// Helper to extract domain from URL for Clearbit
const getDomainFromUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    // Remove 'www.' if present
    let hostname = parsedUrl.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch (e) {
    // Fallback for malformed URLs or just domain strings
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\?#]+)/i);
    return match ? match[1] : null;
  }
};

// --- HELPER COMPONENTS (Minimalist versions) ---

const Toast = ({ message, isVisible, textColor = '#000000' }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        className="fixed bottom-4 right-4 z-50 px-4 py-1 rounded-lg shadow-xl flex items-center space-x-2 backdrop-blur-sm"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        style={{ background: 'linear-gradient(to right, #ffffff, #f0f0f0)', color: textColor }}
      >
        <Icon name="CheckCircle" className="w-5 h-5 fill-none" style={{ stroke: textColor }} />
        <span>{message}</span>
      </motion.div>
    )}
  </AnimatePresence>
);

import ConfirmationModal from '../components/modals/ConfirmationModal';

// Sub-component for clean display of details
// Handles optional icons. Username and Notes will be called without iconName.
const DetailRow = ({ iconName, label, value, onCopy, isLink = false, onSave, fieldName, inputType = 'text', showCallIcon = false, isEditable = true }) => {
  const [inputValue, setInputValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleBlur = () => {
    if (inputValue !== value) {
      onSave(inputValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    }
  };

  const handleInput = (e) => {
    const target = e.currentTarget;
    const selection = window.getSelection();
    const originalRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    let originalCaretOffset = 0;

    if (originalRange) {
      const preCaretRange = originalRange.cloneRange();
      preCaretRange.selectNodeContents(target);
      preCaretRange.setEnd(originalRange.endContainer, originalRange.endOffset);
      originalCaretOffset = preCaretRange.toString().length;
    }

    let newText = target.textContent;
    let newCaretOffset = originalCaretOffset;

    if (inputType === 'phone') {
      const numericText = newText.replace(/[^0-9]/g, '');
      if (newText !== numericText) {
        newText = numericText;
        // Adjust caret offset if characters were removed before it
        const charsBeforeCaret = target.textContent.substring(0, originalCaretOffset);
        const numericCharsBeforeCaret = charsBeforeCaret.replace(/[^0-9]/g, '');
        newCaretOffset = numericCharsBeforeCaret.length;
      }
    }

    setInputValue(newText);

    requestAnimationFrame(() => {
      if (target.firstChild && selection && originalRange) {
        const newRange = document.createRange();
        newRange.setStart(target.firstChild, Math.min(newCaretOffset, target.firstChild.length));
        newRange.setEnd(target.firstChild, Math.min(newCaretOffset, target.firstChild.length));
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    });
  };

  const handleCall = (e) => {
    e.stopPropagation();
    if (value) {
      window.open(`tel:${value}`);
    }
  };

  return (
    <div className="flex items-start justify-between text-sm">
        <div className="flex items-center space-x-2 w-1/4 flex-shrink-0">
            {iconName && <Icon name={iconName} className="text-gray-500 w-4 h-4" />}
            <span className="text-gray-500 font-medium">{label}:</span>
        </div>
        <div className="flex-grow min-w-0 flex items-center justify-end space-x-2">
            {isLink ? (
                <a 
                    href={value} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-400 hover:text-blue-300 transition-colors truncate"
                    onClick={(e) => e.stopPropagation()}
                >
                    {value}
                </a>
            ) : (
                <div
                  ref={ref}
                  contentEditable={isEditable}
                  suppressContentEditableWarning={true}
                  onBlur={handleBlur}
                  onFocus={() => setIsEditing(true)}
                  onKeyDown={handleKeyDown}
                  onInput={handleInput}
                  inputMode={inputType === 'phone' ? 'numeric' : 'text'}
                  className={`text-gray-300 truncate text-right outline-none cursor-text ${isEditing && isEditable ? 'bg-gray-700/50 rounded px-1' : ''}`}
                >
                  {inputValue}
                </div>
            )}
            {showCallIcon && value && (
                <button onClick={handleCall} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors">
                    <Icon name="Phone" className="w-4 h-4" />
                </button>
            )}
            {onCopy && (
                <button onClick={(e) => { e.stopPropagation(); onCopy(); }} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors">
                    <Icon name="Copy" className="w-4 h-4" />
                </button>
            )}
        </div>
    </div>
  );
};

// --- STUNNING PASSWORD CARD ---

const StunningPasswordCard = memo(({ password: initialPassword, onUpdate, onDelete, encryptionKey, selectedCard, setSelectedCard, cardSize, oauthProvider, showNotification, getGradientColor }) => {
  const [decryptedPassword, setDecryptedPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null); // New state for Clearbit logo
  const accountRef = useRef(null);
  const passwordInputRef = useRef(null);

  const oauthProviders = useMemo(() => ({
    'Google': { domain: 'google.com', display: 'Google' },
    'Apple': { domain: 'apple.com', display: 'Apple' },
    'Facebook': { domain: 'facebook.com', display: 'Facebook' },
    'Microsoft': { domain: 'microsoft.com', display: 'Microsoft' },
    'GitHub': { domain: 'github.com', display: 'GitHub' },
    'Other': { domain: null, display: 'Other' },
  }), []);

  const oauthIconMap = useMemo(() => ({
    'Google': googleIcon,
    'Apple': appleIcon,
    'Facebook': facebookIcon,
    'Microsoft': microsoftIcon,
    'GitHub': githubIcon,
  }), []);


  useEffect(() => {
    const decryptPassword = async () => {
      if (initialPassword.password && encryptionKey) {
        try {
          const encryptedData = JSON.parse(initialPassword.password);
          const decrypted = await decrypt(
            { ciphertext: new Uint8Array(encryptedData.ciphertext), iv: new Uint8Array(encryptedData.iv) },
            encryptionKey
          );
          setDecryptedPassword(decrypted);
        } catch (e) {
          console.error("PasswordsPage.jsx:event_269");
          setDecryptedPassword('[Decryption Error]');
        }
      }
    };
    decryptPassword();
  }, [initialPassword.password, encryptionKey]);

  // New useEffect to fetch Clearbit logo
  useEffect(() => {
    console.debug("PasswordsPage.jsx:event_279");
    if (initialPassword.url) {
      setLogoUrl(initialPassword.url);
      console.debug("PasswordsPage.jsx:event_282");
    } else if (initialPassword.account) {
      const domain = getDomainFromUrl(initialPassword.account);
      if (domain) {
        setLogoUrl(`https://img.logo.dev/${domain}?token=pk_Hs9X4-PFTGOl4sEhLWXJjg&size=32`);
        console.debug("PasswordsPage.jsx:event_287");
      } else {
        setLogoUrl(null);
        console.log("StunningPasswordCard: No valid domain from account name, setting logoUrl to null");
      }
    } else {
      setLogoUrl(null);
      console.log("StunningPasswordCard: No initialPassword.url or initialPassword.account, setting logoUrl to null");
    }
  }, [initialPassword.url, initialPassword.account]);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    showNotification(`Copied ${type}!`);
    setIsPasswordVisible(false); // Hide password after copying
  };

  const handleToggleFavorite = () => {
    const newFavoriteStatus = !initialPassword.isFavorite;
    onUpdate(initialPassword.id, { isFavorite: newFavoriteStatus });
    showNotification(newFavoriteStatus ? 'Added to Favorites!' : 'Removed from Favorites!');
  };

  const handleDeleteConfirm = () => {
    onDelete(initialPassword.id);
    setIsDeleteModalOpen(false);
    showNotification('Password entry deleted.');
  };
  
  const handleSave = (field) => async (newValue) => {
    let updatedValue = newValue;
    let updates = { [field]: updatedValue };

    if (field === 'password') {
      // If password is being updated, clear any existing OAuth provider
      if (initialPassword.oauth) {
        updates.oauth = null;
      }
    } else if (field === 'account') {
      const domain = getDomainFromUrl(newValue);
      updates.url = domain ? `https://logo.clearbit.com/${domain}?size=32` : null;
    }

    onUpdate(initialPassword.id, updates);
    showNotification(`Updated ${field.toLowerCase()}`);
  };

  const handleAccountBlur = () => {
    if (accountRef.current.textContent !== initialPassword.account) {
        handleSave('account')(accountRef.current.textContent);
    }
    setIsEditingAccount(false);
  };
  
  const handleAccountKey = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        accountRef.current.blur();
    }
  };

  const gradientColor = getGradientColor(initialPassword.account);
  const passwordDisplay = isPasswordVisible ? decryptedPassword : '•'.repeat(decryptedPassword.length > 0 ? 12 : 1);

  // Render initials for the small account avatar
  const getInitials = (account) => {
    if (!account) return '?';
    const words = account.split(' ');
    if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
    return account.substring(0, 2).toUpperCase();
  };

  // Card Variants for framer-motion
  const cardVariants = {
    initial: { scale: 0.98, opacity: 0.5 },
    animate: { scale: 1, opacity: 1 },
    hover: { y: -2, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)" },
  };

  const currentOAuthProvider = initialPassword.oauth || oauthProvider;
  const oauthLogoDomain = currentOAuthProvider && oauthProviders[currentOAuthProvider]?.domain;

  return (
    <motion.div
      className={`relative p-0 rounded-2xl overflow-hidden cursor-pointer w-full max-w-lg mx-auto password-card ${selectedCard === initialPassword.id ? 'selected' : ''}`}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={(e) => {
        // Only toggle details if the click originated directly on the card or its immediate children
        // and not on interactive elements within the card (buttons, links, editable divs)
        if (e.target === e.currentTarget || e.target.classList.contains('password-card-inner-content')) {
          setIsDetailsExpanded(prev => !prev);
        }
        setSelectedCard(initialPassword.id);
      }}
    >
      {/* Visual Gradient Border Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/0 to-transparent opacity-10 transition-opacity duration-300 pointer-events-none" style={{ background: `linear-gradient(to right, ${gradientColor}, #141414, ${gradientColor})` }}></div>
      
      {/* Main Content Area */}
      <div className={`relative bg-[#141414] p-5 space-y-3 transition-all duration-300 password-card-inner-content ${isDetailsExpanded ? 'pb-8' : 'pb-5'}`}>
        
        {/* Header (Compact Row) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Account Initials/Icon */}
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-md flex-shrink-0 relative overflow-hidden"
              style={{ backgroundColor: logoUrl ? 'transparent' : 'white', color: logoUrl ? 'white' : 'black' }}
            >
              {logoUrl ? (
                <>
                  <img 
                    src={logoUrl} 
                    alt={`${initialPassword.account} logo`} 
                    className="w-full h-full object-cover bg-transparent"
                    onError={(e) => { 
                      console.debug("PasswordsPage.jsx:event_409");
                      e.target.style.display = 'none'; 
                      setLogoUrl(null); 
                    }} // Fallback to initials if logo fails to load
                  />
                </>
              ) : (
                getInitials(initialPassword.account).substring(0, 2)
              )}
            </div>

            {/* Account Name (Editable) */}
            <div 
                ref={accountRef}
                contentEditable={true}
                suppressContentEditableWarning={true}
                onBlur={handleAccountBlur}
                onFocus={() => setIsEditingAccount(true)}
                onKeyDown={handleAccountKey}
                className={`text-lg font-extrabold truncate text-white outline-none cursor-text ${isEditingAccount ? 'bg-gray-700/50 rounded px-1' : 'hover:text-gray-300 transition-colors'}`}
            >
              {initialPassword.account ? initialPassword.account.charAt(0).toUpperCase() + initialPassword.account.slice(1) : ''}
            </div>
          </div>
          
          {/* Quick Actions (Favorite, Copy Password, Show/Hide, Details Toggle) */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Favorite Indicator (Icon) */}
            <motion.button 
                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(); setSelectedCard(initialPassword.id); }}
                className={`text-sm transition-transform duration-300 hover:scale-125 mobile-always-visible ${initialPassword.isFavorite ? 'opacity-100' : 'opacity-0 scale-75'}`}
                animate={{ opacity: initialPassword.isFavorite || isHovering ? 1 : 0, scale: initialPassword.isFavorite || isHovering ? 1 : 0.75 }}
                whileTap={{ scale: 0.9, rotate: 360 }} // Add rotation animation on tap
                title={initialPassword.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                transition={{ duration: 0.2 }}
            >
                <Icon name="Star" className="w-5 h-5" style={initialPassword.isFavorite ? { fill: '#FFD700', stroke: '#FFD700' } : {}} />
            </motion.button>

            {/* Copy Password (Icon) */}
            <motion.button 
                onClick={(e) => { e.stopPropagation(); handleCopy(decryptedPassword, 'Password'); setSelectedCard(initialPassword.id); }} 
                className="w-10 h-10 flex items-center justify-center text-sm bg-[#333]/50 text-gray-300 rounded-full hover:bg-[#555]/70 transition-colors"
                whileTap={{ scale: 0.9 }}
                title="Copy Password"
            >
                <Icon name="Copy" className="w-5 h-5" />
            </motion.button>
            
            {/* Password Toggle (ICON IS BACK) */}
            <motion.button 
                onClick={(e) => { e.stopPropagation(); setIsPasswordVisible(prev => !prev); setSelectedCard(initialPassword.id); if (cardSize === 'slim') setIsDetailsExpanded(true); }} 
                className="w-10 h-10 flex items-center justify-center text-sm bg-[#333]/50 text-gray-300 rounded-full hover:bg-[#555]/70 transition-colors"
                whileTap={{ scale: 0.9 }}
                title={isPasswordVisible ? "Hide Password" : "Show Password"}
            >
                {/* Conditional Eye or EyeOff icon */}
                <Icon name={isPasswordVisible ? "EyeOff" : "Eye"} className="w-5 h-5" />
            </motion.button>

            {/* Expand Toggle (Icon) */}
            <motion.button 
                onClick={(e) => { e.stopPropagation(); setIsDetailsExpanded(prev => {
                  const newExpandedState = !prev;
                  console.debug("PasswordsPage.jsx:event_473");
                  if (newExpandedState && cardSize === 'slim') {
                    setIsPasswordVisible(true);
                  }
                  return newExpandedState;
                }); setSelectedCard(initialPassword.id); }} 
                className="w-10 h-10 flex items-center justify-center text-sm bg-[#333]/50 text-gray-300 rounded-full hover:bg-[#555]/70 transition-colors"
                animate={{ rotate: isDetailsExpanded ? 180 : 0 }}
                whileTap={{ scale: 0.9 }}
                title="Toggle Details"
            >
                <Icon name="ChevronDown" className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
        
        {/* Password Display Row (Left-Aligned) */}
        {(cardSize !== 'slim' || isDetailsExpanded) && (
          <div className="flex items-center bg-black/30 p-3 rounded-xl border border-gray-700/50">
            {currentOAuthProvider && oauthIconMap[currentOAuthProvider] && (
                <img 
                    src={oauthIconMap[currentOAuthProvider]} 
                    alt={`${currentOAuthProvider} logo`} 
                    className="w-5 h-5 object-contain mr-2 flex-shrink-0"
                    onError={(e) => { e.target.onerror = null; e.target.style.display='none'; }}
                />
            )}
              {isPasswordVisible ? (
                  <input
                      ref={passwordInputRef}
                      type="text"
                      value={decryptedPassword}
                      onChange={(e) => setDecryptedPassword(e.target.value)}
                      onBlur={(e) => handleSave('password')(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                      className="flex-grow font-mono text-lg transition-colors duration-200 pl-2 text-left bg-transparent text-green-400 outline-none"
                      disabled={!!initialPassword.oauth}
                  />
              ) : (
                  <span className="flex-grow font-mono text-lg transition-colors duration-200 pl-2 text-left text-gray-400">
                      {passwordDisplay}
                  </span>
              )}
          </div>
        )}

        {/* Expanded Details Section */}
        <AnimatePresence>
          {isDetailsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -10 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden pt-4 border-t border-gray-800/80 space-y-3"
            >
                {/* Username remains text-only (no icon) */}
                <DetailRow label="Username" value={initialPassword.username} onCopy={() => handleCopy(initialPassword.username, 'Username')} onSave={handleSave('username')} fieldName="username" isEditable={!initialPassword.oauth} />
                

                
                {/* Notes remains text-only (no icon) */}
                {initialPassword.notes && <DetailRow label="Notes" value={initialPassword.notes} onCopy={() => handleCopy(initialPassword.notes, 'Notes')} onSave={handleSave('notes')} fieldName="notes" />}
                
                {/* Phone number */}
                {initialPassword.phone && <DetailRow label="Phone" value={initialPassword.phone} onCopy={() => handleCopy(initialPassword.phone, 'Phone')} onSave={handleSave('phone')} fieldName="phone" inputType="phone" showCallIcon={true} />}


                {/* Bottom Card Actions (Delete) - Icon is back */}
                <motion.button
                    onClick={(e) => { e.stopPropagation(); setIsDeleteModalOpen(true); setSelectedCard(initialPassword.id); }}
                    className="w-full mt-6 py-2 text-sm font-semibold text-red-400 bg-red-900/20 rounded-lg hover:bg-red-900/40 transition-colors flex items-center justify-center space-x-2"
                >
                    <Icon name="Trash" className="w-5 h-5" />
                </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
        
      </div>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Permanently Delete?"
        message={`This will delete the password entry for ${initialPassword.account}. This action is irreversible.`}
      />
    </motion.div>
  );
});


const PasswordsPage = () => {
  console.log("PasswordsPage rendering...");
  const [passwords, setPasswords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState(localStorage.getItem('accountView') || 'passwords');
  const pageRef = useRef(null);
  const { session } = useAuth();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalContent, setLimitModalContent] = useState({ title: '', message: '' });
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [isMasterPasswordModalOpen, setIsMasterPasswordModalOpen] = useState(true);
  const [isInitialSetupModalOpen, setIsInitialSetupModalOpen] = useState(false); // New state
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [isChangePinModalOpen, setIsChangePinModalOpen] = useState(false); // New state for change PIN modal
  const [isMasterPasswordLoading, setIsMasterPasswordLoading] = useState(true); // New state for initial master password loading
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutMessage, setLockoutMessage] = useState('');
  const [lockoutEndTime, setLockoutEndTime] = useState(null);
  const [remainingLockoutTime, setRemainingLockoutTime] = useState(0);
  const [selectedCard, setSelectedCard] = useState(null);
  const [accountTags, setAccountTags] = useState([]); // New state for account tags
  const [cardSize, setCardSize] = useState('normal'); // 'normal' or 'slim'
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [sortOption, setSortOption] = useState('default'); // e.g., 'default', 'name_asc', 'name_desc', 'favorite'
  const [isOAuthModalOpen, setIsOAuthModalOpen] = useState(false); // New state for OAuth modal
  const [selectedOAuthProviderForModal, setSelectedOAuthProviderForModal] = useState(null); // New state to pass to OAuth modal
  const [isOAuthSelectionModalOpen, setIsOAuthSelectionModalOpen] = useState(false); // New state for OAuth selection modal
  const [selectedOAuthProviderForFiltering, setSelectedOAuthProviderForFiltering] = useState(null); // New state for filtering passwords by OAuth provider
  const [showToast, setShowToast] = useState({ isVisible: false, message: '' });
  const [selectedCardGradientColor, setSelectedCardGradientColor] = useState(null); // New state for toast gradient
  const [userPlanData, setUserPlanData] = useState(null); // Stores plan details from the 'plans' table
  const [userTotalPasswordsCount, setUserTotalPasswordsCount] = useState(0); // Stores user's current total password count

  const showNotification = (message) => {
    setShowToast({ isVisible: true, message });
    setTimeout(() => setShowToast({ isVisible: false, message: '' }), 2000);
  };

  // Function to determine the starting color for the card's subtle border/gradient
  const getGradientColor = (accountName) => {
    const hash = accountName.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    const colors = [
      '#888',    // For 0
      '#f472b6', // For 1
      '#c084fc', // For 2
      '#818cf8', // For 3
      '#60a5fa', // For 4
      '#38bdf8', // For 5
      '#22d3ee', // For 6
      '#34d399', // For 7
      '#a3e635', // For 8
      '#facc15'  // For 9
    ];
    return colors[hash % colors.length];
  };

  const oauthProviders = useMemo(() => [
    { name: 'Google', domain: 'google.com' },
    { name: 'Apple', domain: 'apple.com' },
    { name: 'Facebook', domain: 'facebook.com' },
    { name: 'Microsoft', domain: 'microsoft.com', display: 'Microsoft' },
    { name: 'GitHub', domain: 'github.com' },
  ], []);

  const sortDropdownRef = useRef(null);
  const sizeDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setShowSortDropdown(false);
      }
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(event.target)) {
        setShowSizeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchPasswords = useCallback(async () => {
    if (!session || !encryptionKey) {
      console.log("No session or encryption key, returning from fetchPasswords.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { data } = await getPasswords();
      setPasswords(data);
      console.log("Passwords fetched.");
    } catch (err) {
      console.error("PasswordsPage.jsx:event_666");
      setError(err.message);
    } finally {
      setIsLoading(false);
      console.debug("PasswordsPage.jsx:event_670");
    }
  }, [session, encryptionKey]);

  // New useEffect to fetch account tags
  useEffect(() => {
    const fetchAccountTags = async () => {
      try {
        const { data, error } = await supabase
          .from('tags')
          .select('account, tag');

        if (error) throw error;
        setAccountTags(data);
      } catch (error) {
        console.error("PasswordsPage.jsx:event_685");
      }
    };

    if (session) {
      fetchAccountTags();
    }
  }, [session]);

  const updatePrefCardSize = useCallback(async (size) => {
    if (!session?.user?.id) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ pref_card_size: size })
        .eq('id', session.user.id);

      if (error) throw error;
      setCardSize(size);
    } catch (error) {
      console.error("PasswordsPage.jsx:event_705");
    }
  }, [session]);

  useEffect(() => {
    const initializeMasterPassword = async () => {
      setIsMasterPasswordLoading(true); // Start loading
      let needsSetup = false;
      let storedMasterPasswordHash = null;
      let storedMasterPasswordSalt = null;

      try {
        const userProfileResponse = await getUserProfile();
        const userProfile = userProfileResponse.data;
        const { data: masterKeyData, error: masterKeyError } = await fetchMasterKeyData();
        const { data: lockoutData, error: lockoutError } = await fetchUserLockoutData();

        if (userProfile) {
          if (userProfile.pref_card_size) {
            setCardSize(userProfile.pref_card_size);
          }
          setUserTotalPasswordsCount(userProfile.total_passwords_count || 0);
          if (userProfile.plan) {
            try {
              const planDetails = await fetchPlanDetails(userProfile.plan);
              setUserPlanData(planDetails);
            } catch (planError) {
              console.error("PasswordsPage.jsx:event_732");
            }
          }
        }

        if (lockoutError) {
          console.error("PasswordsPage.jsx:event_738");
        } else if (lockoutData && lockoutData.masterkey_entry_fails >= 6) {
          // Calculate next 12:00 AM EST
          const now = new Date();
          const nextMidnight = new Date(now);
          nextMidnight.setDate(now.getDate() + (now.getHours() >= 0 ? 1 : 0)); // If it's already past midnight, set for next day
          nextMidnight.setHours(0, 0, 0, 0); // Set to 12:00 AM EST

          const remaining = Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000);

          if (remaining > 0) {
            setIsLockedOut(true);
            setLockoutEndTime(nextMidnight.getTime());
            setRemainingLockoutTime(remaining);
            const hours = Math.floor(remaining / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            setLockoutMessage(`Too many failed attempts. Try again in ${hours.toString().padStart(2, '0')} hours and ${minutes.toString().padStart(2, '0')} minutes.`);
          } else {
            // If remaining is 0 or negative, it means it's past 12 AM EST, so lockout should be cleared by Supabase
            setIsLockedOut(false);
            setLockoutMessage('');
          }
          setIsMasterPasswordLoading(false);
          return;
        }

        if (masterKeyError) {
          console.error("PasswordsPage.jsx:event_765");
          needsSetup = true;
        } else if (masterKeyData && masterKeyData.encryption_hash && masterKeyData.encryption_salt) {
          storedMasterPasswordHash = masterKeyData.encryption_hash;
          storedMasterPasswordSalt = masterKeyData.encryption_salt;
        }

        if (!userProfile || userProfile.intro_master_key === null || userProfile.intro_master_key === false || !storedMasterPasswordHash || !storedMasterPasswordSalt) {
          needsSetup = true;
        }
      } catch (err) {
        console.error("PasswordsPage.jsx:event_776");
        needsSetup = true; // Assume setup is needed if API call fails
      } finally {
        if (needsSetup) {
          setIsSetupMode(true);
          setIsInitialSetupModalOpen(true); // Open the new initial setup modal
          setIsMasterPasswordModalOpen(false); // Ensure old modal is closed
        } else if (storedMasterPasswordHash && storedMasterPasswordSalt) {
          setIsSetupMode(false);
          setIsMasterPasswordModalOpen(true); // Open the existing authentication modal
          setIsInitialSetupModalOpen(false); // Ensure new modal is closed
        } else {
          // Fallback: if intro_master_key is true but no hash/salt, force setup
          setIsSetupMode(true);
          setIsInitialSetupModalOpen(true);
          setIsMasterPasswordModalOpen(false);
        }
        setIsMasterPasswordLoading(false); // End loading
      }
    };

    if (session) {
      initializeMasterPassword();
    }
  }, [session]);

  const deriveKey = async (masterPin) => {
    console.log("deriveKey: Deriving key from master PIN.");
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKeyFromPin(masterPin, salt);
    console.debug("PasswordsPage.jsx:event_806");
    return { key, salt };
  };

  const handleSetMasterPassword = useCallback(async (masterPin) => {
    console.log("handleSetMasterPassword: Attempting to set master password.");
    const { data: existingMasterKeyData, error: fetchError } = await fetchMasterKeyData();

    if (!fetchError && existingMasterKeyData && existingMasterKeyData.encryption_hash && existingMasterKeyData.encryption_salt) {
      console.log("handleSetMasterPassword: Master key already exists in Supabase. Not overwriting.");
      // If key already exists, we should not proceed with setting it again via this flow.
      // This scenario should ideally be prevented by the modal logic.
      setEncryptionKey(await deriveKeyFromPin(masterPin, hexToUint8Array(existingMasterKeyData.encryption_salt)));
      setIsInitialSetupModalOpen(false);
      return;
    }

    const { key, salt } = await deriveKey(masterPin);
    console.debug("PasswordsPage.jsx:event_824");
    const masterPasswordHash = await getPinHash(masterPin);
    const masterPasswordSaltHex = uint8ArrayToHex(salt);

    try {
      await updateMasterKeyData(masterPasswordSaltHex, masterPasswordHash);
      console.log("handleSetMasterPassword: Master key data updated in Supabase.");
    } catch (err) {
      console.error("PasswordsPage.jsx:event_832");
      // Potentially revert UI or show error to user
      throw err; // Re-throw to be caught by the modal's submit handler
    }

    setEncryptionKey(key);
    setIsInitialSetupModalOpen(false); // Close the initial setup modal
    console.log("handleSetMasterPassword: Encryption key set, initial setup modal closing.");
    try {
      await updateIntroMasterKey(true);
      console.log("handleSetMasterPassword: intro_master_key updated in Supabase.");
    } catch (err) {
      console.error("PasswordsPage.jsx:event_844");
    }
  }, [deriveKey]);

  const handleAuthenticate = useCallback(async (enteredPin) => {
    console.log("handleAuthenticate: Attempting to authenticate master password.");
    const { data: masterKeyData, error: fetchError } = await fetchMasterKeyData();

    if (fetchError || !masterKeyData || !masterKeyData.encryption_hash || !masterKeyData.encryption_salt) {
      console.error("PasswordsPage.jsx:event_853");
      return false;
    }

    const storedMasterPasswordHash = masterKeyData.encryption_hash;
    const storedMasterPasswordSalt = masterKeyData.encryption_salt;

    const enteredPinHash = await getPinHash(enteredPin);

    if (enteredPinHash === storedMasterPasswordHash) {
      const salt = hexToUint8Array(storedMasterPasswordSalt);
      const key = await deriveKeyFromPin(enteredPin, salt);
      console.debug("PasswordsPage.jsx:event_865");
      setEncryptionKey(key);
      setIsMasterPasswordModalOpen(false);
      console.log("handleAuthenticate: Authentication successful, encryption key set, modal closing.");
      // Reset failed attempts on successful authentication (handled by Supabase daily reset)
      await updateUserFailedAttempts(0);
      // Clear lockout timestamp if it was set
      await updateUserLockoutData(null);
      return true;
    } else {
      console.log("handleAuthenticate: Authentication failed (incorrect PIN).");
      // Increment failed attempts
      const { data: lockoutData } = await fetchUserLockoutData();
      const currentFails = lockoutData?.masterkey_entry_fails || 0;
      const newFailedAttempts = currentFails + 1;
      await updateUserFailedAttempts(newFailedAttempts);

      if (newFailedAttempts >= 6) {
        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setDate(now.getDate() + (now.getHours() >= 0 ? 1 : 0));
        nextMidnight.setHours(0, 0, 0, 0);

        const remaining = Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000);
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);

        await updateUserLockoutData(now.toISOString()); // Set lockout_timestamp to current time
        setIsLockedOut(true);
        setLockoutEndTime(nextMidnight.getTime());
        setRemainingLockoutTime(remaining);
        setLockoutMessage(`Too many failed attempts. Try again in ${hours.toString().padStart(2, '0')} hours and ${minutes.toString().padStart(2, '0')} minutes.`);
        setIsMasterPasswordModalOpen(false); // Close modal if locked out
      }
      return false;
    }
  }, []);

  const handleChangeMasterPassword = useCallback(async (oldPin, newPin, verifyOnly) => {
    const { data: masterKeyData, error: fetchError } = await fetchMasterKeyData();

    if (fetchError || !masterKeyData || !masterKeyData.encryption_hash) {
      console.error("PasswordsPage.jsx:event_907");
      return false;
    }

    const storedMasterPasswordHash = masterKeyData.encryption_hash;

    const oldPinHash = await getPinHash(oldPin);
    if (oldPinHash !== storedMasterPasswordHash) {
      return false; // Old PIN is incorrect
    }

    if (verifyOnly) {
      return true; // Successfully verified old PIN
    }

    // Proceed with changing the PIN and re-encrypting passwords
    try {
      const { key: newEncryptionKey, salt: newSalt } = await deriveKey(newPin);
      const newMasterPasswordHash = await getPinHash(newPin);
      const newMasterPasswordSaltHex = uint8ArrayToHex(newSalt);

      // Update Supabase with new master password hash and salt
      await updateMasterKeyData(newMasterPasswordSaltHex, newMasterPasswordHash);

      // Re-encrypt all existing passwords
      const reEncryptedPasswords = await Promise.all(passwords.map(async (p) => {
        if (p.password && encryptionKey) {
          try {
            // 1. Decrypt with old key
            const encryptedData = JSON.parse(p.password);
            const decrypted = await decrypt(encryptedData, encryptionKey);

            // 2. Encrypt with new key
            const { ciphertext, iv } = await encrypt(decrypted, newEncryptionKey);
            const newEncryptedPassword = JSON.stringify({
              ciphertext: Array.from(ciphertext),
              iv: Array.from(iv),
            });

            // 3. Update on backend
            await updatePassword(p.id, { password: newEncryptedPassword });
            return { ...p, password: newEncryptedPassword };
          } catch (e) {
            console.error("PasswordsPage.jsx:event_950");
            return p; // Return original if re-encryption fails
          }
        }
        return p; // Return original if no password or key
      }));

      setEncryptionKey(newEncryptionKey);
      setPasswords(reEncryptedPasswords); // Update state with re-encrypted passwords
      setIsChangePinModalOpen(false);
      return true;
    } catch (err) {
      console.error("PasswordsPage.jsx:event_962");
      return false;
    }
  }, [deriveKey, encryptionKey, passwords, updatePassword]);

  useEffect(() => {
    fetchPasswords();
  }, [fetchPasswords]);

  useEffect(() => {
    // No longer storing accountView in localStorage
  }, [currentView]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pageRef.current && !pageRef.current.contains(event.target)) {
        setSelectedCard(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let timer;
    if (isLockedOut && lockoutEndTime) {
      timer = setInterval(() => {
        const now = new Date();
        const remaining = Math.ceil((lockoutEndTime - now.getTime()) / 1000);

        if (remaining <= 0) {
          // If past 12 AM EST, assume Supabase has reset masterkey_entry_fails
          setIsLockedOut(false);
          setLockoutEndTime(null);
          setRemainingLockoutTime(0);
          setLockoutMessage('');
          // No need to update DB here, Supabase handles the reset
        } else {
          setRemainingLockoutTime(remaining);
          const hours = Math.floor(remaining / 3600);
          const minutes = Math.floor((remaining % 3600) / 60);
          const seconds = remaining % 60;
          setLockoutMessage(`Too many failed attempts. Try again in ${hours.toString().padStart(2, '0')} hours and ${minutes.toString().padStart(2, '0')} minutes.`);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLockedOut, lockoutEndTime]);

  useEffect(() => {
    if (selectedCard) {
      const selectedPassword = passwords.find(p => p.id === selectedCard);
      if (selectedPassword) {
        setSelectedCardGradientColor(getGradientColor(selectedPassword.account));
      } else {
        setSelectedCardGradientColor(null);
      }
    } else {
      setSelectedCardGradientColor(null);
    }
  }, [selectedCard, passwords, getGradientColor]);

  const handleCreatePassword = async (passwordData, encryptionKey) => {
    console.log("handleCreatePassword: Creating new password.");
    if (!encryptionKey) {
      console.error("handleCreatePassword: encryptionKey is missing, cannot encrypt password.");
      return;
    }

    // Client-side pre-check for password limit
    if (userPlanData && userTotalPasswordsCount >= userPlanData.total_passwords_limit) {
      setLimitModalContent({
        title: 'Password Limit Reached',
        message: `You have reached your limit of ${userPlanData.total_passwords_limit} passwords for your current plan. Please upgrade to create more.`
      });
      setShowLimitModal(true);
      return;
    }

    try {
      const { ciphertext, iv } = await encrypt(passwordData.password, encryptionKey);
      const encryptedPassword = JSON.stringify({
        ciphertext: Array.from(ciphertext),
        iv: Array.from(iv),
      });
      const payload = { ...passwordData, password: encryptedPassword, tag: passwordData.tags ? JSON.stringify(passwordData.tags) : '[]' };
      const { data: newPassword } = await createPassword(payload);
      setPasswords(prev => [...prev, newPassword]);
      setUserTotalPasswordsCount(prev => prev + 1); // Increment client-side count
      console.log("handleCreatePassword: Password created successfully.");
    } catch (err) {
      console.error("PasswordsPage.jsx:event_1055");
      if (err.response && err.response.status === 429) {
        setLimitModalContent({
          title: 'Password Limit Reached',
          message: err.response.data.detail || 'You have reached your password creation limit.'
        });
        setShowLimitModal(true);
      }
    }
  };

  const handleUpdatePassword = async (id, updates, encryptionKey) => {
    try {
      let payload = { ...updates };
      if (updates.password) {
        // Re-encrypt password if it's being updated
        const { ciphertext, iv } = await encrypt(updates.password, encryptionKey);
        const encryptedPassword = JSON.stringify({
          ciphertext: Array.from(ciphertext),
          iv: Array.from(iv),
        });
        payload = { ...updates, password: encryptedPassword };
      }
      const { data: updatedPassword } = await updatePassword(id, payload);
      setPasswords(prev => prev.map(p => p.id === id ? updatedPassword : p));
    } catch (err) {
      console.error("PasswordsPage.jsx:event_1081");
    }
  };

  const handleDeletePassword = async (id) => {
    try {
      await deletePassword(id);
      setPasswords(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error("PasswordsPage.jsx:event_1090");
    }
  };

  const handleToggleFavorite = async (id, isFavorite) => {
    handleUpdatePassword(id, { isFavorite });
  };



  const filteredPasswords = useMemo(() => {
    const lowerCaseSearchQuery = searchQuery.toLowerCase();

    let sortedAndFiltered = passwords
      .filter(p => {
        const pAccount = p.account?.trim().toLowerCase(); // Define pAccount here
        const matchesAccount = pAccount?.includes(lowerCaseSearchQuery);
        const matchesUsername = p.username?.toLowerCase().includes(lowerCaseSearchQuery);
        const matchesPhone = p.phone?.toLowerCase().includes(lowerCaseSearchQuery);
        const matchesNotes = p.notes?.toLowerCase().includes(lowerCaseSearchQuery);

        // Search within tags from the passwords table
        let matchesPasswordTags = false;
        if (p.tag) {
          try {
            const parsedTags = JSON.parse(p.tag);
            matchesPasswordTags = Array.isArray(parsedTags) && parsedTags.some(tag =>
              String(tag).toLowerCase().includes(lowerCaseSearchQuery)
            );
          } catch (e) {
            // If parsing fails, treat p.tag as a plain string
            matchesPasswordTags = String(p.tag).toLowerCase().includes(lowerCaseSearchQuery);
          }
        }

        // Search within tags from the public.tags table (accountTags)
        // This should link to the current password 'p'
        let matchesPublicTagsLinkedToPassword = false;
        if (Array.isArray(accountTags) && pAccount) { // Only check if accountTags is an array and p.account exists
            matchesPublicTagsLinkedToPassword = accountTags.some(at => {
                const trimmedAtAccount = at.account?.trim().toLowerCase();

                // Check if the public tag entry's account matches the current password's account
                if (trimmedAtAccount === pAccount) {
                    // If they match, then check if the public tag entry itself matches the search query
                    let tagFromPublicTagsMatchesSearch = false;
                    if (at.tag) {
                        try {
                            const parsedAtTags = JSON.parse(at.tag);
                            tagFromPublicTagsMatchesSearch = Array.isArray(parsedAtTags) && parsedAtTags.some(tag =>
                                String(tag).trim().toLowerCase().includes(lowerCaseSearchQuery)
                            );
                        } catch (e) {
                            // Fallback if JSON parsing fails for public tag
                            tagFromPublicTagsMatchesSearch = String(at.tag).trim().toLowerCase().includes(lowerCaseSearchQuery);
                        }
                    }
                    // If the public tag entry's account matches the password's account,
                    // and its tags match the search query, then this password should be included.
                    return tagFromPublicTagsMatchesSearch;
                }
                return false; // This public tag entry is not for the current password's account
            });
        }

        return (matchesAccount || matchesUsername || matchesPhone || matchesNotes || matchesPasswordTags || matchesPublicTagsLinkedToPassword);
      });

    // Primary sort: favorited items first
    sortedAndFiltered.sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        // Secondary sort: by date_created descending (newest first)
        return new Date(b.date_created) - new Date(a.date_created);
    });

    // Apply sorting based on sortOption, overriding default if a specific option is selected
    switch (sortOption) {
      case 'name_asc':
        sortedAndFiltered.sort((a, b) => a.account.localeCompare(b.account));
        break;
      case 'name_desc':
        sortedAndFiltered.sort((a, b) => b.account.localeCompare(a.account));
        break;
      case 'favorite':
        sortedAndFiltered.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
        break;
      case 'date_created_asc':
        sortedAndFiltered.sort((a, b) => new Date(a.date_created) - new Date(b.date_created));
        break;
      case 'date_created_desc':
        sortedAndFiltered.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));
        break;
      case 'date_updated_asc':
        sortedAndFiltered.sort((a, b) => new Date(a.date_updated || a.date_created) - new Date(b.date_updated || b.date_created));
        break;
      case 'date_updated_desc':
        sortedAndFiltered.sort((a, b) => new Date(b.date_updated || b.date_created) - new Date(a.date_updated || a.date_created));
        break;
      default:
        // The default sort is now handled before the switch statement
        break;
    }

    return sortedAndFiltered;
  }, [passwords, searchQuery, accountTags, sortOption]);

  if (isMasterPasswordLoading) return <SplashScreen />;
  if (error) return <div className="error-screen">Error: {error}</div>;

  if (isLockedOut) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans">
        <div className="bg-black rounded-3xl w-full max-w-sm shadow-2xl border border-white/10 relative overflow-hidden p-8 text-center text-white">
          <h2 className="text-2xl font-bold text-red-400 tracking-tight mb-4">Account Locked</h2>
          <p className="text-sm text-gray-400 mb-6">{lockoutMessage}</p>
          <button
            onClick={() => { window.location.href = "mailto:keaganpoole2@gmail.com"; }}
            className="w-full text-center text-gray-500 hover:text-gray-300 mt-2 text-sm transition-colors"
          >
            Contact us
          </button>
        </div>
      </div>
    );
  }

  if (isInitialSetupModalOpen) {
    return (
      <InitialMasterPasswordSetupModal
        isOpen={isInitialSetupModalOpen}
        onSetMasterPassword={handleSetMasterPassword}
        onClose={() => setIsInitialSetupModalOpen(false)}
      />
    );
  }

  if (isMasterPasswordModalOpen) {
    return (
      <MasterPasswordModal
        isOpen={isMasterPasswordModalOpen}
        onAuthenticate={handleAuthenticate}
        isLockedOut={isLockedOut}
      />
    );
  }

  const toggleView = () => {
    setCurrentView(prevView => prevView === 'passwords' ? 'settings' : 'passwords');
  };

  const pageContent = (
    <>
      <header className="page-header">
        <h1>{currentView === 'passwords' ? 'Key Vault' : 'My Account'}</h1>
        <div className="header-actions">
          {currentView === 'passwords' && (
            <>
              <div className="search-bar">
                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                <input
                  type="text"
                  placeholder="Smart Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </header>

      {currentView === 'passwords' ? (
        <div className="passwords-content-wrapper">
          <div className="filterbar">
            <div className="filterbar-section-left flex flex-wrap justify-start items-center">
              {/* Sort Dropdown */}
              <div className="relative" ref={sortDropdownRef}>
                <button 
                  className="filter-sort-btn" 
                  onClick={() => setShowSortDropdown(prev => !prev)}
                >
                  <FontAwesomeIcon icon={faPaintBrush} className="mr-2" /> Sort
                  <motion.div animate={{ rotate: showSortDropdown ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <Icon name="ChevronDown" className="w-4 h-4 ml-2" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {showSortDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="dropdown-menu absolute top-full left-0 mt-2 w-48 bg-[#1c1c1c] rounded-lg shadow-xl border border-[#333] z-10"
                    >
                      <button
                        className={`dropdown-item ${sortOption === 'default' ? 'selected' : ''}`}
                        onClick={() => { setSortOption('default'); setShowSortDropdown(false); }}
                      >
                        Default
                      </button>
                      <button
                        className={`dropdown-item ${sortOption === 'name_asc' ? 'selected' : ''}`}
                        onClick={() => { setSortOption('name_asc'); setShowSortDropdown(false); }}
                      >
                        Name (A-Z)
                      </button>
                      <button
                        className={`dropdown-item ${sortOption === 'name_desc' ? 'selected' : ''}`}
                        onClick={() => { setSortOption('name_desc'); setShowSortDropdown(false); }}
                      >
                        Name (Z-A)
                      </button>

                      <button
                        className={`dropdown-item ${sortOption === 'date_updated_asc' ? 'selected' : ''}`}
                        onClick={() => { setSortOption('date_updated_asc'); setShowSortDropdown(false); }}
                      >
                        Date Updated (Oldest)
                      </button>
                      <button
                        className={`dropdown-item ${sortOption === 'date_updated_desc' ? 'selected' : ''}`}
                        onClick={() => { setSortOption('date_updated_desc'); setShowSortDropdown(false); }}
                      >
                        Date Updated (Newest)
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Size Dropdown */}
              <div className="relative" ref={sizeDropdownRef}>
                <button 
                  className="size-toggle-btn" 
                  onClick={() => setShowSizeDropdown(prev => !prev)}
                >
                  <FontAwesomeIcon icon={faBoxesStacked} className="mr-2" /> View
                  <motion.div animate={{ rotate: showSizeDropdown ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <Icon name="ChevronDown" className="w-4 h-4 ml-2" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {showSizeDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="dropdown-menu absolute top-full left-0 mt-2 w-48 bg-[#1c1c1c] rounded-lg shadow-xl border border-[#333] z-10"
                    >
                      <button
                        className={`dropdown-item ${cardSize === 'normal' ? 'selected' : ''}`}
                        onClick={() => { updatePrefCardSize('normal'); setShowSizeDropdown(false); }}
                      >
                        Normal
                      </button>
                      <button
                        className={`dropdown-item ${cardSize === 'slim' ? 'selected' : ''}`}
                        onClick={() => { updatePrefCardSize('slim'); setShowSizeDropdown(false); }}
                      >
                        Slim
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* OAuth Provider Icons */}
              <div className="flex items-center space-x-2">
                <motion.button
                  onClick={() => setIsOAuthSelectionModalOpen(prev => !prev)}
                  className="w-8 h-8 rounded-full flex items-center justify-center relative overflow-hidden group transition-all duration-200 focus:outline-none"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  title="Manage Popular Logins"
                >
                  <motion.div animate={{ rotate: isOAuthSelectionModalOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <FontAwesomeIcon icon={faPlus} className="text-gray-400 group-hover:text-white" />
                  </motion.div>
                </motion.button>
              </div>
            </div>
          </div>

          <div className="passwords-grid mx-auto">
            {filteredPasswords.length > 0 ? (
              filteredPasswords.map((password) => (
                <StunningPasswordCard
                  key={password.id}
                  password={password}
                  onUpdate={(id, updates) => handleUpdatePassword(id, updates, encryptionKey)}
                  onDelete={handleDeletePassword}
                  encryptionKey={encryptionKey}
                  selectedCard={selectedCard}
                  setSelectedCard={setSelectedCard}
                  cardSize={cardSize}
                  oauthProvider={password.oauth}
                  showNotification={showNotification}
                  getGradientColor={getGradientColor}
                />
              ))
            ) : (
              <div className="empty-state mx-auto flex flex-col items-center justify-center flex-grow mt-auto">
                <button
                  onClick={() => setIsModalOpen(true)}
                  title="Create New Item"
                  className={`
                      group
                      /* Base Styles: Large, Circular, Centered Position */
                      relative w-24 h-24 md:w-48 md:h-48 rounded-full flex items-center justify-center
                      cursor-pointer outline-none select-none mb-6 /* Adjusted mb for smaller button */

                      /* Gradient Background */
                      bg-gradient-to-br from-[var(--color1)] to-[var(--color2)]

                      /* Custom box shadows for floating/depth/inner dimension */
                      [box-shadow:0_18px_35px_-8px_rgba(0,0,0,0.35),_0_6px_10px_-2px_rgba(0,0,0,0.15),_inset_0_0_10px_rgba(0,0,0,0.05)]

                      /* Transition for smooth animations */
                      transition-all duration-300 ease-in-out

                      /* HOVER EFFECT: Lift higher, slightly larger, bolder shadow */
                      hover:scale-[1.05]
                      hover:[box-shadow:0_30px_50px_-10px_rgba(0,0,0,0.45),_0_10px_15px_-3px_rgba(0,0,0,0.2)]
                      
                      /* ACTIVE (CLICK) EFFECT: Press down, reduce shadow, slight translate-y */
                      active:scale-[0.97]
                      active:translate-y-[3px]
                      active:[box-shadow:0_5px_15px_-4px_rgba(0,0,0,0.2),_0_2px_5px_-1px_rgba(0,0,0,0.1)]
                  `}
                >
                  {/* Plus Icon (SVG) - Now reacts dynamically to the group hover/active state */}
                  <svg
                      className="
                          w-10 h-10 md:w-20 md:h-20 transform
                          transition-all duration-300 ease-in-out

                          /* Icon 'Alive' Animations */
                          group-hover:rotate-90
                          group-hover:scale-110
                          group-active:scale-90
                          group-active:rotate-[135deg]
                      "
                      style={{ color: '#000000' }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                  >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <h2 className="text-base font-bold text-white mb-2 md:text-lg">Vault empty</h2>
                <p className="text-gray-400 text-xs md:text-sm">Click the button above to add your first record</p>
              </div>
            )} 
          </div> 
          {filteredPasswords.length > 0 && (
            <button
              onClick={() => setIsModalOpen(true)}
              title="Create New Item"
              className={`
                  group
                  /* Base Styles: Small, Circular, Floating Position for mobile, larger for desktop */
                  fixed bottom-10 right-10 w-16 h-16 md:w-24 md:h-24 rounded-full flex items-center justify-center
                  cursor-pointer outline-none select-none

                  /* Gradient Background */
                  bg-gradient-to-br from-[var(--color1)] to-[var(--color2)]

                  /* Custom box shadows for floating/depth/inner dimension */
                  /* Outer Shadow (Float) and Inner Shadow (for added depth) */
                  [box-shadow:0_18px_35px_-8px_rgba(0,0,0,0.35),_0_6px_10px_-2px_rgba(0,0,0,0.15),_inset_0_0_10px_rgba(0,0,0,0.05)]

                  /* Transition for smooth animations */
                  transition-all duration-300 ease-in-out

                  /* HOVER EFFECT: Lift higher, slightly larger, bolder shadow */
                  hover:scale-[1.05]
                  hover:[box-shadow:0_30px_50px_-10px_rgba(0,0,0,0.45),_0_10px_15px_-3px_rgba(0,0,0,0.2)]
                  
                  /* ACTIVE (CLICK) EFFECT: Press down, reduce shadow, slight translate-y */
                  active:scale-[0.97]
                  active:translate-y-[3px]
                  active:[box-shadow:0_5px_15px_-4px_rgba(0,0,0,0.2),_0_2px_5px_-1px_rgba(0,0,0,0.1)]
              `}
            >
              {/* Plus Icon (SVG) - Now reacts dynamically to the group hover/active state */}
              <svg
                  className="
                      w-8 h-8 md:w-8 md:h-8 transform
                      transition-all duration-300 ease-in-out

                      /* Icon 'Alive' Animations */
                      group-hover:rotate-90
                      group-hover:scale-110
                      group-active:scale-90
                      group-active:rotate-[135deg]
                  "
                  style={{ color: '#000000' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
              >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <AccountSettings onChangeMasterPassword={handleChangeMasterPassword} isMasterPasswordModalOpen={isMasterPasswordModalOpen} />
      )}

      <CreatePasswordModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={(passwordData, encryptionKey) => handleCreatePassword(passwordData, encryptionKey)}
        encryptionKey={encryptionKey}
        getOAuthAccounts={getOAuthAccounts}
        onOpenOAuthAccountModal={(providerName) => {
          setSelectedOAuthProviderForModal(providerName);
          setIsOAuthModalOpen(true);
        }}
      />

      <OAuthAccountModal
        isOpen={isOAuthModalOpen}
        onClose={() => setIsOAuthModalOpen(false)}
        encryptionKey={encryptionKey}
        showNotification={(message) => setShowToast({ isVisible: true, message })}
        selectedProvider={selectedOAuthProviderForModal}
      />
                
      <OAuthSelectionModal
        isOpen={isOAuthSelectionModalOpen}
        onClose={() => setIsOAuthSelectionModalOpen(false)}
        oauthProviders={oauthProviders}
        onSelectProvider={(providerName) => {
          setSelectedOAuthProviderForModal(providerName);
          setIsOAuthModalOpen(true);
          setIsOAuthSelectionModalOpen(false); // Close the selection modal
        }}
      />
                        
      <Toast {...showToast} textColor="#000000" />
    </>
  );

  return (
    <div className="passwords-page" ref={pageRef}>
      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        title={limitModalContent.title}
        message={limitModalContent.message}
        pageTheme="passwords"
      />
      {pageContent}
    </div>
  );
};

export default PasswordsPage;
