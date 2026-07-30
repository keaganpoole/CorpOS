import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const faqs = [
  {
    question: "What is Keyquarters and how does it keep my passwords safe?",
    answer: "Keyquarters is your personal digital vault. We use strong encryption to protect your passwords, turning them into unreadable code that only *you* can unlock with your Master Key. Think of it as a highly secure safe that only you have the key to."
  },
  {
    question: "How do I find my master key?",
    answer: "For your security, your Master Key is never stored or transmitted to our servers. If you need to reset it, please contact support for assistance with recovery options."
  },
  {
    question: "Is my data truly secure with Keyquarters?",
    answer: "Yes. Your security is our highest priority. We use AES-256 encryption—the same standard trusted by banks and hospitals to protect your data. Your Master Key never leaves your device, and all communication with our servers is encrypted. Your information stays private and secure."
  },
  {
    question: "Why do I need to set up security questions during onboarding?",
    answer: "Security questions add an extra layer of protection. They help us confirm it’s really you if you ever need to recover access or make important changes to your account."
  },
  {
    question: "Can I access my passwords from multiple devices?",
    answer: "Yes. Keyquarters works across all your devices. Once you sign in with your Master Key on a new device, your encrypted vault will sync automatically. Each device will need your Master Key to unlock your passwords."
  },
  {
    question: "How do I contact support if I have more questions?",
    answer: "You can reach us anytime through the 'Contact us' button in your account settings."
  },
];


const FAQModal = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-backdrop bg-black bg-opacity-50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="modal-content faq-modal-content"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
          >
            <header className="modal-header">
              <h2>Frequently Asked Questions</h2>
              <button onClick={onClose} className="close-btn">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </header>
            <div className="faq-content space-y-6">
              {faqs.map((faq, index) => (
                <div key={index} className="faq-item">
                  <h3 className="text-lg font-semibold text-white mb-2">{faq.question}</h3>
                  <p className="text-gray-300 text-sm">{faq.answer}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FAQModal;