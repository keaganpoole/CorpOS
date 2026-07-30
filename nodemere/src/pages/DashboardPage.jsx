// src/pages/DashboardPage.jsx

import React, { useState, useEffect } from 'react';
import NavPanel from '../components/dashboard/NavPanel';

import PasswordsPage from './PasswordsPage'; // Import PasswordsPage
import PhoneHelperPage from './PhoneHelperPage'; // Import PhoneHelperPage
import SettingsPage from './SettingsPage'; // Import SettingsPage
import { Outlet, useNavigate, useLocation } from 'react-router-dom'; // Import useNavigate and useLocation
import PlanChangePopupModal from '../components/modals/PlanChangePopupModal';
import { fetchUserPlanAndPopupStatus, updateTableRecord, supabase, fetchUserSwiperPopupStatus, updateUserSwiperPopupStatus } from '../supabaseClient';
import '../styles/Dashboard.css';
import { useSwipeable } from 'react-swipeable'; // Import useSwipeable
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; // Import FontAwesomeIcon
import { faKey, faPhone, faHome, faUserCircle } from '@fortawesome/free-solid-svg-icons'; // Import icons
import { motion } from 'framer-motion'; // Import motion
import SwiperIntroModal from '../components/modals/SwiperIntroModal'; // Import SwiperIntroModal
import TutorialModal from '../components/modals/TutorialModal'; // Import TutorialModal
import DashboardLoadingScreen from '../components/DashboardLoadingScreen'; // Import DashboardLoadingScreen
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export const DashboardPage = () => {
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [userPlan, setUserPlan] = useState('Free'); // Default to Free plan
  const [currentUserId, setCurrentUserId] = useState(null); // New state for user ID
  const [screenWidth, setScreenWidth] = useState(window.innerWidth); // State for screen width
  const navigate = useNavigate(); // Initialize navigate
  const location = useLocation(); // Initialize useLocation
  const [isLoadingData, setIsLoadingData] = useState(true); // Tracks if data is still loading
  const [hasMetMinimumLoadingTime, setHasMetMinimumLoadingTime] = useState(false); // Tracks if 5 seconds have passed
  const [modalQueue, setModalQueue] = useState([]); // State to hold the queue of modals to show
  const [currentModal, setCurrentModal] = useState(null); // State to hold the currently active modal

  const setShowTutorialModal = (show) => {
    if (show) {
      setModalQueue(prev => [...prev, 'tutorial']);
      setCurrentModal('tutorial');
    } else {
      handleCloseModal('tutorial');
    }
  };

  // Determine initial currentPage based on URL
  const getInitialPage = () => {
    if (location.pathname.includes('/dashboard/phone-helper')) return 'phonehelper';
    if (location.pathname.includes('/dashboard/settings')) return 'settings';
    if (location.pathname === '/') return 'home'; // Assuming home is '/'
    return 'passwords'; // Default to passwords
  };
  const [currentPage, setCurrentPage] = useState(getInitialPage());

  useEffect(() => {
    // Update currentPage when location changes
    setCurrentPage(getInitialPage());
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Effect for minimum loading screen display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasMetMinimumLoadingTime(true);
    }, 5000); // 5 seconds

    return () => clearTimeout(timer);
  }, []);

  const { profile, hideTutorialModal } = useAuth(); // Destructure hideTutorialModal from useAuth

  useEffect(() => {
            const checkInitialModals = async () => {
                try {
                    const { data: { user }, error: userError } = await supabase.auth.getUser();
                    if (userError || !user) {
                        console.error('Error fetching user:', userError);
                        navigate('/auth'); // Redirect to auth if no user
                        return;
                    }
                    setCurrentUserId(user.id); // Store user ID in state
    
                    const { data, error } = await fetchUserPlanAndPopupStatus();
    
                    if (error) {
                        console.error('Error fetching user plan and popup status:', error);
                        return;
                    }
    
                    // Check for identity questions and redirect if not set
                    if (!data.identity_questions || data.identity_questions.length === 0) {
                        navigate('/onboarding');
                        return;
                    }
    
                    const newModalQueue = [];

                    if (data) {
                        setUserPlan(data.plan || 'Free'); // Set the user's plan, default to Free
                        if (data.plan_change_popup === false || data.plan_change_popup === null) {
                            newModalQueue.push('planChange');
                        }
                    }

                    if (!profile?.hide_tutorial_modal) {
                        newModalQueue.push('tutorial');
                    }

                    const { data: swiperData, error: swiperError } = await fetchUserSwiperPopupStatus();
                    if (swiperError) {
                      console.error('Error fetching swiper popup status:', swiperError);
                    } else if (swiperData && (swiperData.popup_swiper === false || swiperData.popup_swiper === null)) {
                        newModalQueue.push('swiperIntro');
                    }
                    
                    setModalQueue(newModalQueue);
                    if (newModalQueue.length > 0) {
                      setCurrentModal(newModalQueue[0]);
                    }

                } finally {
                    setIsLoadingData(false); // Data fetching is complete
                }
            };
    
            checkInitialModals();
  }, [profile?.hide_tutorial_modal]); // Depend on profile.hide_tutorial_modal to react to changes

  const handleCloseModal = (modalName) => {
    const currentModalIndex = modalQueue.indexOf(modalName);
    if (currentModalIndex > -1 && currentModalIndex < modalQueue.length - 1) {
      setCurrentModal(modalQueue[currentModalIndex + 1]);
    } else {
      setCurrentModal(null); // No more modals in the queue
    }
  };

  const handleClosePlanChangePopup = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Error fetching user for popup close:', userError);
      handleCloseModal('planChange');
      return;
    }

    const { error } = await updateTableRecord('users', user.id, { plan_change_popup: true });

    if (error) {
      console.error('Error updating plan_change_popup:', error);
    }
    handleCloseModal('planChange');
  };

  const handleCloseSwiperIntroPopup = async (dontRemindAgain) => {
    if (dontRemindAgain) {
      const { error } = await updateUserSwiperPopupStatus(true);
      if (error) {
        console.error('Error updating swiper popup status:', error);
      }
    }
    handleCloseModal('swiperIntro');
  };

  const handleCloseTutorialPopup = async (dontRemindAgain) => {
    if (dontRemindAgain) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('Error fetching user for tutorial popup close:', userError);
        handleCloseModal('tutorial');
        return;
      }
      const { error } = await updateTableRecord('users', user.id, { hide_tutorial_modal: true });
      if (error) {
        console.error('Error updating hide_tutorial_modal:', error);
      }
    }
    handleCloseModal('tutorial');
  };

  const isMobileOrTablet = React.useMemo(() => screenWidth < 1024, [screenWidth]); // Memoize isMobileOrTablet

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (isMobileOrTablet) {
        if (currentPage === 'passwords') setCurrentPage('phonehelper');
        else if (currentPage === 'phonehelper') setCurrentPage('settings');
      }
    },
    onSwipedRight: () => {
      if (isMobileOrTablet) {
        if (currentPage === 'settings') setCurrentPage('phonehelper');
        else if (currentPage === 'phonehelper') setCurrentPage('passwords');
      }
    },
    preventScrollOnSwipe: true,
    trackMouse: true,
  });


  if (isLoadingData || !hasMetMinimumLoadingTime) {
    return <DashboardLoadingScreen isLoading={true} />;
  }

  return (
    <div {...handlers} className="dashboard-layout">
      {!isMobileOrTablet && (
        <NavPanel isExpanded={isNavExpanded} setIsExpanded={setIsNavExpanded} />
      )}
      <div className={`dashboard-main-content ${!isMobileOrTablet ? '' : 'w-full'}`}>
        {/* MainPanel removed. Content now directly within dashboard-main-content */}
        <div className="dashboard-view-content">
          {isMobileOrTablet ? (
            <>
              {currentPage === 'passwords' && <PasswordsPage />}
              {currentPage === 'phonehelper' && <PhoneHelperPage />}
              {currentPage === 'settings' && <SettingsPage onShowTutorial={() => setShowTutorialModal(true)} />}
            </>
          ) : (
            <Outlet context={{ setShowTutorialModal }} />
          )}
        </div>
      </div>
      <PlanChangePopupModal 
        isOpen={currentModal === 'planChange'} 
        onClose={handleClosePlanChangePopup} 
        plan={userPlan} 
      />
      <SwiperIntroModal
        isOpen={currentModal === 'swiperIntro'}
        onClose={() => handleCloseModal('swiperIntro')}
        onConfirm={handleCloseSwiperIntroPopup}
      />
      <TutorialModal
        isOpen={currentModal === 'tutorial'}
        onClose={() => handleCloseModal('tutorial')}
        onConfirm={handleCloseTutorialPopup}
      />
    </div>
  );
};
