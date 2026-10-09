import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTimes, faKey, faBoxesStacked } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../../supabaseClient'; // Assuming supabaseClient is correctly set up
import { useAuth } from '../../contexts/AuthContext'; // Assuming AuthContext provides user session
import '../../styles/CreatePasswordModal.css'; // Reusing the CSS provided by the user
import colors from '../../../color';
import SavedAccountsModal from './SavedAccountsModal'; // Import the new modal
import { decrypt } from '../../utils/crypto'; // Import decrypt function
import ConfirmationModal from './ConfirmationModal'; // Import ConfirmationModal

// Import OAuth provider icons
import googleIcon from '../../assets/googleicon.png';
import appleIcon from '../../assets/appleicon.png';
import facebookIcon from '../../assets/facebookicon.png';
import microsoftIcon from '../../assets/microsofticon.png';
import githubIcon from '../../assets/githubicon.png';

// Debounce utility function
const debounce = (func, delay) => {
    let timeout;
    const debounced = function executed(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, delay);
    };
    debounced.cancel = () => {
        clearTimeout(timeout);
    };
    return debounced;
};

// Placeholder for PasswordStrengthMeter - will be moved or re-created if needed
const PasswordStrengthMeter = ({ password }) => {
  const controls = useAnimation(); // Assuming useAnimation is imported from framer-motion

  const evaluatePassword = (pass) => {
    let score = 0;
    const checks = {
      length: pass.length >= 12,
      uppercase: /[A-Z]/.test(pass),
      lowercase: /[a-z]/.test(pass),
      number: /[0-9]/.test(pass),
      special: /[!@#$%^&*]/.test(pass),
    };
    if (pass.length >= 8) score++;
    if (checks.uppercase) score++;
    if (checks.lowercase) score++;
    if (checks.number) score++;
    if (checks.special) score++;
    
    return { score, checks };
  };

  useEffect(() => {
    if (!password) {
      controls.start({ width: '0%', backgroundColor: '#EF4444' });
      return;
    }

    const { score, checks } = evaluatePassword(password);
    
    const strengthLevels = {
      0: { width: '10%', color: '#EF4444', label: 'Very Weak' },
      1: { width: '20%', color: '#EF4444', label: 'Weak' },
      2: { width: '40%', color: '#F59E0B', label: 'Fair' },
      3: { width: '60%', color: '#F59E0B', label: 'Good' },
      4: { width: '80%', color: 'var(--color1)', label: 'Strong' },
      5: { width: '100%', color: 'var(--color1)', label: 'Very Strong' },
    };
  
    const { width, color, label } = strengthLevels[score];
    controls.start({ width, backgroundColor: color });
  }, [password, controls]);

  if (!password) return null;

  const { score, checks } = evaluatePassword(password);
  const strengthLevels = {
    0: { width: '10%', color: '#EF4444', label: 'Very Weak' },
    1: { width: '20%', color: '#EF4444', label: 'Weak' },
    2: { width: '40%', color: '#F59E0B', label: 'Fair' },
    3: { width: '60%', color: '#F59E0B', label: 'Good' },
    4: { width: '80%', color: 'var(--color1)', label: 'Strong' },
    5: { width: '100%', color: 'var(--color1)', label: 'Very Strong' },
  };
  const { label, color } = strengthLevels[score];

  return (
    <div className="password-strength-container">
      <div className="password-strength-meter">
        <motion.div
          className="strength-bar"
          initial={{ width: 0 }}
          animate={controls}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        />
      </div>
      <div className="strength-feedback">
        <span style={{ color }}>{label}</span>
        <div className="strength-criteria">
          <span className={checks.length ? 'met' : ''}>12+ Chars</span>
          <span className={checks.uppercase ? 'met' : ''}>Uppercase</span>
          <span className={checks.number ? 'met' : ''}>Number</span>
          <span className={checks.special ? 'met' : ''}>Symbol</span>
        </div>
      </div>
    </div>
  );
};


const CreatePasswordModal = ({ isOpen, onClose, onCreate, encryptionKey, getOAuthAccounts, onOpenOAuthAccountModal }) => {
    const { session } = useAuth();
    const [currentSlide, setCurrentSlide] = useState(1);
    const [selectedTags, setSelectedTags] = useState([]);
    const [companyName, setCompanyName] = useState('');
    const [userCategories, setUserCategories] = useState([]);

    // Slide 2 states (existing form)
    const [account, setAccount] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [generatedLogoUrl, setGeneratedLogoUrl] = useState(null); // New state for generated logo URL
    const [selectedOAuthProvider, setSelectedOAuthProvider] = useState(null); // New state for selected OAuth provider
    const [customOAuthProvider, setCustomOAuthProvider] = useState(''); // New state for custom OAuth provider
    const [savedOAuthLogins, setSavedOAuthLogins] = useState([]); // New state for saved OAuth logins
    const [selectedSavedLoginId, setSelectedSavedLoginId] = useState(null); // New state for selected saved login
    const [isAnimating, setIsAnimating] = useState(false);
    const [showOptionalFields, setShowOptionalFields] = useState(false);
    const [showSavedAccountsModal, setShowSavedAccountsModal] = useState(false); // New state for saved accounts modal
    const [showTagDeleteConfirmation, setShowTagDeleteConfirmation] = useState(false); // New state for tag delete confirmation
    const [tagToDelete, setTagToDelete] = useState(null); // New state to store the tag to be deleted

    useEffect(() => {
        if (isOpen && selectedOAuthProvider && encryptionKey && getOAuthAccounts) {
            const fetchSavedLogins = async () => {
                try {
                    const { data } = await getOAuthAccounts();
                    const filteredLogins = data.filter(login => login.oauth === selectedOAuthProvider);
                    
                    const decryptedLogins = await Promise.all(filteredLogins.map(async (login) => {
                        if (login.password) {
                            try {
                                const encryptedData = JSON.parse(login.password);
                                const decryptedPass = await decrypt(
                                    { ciphertext: new Uint8Array(encryptedData.ciphertext), iv: new Uint8Array(encryptedData.iv) },
                                    encryptionKey
                                );
                                return { ...login, decryptedPassword: decryptedPass };
                            } catch (e) {
                                console.error("CreatePasswordModal.jsx:event_158");
                                return { ...login, decryptedPassword: '[Decryption Error]' };
                            }
                        }
                        return login;
                    }));
                    setSavedOAuthLogins(decryptedLogins);
                    if (decryptedLogins.length > 0) {
                        setShowSavedAccountsModal(true);
                    } else {
                        setShowSavedAccountsModal(false);
                        // If no saved accounts, open the OAuthAccountModal to create one
                        if (onOpenOAuthAccountModal) {
                            onOpenOAuthAccountModal(selectedOAuthProvider);
                            onClose(); // Close CreatePasswordModal
                        }
                    }
                } catch (error) {
                    console.error("CreatePasswordModal.jsx:event_176");
                    setSavedOAuthLogins([]);
                    setShowSavedAccountsModal(false);
                }
            };
            fetchSavedLogins();
        } else if (!selectedOAuthProvider) {
            setSavedOAuthLogins([]);
            setSelectedSavedLoginId(null); // Reset selected saved login when OAuth provider is cleared
            setShowSavedAccountsModal(false); // Close saved accounts modal when OAuth provider changes or modal closes
        }
    }, [isOpen, selectedOAuthProvider, encryptionKey, getOAuthAccounts, onOpenOAuthAccountModal, onClose]);

    const handleSelectSavedLogin = (login) => {
        setUsername(login.email);
        setPassword(login.decryptedPassword);
        setSelectedSavedLoginId(login.id);
    };

    const buttonTextRef = useRef(null);
    const liveIntervalId = useRef(null);
    const animationFrameId = useRef(null);

    // Slide 1 states
    const colorThief = useRef(null);
    const companyTileContainerRef = useRef(null);
    const placeholderRef = useRef(null);
    const tagsContainerRef = useRef(null);
    const addTagBtnRef = useRef(null);
    const customTagWrapperRef = useRef(null);
    const customTagInputRef = useRef(null);
    const confirmAddTagBtnRef = useRef(null);
    const modalDynamicBgRef = useRef(null);
    const initialLogoRef = useRef(null);
    const viewAllTagsBtnRef = useRef(null);
    const allTagsModalRef = useRef(null);
    const allTagsGridRef = useRef(null);
    const closeAllTagsBtnRef = useRef(null);

    const defaultCategories = [
        'Social', 'Finance', 'Productivity', 'E-commerce', 'Utilities', 'Travel',
        'Health', 'Education', 'Streaming', 'Gaming'
    ];
    const companyTagMap = {
        'google': 'Productivity', 'microsoft': 'Productivity', 'slack': 'Productivity', 'adobe': 'Productivity',
        'facebook': 'Social', 'instagram': 'Social', 'twitter': 'Social', 'x': 'Social', 'linkedin': 'Social',
        'chase': 'Finance', 'wellsfargo': 'Finance', 'bankofamerica': 'Finance', 'paypal': 'Finance',
        'verizon': 'Utilities', 'comcast': 'Utilities', 'at&t': 'Utilities',
        'expedia': 'Travel', 'booking': 'Travel', 'airbnb': 'Travel',
        'coursera': 'Education', 'udemy': 'Education',
        'amazon': 'Shopping', 'ebay': 'E-commerce',
        'netflix': 'Streaming', 'hulu': 'Streaming',
        'epicgames': 'Gaming', 'steam': 'Gaming'
    };

    useEffect(() => {
        if (isOpen) {
            setCurrentSlide(1); // Always start at the first slide
            setCompanyName('');
            setSelectedTags([]);
            // Reset Slide 2 fields
            setAccount('');
            setUsername('');
            setPassword('');
            setPhone('');
            setNotes('');
            setGeneratedLogoUrl(null); // Reset generated logo URL
            setSelectedOAuthProvider(null); // Reset selected OAuth provider
            setCustomOAuthProvider(''); // Reset custom OAuth provider
            setShowOptionalFields(false);
            setSelectedSavedLoginId(null); // Reset selected saved login
            
            // Initialize ColorThief
            if (typeof window !== 'undefined' && window.ColorThief && !colorThief.current) {
                colorThief.current = new window.ColorThief();
                // After ColorThief is initialized, re-run updateCompanyTile to apply gradient
                updateCompanyTile();
            }
            
            fetchUserTags();
        }
    }, [isOpen, session]);

    const fetchUserTags = useCallback(async () => {
        if (!session?.user?.id) return;
        try {
            const { data, error } = await supabase
                .from('users')
                .select('tags')
                .eq('id', session.user.id)
                .single();

            if (error) throw error;

            if (data && data.tags) {
                setUserCategories(data.tags);
                setSelectedTags([]); // Initialize selectedTags as empty, so tags are deselected by default
            } else {
                setUserCategories([]);
                setSelectedTags([]);
            }
        } catch (error) {
            console.error("CreatePasswordModal.jsx:event_278");
            setUserCategories([]);
        }
    }, [session]);

    const allCategories = useMemo(() => {
        return Array.from(new Set(userCategories)); // Only user-created tags
    }, [userCategories]);

    // --- Slide 1 Logic (Company/Tag Selection) ---

    const levenshteinDistance = (s1, s2) => {
        s1 = s1.toLowerCase().trim();
        s2 = s2.toLowerCase().trim();
        
        const track = Array(s2.length + 1).fill(null).map(() =>
            Array(s1.length + 1).fill(null));

        for (let i = 0; i <= s1.length; i += 1) {
            track[0][i] = i;
        }
        for (let j = 0; j <= s2.length; j += 1) {
            track[j][0] = j;
        }

        for (let j = 1; j <= s2.length; j += 1) {
            for (let i = 1; i <= s1.length; i += 1) {
                const indicator = (s1[i - 1] === s2[j - 1] ? 0 : 1);
                track[j][i] = Math.min(
                    track[j - 1][i] + 1,        // deletion
                    track[j][i - 1] + 1,        // insertion
                    track[j - 1][i - 1] + indicator, // substitution
                );
            }
        }
        return track[s2.length][s1.length];
    };

    const getCorrectedDisplayName = (inputName, canonicalSlugs) => {
        const inputSlug = inputName.toLowerCase().replace(/\s+/g, '').replace(/&/g, 'and');
        let bestMatchSlug = null;
        let minDistance = 2; 

        for (const slug of canonicalSlugs) {
            const distance = levenshteinDistance(inputSlug, slug);
            
            if (distance === 0) {
                return slug.charAt(0).toUpperCase() + slug.slice(1);
            }
            
            if (distance < minDistance) {
                minDistance = distance;
                bestMatchSlug = slug;
            }
        }

        if (minDistance > 0 && minDistance < 2 && bestMatchSlug) {
            return bestMatchSlug.charAt(0).toUpperCase() + bestMatchSlug.slice(1);
        }

        return inputName;
    };

    const selectTag = (tagName) => {
        setSelectedTags(prevSelectedTags => {
            if (prevSelectedTags.includes(tagName)) {
                return prevSelectedTags.filter(tag => tag !== tagName);
            } else {
                return [...prevSelectedTags, tagName];
            }
        });
    };


    const openAllTagsModal = () => {
        if (allTagsGridRef.current) {
            allTagsModalRef.current?.classList.remove('hidden');
            allTagsModalRef.current?.classList.add('tags-modal-open', 'flex');
        }
    };

    const closeAllTagsModal = () => {
        allTagsModalRef.current?.classList.remove('tags-modal-open', 'flex');
        allTagsModalRef.current?.classList.add('hidden');
    };

    const updateCompanyTile = useCallback(() => {
        const currentCompanyName = companyName.trim();
        if (!companyTileContainerRef.current || !placeholderRef.current) return;

        companyTileContainerRef.current.innerHTML = ''; 

        if (currentCompanyName) {
            placeholderRef.current.classList.add('hidden');
            companyTileContainerRef.current.classList.remove('bg-gray-900/30', 'border-dashed', 'border-gray-700/50');
            companyTileContainerRef.current.classList.add('p-1');
            
            const canonicalSlugs = Object.keys(companyTagMap);
            const correctedDisplayName = getCorrectedDisplayName(currentCompanyName, canonicalSlugs); 

            const companySlug = currentCompanyName.toLowerCase().replace(/\s+/g, '').replace(/&/g, 'and');
            let domainForClearbit = companySlug;
            // If the companySlug doesn't contain a dot, assume it's a company name and append .com
            if (!companySlug.includes('.')) {
              domainForClearbit = `${companySlug}.com`;
            }
            const logoUrl = `https://img.logo.dev/${domainForClearbit}?token=pk_Hs9X4-PFTGOl4sEhLWXJjg&size=128`;
            setGeneratedLogoUrl(logoUrl); // Set the generated logo URL
            
            const tile = document.createElement('div');
            tile.className = 'tile-pop-in showcase-tile rounded-2xl w-full h-full';
            const placeholderLetter = correctedDisplayName.charAt(0).toUpperCase();

            tile.innerHTML = `
                <div class="dynamic-gradient-bg absolute inset-0 rounded-2xl blur-3xl opacity-0 transition-opacity duration-1000"></div>
                <div class="showcase-tile-content p-5 flex items-center w-full h-full">
                    <img 
                        crossorigin="anonymous"
                        id="companyLogo"
                        src="${logoUrl}" 
                        onerror="this.onerror=null;this.src='https://placehold.co/64x64/1e293b/94a3b8?text=${placeholderLetter}'; this.parentElement.querySelector('#logo-fallback').classList.remove('hidden'); this.classList.add('hidden');"
                        alt="${correctedDisplayName} Logo" 
                        class="w-14 h-14 rounded-lg bg-white/5 object-contain p-1.5 shrink-0"
                    >
                    <div id="logo-fallback" class="w-14 h-14 rounded-lg bg-gray-700 text-gray-300 flex items-center justify-center text-2xl font-bold hidden shrink-0">${placeholderLetter}</div>
                    <div class="ml-4">
                        <p class="font-bold text-lg text-gray-50">${correctedDisplayName}</p>
                        <p class="text-xs text-gray-400" id="companyTagDisplay">Identified</p>
                    </div>
                    <div class="ml-auto text-green-400">
                         <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" class="feather feather-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                </div>
            `;
            companyTileContainerRef.current.appendChild(tile);

            const logoElement = tile.querySelector('#companyLogo');
            const tileGradientBg = tile.querySelector('.dynamic-gradient-bg');
            const companyTagDisplayElement = tile.querySelector('#companyTagDisplay');

            // Fetch tag from public.tags table
            const fetchAndDisplayTag = async () => {
                try {
                    const { data, error } = await supabase
                        .from('tags')
                        .select('tag')
                        .eq('account', currentCompanyName)
                        .single();

                    if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows found, which is fine

                    if (data && data.tag && data.tag.length > 0) {
                        companyTagDisplayElement.textContent = data.tag[0];
                    } else {
                        companyTagDisplayElement.textContent = 'Account Identified';
                    }
                } catch (error) {
                    console.error("CreatePasswordModal.jsx:event_435");
                    companyTagDisplayElement.textContent = 'Account Identified';
                }
            };

            fetchAndDisplayTag();

            const updateGradients = () => {
                console.debug("CreatePasswordModal.jsx:event_443");
                applyDynamicGradient(colorThief.current, logoElement, tileGradientBg);
                if (tileGradientBg) tileGradientBg.style.opacity = 0.8; 
                applyDynamicGradient(colorThief.current, logoElement, modalDynamicBgRef.current);
            };

            if (logoElement.complete) {
                updateGradients();
            } else {
                logoElement.onload = updateGradients;
                logoElement.onerror = () => {
                    setGeneratedLogoUrl(null); // Set to null if logo fails to load
                    updateGradients(); // Still try to update gradients with fallback
                };
            }

            const continueBtn = document.getElementById('continueBtn');
            if (continueBtn) {
                continueBtn.disabled = !currentCompanyName && selectedTags.length === 0;
            }
        } else {
            setGeneratedLogoUrl(null); // Clear generated logo URL if company name is empty
            companyTileContainerRef.current.appendChild(placeholderRef.current);
            placeholderRef.current.classList.remove('hidden');
            companyTileContainerRef.current.classList.add('bg-gray-900/30', 'border-dashed', 'border-gray-700/50');
            companyTileContainerRef.current.classList.remove('p-1');
            selectTag('');
            const continueBtn = document.getElementById('continueBtn');
            if (continueBtn) {
                continueBtn.disabled = true;
            }
            
            if (modalDynamicBgRef.current) {
                // Apply a default gradient if no company name is entered
                modalDynamicBgRef.current.style.background = `radial-gradient(circle at center, rgba(17, 17, 17, 0.7) 0%, rgba(10, 10, 10, 0.7) 100%)`; // Near-black default
                modalDynamicBgRef.current.style.opacity = 0.1; // Set to 0.1 opacity
            }
        }
    }, [companyName, selectedTags, allCategories]);


    const createTag = async (tagName) => {
        const cleanName = tagName.trim();
        if (!cleanName || allCategories.map(t => t.toLowerCase()).includes(cleanName.toLowerCase())) return;

        // Add to the global list and update Supabase
        const newCategories = [...userCategories, cleanName];
        try {
            const { error } = await supabase
                .from('users')
                .update({ tags: newCategories })
                .eq('id', session.user.id);

            if (error) throw error;

            setUserCategories(newCategories); 
            setSelectedTags(prev => [...prev, cleanName]); // Add new tag to selectedTags
            
            if (customTagInputRef.current) customTagInputRef.current.value = '';
            customTagWrapperRef.current?.classList.add('hidden');
            
            addTagBtnRef.current?.classList.remove('tag-btn-active');
        } catch (error) {
            console.error("CreatePasswordModal.jsx:event_506");
        }
    };

    const deleteTag = useCallback(async (tagToDelete) => {
        if (!session?.user?.id) return;

        const newCategories = userCategories.filter(tag => tag !== tagToDelete);

        try {
            const { error } = await supabase
                .from('users')
                .update({ tags: newCategories })
                .eq('id', session.user.id);

            if (error) throw error;

            setUserCategories(newCategories);
            if (selectedTags.includes(tagToDelete)) {
                setSelectedTags(prev => prev.filter(tag => tag !== tagToDelete)); // Deselect if the deleted tag was selected
            }
        } catch (error) {
            console.error("CreatePasswordModal.jsx:event_528");
        }
    }, [session, userCategories, selectedTags]);

    const applyDynamicGradient = (colorThiefInstance, logoElement, targetElement) => {
        if (!colorThiefInstance || !logoElement || !targetElement) {
            console.log('applyDynamicGradient: Missing colorThiefInstance, logoElement, or targetElement.');
            return;
        }
        try {
            console.log('applyDynamicGradient: Attempting to get palette from logo.');
            const palette = colorThiefInstance.getPalette(logoElement, 4); 
            if (palette && palette.length >= 2) {
                const color1 = `rgb(${palette[0][0]}, ${palette[0][1]}, ${palette[0][2]})`;
                const color2 = `rgb(${palette[1][0]}, ${palette[1][1]}, ${palette[1][2]})`;
                targetElement.style.background = `radial-gradient(circle at center, ${color1} 0%, ${color2} 100%)`;
                targetElement.style.opacity = 0.1; // Set to 0.1 opacity
                console.debug("CreatePasswordModal.jsx:event_545");
            } else {
                console.log('applyDynamicGradient: Palette not diverse enough, applying fallback.');
                targetElement.style.background = `radial-gradient(circle at center, rgba(17, 17, 17, 0.7) 0%, rgba(10, 10, 10, 0.7) 100%)`; // Near-black fallback
                targetElement.style.opacity = 0.1; // Set to 0.1 opacity
            }
        } catch (e) {
            console.error("CreatePasswordModal.jsx:event_552");
            targetElement.style.background = `radial-gradient(circle at center, rgba(17, 17, 17, 0.7) 0%, rgba(10, 10, 10, 0.7) 100%)`; // Near-black fallback
            targetElement.style.opacity = 0.1; // Set to 0.1 opacity
        }
    };

    useEffect(() => {
        if (currentSlide === 1 && isOpen) {
            // Event Listeners for Slide 1

            const handleAddTagClick = () => {
                customTagWrapperRef.current?.classList.toggle('hidden');
                addTagBtnRef.current?.classList.toggle('tag-btn-active');
                if (!customTagWrapperRef.current?.classList.contains('hidden')) {
                    customTagInputRef.current?.focus();
                    selectTag('');
                }
            };
            addTagBtnRef.current?.addEventListener('click', handleAddTagClick);
            const handleConfirmAddTagClick = () => {
                if (customTagInputRef.current) createTag(customTagInputRef.current.value.trim());
            };
            confirmAddTagBtnRef.current?.addEventListener('click', handleConfirmAddTagClick);
            const handleCustomTagInputKeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (customTagInputRef.current) createTag(customTagInputRef.current.value.trim());
                }
            };
            customTagInputRef.current?.addEventListener('keydown', handleCustomTagInputKeydown);
            viewAllTagsBtnRef.current?.addEventListener('click', openAllTagsModal);
            closeAllTagsBtnRef.current?.addEventListener('click', closeAllTagsModal);


            
            // Initial check for continue button
            const continueBtn = document.getElementById('continueBtn');
            if (continueBtn) {
                continueBtn.disabled = !companyName.trim() && selectedTags.length === 0;
            }

            return () => {
                addTagBtnRef.current?.removeEventListener('click', handleAddTagClick);
                confirmAddTagBtnRef.current?.removeEventListener('click', handleConfirmAddTagClick);
                customTagInputRef.current?.removeEventListener('keydown', handleCustomTagInputKeydown);
                viewAllTagsBtnRef.current?.removeEventListener('click', openAllTagsModal);
                closeAllTagsBtnRef.current?.removeEventListener('click', closeAllTagsModal);
            };
        }
    }, [currentSlide, isOpen, companyName, selectedTags, updateCompanyTile, createTag, allCategories, deleteTag]);

    // New useEffect for companyName changes
    useEffect(() => {
        if (currentSlide === 1 && isOpen) {
            const handler = debounce(() => {
                updateCompanyTile();
            }, 500); // 500ms debounce delay
            handler();
            return () => {
                handler.cancel && handler.cancel(); // If debounce function has a cancel method
            };
        }
    }, [companyName, currentSlide, isOpen, updateCompanyTile]); // Add updateCompanyTile to dependencies

    // New useEffect to control gradient for Slide 2
    useEffect(() => {
        if (currentSlide === 2 && isOpen && modalDynamicBgRef.current) {
            modalDynamicBgRef.current.style.background = `radial-gradient(circle at center, rgba(17, 17, 17, 0.7) 0%, rgba(10, 10, 10, 0.7) 100%)`; // Near-black default
            modalDynamicBgRef.current.style.opacity = 0.1; // Set to 0.1 opacity
        }
    }, [currentSlide, isOpen]);

    // --- Slide 2 Logic (Existing Form) ---

    const inputGroupClasses = "relative group";
    const inputClasses = "relative w-full px-5 py-3 bg-[#1c1c1c] border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-transparent transition-all peer";
    const labelClasses = "absolute left-4 -top-2 text-xs text-gray-400 bg-[#1c1c1c] px-2 rounded-md transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:-top-2 peer-focus:text-xs";
    const gradientBorderClasses = `absolute -inset-px rounded-full opacity-0 group-focus-within:opacity-100 transition duration-150`;
    const gradientBorderStyle = {
        background: `linear-gradient(90deg, ${colors[0].hex}, ${colors[1].hex}) border-box`,
        WebkitMask: `linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)`,
        WebkitMaskComposite: `destination-out`,
        maskComposite: `exclude`,
        border: `2px solid transparent`,
    };
    const textareaLabelClasses = "absolute left-4 -top-2 text-xs text-gray-400 bg-[#1c1c1c] px-2 rounded-md transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:-top-2 peer-focus:text-xs";

    useEffect(() => {
        if (currentSlide === 2 && isOpen) {
            // Reset fields if coming from Slide 1
            if (companyName) {
                setAccount(companyName);
            }
            // Cleanup interval on component unmount
            return () => {
                if (liveIntervalId.current) clearInterval(liveIntervalId.current);
                if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            };
        }
    }, [currentSlide, isOpen, companyName]);

    const handleSubmitSlide2 = (e) => {
        e.preventDefault();
        const oauthProvider = selectedOAuthProvider === 'Other' ? customOAuthProvider : selectedOAuthProvider;
        onCreate({ account, username, password, phone, notes, url: generatedLogoUrl, tags: selectedTags, oauth: oauthProvider }, encryptionKey);
        onClose();
        // Reset fields
        setAccount(''); setUsername(''); setPassword(''); setPhone(''); setNotes(''); setGeneratedLogoUrl(null); setSelectedTags([]);
        setSelectedOAuthProvider(null); setCustomOAuthProvider('');
    };

    const generateStrongPassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        const specialChars = "!@#$%^&*";
        let newPassword = "";
        for (let i = 0; i < 12; i++) {
            newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        for (let i = 0; i < 4; i++) {
            newPassword += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
        }
        newPassword = newPassword.split('').sort(() => 0.5 - Math.random()).join('');
        setPassword(newPassword);
    };

    const handleGenerateClick = () => {
        if (isAnimating) return;
        
        setIsAnimating(true);
        generateStrongPassword();

        const targetEl = buttonTextRef.current;
        if (!targetEl) return;

        const originalText = "Generate Strong Password";
        const CHARS = '!<>-_/[]{}—=+*^?#';
        
        targetEl.innerHTML = '';
        originalText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char === ' ' ? ' ' : char;
            span.className = 'letter';
            span.setAttribute('data-text', char);
            targetEl.appendChild(span);
        });

        const letters = Array.from(targetEl.querySelectorAll('.letter'));
        const queue = [];
        for (let i = 0; i < letters.length; i++) {
            const start = i * 2;
            const end = start + 15;
            queue.push({ start, end, char: letters[i] });
        }

        let frame = 0;

        const update = () => {
            let complete = 0;
            for (let i = 0; i < queue.length; i++) {
                let { start, end, char } = queue[i];
                
                if (frame >= end) {
                    if (!char.classList.contains('resolved')) {
                        char.textContent = originalText[i] === ' ' ? ' ' : originalText[i];
                        char.classList.add('resolved');
                        char.classList.remove('resolving');
                    }
                    complete++;
                } else if (frame >= start) {
                    if (!char.classList.contains('resolving')) {
                        char.classList.add('resolving');
                    }
                    if (char.textContent.trim() !== '') {
                        char.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
                    }
                }
            }

            if (complete === queue.length) {
                cancelAnimationFrame(animationFrameId.current);
                animationFrameId.current = null;
                startLiveAnimation();
                return;
            }
            
            frame++;
            animationFrameId.current = requestAnimationFrame(update);
        };
        
        animationFrameId.current = requestAnimationFrame(update);

        setTimeout(() => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
            setIsAnimating(false);
        }, 1500);
    };

    const runLiveScramble = (letter) => {
        if (letter.classList.contains('live-active')) return; 

        const originalChar = letter.getAttribute('data-text');
        let scrambleCount = 0;
        const maxScrambles = 5;
        
        letter.classList.add('live-active', 'resolving');

        const interval = setInterval(() => {
            if (scrambleCount >= maxScrambles) {
                clearInterval(interval);
                letter.textContent = originalChar === ' ' ? ' ' : originalChar;
                letter.classList.remove('live-active', 'resolving');
            }
            else {
                letter.textContent = '!<>-_/[]{}—=+*^?#'[Math.floor(Math.random() * 15)];
                scrambleCount++;
            }
        }, 80);
    }

    const startLiveAnimation = () => {
        if (liveIntervalId.current) clearInterval(liveIntervalId.current);
        
        liveIntervalId.current = setInterval(() => {
            const targetEl = buttonTextRef.current;
            if (!targetEl) return;
            const letters = Array.from(targetEl.querySelectorAll('.letter.resolved'));
            if (letters.length > 1) {
                const index1 = Math.floor(Math.random() * letters.length);
                let index2 = Math.floor(Math.random() * letters.length);
                while(index1 === index2) {
                    index2 = Math.floor(Math.random() * letters.length);
                }
                
                if (letters[index1].textContent.trim() !== '') runLiveScramble(letters[index1]);
                if (letters[index2].textContent.trim() !== '') runLiveScramble(letters[index2]);
            }
        }, 8000);
    }

    const handleConfirmTagDelete = () => {
        if (tagToDelete) {
            deleteTag(tagToDelete);
            setTagToDelete(null);
        }
        setShowTagDeleteConfirmation(false);
    };

    const handleCancelTagDelete = () => {
        setTagToDelete(null);
        setShowTagDeleteConfirmation(false);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div key="create-password-modal-content" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.99, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.99, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="relative border border-gray-800 rounded-3xl w-full max-w-md overflow-hidden"
                    >
                        <button onClick={onClose} className={`absolute top-4 right-4 z-30 p-2 text-gray-400 hover:text-gray-100 transition-colors duration-200 active:scale-95 rotate-on-hover ${currentSlide === 2 ? 'hidden' : ''}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        {/* Dynamic Gradient Layer (Z-index 0) */}
                        <div ref={modalDynamicBgRef} className="absolute inset-0 rounded-3xl blur-3xl opacity-0 transition-opacity duration-1000 z-10"></div>

                        {/* All Tags Full-Screen Overlay (Z-index 40) */}
                        <div ref={allTagsModalRef} className="absolute inset-0 bg-black rounded-3xl z-40 p-8 hidden flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold text-gray-50">All Tags</h3>
                                <button ref={closeAllTagsBtnRef} className="p-2 text-gray-400 hover:text-gray-100 transition-colors duration-200 active:scale-95 rotate-on-hover">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                            <div ref={allTagsGridRef} className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto p-2 hide-scrollbar">
                                {allCategories
                                    .sort((a, b) => {
                                        if (selectedTags.includes(a)) return -1;
                                        if (selectedTags.includes(b)) return 1;
                                        return a.localeCompare(b);
                                    })
                                    .map(tagText => (
                                        <button
                                            key={tagText}
                                            className={`tag-btn border relative group ${selectedTags.includes(tagText) ? 'tag-selected' : 'bg-gray-800/50 border-gray-700 text-gray-300'} px-3 py-1.5 rounded-full text-sm font-medium text-center`}
                                            onClick={() => {
                                                selectTag(tagText);
                                                closeAllTagsModal();
                                            }}
                                        >
                                            {tagText}
                                            <button
                                                className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 rotate-on-hover"
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent selecting the tag when deleting
                                                    setTagToDelete(tagText);
                                                    setShowTagDeleteConfirmation(true);
                                                }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                        </button>
                                    ))}
                            </div>
                        </div>

                        {/* Content Layer (Z-index 10) */}
                        <div className="relative z-20 rounded-3xl p-8 space-y-8 flex flex-col backdrop-blur-sm">
                            {currentSlide === 1 && (
                                <motion.div
                                    key="slide1"
                                    initial={{ x: 100, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: -100, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    className="space-y-8"
                                >

                                    <div className="text-center">
                                        <h2 className="text-2xl font-extrabold text-gray-50">New Account</h2>
                                        <p className="text-sm text-gray-400 mt-2">Add a record to your vault. You can also add tags so it's easier to find later.</p>
                                    </div>

                                    <div className={inputGroupClasses}>
                                        <div className={gradientBorderClasses} style={gradientBorderStyle}></div>
                                        <input type="text" id="companyName" name="companyName" placeholder=" " className={`${inputClasses} pl-5`} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                                        <label htmlFor="companyName" className={labelClasses}>Name (e.g Gmail, Jake's birthday, etc.) </label>
                                    </div>

                                    <div ref={companyTileContainerRef} className="h-32 flex items-center justify-center bg-gray-900/30 border border-dashed border-gray-700/50 rounded-2xl transition-all duration-300 shadow-inner shadow-gray-900/50">
                                                                                 <div ref={placeholderRef} className="text-center text-gray-600">
                                                                                    <svg className="mx-auto h-12 w-12" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                                                                    <p className="mt-2 text-sm font-medium">Enter something above</p>
                                                                                </div>                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div>
                                                                        <h3 className="text-sm font-semibold text-gray-400 mb-3 text-center">Add tags to personalize it</h3>
                                            <div className="flex items-center gap-2">
                                                <div className="flex whitespace-nowrap gap-2 horizontal-scroll py-4 px-1 flex-grow">
                                                    <button ref={addTagBtnRef} title="Add custom category" className="tag-btn bg-gray-800/50 border border-gray-700 text-gray-400 w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 shrink-0 rotate-on-hover">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                    </button>
                                                    {allCategories
                                                        .sort((a, b) => {
                                                            if (selectedTags.includes(a)) return -1;
                                                            if (selectedTags.includes(b)) return 1;
                                                            return a.localeCompare(b);
                                                        })
                                                        .map(tagText => (
                                                            <button
                                                                key={tagText}
                                                                className={`tag-btn border relative group ${selectedTags.includes(tagText) ? 'tag-selected' : 'bg-gray-800/50 border-gray-700 text-gray-300'} px-3 py-1.5 rounded-full text-sm font-medium shrink-0`}
                                                                onClick={() => selectTag(tagText)}
                                                            >
                                                                {tagText}
                                                                <button
                                                                    className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 rotate-on-hover"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation(); // Prevent selecting the tag when deleting
                                                                        setTagToDelete(tagText);
                                                                        setShowTagDeleteConfirmation(true);
                                                                    }}
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                                </button>
                                                            </button>
                                                        ))}
                                                </div>
                                                <button ref={viewAllTagsBtnRef} title="View all categories in a list" className="tag-btn bg-gray-800/50 border border-gray-700 text-gray-400 w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium shrink-0">
                                                    <FontAwesomeIcon icon={faBoxesStacked} className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div ref={customTagWrapperRef} className="hidden pt-2">
                                            <div className="flex items-center gap-2">
                                        <div className={inputGroupClasses}>
                                            <div className={gradientBorderClasses} style={gradientBorderStyle}></div>
                                            <input ref={customTagInputRef} type="text" placeholder=" " className={`${inputClasses} pl-5`} />
                                            <label htmlFor="customTagInput" className={labelClasses}>Tag (e.g work)</label>
                                        </div>
                                                <button ref={confirmAddTagBtnRef} className={`bg-gradient-to-r from-[${colors[0].hex}] to-[${colors[1].hex}] text-white rounded-full p-2 h-9 w-9 flex items-center justify-center hover:opacity-90 transition-all duration-300 shadow-lg shadow-[${colors[1].hex}]/20 shrink-0`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <button 
                                            type="button"
                                            disabled={!companyName.trim()}
                                            onClick={() => setCurrentSlide(2)}
                                            className={`w-full py-3 text-sm font-semibold text-[var(--color3)] rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
                                            style={{ background: `linear-gradient(to right, ${colors[0].hex}, ${colors[1].hex})` }}
                                        >Continue</button>
                                    </div>
                                </motion.div>
                            )}

                            {currentSlide === 2 && (
                                <motion.div
                                    key="slide2"
                                    initial={{ x: 100, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: -100, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    className="space-y-5"
                                >
                                                                                                                                                <header className="modal-header flex justify-between items-center mb-5">
                                                                                                                                                    <button onClick={() => setCurrentSlide(1)} className="text-gray-400 hover:text-white transition-colors">
                                                                                                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                                                                                                                                    </button>
                                                                                                                                                    <h2 className="text-xl font-bold text-white text-center flex-grow">Add New Account</h2>
                                                                                                                                                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors rotate-on-hover">
                                                                                                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                                                                                                                    </button>
                                                                                                                                                </header>                                    <form onSubmit={handleSubmitSlide2} className="space-y-5 pt-4">
                                        <div className={inputGroupClasses}>
                                            <div className={gradientBorderClasses} style={gradientBorderStyle}></div>
                                            <input id="account" type="text" name="account" placeholder=" " value={account} onChange={(e) => setAccount(e.target.value)} className={inputClasses} required />
                                            <label htmlFor="account" className={labelClasses}>Account (e.g Gmail, wifi, birthday, etc)</label>
                                        </div>

                                        <div className={inputGroupClasses}>
                                            <div className={gradientBorderClasses} style={gradientBorderStyle}></div>
                                            <input id="username" type="text" name="username" placeholder=" " value={username} onChange={(e) => setUsername(e.target.value)} className={inputClasses} />
                                            <label htmlFor="username" className={labelClasses}>Username/Email</label>
                                        </div>

                                        {selectedOAuthProvider && selectedOAuthProvider !== 'Other' && savedOAuthLogins.length > 0 && (
                                            <></>
                                        )}

                                        <div className={inputGroupClasses}>
                                            <div className={gradientBorderClasses} style={gradientBorderStyle}></div>
                                            <input id="password" type="text" name="password" placeholder=" " 
                                                   value={password} 
                                                   onChange={(e) => {
                                                        setPassword(e.target.value);
                                                        setSelectedOAuthProvider(null); // Clear OAuth selection if user types in password
                                                        setCustomOAuthProvider('');
                                                        setSelectedSavedLoginId(null); // Clear selected saved login if user types in password
                                                   }} 
                                                   className={inputClasses} 
                                                   required={!selectedOAuthProvider}
                                                   disabled={!!selectedOAuthProvider}
                                            />
                                            <label htmlFor="password" className={labelClasses}>Password</label>
                                        </div>
                                        
                                        {!selectedOAuthProvider && <PasswordStrengthMeter password={password} />}
                                        
                                        {!selectedOAuthProvider && (
                                            <div className={inputGroupClasses}>
                                                <div className={gradientBorderClasses} style={gradientBorderStyle}></div>
                                                <button
                                                    type="button"
                                                    onClick={handleGenerateClick}
                                                    className={`${inputClasses} flex items-center justify-center ${isAnimating ? 'animating' : ''}`}
                                                    disabled={isAnimating}
                                                >
                                                    <FontAwesomeIcon icon={faKey} className="mr-2" />
                                                    <span ref={buttonTextRef} className="btn-text text-sm font-semibold">
                                                        Generate strong password
                                                    </span>
                                                </button>
                                            </div>
                                        )}

                                        <div className="text-center text-gray-400 text-sm mt-4">
                                            Or log in with:
                                        </div>

                                        <div className="flex flex-wrap justify-center gap-3 px-2">
                                            {[ // Added opening curly brace here
                                                { name: 'Google', domain: 'google.com', icon: googleIcon },
                                                { name: 'Apple', domain: 'apple.com', icon: appleIcon },
                                                { name: 'Facebook', domain: 'facebook.com', icon: facebookIcon },
                                                { name: 'Microsoft', domain: 'microsoft.com', icon: microsoftIcon },
                                                { name: 'GitHub', domain: 'github.com', icon: githubIcon },
                                            ].map((oauth) => (
                                                <div 
                                                    key={oauth.name} 
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 
                                                                ${selectedOAuthProvider === oauth.name ? 'ring-2 ring-white scale-110' : ''}
                                                                relative overflow-hidden`}
                                                    onClick={() => {
                                                        setSelectedOAuthProvider(oauth.name);
                                                        setCustomOAuthProvider('');
                                                        setPassword(`Logged in with ${oauth.name}`);
                                                        setSelectedSavedLoginId(null); // Clear selected saved login
                                                    }}
                                                    title={`Sign in with ${oauth.name}`}
                                                >
                                                    <img 
                                                        src={oauth.icon} 
                                                        alt={`${oauth.name} logo`} 
                                                        className="w-7 h-7 object-contain" 
                                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/32x32/1e293b/94a3b8?text=?'; }}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {selectedOAuthProvider && (
                                            <div className="w-full text-center mt-3">
                                                <button 
                                                    onClick={() => { setSelectedOAuthProvider(null); setPassword(''); setCustomOAuthProvider(''); setSelectedSavedLoginId(null); }}
                                                    className="text-red-400 hover:text-red-300 transition-colors text-sm underline mt-2"
                                                >
                                                    Clear OAuth Selection
                                                </button>
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => setShowOptionalFields(!showOptionalFields)}
                                            className="w-full py-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors flex items-center justify-center"
                                        >
                                            <FontAwesomeIcon icon={showOptionalFields ? faTimes : faPlus} className="mr-2" />
                                            {showOptionalFields ? 'Hide optional fields' : 'Show optional fields'}
                                        </button>

                                        <AnimatePresence>
                                            {showOptionalFields && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                                    className="overflow-hidden space-y-5"
                                                >
                                                    <div className={inputGroupClasses}>
                                                        <div className={gradientBorderClasses} style={gradientBorderStyle}></div>
                                                        <input id="phone" type="tel" name="phone" placeholder=" " value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} className={inputClasses} />
                                                        <label htmlFor="phone" className={labelClasses}>Phone (optional)</label>
                                                    </div>

                                                    <div className={inputGroupClasses}>
                                                        <div className={gradientBorderClasses} style={gradientBorderStyle}></div>
                                                        <textarea id="notes" name="notes" placeholder=" " value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClasses} h-12`} />
                                                        <label htmlFor="notes" className={textareaLabelClasses}>Notes (optional)</label>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <button type="submit" disabled={!account.trim()} className={`w-full py-3 mt-6 text-sm font-semibold text-[var(--color3)] rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
                                            style={{ background: `linear-gradient(to right, ${colors[0].hex}, ${colors[1].hex})` }}>Submit</button>
                                    </form>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
            <SavedAccountsModal
                key="saved-accounts-modal"
                isOpen={showSavedAccountsModal}
                onClose={() => setShowSavedAccountsModal(false)}
                savedLogins={savedOAuthLogins}
                onSelectLogin={handleSelectSavedLogin}
                selectedOAuthProvider={selectedOAuthProvider}
            />
            <ConfirmationModal
                isOpen={showTagDeleteConfirmation}
                onClose={handleCancelTagDelete}
                onConfirm={handleConfirmTagDelete}
                title="Remove Tag?"
                message={`Are you sure you want to remove the tag \"${tagToDelete}\"? This action is irreversible.`}
                confirmText="Remove"
                cancelText="Keep"
            />
        </AnimatePresence>
    );
};

export default CreatePasswordModal;
