import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/CommissionLogicModal.css';

const CommissionLogicModal = ({ isOpen, onClose, commissionData, tiers }) => {
  const isLoading = commissionData === null;
  const hasData = commissionData && commissionData.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="commission-modal-overlay" 
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="commission-modal-content" 
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <button className="commission-modal-close-button" onClick={onClose}>
              &times;
            </button>
            <h2 className="commission-modal-title">🪙 Points Structure</h2>

            {isLoading && <div className="commission-modal-status">⏳ Loading commission rules...</div>}

            {!isLoading && !hasData && (
              <div className="commission-modal-status">⚠️ No commission rules found.</div>
            )}
 
            {!isLoading && hasData && (
              <div className="commission-table-container">
                <table className="commission-table">
                  <thead>
                    <tr>
                      <th> Plan</th>
                      {tiers.map((tier) => (
                        <th key={tier}>
                          {tier.toLowerCase().includes('tier') ? tier : `Tier ${tier}`}
                          <div className="header-sub"><span className="header-emoji-accent">🆕</span> / <span className="header-emoji-accent">🔄</span></div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {commissionData.map((row, index) => (
                      <motion.tr 
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <td className="plan-cell">
                          <span className="plan-name">{row.plan}</span>
                        </td>
                        {tiers.map(tier => (
                          <td key={tier} className="points-cell">
                            <div className="points-pair">
                              <span className="points-val">{row[tier]?.new ?? 0}</span>
                              <span className="points-divider">/</span>
                              <span className="points-val">{row[tier]?.rebill ?? 0}</span>
                            </div>
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommissionLogicModal;