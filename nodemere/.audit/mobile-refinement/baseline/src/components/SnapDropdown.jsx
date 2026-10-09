import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

const SNAP_OPTIONS = [5, 15, 30, 60];

const SnapDropdown = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        aria-expanded={open}
        className="flex min-h-[34px] w-[104px] items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-left text-[11px] font-semibold tracking-[-0.02em] text-white transition-colors hover:bg-white/[0.04]"
      >
        <span className="truncate">{value} min</span>
        <ChevronDown size={12} className={`shrink-0 text-zinc-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-2 shadow-[0_14px_36px_rgba(0,0,0,0.66)]"
          >
            {SNAP_OPTIONS.map((option) => {
              const active = value === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => { onChange(option); setOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[11px] font-semibold tracking-[-0.02em] transition-colors hover:bg-white/[0.04] ${active ? 'text-white' : 'text-zinc-500'}`}
                >
                  <span className="w-4">{active ? <Check size={12} className="text-white" /> : null}</span>
                  <span className="min-w-0 flex-1 truncate">{option} min</span>
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default SnapDropdown;
