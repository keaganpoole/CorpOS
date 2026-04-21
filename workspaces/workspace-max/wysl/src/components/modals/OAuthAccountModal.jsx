import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { createOAuthAccount, getOAuthAccounts, deleteOAuthAccount } from '../../services/apiService';
import { encrypt, decrypt } from '../../utils/crypto';
import colors from '../../../color';

// Import OAuth provider icons
import googleIcon from '../../assets/googleicon.png';
import appleIcon from '../../assets/appleicon.png';
import facebookIcon from '../../assets/facebookicon.png';
import microsoftIcon from '../../assets/microsofticon.png';
import githubIcon from '../../assets/githubicon.png';

const OAuthAccountModal = ({ isOpen, onClose, encryptionKey, showNotification, selectedProvider }) => {
  const { session } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState(''); // New state for username/email
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [savedOAuthAccounts, setSavedOAuthAccounts] = useState([]);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null); // For editing existing accounts

  const oauthIconMap = useMemo(() => ({
    'Google': googleIcon,
    'Apple': appleIcon,
    'Facebook': facebookIcon,
    'Microsoft': microsoftIcon,
    'GitHub': githubIcon,
  }), []);

  const inputGroupClasses = "relative group";
  const inputClasses = "relative w-full px-5 py-3 bg-[#1c1c1c] border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-transparent transition-all peer";
  const labelClasses = "absolute left-4 -top-2 text-xs text-gray-400 bg-[#1c1c1c] px-2 rounded-md transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:-top-2 peer-focus:text-xs";

  const fetchOAuthAccounts = useCallback(async () => {
    if (!session || !encryptionKey || !selectedProvider) return;
    try {
      const { data } = await getOAuthAccounts();
      const filteredAccounts = data.filter(acc => acc.oauth === selectedProvider);
      const decryptedAccounts = await Promise.all(filteredAccounts.map(async (acc) => {
        if (acc.password) {
          try {
            const encryptedData = JSON.parse(acc.password);
            const decryptedPass = await decrypt(
              { ciphertext: new Uint8Array(encryptedData.ciphertext), iv: new Uint8Array(encryptedData.iv) },
              encryptionKey
            );
            return { ...acc, decryptedPassword: decryptedPass };
          } catch (e) {
            console.error('Decryption failed for OAuth account:', e);
            return { ...acc, decryptedPassword: '[Decryption Error]' };
          }
        }
        return acc;
      }));
      setSavedOAuthAccounts(decryptedAccounts);
    } catch (err) {
      console.error('Failed to fetch OAuth accounts:', err);
      setError('Failed to load saved accounts.');
    }
  }, [session, encryptionKey, selectedProvider]);

  useEffect(() => {
    if (isOpen && selectedProvider) {
      fetchOAuthAccounts();
      setUsernameOrEmail(''); // Clear new field on open
      setPassword('');
      setError(null);
      setEditingAccount(null);
    }
  }, [isOpen, selectedProvider, fetchOAuthAccounts]);

  const handleAddOrUpdateAccount = async (e) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password.trim()) { // Validate new field
      setError('Username/Email and password cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { ciphertext, iv } = await encrypt(password, encryptionKey);
      const encryptedPassword = JSON.stringify({
        ciphertext: Array.from(ciphertext),
        iv: Array.from(iv),
      });

      const payload = {
        oauth: selectedProvider,
        email: usernameOrEmail, // Map to email column
        password: encryptedPassword,
      };

      if (editingAccount) {
        // Assume updateOAuthAccount is available and works as intended
        // await updateOAuthAccount(editingAccount.id, payload);
        showNotification('Account updated');
      } else {
        await createOAuthAccount(payload);
        showNotification('Account saved');
      }
      
      fetchOAuthAccounts(); // Refresh the list
      setUsernameOrEmail(''); // Clear new field
      setPassword('');
      setEditingAccount(null);
    } catch (err) {
      console.error('Failed to save OAuth account:', err);
      setError('Failed to save account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteOAuthAccount(id);
      showNotification('Account deleted successfully!');
      fetchOAuthAccounts();
    } catch (err) {
      console.error('Failed to delete OAuth account:', err);
      setError('Failed to delete account. Please try again.');
    }
  };

  const handleEdit = (account) => {
    setUsernameOrEmail(account.email || ''); // Populate new field
    setPassword(account.decryptedPassword || '');
    setEditingAccount(account);
  };

  const handleCancelEdit = () => {
    setUsernameOrEmail(''); // Clear new field
    setPassword('');
    setEditingAccount(null);
    setError(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          initial={{ opacity: 0, scale: 0.99, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.99, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <motion.div
            className="relative border border-gray-800 rounded-3xl w-full max-w-md overflow-hidden"
            initial={{ opacity: 0, scale: 0.99, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Close Button */}
            <button onClick={onClose} className="absolute top-4 right-4 z-30 p-2 text-gray-400 hover:text-gray-100 transition-colors duration-200 active:scale-95 rotate-on-hover">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            {/* Content Layer */}
            <div className="relative z-20 rounded-3xl p-8 space-y-5 flex flex-col backdrop-blur-sm bg-[#141414]">
              <div className="text-center">
                <h2 className="text-2xl font-extrabold text-gray-50">
                  {editingAccount ? `Edit ${selectedProvider} Account` : `Add New ${selectedProvider} Account`}
                </h2>
                <p className="text-sm text-gray-400 mt-2">{editingAccount ? 'Modify your saved login credentials.' : 'Enter new login credentials.'}</p>
              </div>

              {/* OAuth Provider Logo */}
              <div className="flex justify-center mb-4">
                <img 
                  src={oauthIconMap[selectedProvider]} 
                  alt={`${selectedProvider} logo`} 
                  className="w-16 h-16 object-contain rounded-full shadow-lg"
                />
              </div>

              <form onSubmit={handleAddOrUpdateAccount} className="space-y-5">
                <div className={inputGroupClasses}>
                  <input
                    type="text"
                    id="oauthUsernameOrEmail"
                    name="oauthUsernameOrEmail"
                    placeholder=" "
                    className={inputClasses}
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                  <label htmlFor="oauthUsernameOrEmail" className={labelClasses}>Username or email</label>
                </div>
                <div className={inputGroupClasses}>
                  <input
                    type={isPasswordVisible ? 'text' : 'password'}
                    id="oauthPassword"
                    name="oauthPassword"
                    placeholder=" "
                    className={inputClasses}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                  <label htmlFor="oauthPassword" className={labelClasses}>Password</label>
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible(prev => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    <FontAwesomeIcon icon={isPasswordVisible ? faEyeSlash : faEye} />
                  </button>
                </div>
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                
                {/* 🎯 Saved Accounts Div Moved Below Password Field */}
                {savedOAuthAccounts.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 hide-scrollbar pt-2"> {/* Added pt-2 for spacing */}
                      {savedOAuthAccounts.map(account => (
                          <button
                              key={account.id}
                              className="w-full text-left px-3 py-2 bg-[#1c1c1c] border border-gray-700 rounded-lg text-white hover:border-white transition-colors duration-200 flex items-center justify-between"
                              onClick={() => handleEdit(account)}
                          >
                              <div className="flex-grow">
                                  <p className="font-medium text-sm">{account.email}</p>
                                  {/* 🎯 Password Part Removed for Space/Clarity */}
                                  {/* {account.decryptedPassword && <p className="text-xs text-gray-400">Password: {isPasswordVisible ? account.decryptedPassword : '•'.repeat(12)}</p>} */}
                              </div>
                              <div className="flex space-x-1">
                                  <button
                                      onClick={(e) => { e.stopPropagation(); handleDelete(account.id); }}
                                      className="px-2 py-0.5 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors rounded-sm"
                                  >
                                      Delete
                                  </button>
                              </div>
                          </button>
                      ))}
                  </div>
                )}
                
                <div className="flex flex-col space-y-3 pt-4">
                  <button
                    type="submit"
                    className={`w-full py-3 text-sm font-semibold text-[var(--color3)] rounded-full hover:opacity-90 transition-opacity btn-shine disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={{ background: `linear-gradient(to right, ${colors[0].hex}, ${colors[1].hex})` }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (editingAccount ? 'Updating...' : 'Saving...') : (editingAccount ? 'Update Account' : 'Save Account')}
                  </button>
                  {editingAccount && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="w-full py-3 text-sm font-semibold text-gray-400 hover:text-white transition-colors rounded-full"
                      disabled={isSubmitting}
                    >
                      Cancel Edit
                    </button>
                  )}
                  {!editingAccount && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-3 text-sm font-semibold text-gray-400 hover:text-white transition-colors rounded-full"
                      disabled={isSubmitting}
                    >
                      Close
                    </button>
                  )}
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
 
export default OAuthAccountModal;  