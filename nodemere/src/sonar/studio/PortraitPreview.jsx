import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CHARACTERISTICS } from './voiceDefinition';

const loaded = new Set();
const failed = new Set();
const EASE = [.16, 1, .3, 1];
const CROSSFADE_MS = 1150;

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
  const [previousVisible, setPreviousVisible] = useState(null);
  const previousTimer = React.useRef(null);
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

  useEffect(() => () => {
    if (previousTimer.current) window.clearTimeout(previousTimer.current);
  }, []);

  const revealPortrait = React.useCallback((next) => {
    setVisible(current => {
      if (current?.src && current.src !== next.src) {
        setPreviousVisible(current);
        if (previousTimer.current) window.clearTimeout(previousTimer.current);
        previousTimer.current = window.setTimeout(() => {
          setPreviousVisible(null);
          previousTimer.current = null;
        }, CROSSFADE_MS);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!requested?.src || failed.has(requested.src)) {
      if (!requested) setVisible(null);
      return undefined;
    }
    if (loaded.has(requested.src)) {
      revealPortrait(requested);
      return undefined;
    }
    let cancelled = false;
    const image = new Image();
    image.decoding = 'async';
    image.src = requested.src;
    const reveal = () => {
      if (cancelled) return;
      loaded.add(requested.src);
      revealPortrait(requested);
    };
    image.decode?.().then(reveal).catch(() => {
      if (image.complete && image.naturalWidth) reveal();
      else failed.add(requested.src);
    });
    return () => { cancelled = true; };
  }, [requested?.src, requested?.position, requested?.scale, requested?.origin, revealPortrait]);

  if (!visible) return null;
  const currentScale = Number(visible.scale || 1);
  const previousScale = Number(previousVisible?.scale || 1);
  return <div className={`ns-portrait-preview ${subdued ? 'is-subdued' : ''}`}>
    <motion.span
      className="ns-portrait-image ns-portrait-image--current"
      key={`${visible.src}-${visible.position || ''}-${visible.scale || 1}-${visible.origin || ''}`}
      initial={{ opacity: previousVisible && !reducedMotion ? .12 : 1, filter: previousVisible && !reducedMotion ? 'blur(2.5px)' : 'blur(0px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: reducedMotion ? 0 : CROSSFADE_MS / 1000, ease: EASE }}
    >
      <img src={visible.src} alt="" style={{ objectPosition: visible.position || '56% 50%', transformOrigin: visible.origin || undefined, transform: `scale(${currentScale})` }} />
    </motion.span>
    {previousVisible ? <motion.span
      className="ns-portrait-image ns-portrait-image--previous"
      key={`${previousVisible.src}-${previousVisible.position || ''}-${previousVisible.scale || 1}-${previousVisible.origin || ''}`}
      initial={{ opacity: reducedMotion ? 0 : 1, filter: 'blur(0px)' }}
      animate={{ opacity: 0, filter: reducedMotion ? 'blur(0px)' : 'blur(2px)' }}
      transition={{ duration: reducedMotion ? 0 : CROSSFADE_MS / 1000, ease: EASE }}
      aria-hidden="true"
    >
      <img src={previousVisible.src} alt="" style={{ objectPosition: previousVisible.position || '56% 50%', transformOrigin: previousVisible.origin || undefined, transform: `scale(${previousScale})` }} />
    </motion.span> : null}
    <div className="ns-portrait-tone" />
  </div>;
}
