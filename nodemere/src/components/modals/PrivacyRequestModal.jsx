import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faTimes } from '@fortawesome/free-solid-svg-icons';
import { api } from '../../sonar/lib/api';
import '../../styles/PasswordsPage.css';

const PrivacyRequestModal = ({ isOpen, onClose, onFeedback }) => {
  const [requestType, setRequestType] = React.useState('access');
  const [details, setDetails] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) return;
    setRequestType('access');
    setDetails('');
    setError('');
  }, [isOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.createPrivacyRequest({ request_type: requestType, details });
      onFeedback?.('Privacy request submitted. Support will follow up using your account email.', 'success');
      onClose();
    } catch (requestError) {
      setError(requestError.message || 'Could not submit privacy request.');
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
              <h2><FontAwesomeIcon icon={faFileAlt} className="mr-2 text-zinc-400" />Privacy & data</h2>
              <button type="button" onClick={onClose} className="close-btn" aria-label="Close privacy settings"><FontAwesomeIcon icon={faTimes} /></button>
            </header>
            <form className="modal-form" onSubmit={handleSubmit}>
              <p className="mb-5 text-sm text-gray-400">Submit an access, correction, or deletion request for the data connected to this account.</p>
              <div className="mb-5 grid gap-2">
                {[
                  ['access', 'Request a data copy'],
                  ['correction', 'Request a correction'],
                  ['deletion', 'Request deletion'],
                ].map(([value, label]) => (
                  <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-sm text-zinc-200">
                    <input type="radio" name="privacy-request-type" value={value} checked={requestType === value} onChange={() => setRequestType(value)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <label className="mb-2 block text-sm text-gray-300" htmlFor="privacy-details">Details</label>
              <textarea id="privacy-details" className="modal-input min-h-[96px] resize-y" value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Tell us what you need." maxLength={2000} />
              {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
              <button type="submit" disabled={loading} className="submit-btn mt-6 disabled:cursor-wait disabled:opacity-60">{loading ? 'Submitting...' : 'Submit request'}</button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PrivacyRequestModal;
