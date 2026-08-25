import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import ModalSpectrumLine from '../ModalSpectrumLine';

const PlanChangePopupModal = ({ isOpen, onClose, plan }) => {
  if (typeof document === 'undefined') return null;

  const normalizedPlan = String(plan || 'Free').trim() || 'Free';
  const formattedPlan = normalizedPlan
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ') || 'Free';
  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={onClose}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="relative max-h-[calc(100vh-48px)] w-full max-w-[760px] overflow-y-auto overflow-x-hidden rounded-[30px] border border-white/[0.08] bg-[#070707] shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <ModalSpectrumLine variant="gasp" />
              <div className="pointer-events-none absolute right-[-140px] top-[-180px] h-72 w-72 rounded-full bg-white/[0.035] blur-[72px]" />

              <div className="p-7 sm:p-8">
                <div className="relative flex items-start justify-center text-center">
                  <div className="relative w-full text-center">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">Welcome</p>
                    <h2 className="text-xl font-semibold tracking-[-0.04em] text-white sm:text-2xl">Welcome to Nodemere</h2>
                    <p className="mx-auto mt-3 max-w-[520px] text-center text-sm leading-6 text-zinc-500">
                      Your workspace is ready. You’re getting started on the {formattedPlan} plan, with a front desk built to help your business run with more clarity, consistency, and momentum.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center text-zinc-600 transition hover:text-white"
                    aria-label="Close Welcome to Nodemere"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="relative mt-8 text-center">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">A quick look inside Nodemere</p>
                  <div className="aspect-video overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
                    <iframe
                      className="h-full w-full"
                      src="https://www.youtube.com/embed/U8emXhW4YF4"
                      title="Nodemere tutorial"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>

                <div className="relative mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-11 rounded-full bg-white px-6 text-sm font-bold text-black transition hover:bg-zinc-200"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};

export default PlanChangePopupModal;
