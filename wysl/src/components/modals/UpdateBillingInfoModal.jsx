// src/components/modals/UpdateBillingInfoModal.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import '../../styles/PasswordsPage.css'; // Assuming similar styling

const STRIPE_BILLING_PORTAL_URL = "https://billing.stripe.com/p/login/dRm4gz11YesldM7apW7wA00";

const UpdateBillingInfoModal = ({ isOpen, onClose }) => {

  const handleRedirectToStripe = () => {
    window.location.href = STRIPE_BILLING_PORTAL_URL;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="modal-content" initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}>
            <header className="modal-header">
              <h2>Manage Billing Information</h2>
              <button onClick={onClose} className="close-btn"><FontAwesomeIcon icon={faTimes} /></button>
            </header>
            <div className="modal-form text-center">
              <p className="text-gray-400 mb-6">You will be redirected to the Customer Portal to manage your billing details securely.</p>
              <button onClick={handleRedirectToStripe} className="submit-btn">Go to Customer Portal</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdateBillingInfoModal;
