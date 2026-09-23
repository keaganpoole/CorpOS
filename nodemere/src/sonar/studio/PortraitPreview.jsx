import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CHARACTERISTICS } from './voiceDefinition';

const loaded = new Set();
const failed = new Set();
const EASE = [.22, 1, .36, 1];

function asPortrait(asset, values = {}) {
  if (!asset) return null;
  if (typeof asset === 'string') return { src: asset };
  if (asset.src) return asset;
  const gender = values.gender === 'Masculine' ? 'Masculine' : values.gender === 'Feminine' ? 'Feminine' : null;
  return asset[gender] || asset.Feminine || asset.Masculine || null;
}

function portraitFor(stageAssets, option, values) {
  return asPortrait(stageAssets?.[option], values);
}

function selectedPortrait(stage, values, assets) {
  const current = CHARACTERISTICS[Math.min(stage, CHARACTERISTICS.length - 1)];
  const selected = current && portraitFor(assets[current.key], values[current.key], values);
  if (selected) return selected;

  for (let index = Math.min(stage, CHARACTERISTICS.length - 1); index >= 0; index -= 1) {
    const characteristic = CHARACTERISTICS[index];
    const value = values[characteristic.key];
    if (Array.isArray(value)) {
      for (const option of value) {
        const portrait = portraitFor(assets[characteristic.key], option, values);
        if (portrait) return portrait;
      }
    } else {
      const portrait = portraitFor(assets[characteristic.key], value, values);
      if (portrait) return portrait;
    }
  }
  return null;
}

export default function PortraitPreview({ stage, values = {}, previewOption, assets = {}, reducedMotion, subdued = false }) {
  const characteristic = CHARACTERISTICS[Math.min(stage, CHARACTERISTICS.length - 1)];
  const stageAssets = assets[characteristic?.key] || {};
  const requested = previewOption?.key === characteristic?.key
    ? portraitFor(stageAssets, previewOption.option, values)
    : selectedPortrait(stage, values, assets);
  const [visible, setVisible] = useState(() => requested && loaded.has(requested.src) ? requested : null);
  const sources = useMemo(() => Object.values(stageAssets).map(asset => asPortrait(asset, values)).filter(Boolean), [stageAssets, values.gender]);

  useEffect(() => {
    sources.forEach(asset => {
      if (!asset.src || loaded.has(asset.src) || failed.has(asset.src)) return;
      const image = new Image();
      image.decoding = 'async';
      image.src = asset.src;
      image.decode?.().then(() => loaded.add(asset.src)).catch(() => {
        if (image.complete && image.naturalWidth) loaded.add(asset.src);
        else failed.add(asset.src);
      });
    });
  }, [sources]);

  useEffect(() => {
    if (!requested?.src || failed.has(requested.src)) {
      if (!requested) setVisible(null);
      return undefined;
    }
    if (loaded.has(requested.src)) {
      setVisible(requested);
      return undefined;
    }
    let cancelled = false;
    const image = new Image();
    image.decoding = 'async';
    image.src = requested.src;
    const reveal = () => {
      if (cancelled) return;
      loaded.add(requested.src);
      setVisible(requested);
    };
    image.decode?.().then(reveal).catch(() => {
      if (image.complete && image.naturalWidth) reveal();
      else failed.add(requested.src);
    });
    return () => { cancelled = true; };
  }, [requested?.src, requested?.position, requested?.scale]);

  if (!visible) return null;
  const style = {
    '--portrait-position': visible.position || '56% 50%',
    '--portrait-scale': visible.scale || 1,
  };
  return <div className={`ns-portrait-preview ${subdued ? 'is-subdued' : ''}`} style={style}>
    <AnimatePresence initial={false} mode="sync">
      <motion.img
        key={visible.src}
        src={visible.src}
        alt=""
        initial={{ opacity: 0, scale: reducedMotion ? Number(visible.scale || 1) : Number(visible.scale || 1) * 1.018, x: reducedMotion ? 0 : 7, filter: reducedMotion ? 'blur(0px)' : 'blur(5px)' }}
        animate={{ opacity: 1, scale: Number(visible.scale || 1), x: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: Number(visible.scale || 1) * (reducedMotion ? 1 : .992), x: reducedMotion ? 0 : -4, filter: reducedMotion ? 'blur(0px)' : 'blur(3px)' }}
        transition={{ duration: reducedMotion ? .16 : .42, ease: EASE }}
      />
    </AnimatePresence>
    <div className="ns-portrait-tone" />
  </div>;
}
