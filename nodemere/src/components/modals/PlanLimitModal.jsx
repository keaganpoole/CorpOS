import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowUpRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../sonar/lib/api';

const PlanLimitModal = ({ detail, onClose }) => {
  const navigate = useNavigate();
  const [openingPortal, setOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState('');
  if (!detail) return null;

  const isSubscriptionIssue = detail.code === 'subscription_inactive' || detail.code === 'billing_customer_invalid';
  const title = detail.code === 'minute_limit_reached'
    ? 'Call minutes used'
    : detail.code === 'feature_not_in_plan'
      ? 'Plan feature unavailable'
      : detail.code === 'subscription_inactive'
        ? 'Subscription needs attention'
        : `${String(detail.resource || 'Plan').replace(/\b\w/g, (letter) => letter.toUpperCase())} limit reached`;

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

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-5 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative w-full max-w-[470px] rounded-2xl border border-white/[0.1] bg-[#141414] p-8 text-center text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
          initial={{ scale: 0.94, opacity: 0, y: 18 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 18 }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-zinc-500 transition hover:bg-white/[0.05] hover:text-white" aria-label="Close">
            <X size={17} />
          </button>
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <AlertTriangle size={21} />
          </div>
          <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
          <p className="mt-3 text-[14px] leading-6 text-zinc-400">
            {detail.message || 'Your current plan does not include enough capacity for this action.'}
          </p>
          {portalError && <p className="mt-3 text-[12px] text-red-300">{portalError}</p>}
          <div className="mt-7 flex flex-col items-center gap-3">
            <button type="button" onClick={handleAction} disabled={openingPortal} className="flex w-full max-w-[240px] items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--brandGradientStart)] to-[var(--brandGradientEnd)] px-4 py-3 text-[13px] font-semibold text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">
              {openingPortal ? 'Opening...' : isSubscriptionIssue ? 'Open Billing Portal' : 'View Plans'}
              {!openingPortal && <ArrowUpRight size={15} />}
            </button>
            <button type="button" onClick={onClose} className="text-[12px] text-zinc-500 transition hover:text-white">Maybe later</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PlanLimitModal;
