import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const faqs = [
  {
    question: 'What is Nodemere?',
    answer: 'Nodemere provides AI receptionist and workflow software for U.S. businesses. Your team controls the business information, contacts, integrations, and workflows used by your account.',
  },
  {
    question: 'How do I manage account access?',
    answer: 'Use the account controls in your workspace to manage access and contact support@nodemere.ai if you need help with your account.',
  },
  {
    question: 'How does Nodemere handle data?',
    answer: 'Nodemere uses administrative, technical, and organizational safeguards designed to protect account and service data. See the Privacy Policy for details and contact support@nodemere.ai for a privacy request.',
  },
  {
    question: 'Are calls recorded or transcribed?',
    answer: 'A business may enable recording and transcription. The business is responsible for providing any required notice and obtaining any required consent before using those features.',
  },
  {
    question: 'Can Nodemere make outbound calls or texts?',
    answer: 'Operational calls require documented lawful permission. Telemarketing, marketing, political, fundraising, debt-collection, and SMS use are not authorized at launch.',
  },
  {
    question: 'How do I contact support?',
    answer: 'Email support@nodemere.ai.',
  },
];

const FAQModal = ({ isOpen, onClose }) => (
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
            <button onClick={onClose} className="close-btn" aria-label="Close frequently asked questions">
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </header>
          <div className="faq-content space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question} className="faq-item">
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

export default FAQModal;
