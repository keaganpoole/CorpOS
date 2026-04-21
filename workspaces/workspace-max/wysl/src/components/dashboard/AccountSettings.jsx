import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';


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
      console.error('Error logging out:', error.message);
      showFeedback('Error logging out.', 'error');
    } else {
      navigate('/auth');
    }
  };

  const showFeedback = (message, type) => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 3000);
  };

  const handleSubscriptionCancel = async (reason) => {
    const { data, error } = await supabase
      .from('users')
      .update({
        plan: 'free',
        subscription_status: 'canceled',
        trial_end_date: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', session.user.id)
      .select()
      .single();

    if (error) {
      showFeedback('Error cancelling subscription.', 'error');
      console.error('Error cancelling subscription:', error);
    } else {
      showFeedback('Subscription canceled successfully.', 'success');
      updateProfile({ 
        plan: data.plan, 
        subscription_status: data.subscription_status,
        trial_end_date: data.trial_end_date
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!session || !session.user) {
      showFeedback('You must be logged in to delete your account.', 'error');
      return;
    }

    // Fetch the latest user profile to check subscription status
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_status')
      .eq('id', session.user.id)
      .single();

    if (userError) {
      console.error('Error fetching user subscription status:', userError.message);
      showFeedback('Error checking subscription status.', 'error');
      return;
    }

    if (userData.subscription_status === 'active') {
      setIsDeleteAccountModalOpen(true); // Open modal to inform user about active subscription
      return;
    }

    // Proceed with deletion if no active subscription
    try {
      // Delete user's password accounts
      const { error: passwordsError } = await supabase
        .from('passwords')
        .delete()
        .eq('user', session.user.id);

      if (passwordsError) throw passwordsError;

      // Delete user's messages
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('user', session.user.id);

      if (messagesError) throw messagesError;

      // Delete user's threads
      const { error: threadsError } = await supabase
        .from('threads')
        .delete()
        .eq('user', session.user.id);

      if (threadsError) throw threadsError;

      // Update user's plan to 'free' and set account_deletion_date
      const { error: updateError } = await supabase
        .from('users')
        .update({ plan: 'free', account_deletion_date: new Date().toISOString() })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      showFeedback('Account deleted successfully.', 'success');
      // Optionally log out the user or redirect to a confirmation page
      handleLogout();
    } catch (error) {
      console.error('Error deleting account:', error.message);
      showFeedback('Error deleting account.', 'error');
    }
  };

  const handleUpdateBillingInfo = async (billingInfo) => {
    // Placeholder for Stripe API call to update billing info
    console.log('Updating billing info:', billingInfo);
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
      console.error('Error updating device details:', error.message);
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
    </>
  );
};

export default AccountSettings;
