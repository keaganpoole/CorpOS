import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../sonar/lib/api';


import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faIdCard, faEnvelope, faSignOutAlt, faCreditCard, faKey, faQuestionCircle, faPlayCircle, faMobileAlt } from '@fortawesome/free-solid-svg-icons';
import '../../styles/PasswordsPage.css';
import UpdateBillingInfoModal from '../modals/UpdateBillingInfoModal';
import ChangeMasterPinModal from '../modals/ChangeMasterPinModal'; // Import the new modal
import FAQModal from '../modals/FAQModal'; // Import FAQModal
import DeleteAccountModal from '../modals/DeleteAccountModal'; // Import DeleteAccountModal
import ContactUsModal from '../modals/ContactUsModal'; // Import the new ContactUsModal
import TutorialModal from '../modals/TutorialModal'; // Import TutorialModal
import DeviceInfoModal from '../modals/DeviceInfoModal'; // Import DeviceInfoModal
import AccountSecurityModal from '../modals/AccountSecurityModal';
import PrivacyRequestModal from '../modals/PrivacyRequestModal';

const AccountSettings = ({ onChangeMasterPassword, isMasterPasswordModalOpen, onShowTutorial }) => {
  const { session, profile, updateProfile } = useAuth();
  const [user, setUser] = useState(null);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isChangePinModalOpen, setIsChangePinModalOpen] = useState(false); // New state for change PIN modal
  const [isFAQModalOpen, setIsFAQModalOpen] = useState(false); // State for FAQ modal
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false); // State for delete account modal
  const [isContactUsModalOpen, setIsContactUsModalOpen] = useState(false); // State for ContactUsModal
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false); // State for TutorialModal
  const [isDeviceInfoModalOpen, setIsDeviceInfoModalOpen] = useState(false); // New state for DeviceInfoModal
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      if (session) {
        setUser(profile);
      }
    };
    fetchUserData();
  }, [session, profile]);

  const handleContactUs = () => {
    setIsContactUsModalOpen(true);
  };

  const handleShowTutorial = () => {
    if (onShowTutorial) {
      onShowTutorial();
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("AccountSettings.jsx:event_58");
      showFeedback('Error logging out.', 'error');
    } else {
      navigate('/auth');
    }
  };

  const showFeedback = (message, type) => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 3000);
  };

  const handleSubscriptionCancel = async () => {
    try {
      const result = await api.createBillingPortal();
      if (!result?.url) throw new Error('Stripe Billing Portal is unavailable.');
      window.location.assign(result.url);
    } catch (error) {
      showFeedback('Could not open Stripe Billing Portal.', 'error');
      console.error("AccountSettings.jsx:event_77");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.closeAccount();
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error) {
      console.error("AccountSettings.jsx:event_87");
      if (error.status === 409) {
        setIsDeleteAccountModalOpen(false);
        setIsBillingModalOpen(true);
        showFeedback('Cancel your subscription in Stripe Billing Portal before closing your account.', 'error');
      } else {
        showFeedback(error.message || 'Error closing account.', 'error');
      }
    }
  };

  const handleUpdateBillingInfo = async (billingInfo) => {
    // Placeholder for Stripe API call to update billing info
    console.debug("AccountSettings.jsx:event_100");
    showFeedback('Billing information updated successfully!', 'success');
    setIsBillingModalOpen(false);
  };

  const handleUpdateDeviceDetails = async (deviceInfo) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ device: deviceInfo })
        .eq('id', session.user.id);

      if (error) throw error;

      updateProfile({ device: deviceInfo }); // Update local profile context
      setIsDeviceInfoModalOpen(false);
    } catch (error) {
      console.error("AccountSettings.jsx:event_117");
      showFeedback('Error updating device details.', 'error');
    }
  };

  return (
    <>
      {!isMasterPasswordModalOpen && (
        <div className="account-settings-container">
          <div className="settings-card">
            <h2>Account Settings</h2>
            {feedback.message && <div className={`feedback ${feedback.type}`}>{feedback.message}</div>}
            <ul className="settings-options">

              <li className="settings-option">
                <button className="settings-btn" onClick={() => window.open('https://www.youtube.com/watch?v=U8emXhW4YF4', '_blank')}>
                  <FontAwesomeIcon icon={faPlayCircle} />
                  Tutorial
                </button>
              </li>

              <li className="settings-option">
                <button className="settings-btn" onClick={() => setIsDeviceInfoModalOpen(true)}>
                  <FontAwesomeIcon icon={faMobileAlt} />
                  Update Device Details
                </button>
              </li>

              <li className="settings-option">
                <button className="settings-btn" onClick={() => setIsBillingModalOpen(true)}>
                  <FontAwesomeIcon icon={faCreditCard} />
                  Update billing info
                </button>
              </li>

              <li className="settings-option">
                <button className="settings-btn" onClick={() => setIsSecurityModalOpen(true)}>
                  <FontAwesomeIcon icon={faKey} />
                  Email & password security
                </button>
              </li>

              <li className="settings-option">
                <button className="settings-btn" onClick={() => setIsPrivacyModalOpen(true)}>
                  <FontAwesomeIcon icon={faIdCard} />
                  Privacy & data requests
                </button>
              </li>

              <li className="settings-option">
                <button className="settings-btn" onClick={() => setIsFAQModalOpen(true)}>
                  <FontAwesomeIcon icon={faQuestionCircle} />
                  FAQs
                </button>
              </li>
              <li className="settings-option">
                <button className="settings-btn" onClick={handleContactUs}>
                  <FontAwesomeIcon icon={faEnvelope} />
                  Contact us
                </button>
              </li>
            </ul>
            <div className="manage-subscription-container flex flex-col items-center">
              <button className="manage-subscription-btn mt-4" onClick={handleLogout}> {/* Added mt-4 */}
                Log Out
              </button>
              <button className="manage-subscription-btn mt-4" onClick={() => setIsDeleteAccountModalOpen(true)}>
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      <UpdateBillingInfoModal
        isOpen={isBillingModalOpen}
        onClose={() => setIsBillingModalOpen(false)}
        onSave={handleUpdateBillingInfo}
      />

      <ChangeMasterPinModal
        isOpen={isChangePinModalOpen}
        onClose={() => setIsChangePinModalOpen(false)}
        onChangeMasterPassword={onChangeMasterPassword}
      />

      <FAQModal
        isOpen={isFAQModalOpen}
        onClose={() => setIsFAQModalOpen(false)}
      />

      <DeleteAccountModal
        isOpen={isDeleteAccountModalOpen}
        onClose={() => setIsDeleteAccountModalOpen(false)}
        onConfirmDelete={handleDeleteAccount}
        subscriptionStatus={profile?.subscription_status}
        onManageSubscription={() => {
          setIsDeleteAccountModalOpen(false);
          setIsBillingModalOpen(true);
        }}
      />

      <ContactUsModal
        isOpen={isContactUsModalOpen}
        onClose={() => setIsContactUsModalOpen(false)}
        showNotification={showFeedback}
      />

      {isDeviceInfoModalOpen && (
        <DeviceInfoModal
          isOpen={isDeviceInfoModalOpen}
          onClose={() => setIsDeviceInfoModalOpen(false)}
          user={profile}
          onUpdate={handleUpdateDeviceDetails}
          isUpdateMode={true}
          initialDeviceData={profile?.device}
        />
      )}

      <AccountSecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        session={session}
        onFeedback={showFeedback}
      />

      <PrivacyRequestModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        onFeedback={showFeedback}
      />
    </>
  );
};

export default AccountSettings;
