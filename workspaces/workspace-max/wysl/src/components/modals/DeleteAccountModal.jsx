import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

const DeleteAccountModal = ({ isOpen, onClose, onConfirmDelete, subscriptionStatus, onManageSubscription }) => {
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
            className="modal-content"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
          >
            <header className="modal-header">
              <h2>Delete Account</h2>
              <button onClick={onClose} className="close-btn">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </header>
            <div className="modal-body text-center p-4">
              {subscriptionStatus === 'active' ? (
                <>
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-500 text-4xl mb-4" />
                  <p className="text-white mb-4">
                    You have an active subscription. Please cancel your subscription first before deleting your account.
                  </p>
                  <button
                    onClick={onManageSubscription}
                    className="btn-primary bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Manage Subscription
                  </button>
                </>
              ) : (
                <>
                  <p className="text-white mb-4">
                    Are you sure you want to delete your account? This action cannot be undone.
                  </p>
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={onConfirmDelete}
                      className="btn-danger bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                    >
                      Yes, Delete My Account
                    </button>
                    <button
                      onClick={onClose}
                      className="btn-secondary bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DeleteAccountModal;
