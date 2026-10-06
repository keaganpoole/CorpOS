import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../sonar/lib/api';
import ModalSpectrumLine from '../ModalSpectrumLine';

const PlanLimitModal = ({ detail, onClose }) => {
  const navigate = useNavigate();
  const [openingPortal, setOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState('');
  const isSubscriptionIssue = ['subscription_inactive', 'billing_customer_invalid', 'overage_limit_reached', 'billing_context_missing'].includes(detail?.code);
  const title = detail?.code === 'minute_limit_reached'
    ? 'Call minutes used'
    : detail?.code === 'overage_limit_reached'
      ? 'Billing limit reached'
    : detail?.code === 'billing_context_missing'
      ? 'Billing verification required'
    : detail?.code === 'feature_not_in_plan'
      ? 'Plan feature unavailable'
      : detail?.code === 'subscription_inactive'
        ? 'Subscription needs attention'
        : detail?.resource === 'receptionists'
          ? 'Receptionist limit reached'
          : `${String(detail?.resource || 'Plan').replace(/\b\w/g, (letter) => letter.toUpperCase())} limit reached`;
  const description = String(detail?.message || 'Your current plan does not include enough capacity for this action.')
    .replace(/\b1 receptionists\b/gi, '1 receptionist')
    .replace('Upgrade in Stripe Billing Portal to add more.', 'View plans to add more.');

  const handleAction = async () => {
    if (!isSubscriptionIssue) {
      onClose();
      navigate('/pricing');
      return;
    }
    setOpeningPortal(true);
    setPortalError('');
    try {
      const result = await api.createBillingPortal();
      if (result?.url) window.location.assign(result.url);
      else setPortalError('Billing Portal is unavailable right now. Please try again.');
    } catch (error) {
      setPortalError(error?.message || 'Billing Portal is unavailable right now. Please try again.');
    } finally {
      setOpeningPortal(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {detail && <motion.div
        className="responsive-dialog fixed inset-0 z-[1400] flex items-center justify-center bg-black/55 p-6 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.section
          className="relative flex max-h-[calc(100vh-48px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/95 text-center text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-limit-title"
          onClick={(event) => event.stopPropagation()}
        >
          <ModalSpectrumLine variant="plan" />
          <div className="relative flex flex-1 flex-col overflow-y-auto p-6 sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1 pl-8">
                <h2 id="plan-limit-title" className="text-[26px] font-semibold tracking-[-0.01em] text-white sm:text-[34px]">{title}</h2>
                <p className="mt-4 text-sm leading-[1.55] text-zinc-300 sm:text-[15px]">{description}</p>
              </div>
              <button type="button" onClick={onClose} className="shrink-0 rounded-full p-2 text-zinc-500 transition hover:bg-white/[0.04] hover:text-white" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            {portalError && <p role="alert" className="mb-4 text-sm text-zinc-300">{portalError}</p>}
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={onClose} className="h-12 rounded-full border border-white/[0.08] px-8 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">Maybe later</button>
              <button type="button" onClick={handleAction} disabled={openingPortal} className="h-12 rounded-full bg-white px-8 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60">
                {openingPortal ? 'Opening...' : isSubscriptionIssue ? 'Open Billing Portal' : 'View Plans'}
              </button>
            </div>
          </div>
        </motion.section>
      </motion.div>}
    </AnimatePresence>,
    document.body,
  );
};

export default PlanLimitModal;
