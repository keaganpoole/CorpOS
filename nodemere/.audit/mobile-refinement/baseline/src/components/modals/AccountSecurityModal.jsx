import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faTimes } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../../supabaseClient';
import '../../styles/PasswordsPage.css';

const AccountSecurityModal = ({ isOpen, onClose, session, onFeedback }) => {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) return;
    setCurrentPassword('');
    setNewEmail('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  }, [isOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const emailChanged = newEmail.trim() && newEmail.trim().toLowerCase() !== String(session?.user?.email || '').toLowerCase();
    const passwordChanged = Boolean(newPassword);
    if (!emailChanged && !passwordChanged) {
      setError('Enter a new email or password to continue.');
      return;
    }
    if (!currentPassword) {
      setError('Enter your current password to confirm this change.');
      return;
    }
    if (passwordChanged && newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: session?.user?.email,
        password: currentPassword,
      });
      if (reauthError) throw reauthError;

      const updates = {};
      if (emailChanged) updates.email = newEmail.trim();
      if (passwordChanged) updates.password = newPassword;
      const { error: updateError } = await supabase.auth.updateUser(updates);
      if (updateError) throw updateError;

      onFeedback?.(emailChanged ? 'Security updated. Check your inbox to confirm the new email.' : 'Password updated successfully.', 'success');
      onClose();
    } catch (updateError) {
      setError(updateError.message || 'Could not update account security.');
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
              <h2><FontAwesomeIcon icon={faKey} className="mr-2 text-zinc-400" />Security</h2>
              <button type="button" onClick={onClose} className="close-btn" aria-label="Close security settings"><FontAwesomeIcon icon={faTimes} /></button>
            </header>
            <form className="modal-form" onSubmit={handleSubmit}>
              <p className="mb-5 text-sm text-gray-400">Confirm your current password before changing account access.</p>
              <label className="mb-2 block text-sm text-gray-300" htmlFor="current-password">Current password</label>
              <input id="current-password" className="modal-input mb-4" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              <label className="mb-2 block text-sm text-gray-300" htmlFor="security-email">New email</label>
              <input id="security-email" className="modal-input mb-4" type="email" autoComplete="email" placeholder={session?.user?.email || ''} value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
              <label className="mb-2 block text-sm text-gray-300" htmlFor="new-password">New password</label>
              <input id="new-password" className="modal-input mb-4" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              <label className="mb-2 block text-sm text-gray-300" htmlFor="confirm-new-password">Confirm new password</label>
              <input id="confirm-new-password" className="modal-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
              <button type="submit" disabled={loading} className="submit-btn mt-6 disabled:cursor-wait disabled:opacity-60">{loading ? 'Updating...' : 'Update security'}</button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AccountSecurityModal;
