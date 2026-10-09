import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  X, Play, Pause, Sparkles,
  User, ChevronLeft, ChevronRight, Loader2,
  CalendarDays, Volume2,
} from 'lucide-react';
import { api } from '../lib/api';
import CubePreloader from '../components/CubePreloader';
import MbtiPersonalityModal, { getMbtiProfileSummary } from '../components/MbtiPersonalityModal';
import ReceptionistGallery from '../studio/ReceptionistGallery';
import ReceptionistActionConfirmation from '../components/ReceptionistActionConfirmation';
import IntercomVoiceLine from '../nest/IntercomVoiceLine';
import { avatarVideoUrl } from '../studio/catalogGeometry';
import { CHARACTERISTICS, SUB_ACCENTS } from '../studio/voiceDefinition';

const accentLabels = new Set([...CHARACTERISTICS.find(item => item.key === 'accent').options, ...Object.values(SUB_ACCENTS).flat()]);
const isCreatedReceptionist = person => person.source === 'created_receptionist' || person.created_receptionist_id != null;
const catalogAccentTraits = person => isCreatedReceptionist(person) && Array.isArray(person.traits) ? person.traits.filter(trait => accentLabels.has(trait)) : [];
const catalogCoreTraits = person => Array.isArray(person.traits) ? person.traits.filter(trait => !isCreatedReceptionist(person) || !accentLabels.has(trait)) : [];
const catalogMbti = person => {
  let personality = Array.isArray(person.personality) ? person.personality[0] : person.personality;
  if (typeof personality === 'string') {
    try { personality = JSON.parse(personality); } catch { return person.personality_type || person.mbti || person.personality; }
  }
  return personality?.mbti || person.personality_type || person.mbti || '';
};

const HireReceptionistModal = ({
  onClose,
  onHire,
  embedded = false,
  initialCreatedId = null,
  hiredCatalogIds = [],
  hiredVoiceIds = [],
  catalogRows,
  autoPlayOnOpen = false,
  hideVoiceButton = false,
  compactVoicePreview = false,
  allowGalleryWheelZoom = true,
  showGalleryZoomControls = true,
  galleryDefaultZoom,
  randomizeGalleryRoster = false,
  galleryIntroReveal = false,
  onGalleryInteraction,
  interactive = true,
  portalDetail = false,
}) => {
  const [receptionists, setReceptionists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [hiringId, setHiringId] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [hireError, setHireError] = useState('');
  const [personalityPerson, setPersonalityPerson] = useState(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const levelFrameRef = useRef(0);
  const detailRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const reducedMotion = useReducedMotion();
  const carouselTransitionMs = 620;
  const hiredCatalogKey = (hiredCatalogIds || [])
    .filter(Boolean)
    .map((value) => String(value))
    .sort()
    .join('|');
  const hiredVoiceKey = (hiredVoiceIds || [])
    .filter(Boolean)
    .map((value) => String(value))
    .sort()
    .join('|');

  const loadReceptionists = async () => {
    if (catalogRows === null) {
      setLoading(true);
      return;
    }
    setLoading(true);
    setLoadError('');
    setSelectedIndex(null);
    try {
      const catalogData = catalogRows === undefined ? await api.getReceptionistCatalog() : catalogRows;

      const hiredIds = new Set((hiredCatalogIds || []).filter(Boolean).map((value) => String(value)));
      const hiredVoices = new Set((hiredVoiceIds || []).filter(Boolean).map((value) => String(value)));

      const availableReceptionists = (catalogData || []).filter(
        (row) => !hiredIds.has(String(row.id)) && !hiredVoices.has(String(row.elevenlabs_voice_id || row.provider_voice_id || ''))
      ).map((row) => ({
        ...row,
        catalog_id: row.source ? (row.catalog_id ?? null) : (row.catalog_id ?? row.id),
      }));

      setReceptionists(availableReceptionists);
      if (initialCreatedId != null) {
        const createdIndex = availableReceptionists.findIndex(row => String(row.created_receptionist_id) === String(initialCreatedId));
        if (createdIndex >= 0) setSelectedIndex(createdIndex);
      }
    } catch (err) {
      console.error("HireReceptionistModal.jsx:event_46");
      setLoadError('The catalog couldn’t load. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceptionists();
  }, [catalogRows, hiredCatalogKey, hiredVoiceKey]);

  useEffect(() => () => { audioRef.current?.pause(); cancelAnimationFrame(levelFrameRef.current); audioContextRef.current?.close(); }, []);

  const closeDetail = () => {
    audioRef.current?.pause();
    cancelAnimationFrame(levelFrameRef.current);
    setPlayingVoice(null);
    setVoiceLevel(0);
    setSelectedIndex(null);
    setDescriptionExpanded(false);
    setHireError('');
  };

  useEffect(() => {
    if (!embedded || selectedIndex === null) return;
    const previousFocus = document.activeElement;
    const panel = detailRef.current;
    panel?.querySelector('button')?.focus();
    return () => { previousFocus?.focus({ preventScroll: true }); };
  }, [embedded, selectedIndex]);

  useEffect(() => {
    if (!embedded || selectedIndex === null) return;
    const panel = detailRef.current;
    const key = event => {
      if (personalityPerson || archiveTarget) return;
      if (event.key === 'Escape' && !hiringId && !archiving) { event.preventDefault(); closeDetail(); }
      if (event.key !== 'Tab') return;
      const buttons = [...panel.querySelectorAll('button:not(:disabled),[href],[tabindex="0"]')];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); };
  }, [embedded, selectedIndex, personalityPerson, hiringId, archiving, archiveTarget]);

  const nextCard = () => {
    if (isAnimating || receptionists.length === 0) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev + 1) % receptionists.length);
    setTimeout(() => setIsAnimating(false), carouselTransitionMs);
  };

  const prevCard = () => {
    if (isAnimating || receptionists.length === 0) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev - 1 + receptionists.length) % receptionists.length);
    setTimeout(() => setIsAnimating(false), carouselTransitionMs);
  };

  // Keyboard navigation
  useEffect(() => {
    if (embedded) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') nextCard();
      if (e.key === 'ArrowLeft') prevCard();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [embedded, isAnimating, receptionists.length]);

  const playVoice = (voiceUrl, receptionistId, { nativePlayback = false } = {}) => {
    cancelAnimationFrame(levelFrameRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingVoice === receptionistId) {
      setPlayingVoice(null);
      setVoiceLevel(0);
      return;
    }

    const audio = new Audio();
    if (!nativePlayback) audio.crossOrigin = 'anonymous';
    audio.src = voiceUrl;
    audioRef.current = audio;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext && !nativePlayback) {
      try {
        audioContextRef.current ||= new AudioContext();
        const context = audioContextRef.current;
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        const source = context.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(context.destination);
        analyserRef.current = analyser;
      } catch { analyserRef.current = null; }
    }
    const stop = () => {
      cancelAnimationFrame(levelFrameRef.current);
      setPlayingVoice(null);
      setVoiceLevel(0);
    };
    audio.onended = stop;
    audio.onerror = stop;
    const start = async () => {
      try {
        const resumePromise = nativePlayback ? undefined : audioContextRef.current?.resume();
        const playPromise = audio.play();
        await Promise.all([resumePromise, playPromise]);
        setPlayingVoice(receptionistId);
        if (nativePlayback) {
          setVoiceLevel(0.08);
          return;
        }
        const samples = new Uint8Array(analyserRef.current?.frequencyBinCount || 0);
        const sample = () => {
          if (audioRef.current !== audio) return;
          if (analyserRef.current) {
            analyserRef.current.getByteTimeDomainData(samples);
            let sum = 0;
            for (const value of samples) { const amplitude = (value - 128) / 128; sum += amplitude * amplitude; }
            setVoiceLevel(Math.sqrt(sum / samples.length));
          }
          levelFrameRef.current = requestAnimationFrame(sample);
        };
        levelFrameRef.current = requestAnimationFrame(sample);
      } catch {
        stop();
      }
    };
    start();
  };

  const openDetail = (index) => {
    const receptionist = receptionists[index];
    // Start directly inside the tile's click gesture so browser autoplay
    // policies allow the preview without showing an extra play control.
    if (embedded && autoPlayOnOpen && receptionist?.voice) {
      playVoice(receptionist.voice, receptionist.id);
    }
    setDescriptionExpanded(false);
    setSelectedIndex(index);
  };

  const handleSelect = async (receptionist) => {
    if (hiringId) return;
    const receptionistId = receptionist.created_receptionist_id ?? receptionist.custom_voice_id ?? receptionist.catalog_id ?? receptionist.id;
    setHiringId(receptionistId);
    setHireError('');
    try {
      await onHire?.(receptionist);
      onClose?.();
    } catch (err) {
      console.error("HireReceptionistModal.jsx:event_113");
      setHireError(err?.message || 'Failed to hire receptionist');
    } finally {
      setHiringId(null);
    }
  };

  const detail = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={embedded ? { duration: reducedMotion ? 0 : .68, ease: [.9, 0, .1, 1] } : undefined}
        className={
        embedded
          ? `ns-gallery-detail${portalDetail ? ' ns-gallery-detail-portal' : ''}`
          : 'fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md'
      }
      onClick={embedded ? () => { if (!hiringId && !archiving) closeDetail(); } : onClose}
    >
      {!embedded && <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-zinc-700/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-800/12 blur-[120px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03]"
          style={{ backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      </div>}

      {/* Close button */}
      {!embedded && (
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-[1010] p-2.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <X size={18} />
        </button>
      )}

      <motion.div
        initial={embedded ? { opacity: 0 } : { scale: 0.95, opacity: 0, y: 20 }}
        animate={embedded ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
        exit={embedded ? { opacity: 0 } : { scale: 0.95, opacity: 0, y: 20 }}
        transition={embedded ? { duration: reducedMotion ? 0 : .68, ease: [.77, 0, .175, 1] } : undefined}
        className={embedded ? 'ns-gallery-detail-inner relative z-10 flex flex-col items-center' : 'relative z-10 w-full max-w-[440px] flex flex-col items-center'}
        ref={detailRef}
        role={embedded ? 'dialog' : undefined}
        aria-modal={embedded && !archiveTarget ? true : undefined}
        inert={archiveTarget ? '' : undefined}
        aria-hidden={archiveTarget ? true : undefined}
        aria-label={embedded ? `${receptionists[selectedIndex]?.full_name || 'Receptionist'} details` : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {embedded && <span className="sr-only">Press Escape or click outside to close receptionist details.</span>}
        {/* Header */}
        {!embedded && <div className="text-center mb-10 space-y-2">
          <h1 className="text-xs uppercase tracking-[6px] font-bold text-white/20">RECEPTIONIST CATALOG</h1>
          <p className="text-2xl font-semibold tracking-tight text-white">Hire a Receptionist</p>
        </div>}

        {loading ? (
          <div className="flex items-center justify-center py-20" aria-label="Loading receptionists">
            <CubePreloader size={26} />
          </div>
        ) : receptionists.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <User size={40} className="text-zinc-700" />
            <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-widest">No receptionists available</p>
          </div>
        ) : (
          <>
            {/* Card Carousel — 3D perspective */}
            {embedded ? receptionists.filter((_, index) => index === selectedIndex).map(person => {
              const description = person.description || getMbtiProfileSummary(person.personality?.mbti || person.personality_type, person.first_name || person.full_name);
              const expandableDescription = isCreatedReceptionist(person) && typeof description === 'string' && description.length > 130;
              return (
              <section className={`ns-receptionist-preview-card ns-catalog-review ${person.avatar_video ? 'ns-catalog-video-review' : ''}`} key={person.id || person.full_name}>
                <div className="ns-receptionist-preview-image">
                  {person.avatar_video ? <video src={avatarVideoUrl(person.avatar_video)} poster={person.avatar || undefined} autoPlay muted loop playsInline preload="metadata" aria-label={`${person.full_name || 'Receptionist'} video portrait`} /> : person.avatar ? <img src={person.avatar} alt={person.full_name || 'Receptionist'} style={person.source === 'created_receptionist' || person.created_receptionist_id != null ? { objectPosition: 'center top' } : undefined} /> : <div className="ns-gallery-placeholder"><User size={64}/></div>}
                  <div className="ns-receptionist-preview-image-wash" />
                </div>
                <div className="ns-receptionist-preview-body">
                  <div className={`ns-catalog-status-row${hideVoiceButton ? ' is-autoplay' : ''}${compactVoicePreview ? ' is-compact-preview' : ''}`}>
                    {compactVoicePreview && person.voice ? <button type="button" className="ns-catalog-preview-button" onClick={event => { playVoice(person.voice, person.id, { nativePlayback: true }); if (event.detail > 0) event.currentTarget.blur(); }}><span>{playingVoice === person.id ? 'Playing' : 'Preview'}</span>{playingVoice === person.id ? <Pause size={13}/> : <Volume2 size={13}/>}</button> : <span className="ns-eyebrow">{person.source === 'created_receptionist' ? 'YOUR CREATION' : 'AVAILABLE'}</span>}
                    {hideVoiceButton && person.voice && <IntercomVoiceLine enabled={playingVoice === person.id} level={voiceLevel}/>} 
                  </div>
                  <h2>{person.full_name || 'Receptionist'}</h2>
                  {description && (expandableDescription ? <div className="ns-catalog-description"><p className={`ns-receptionist-preview-copy${descriptionExpanded ? '' : ' is-collapsed'}`}>{description}</p><button type="button" aria-expanded={descriptionExpanded} onClick={() => setDescriptionExpanded(expanded => !expanded)}>{descriptionExpanded ? 'Show less' : 'Show more'}</button></div> : <p className="ns-receptionist-preview-copy">{description}</p>)}
                  <dl className={`ns-catalog-review-meta${isCreatedReceptionist(person) ? ' ns-catalog-review-meta-created' : ''}`}>
                    {person.age && <div><dt>Age</dt><dd>{String(person.age).match(/^\d+$/) ? `${person.age} years old` : person.age}</dd></div>}
                    {catalogMbti(person) && <div><dt>Personality</dt><dd><button type="button" onClick={() => setPersonalityPerson(person)}>{catalogMbti(person)}</button></dd></div>}
                    {catalogAccentTraits(person).length > 0 && <div><dt>Accent</dt><dd>{catalogAccentTraits(person).join(' · ')}</dd></div>}
                  </dl>
                  {catalogCoreTraits(person).length > 0 && <div className="ns-catalog-review-traits"><span>Core traits</span><div>{catalogCoreTraits(person).map((trait, i) => <span key={i}>{trait}</span>)}</div></div>}
                  <div className="ns-receptionist-preview-actions">
                    {person.voice && !hideVoiceButton ? <div className="ns-catalog-voice-preview"><button type="button" className="ns-take-play" aria-label={playingVoice === person.id ? 'Pause voice preview' : 'Play voice preview'} onClick={() => playVoice(person.voice, person.id)}>{playingVoice === person.id ? <Pause size={18}/> : <Play size={18}/>}</button><IntercomVoiceLine enabled={playingVoice === person.id} level={voiceLevel}/><span>{playingVoice === person.id ? 'Playing preview' : 'Preview voice'}</span></div> : !person.voice ? <span className="ns-footnote">No voice preview</span> : null}
                    <div className={`ns-catalog-hire-actions${isCreatedReceptionist(person) ? ' is-created' : ''}`}>
                    <button type="button" className="ns-primary" disabled={Boolean(hiringId) || archiving} onClick={() => handleSelect(person)}>{hiringId === (person.created_receptionist_id ?? person.custom_voice_id ?? person.catalog_id ?? person.id) ? <><Loader2 size={16} className="animate-spin"/> Hiring…</> : <>Hire {person.first_name || person.full_name || 'receptionist'}</>}</button>
                    {person.created_receptionist_id != null && <button type="button" className="ns-catalog-archive-action" disabled={Boolean(hiringId) || archiving} onClick={() => { setHireError(''); setArchiveTarget(person); }}>{archiving ? 'Archiving…' : 'Archive'}</button>}
                    </div>
                  </div>
                </div>
              </section>
            );
            }) : <div className="relative w-full aspect-[2/3] mb-6" style={{ perspective: '1500px' }}>
              {receptionists.map((person, index) => {
                if (embedded && index !== selectedIndex) return null;
                const hasNeighbors = receptionists.length > 1;
                const isActive = embedded || index === currentIndex;
                const isNext = !embedded && hasNeighbors && index === (currentIndex + 1) % receptionists.length;
                const isPrev = !embedded && hasNeighbors && index === (currentIndex - 1 + receptionists.length) % receptionists.length;

                const baseClasses = "absolute top-0 left-0 w-full h-full transition-all duration-[620ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform";
                let stateClasses = "opacity-0 scale-90 pointer-events-none";

                if (isActive) stateClasses = "opacity-100 scale-100 translate-x-0 z-20";
                if (isNext) stateClasses = "opacity-40 scale-95 translate-x-full z-10 blur-[2px] cursor-pointer";
                if (isPrev) stateClasses = "opacity-40 scale-95 -translate-x-full z-10 blur-[2px] cursor-pointer";

                return (
                  <div
                    key={`${person.id ?? person.elevenlabs_voice_id ?? person.full_name ?? 'receptionist'}-${index}`}
                    className={`${baseClasses} ${stateClasses}`}
                    onClick={() => {
                      if (isNext) nextCard();
                      if (isPrev) prevCard();
                    }}
                  >
                    <div className="relative h-full w-full bg-[#0a0a0a] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl flex flex-col">
                      {/* Header Image Area */}
                      <div className="relative h-[75%] w-full group overflow-hidden">
                        {person.avatar_video ? (
                          <video src={avatarVideoUrl(person.avatar_video)} poster={person.avatar || undefined} autoPlay muted loop playsInline preload="metadata" aria-label={person.full_name || 'Receptionist video portrait'} className="h-full w-full object-cover" />
                        ) : person.avatar ? (
                          <img
                            src={person.avatar}
                            alt={person.full_name || 'Receptionist'}
                            className="w-full h-full object-cover"
                            style={person.source === 'created_receptionist' || person.created_receptionist_id != null ? { objectPosition: 'center top' } : undefined}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-[#050505] flex items-center justify-center">
                            <User size={64} className="text-white/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />

                        {/* Name Overlay */}
                        <div className="absolute bottom-6 left-8">
                          <h2 className="text-4xl font-bold text-white tracking-tight leading-none mb-1">
                            {person.full_name || 'Unnamed'}
                          </h2>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {person.age && (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/50">
                                <CalendarDays size={11} />
                                <span>{String(person.age).match(/^\d+$/) ? `${person.age} years old` : person.age}</span>
                              </span>
                            )}
                            {(person.personality?.mbti || person.personality_type) && (
                              <button
                                type="button"
                                title={person.personality?.personality || 'Personality type'}
                                aria-label={`Learn about ${person.personality?.mbti || person.personality_type} personality type`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setPersonalityPerson(person);
                                }}
                                className="inline-flex items-center rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-violet-100/75 transition hover:border-violet-200/35 hover:bg-violet-300/15 hover:text-white"
                              >
                    {person.personality?.mbti || person.personality_type}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 p-8 pt-2 flex flex-col gap-6">
                        <div className="border-b border-white/5 pb-6">
                          <div className="space-y-1">
                            {person.source === 'voice_clone' && person.elevenlabs_voice_id && (
                              <p className="mb-3 break-all text-[10px] font-semibold uppercase tracking-wider text-white/35">
                                Voice ID: {person.elevenlabs_voice_id}
                              </p>
                            )}
                            {person.voice ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playVoice(person.voice, person.id);
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white"
                              >
                                {playingVoice === person.id ? (
                                  <>
                                    <Pause size={14} className="animate-pulse" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Playing...</span>
                                  </>
                                ) : (
                                  <>
                                    <Play size={14} fill="currentColor" className="ml-0.5" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Preview Voice</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <p className="text-[11px] text-white/30">No voice set</p>
                            )}
                          </div>
                        </div>

                        {/* Core Traits */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/30">
                            <Sparkles size={12} />
                            <span>Core Traits</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {person.traits && Array.isArray(person.traits) && person.traits.map((trait, i) => (
                              <span key={`${String(trait)}-${i}`} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/60 font-medium">
                                {trait}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Description */}
                        {getMbtiProfileSummary(person.personality?.mbti || person.personality_type, person.first_name || person.full_name) && (
                          <p className="mt-2 text-xs leading-relaxed text-white/40">
                            "{getMbtiProfileSummary(person.personality?.mbti || person.personality_type, person.first_name || person.full_name)}"
                          </p>
                        )}

                        {/* Hire button — only on active card */}
                        {isActive && (
                          <button
                            disabled={Boolean(hiringId)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelect(person);
                            }}
                            className="mt-auto w-full h-11 bg-white text-black font-bold rounded-2xl tracking-wide flex items-center justify-center gap-2 hover:bg-white/90 transition-all active:scale-[0.98] shadow-lg shadow-white/5 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {hiringId === (person.created_receptionist_id ?? person.custom_voice_id ?? person.catalog_id ?? person.id) && <Loader2 size={16} className="animate-spin" />}
                            ✨ Hire {person.first_name || person.full_name || 'Receptionist'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>}

            {/* Navigation arrows */}
            {!embedded && receptionists.length > 1 && (
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={prevCard}
                  disabled={isAnimating}
                  className="p-2 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 transition-all disabled:opacity-30"
                >
                  <ChevronLeft size={16} className="text-zinc-300" />
                </button>
                <div className="flex gap-2">
                  {receptionists.map((person, i) => (
                    <button
                      key={`${person.id ?? person.elevenlabs_voice_id ?? person.full_name ?? 'receptionist'}-dot-${i}`}
                      onClick={() => {
                        if (isAnimating) return;
                        setIsAnimating(true);
                        setCurrentIndex(i);
                        setTimeout(() => setIsAnimating(false), carouselTransitionMs);
                      }}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentIndex
                          ? 'w-6 bg-zinc-300 shadow-[0_0_8px_rgba(212,212,216,0.28)]'
                          : 'w-1.5 bg-zinc-700 hover:bg-zinc-500'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={nextCard}
                  disabled={isAnimating}
                  className="p-2 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 transition-all disabled:opacity-30"
                >
                  <ChevronRight size={16} className="text-zinc-300" />
                </button>
              </div>
            )}

            {hireError && (
              <p className="text-xs font-semibold text-rose-300">{hireError}</p>
            )}

          </>
        )}
      </motion.div>

      <AnimatePresence>
        {personalityPerson && (
          <MbtiPersonalityModal person={personalityPerson} onClose={() => setPersonalityPerson(null)} />
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        body {
          font-family: 'Inter', sans-serif;
        }
      `}</style>
    </motion.div>
  );

  if (!embedded) return detail;
  if (loading || loadError || !receptionists.length) return <div className="ns-gallery-status" role="status">
    {loading ? <><CubePreloader size={26}/><span>Opening the catalog</span></> : <>
      <User size={32}/><span>{loadError || 'No receptionists available'}</span>
      {loadError && <button type="button" onClick={loadReceptionists}>Try again</button>}
    </>}
  </div>;
  return <><AnimatePresence>{archiveTarget?.created_receptionist_id != null && <ReceptionistActionConfirmation
    title="Archive Receptionist" action="Archive" name={archiveTarget.first_name || archiveTarget.full_name || 'receptionist'}
    description="This moves your saved receptionist to Archives. Their portrait, voice, and profile are preserved. You can restore them to the catalog."
    error={hireError} onClose={() => { setArchiveTarget(null); setHireError(''); }}
    onConfirm={async () => {
      setArchiving(true); setHireError('');
      try {
        const result = await api.archiveCreation(archiveTarget.created_receptionist_id);
        if (!result?.ok) throw new Error('Could not archive receptionist. Please try again.');
        setArchiveTarget(null); closeDetail(); await loadReceptionists();
      } catch (error) { setHireError(error?.message || 'Could not archive receptionist. Please try again.'); }
      finally { setArchiving(false); }
    }}
  />}</AnimatePresence><ReceptionistGallery receptionists={receptionists} onSelect={openDetail} onInteraction={onGalleryInteraction} paused={!interactive || selectedIndex !== null} allowWheelZoom={allowGalleryWheelZoom} showZoomControls={showGalleryZoomControls} defaultZoom={galleryDefaultZoom} randomizeRoster={randomizeGalleryRoster} introOnActive={galleryIntroReveal}>
    {!portalDetail && <AnimatePresence>{selectedIndex !== null && detail}</AnimatePresence>}
  </ReceptionistGallery>
  {portalDetail && typeof document !== 'undefined' && createPortal(
    <AnimatePresence>{selectedIndex !== null && detail}</AnimatePresence>,
    document.body,
  )}</>;
};

export default HireReceptionistModal;
