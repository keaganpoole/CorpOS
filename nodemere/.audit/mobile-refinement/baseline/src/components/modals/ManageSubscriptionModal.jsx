// src/components/modals/ManageSubscriptionModal.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import '../../styles/PasswordsPage.css';

const CANCELLATION_REASONS = [
  "It's not worth the price.",
  "I can no longer afford it.",
  "I found it difficult to use.",
  "It's not as useful as I hoped.",
  "Other",
];

const ManageSubscriptionModal = ({ isOpen, onClose, onConfirm }) => {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const navigate = useNavigate();

  const handleContinue = () => {
    setStep(2);
  };

  const handleConfirm = () => {
    const finalReason = reason === 'Other' ? otherReason : reason;
    onConfirm(finalReason);
    onClose();
  };
  
  const handleClose = () => {
    setStep(1);
    setReason('');
    setOtherReason('');
    onClose();
  }

  const handleKeepSubscription = () => {
    handleClose();
    navigate('/dashboard');
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="modal-content" initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}>
            <header className="modal-header">
              <h2>{step === 1 ? 'We\'re sad to see you go' : 'Are you sure?'}</h2>
              <button onClick={handleClose} className="close-btn"><FontAwesomeIcon icon={faTimes} /></button>
            </header>
            
            {step === 1 && (
              <div className="modal-form">
                <p className="cancellation-prompt">Please tell us why you're cancelling. (Optional)</p>
                <div className="reason-options">
                  {CANCELLATION_REASONS.map((r) => (
                    <label key={r} className="reason-label">
                      <input
                        type="radio"
                        name="cancellation-reason"
                        value={r}
                        checked={reason === r}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      <span className="custom-radio"></span>
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
                {reason === 'Other' && (
                  <textarea
                    placeholder="Please tell us more..."
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    className="reason-textarea"
                  />
                )}
                <button onClick={handleContinue} className="submit-btn">Continue</button>
              </div>
            )}

            {step === 2 && (
              <div className="confirmation-modal-body">
                <p>Cancelling your subscription will downgrade you to the Free plan at the end of your current billing cycle. Are you sure you want to proceed?</p>
                <div className="confirmation-modal-actions stacked">
                  <button onClick={handleConfirm} className="confirm-btn">Yes, cancel my subscription</button>
                  <button onClick={handleKeepSubscription} className="cancel-btn">I've changed my mind</button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ManageSubscriptionModal;
