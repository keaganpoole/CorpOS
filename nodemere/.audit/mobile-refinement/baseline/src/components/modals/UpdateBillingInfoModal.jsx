// src/components/modals/UpdateBillingInfoModal.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { api } from '../../sonar/lib/api';
import '../../styles/PasswordsPage.css'; // Assuming similar styling

const UpdateBillingInfoModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleRedirectToStripe = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.createBillingPortal();
      if (!result?.url) throw new Error('Stripe Billing Portal is unavailable.');
      window.location.assign(result.url);
    } catch (err) {
      setError(err.message || 'Could not open Stripe Billing Portal.');
    } finally {
      setLoading(false);
    }
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
              <p className="text-gray-400 mb-6">Stripe Billing Portal securely manages your payment method, invoices, plan changes, and cancellation.</p>
              {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}
              <button onClick={handleRedirectToStripe} disabled={loading} className="submit-btn disabled:cursor-wait disabled:opacity-60">{loading ? 'Opening...' : 'Open Stripe Billing Portal'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdateBillingInfoModal;
