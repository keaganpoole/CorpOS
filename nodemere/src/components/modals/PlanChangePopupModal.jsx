// src/components/modals/PlanChangePopupModal.jsx
import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const PlanChangePopupModal = ({ isOpen, onClose, plan }) => {
  if (typeof document === 'undefined') return null;

  const normalizedPlan = String(plan || 'Free').trim() || 'Free';
  const formattedPlan = normalizedPlan
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ') || 'Free';
  const planSummaries = {
    free: 'You can start testing Nodemere with light usage and a simple setup.',
    essentials: 'You now have more room to run your receptionist and support day-to-day call handling.',
    pro: 'Your account is set up for higher-volume operations and more flexible automation.',
    ultra: 'Your account is set up for larger-scale receptionist operations and advanced capacity.',
  };
  const summary = planSummaries[normalizedPlan.toLowerCase()] || 'Your account has been updated and your new plan is ready.';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/55 p-6 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.section
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-h-[calc(100vh-48px)] w-full max-w-[520px] overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/95 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="relative flex flex-1 flex-col p-6 sm:p-8">
              <div className="relative mb-6 flex items-start gap-5 justify-between">
                <div className="min-w-0 flex-1 pl-8 text-center">
                  <h2 className="text-[26px] font-semibold tracking-[-0.01em] text-white sm:text-[34px]">
                    Welcome to {formattedPlan}
                  </h2>
                  <p className="mt-4 w-full max-w-none text-sm leading-[1.55] text-zinc-300 sm:text-[15px]">
                    {summary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-full p-2 text-zinc-500 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-12 rounded-full bg-white px-10 text-sm font-bold text-black transition hover:bg-zinc-200"
                >
                  Got it
                </button>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default PlanChangePopupModal;
