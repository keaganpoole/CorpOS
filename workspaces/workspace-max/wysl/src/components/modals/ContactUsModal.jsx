import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendHelpdeskMessage } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import colors from '../../../color';

const ContactUsModal = ({ isOpen, onClose, showNotification }) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const { session } = useAuth();

  const inputGroupClasses = "relative group";
  const inputClasses = "relative w-full px-5 py-3 bg-[#1c1c1c] border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-transparent transition-all peer";
  const labelClasses = "absolute left-4 -top-2 text-xs text-gray-400 bg-[#1c1c1c] px-2 rounded-md transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:-top-2 peer-focus:text-xs";
  const textareaClasses = "relative w-full px-5 py-3 bg-[#1c1c1c] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-transparent transition-all peer";
  const textareaLabelClasses = "absolute left-4 -top-2 text-xs text-gray-400 bg-[#1c1c1c] px-2 rounded-md transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:-top-2 peer-focus:text-xs";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError('Subject and message cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await sendHelpdeskMessage({
        user: session?.user?.id || null, // Pass user ID if available
        subject,
        message,
      });
      showNotification('Message sent successfully!');
      onClose();
      setSubject('');
      setMessage('');
    } catch (err) {
      console.error('Failed to send helpdesk message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            {/* Content Layer */}
            <div className="relative z-20 rounded-3xl p-8 space-y-8 flex flex-col backdrop-blur-sm bg-[#141414]">
              <div className="text-center">
                <h2 className="text-2xl font-extrabold text-gray-50">Contact Support</h2>
                <p className="text-sm text-gray-400 mt-2">Have a question or need assistance? Send us a message.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className={inputGroupClasses}>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    placeholder=" "
                    className={inputClasses}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                  <label htmlFor="subject" className={labelClasses}>Subject</label>
                </div>
                <div className={inputGroupClasses}>
                  <textarea
                    id="message"
                    name="message"
                    rows="5"
                    placeholder=" "
                    className={`${textareaClasses} h-auto min-h-[120px] pt-3 pb-3`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isSubmitting}
                    required
                  ></textarea>
                  <label htmlFor="message" className={textareaLabelClasses}>Message</label>
                </div>
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                <div className="flex flex-col space-y-3 pt-4">
                  <button
                    type="submit"
                    className={`w-full py-3 text-sm font-semibold text-[var(--color3)] rounded-full hover:opacity-90 transition-opacity btn-shine disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={{ background: `linear-gradient(to right, ${colors[0].hex}, ${colors[1].hex})` }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 text-sm font-semibold text-gray-400 hover:text-white transition-colors rounded-full"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContactUsModal;
