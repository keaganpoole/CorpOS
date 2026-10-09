import React from 'react';

const BrandColorInput = ({ value, onChange }) => {
  const color = value || '#000000';

  return (
    <div className="flex h-12 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3 transition-colors focus-within:border-white/[0.16]">
      <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/15 shadow-none outline-none transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white/20" style={{ backgroundColor: color }}>
        <input
          type="color"
          value={color}
          onChange={(event) => onChange(event.target.value)}
          className="sr-only"
          aria-label="Choose brand color"
        />
      </label>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-zinc-200">{value ? value.toUpperCase() : 'Not set'}</div>
      </div>
      {value ? (
        <button type="button" onClick={() => onChange('')} className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 transition hover:bg-white/[0.05] hover:text-zinc-300">
          Clear
        </button>
      ) : null}
    </div>
  );
};

export default BrandColorInput;
