import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Mic, MicOff, PhoneOff, X } from 'lucide-react';
import { api } from '../lib/api';
import { useNest } from './NestRuntime';
import IntercomVoiceLine from './IntercomVoiceLine';
import useIntercomMicrophone from './useIntercomMicrophone';
import ringingSound from '../../assets/ringing.mp3';
import pickupSound from '../../assets/pickup.mp3';

const PRIVACY_COPY = 'Voice conversations may be transcribed and saved so you can review them later.';
const ACTIVE_PHASES = new Set(['connecting', 'listening', 'speaking']);

const createLine = (message) => {
  const text = String(message?.message || message?.text || '').trim();
  if (!text) return null;
  const role = message?.role === 'user' || message?.source === 'user' ? 'user' : 'agent';
  return {
    id: String(message?.event_id || `${role}:${Date.now()}:${Math.random().toString(16).slice(2)}`),
    role,
    text,
    at: new Date().toISOString(),
  };
};

const normalizeTranscriptText = (value) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

const isSuccessfulDispatchToolResponse = (response) => {
  const toolName = String(response?.tool_name || '').trim().toLowerCase().replace(/_/g, '-');
  if (toolName !== 'dispatch-call') return false;
  if (response?.is_error) return false;
  const rawResult = response?.full_tool_result;
  if (!rawResult) return false;
  try {
    const result = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
    return Boolean(result?.ok !== false && (result?.call_dispatched || result?.success));
  } catch {
    return false;
  }
};

const fallbackInitial = (name) => String(name || 'R').trim().slice(0, 1).toUpperCase();
const receptionistImage = (receptionist) => receptionist?.avatar || receptionist?.banner_url || '';

function PrivacyNotice({ open, busy, onCancel, onAccept }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="nest-overlay intercom-privacy-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.section
            className="intercom-privacy-panel no-drag"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 7, scale: 0.99 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="intercom-privacy-title"
          >
            <span className="intercom-spectrum" aria-hidden="true" />
            <div className="intercom-privacy-mark"><Mic size={17} /></div>
            <h2 id="intercom-privacy-title">Before you begin</h2>
            <p>{PRIVACY_COPY}</p>
            <div className="intercom-privacy-actions">
              <button type="button" className="is-secondary" onClick={onCancel}>Not now</button>
              <button type="button" className="is-primary" onClick={onAccept} disabled={busy}>
                <Check size={14} />
                {busy ? 'Starting' : 'Continue'}
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function NestIntercomInner({ open, onClose }) {
  const { start: startMicrophone, stop: stopMicrophone, sample: sampleMicrophone, setMuted: setMicrophoneMuted } = useIntercomMicrophone();
  const { queueLength, setVoiceActive, nestSoundsMuted } = useNest();
  const [bootstrap, setBootstrap] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [phase, setPhase] = useState('selecting');
  const [line, setLine] = useState(null);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [micPermissionState, setMicPermissionState] = useState('unknown');
  const [silenceHintVisible, setSilenceHintVisible] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const [error, setError] = useState('');
  const sessionRef = useRef(null);
  const transcriptRef = useRef([]);
  const agentDraftRef = useRef('');
  const lastActivityRef = useRef(Date.now());
  const endingRef = useRef(false);
  const endTransportRef = useRef(() => {});
  const userHasSpokenRef = useRef(false);
  const silenceHintTimerRef = useRef(null);
  const silenceHintHideTimerRef = useRef(null);
  const ringingAudioRef = useRef(null);
  const pickupAudioRef = useRef(null);
  const ringingTimerRef = useRef(null);

  useEffect(() => { setMicrophoneMuted(muted); }, [muted, setMicrophoneMuted]);

  const stopNestSounds = useCallback(() => {
    if (ringingTimerRef.current) window.clearInterval(ringingTimerRef.current);
    ringingTimerRef.current = null;
    [ringingAudioRef.current, pickupAudioRef.current].forEach((audio) => {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
    });
  }, []);

  const clearSilenceHintTimers = useCallback(() => {
    if (silenceHintTimerRef.current) window.clearTimeout(silenceHintTimerRef.current);
    if (silenceHintHideTimerRef.current) window.clearTimeout(silenceHintHideTimerRef.current);
    silenceHintTimerRef.current = null;
    silenceHintHideTimerRef.current = null;
  }, []);

  const startSilenceHintTimer = useCallback(() => {
    clearSilenceHintTimers();
    userHasSpokenRef.current = false;
    setSilenceHintVisible(false);
    silenceHintTimerRef.current = window.setTimeout(() => {
      if (userHasSpokenRef.current) return;
      setSilenceHintVisible(true);
      silenceHintHideTimerRef.current = window.setTimeout(() => setSilenceHintVisible(false), 3200);
    }, 5000);
  }, [clearSilenceHintTimers]);

  const readMicrophonePermission = useCallback(async () => {
    if (!navigator.permissions?.query) return 'prompt';
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      return result.state;
    } catch {
      return 'prompt';
    }
  }, []);

  const selectedReceptionist = useMemo(
    () => (bootstrap?.receptionists || []).find((item) => String(item.id) === String(selectedId)) || null,
    [bootstrap, selectedId],
  );

  const refreshBootstrap = useCallback(async () => {
    const data = await api.getIntercomBootstrap();
    setBootstrap(data);
    const remembered = data?.settings?.last_receptionist_eligible ? data.settings.last_receptionist_id : '';
    setSelectedId(remembered || data?.receptionists?.[0]?.id || '');
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    refreshBootstrap().catch(() => setError('Voice is unavailable right now.'));
    return undefined;
  }, [open, refreshBootstrap]);

  useEffect(() => {
    setVoiceActive(open);
    if (!open) {
      stopMicrophone();
      stopNestSounds();
      clearSilenceHintTimers();
      setSilenceHintVisible(false);
    }
    if (open) {
      setPhase('selecting');
      setError('');
      setLine(null);
    }
    return () => setVoiceActive(false);
  }, [clearSilenceHintTimers, open, setVoiceActive, stopMicrophone, stopNestSounds]);

  useEffect(() => {
    ringingAudioRef.current = new Audio(ringingSound);
    pickupAudioRef.current = new Audio(pickupSound);
    return () => stopNestSounds();
  }, [stopNestSounds]);

  useEffect(() => {
    const shouldRing = open && !nestSoundsMuted && ['calling', 'connecting'].includes(phase);
    if (!shouldRing) {
      if (ringingTimerRef.current) window.clearInterval(ringingTimerRef.current);
      ringingTimerRef.current = null;
      if (ringingAudioRef.current) {
        ringingAudioRef.current.pause();
        ringingAudioRef.current.currentTime = 0;
      }
      return undefined;
    }
    const playRing = () => {
      const audio = ringingAudioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    };
    playRing();
    ringingTimerRef.current = window.setInterval(playRing, 5000);
    return () => {
      if (ringingTimerRef.current) window.clearInterval(ringingTimerRef.current);
      ringingTimerRef.current = null;
      if (ringingAudioRef.current) {
        ringingAudioRef.current.pause();
        ringingAudioRef.current.currentTime = 0;
      }
    };
  }, [nestSoundsMuted, open, phase]);

  const persistLine = useCallback(async (nextLine) => {
    if (!nextLine || !sessionRef.current?.intercom_id) return;
    const result = await api.recordIntercomTurn({
      intercom_id: sessionRef.current.intercom_id,
      elevenlabs_conversation_id: sessionRef.current.elevenlabs_conversation_id,
      turn_id: nextLine.id,
      role: nextLine.role,
      text: nextLine.text,
      at: nextLine.at,
    });
    if (result?.usage) {
      setBootstrap((current) => current ? { ...current, usage: result.usage } : current);
    }
  }, []);

  const appendFinalLine = useCallback((nextLine) => {
    if (!nextLine?.text) return;
    lastActivityRef.current = Date.now();
    setIdleWarning(false);
    setLine(nextLine);
    if (!transcriptRef.current.some((item) => item.id === nextLine.id)) {
      transcriptRef.current = [...transcriptRef.current, nextLine].slice(-200);
    }
    persistLine(nextLine).catch((err) => {
      setError(err.message || 'The daily voice limit has been reached.');
      if (err?.status === 429) endTransportRef.current();
    });
  }, [persistLine]);

  const finalizeSession = useCallback(async ({ close = true } = {}) => {
    if (endingRef.current) return;
    stopMicrophone();
    clearSilenceHintTimers();
    setSilenceHintVisible(false);
    endingRef.current = true;
    const session = sessionRef.current;
    const transcript = transcriptRef.current;
    const usage = bootstrap?.usage || session?.usage || {};
    const endedAt = new Date().toISOString();
    sessionRef.current = null;
    transcriptRef.current = [];
    agentDraftRef.current = '';
    setLine(null);
    setIdleWarning(false);
    setMuted(false);
    setPhase('selecting');
    endingRef.current = false;
    if (close) onClose?.();
    if (session?.intercom_id) {
      api.saveIntercomConversation({
        intercom_id: session.intercom_id,
        elevenlabs_conversation_id: session.elevenlabs_conversation_id,
        agent_id: session.agent_id,
        receptionist: session.receptionist,
        transcript,
        usage,
        started_at: session.started_at,
        ended_at: endedAt,
      }).catch(() => {
        // Final user and agent turns are already persisted incrementally.
      });
    }
  }, [bootstrap?.usage, clearSilenceHintTimers, onClose, stopMicrophone]);

  const conversation = useConversation({
    micMuted: muted,
    onConnect: ({ conversationId }) => {
      if (ringingTimerRef.current) window.clearInterval(ringingTimerRef.current);
      ringingTimerRef.current = null;
      if (ringingAudioRef.current) {
        ringingAudioRef.current.pause();
        ringingAudioRef.current.currentTime = 0;
      }
      if (!nestSoundsMuted && pickupAudioRef.current) {
        pickupAudioRef.current.currentTime = 0;
        pickupAudioRef.current.play().catch(() => {});
      }
      if (sessionRef.current) {
        sessionRef.current.elevenlabs_conversation_id = conversationId;
        api.recordIntercomTurn({
          intercom_id: sessionRef.current.intercom_id,
          elevenlabs_conversation_id: conversationId,
          role: 'agent',
        }).catch(() => {});
      }
      lastActivityRef.current = Date.now();
      startSilenceHintTimer();
      setPhase('listening');
    },
    onDisconnect: () => {
      if (sessionRef.current && !endingRef.current) finalizeSession();
    },
    onError: (message) => {
      setError(String(message || 'Voice had trouble connecting.'));
      if (sessionRef.current) finalizeSession({ close: false });
      else { stopMicrophone(); setPhase('selecting'); }
    },
    onModeChange: ({ mode }) => {
      lastActivityRef.current = Date.now();
      setIdleWarning(false);
      setPhase(mode === 'speaking' ? 'speaking' : 'listening');
    },
    onMessage: (message) => {
      const nextLine = createLine(message);
      if (nextLine) {
        if (nextLine.role === 'user') {
          userHasSpokenRef.current = true;
          clearSilenceHintTimers();
          setSilenceHintVisible(false);
        }
        appendFinalLine(nextLine);
      }
    },
    onAgentChatResponsePart: ({ type, text, response_id: responseId }) => {
      lastActivityRef.current = Date.now();
      setIdleWarning(false);
      if (type === 'start') agentDraftRef.current = '';
      if (type === 'delta' && text) {
        agentDraftRef.current += text;
        setLine({
          id: String(responseId || 'agent-draft'),
          role: 'agent',
          text: agentDraftRef.current,
          at: new Date().toISOString(),
          draft: true,
        });
      }
      if (type === 'stop') agentDraftRef.current = '';
    },
    onAgentResponseCorrection: ({ corrected_agent_response: corrected }) => {
      if (corrected) setLine((current) => current?.role === 'agent' ? { ...current, text: corrected } : current);
    },
    onAgentToolResponse: (response) => {
      if (isSuccessfulDispatchToolResponse(response)) {
        endSession();
      }
    },
  });
  endTransportRef.current = conversation.endSession;

  useEffect(() => {
    if (!open || !ACTIVE_PHASES.has(phase)) return undefined;
    const interval = window.setInterval(() => {
      const idleFor = (Date.now() - lastActivityRef.current) / 1000;
      const warningAt = bootstrap?.limits?.idle_warning_seconds || 45;
      const disconnectAt = bootstrap?.limits?.idle_disconnect_seconds || 75;
      if (idleFor >= disconnectAt) {
        conversation.endSession();
        finalizeSession();
      } else if (idleFor >= warningAt) {
        setIdleWarning(true);
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [bootstrap?.limits, conversation.endSession, finalizeSession, open, phase]);

  useEffect(() => {
    if (!open || phase !== 'speaking') return undefined;
    const maxAgentSeconds = bootstrap?.limits?.turn_seconds?.agent || 30;
    const timer = window.setTimeout(() => {
      conversation.sendUserActivity();
    }, maxAgentSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [bootstrap?.limits?.turn_seconds?.agent, conversation.sendUserActivity, open, phase]);

  const beginSession = async ({ force = false, receptionistId = selectedId, requestPermission = false } = {}) => {
    if (!receptionistId || (loading && !force)) return;
    setLoading(true);
    setError('');
    try {
      const permission = await readMicrophonePermission();
      setMicPermissionState(permission);
      if (permission !== 'granted' && !requestPermission) {
        setPhase('mic-permission');
        return;
      }
      await startMicrophone();
      setMicPermissionState('granted');
      setPhase('calling');
      const session = await api.createIntercomSession({ receptionist_id: receptionistId });
      const startedAt = new Date().toISOString();
      sessionRef.current = { ...session, started_at: startedAt };
      transcriptRef.current = [];
      agentDraftRef.current = '';
      endingRef.current = false;
      lastActivityRef.current = Date.now();
      setLine(null);
      setPhase('connecting');
      conversation.startSession({
        signedUrl: session.signed_url,
        userId: session.user_id,
        dynamicVariables: session.dynamic_variables,
        overrides: {
          agent: session.knowledge_base_override?.length
            ? { prompt: { knowledge_base: session.knowledge_base_override } }
            : undefined,
          tts: session.receptionist?.voice_id ? { voiceId: session.receptionist.voice_id } : undefined,
        },
      });
    } catch (err) {
      stopMicrophone();
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setMicPermissionState('denied');
        setError('Microphone access is required to talk.');
        setPhase('mic-permission');
      } else {
        setError(err.message || 'Voice could not start.');
        setPhase('selecting');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectReceptionist = (receptionistId) => {
    setSelectedId(receptionistId);
    setError('');
  };

  const requestStart = (receptionistId = selectedId) => {
    if (!receptionistId) {
      setError('Choose a receptionist first.');
      return;
    }
    setError('');
    if (!bootstrap?.settings?.privacy_accepted) {
      setPrivacyOpen(true);
      return;
    }
    beginSession({ receptionistId });
  };

  const acceptPrivacy = async () => {
    setLoading(true);
    try {
      const result = await api.updateIntercomSettings({ privacy_accepted: true });
      setBootstrap((current) => ({ ...current, settings: { ...(current?.settings || {}), ...(result?.settings || {}) } }));
      setPrivacyOpen(false);
      await beginSession({ force: true });
    } catch (err) {
      setError(err.message || 'Voice could not start.');
    } finally {
      setLoading(false);
    }
  };

  const endSession = () => {
    endingRef.current = true;
    stopNestSounds();
    conversation.endSession();
    endingRef.current = false;
    finalizeSession();
  };

  const unavailable = bootstrap && (!bootstrap.agent_configured || !(bootstrap.receptionists || []).length);
  const hasTranscript = Boolean(line?.text);
  const receptionists = bootstrap?.receptionists || [];
  const pickerCount = receptionists.length > 4 ? 'many' : receptionists.length;
  const sessionFallback = phase === 'connecting'
    ? 'Opening the intercom'
    : phase === 'speaking'
      ? 'Speaking with you'
      : 'I\u2019m here. What do you need?';

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className={`intercom-surface phase-${phase} ${hasTranscript ? 'has-transcript' : ''}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ delay: 0.12, duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            {selectedReceptionist?.banner_url && (
              <span className="intercom-banner" style={{ backgroundImage: `url(${selectedReceptionist.banner_url})` }} aria-hidden="true" />
            )}
            <span className="intercom-scrim" aria-hidden="true" />
            {queueLength > 0 && <span className="intercom-queue" title={`${queueLength} NEST events waiting`}>{queueLength}</span>}

            <div className="intercom-main">
              {phase === 'mic-permission' && selectedReceptionist ? (
                <motion.div className="intercom-mic-permission no-drag" role="status" aria-live="polite" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <span>{micPermissionState === 'denied' ? 'Allow microphone access to talk' : 'Please allow microphone access'}</span>
                  <button type="button" onClick={() => beginSession({ force: true, receptionistId: selectedId, requestPermission: true })} disabled={loading}>
                    <Mic size={13} />
                    Allow microphone
                  </button>
                </motion.div>
              ) : phase === 'calling' && selectedReceptionist ? (
                <motion.div className="intercom-calling no-drag" role="status" aria-live="polite" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}>
                  <span className="intercom-calling-photo" aria-hidden="true">
                    {receptionistImage(selectedReceptionist)
                      ? <img src={receptionistImage(selectedReceptionist)} alt="" />
                      : <span className="intercom-receptionist-fallback">{fallbackInitial(selectedReceptionist.name)}</span>}
                  </span>
                  <span>Calling {selectedReceptionist.name}...</span>
                </motion.div>
              ) : phase === 'selecting' && selectedReceptionist && (
                <div className="intercom-action no-drag">
                  <span className="intercom-action-label">
                    <span>Talk with</span>
                    <strong>{selectedReceptionist.name.split(' ')[0]}</strong>
                  </span>
                  <button
                    type="button"
                    className="intercom-talk-button"
                    onClick={() => requestStart(selectedId)}
                    disabled={loading || unavailable}
                    aria-label={`Talk with ${selectedReceptionist.name}`}
                    title={`Talk with ${selectedReceptionist.name}`}
                  >
                    <Mic size={14} />
                  </button>
                </div>
              )}
              {phase === 'selecting' ? (
                <motion.div className={`intercom-picker is-${phase} count-${pickerCount}`} layout>
                  {receptionists.map((item) => {
                    const isSelected = String(item.id) === String(selectedId);
                    return (
                      <motion.button
                        type="button"
                        key={item.id}
                        layout
                        className={`intercom-receptionist ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => selectReceptionist(String(item.id))}
                        disabled={loading || unavailable}
                        aria-label={`Select ${item.name}`}
                        aria-pressed={isSelected}
                        title={item.name}
                      >
                        {item.banner_url && (
                          <span
                            className="intercom-receptionist-banner"
                            style={{ backgroundImage: `url(${item.banner_url})` }}
                            aria-hidden="true"
                          />
                        )}
                        <span className="intercom-receptionist-shade" aria-hidden="true" />
                        <span className="intercom-receptionist-name">{item.name.split(' ')[0]}</span>
                      </motion.button>
                    );
                  })}
                </motion.div>
              ) : ACTIVE_PHASES.has(phase) && selectedReceptionist && (
                <motion.div
                  className={`intercom-session-stage is-${phase}`}
                  initial={{ opacity: 0, scale: 0.94, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className={`intercom-session-monitor ${silenceHintVisible ? 'is-hint-visible' : ''}`}>
                    <div className="intercom-session-monitor-line">
                      <IntercomVoiceLine
                        sampleMicrophone={sampleMicrophone}
                        enabled={open && conversation.status === 'connected' && !muted && !conversation.isMuted}
                      />
                    </div>
                    <span className="intercom-session-silence-hint">Listening...</span>
                  </div>

                  <span className="intercom-session-divider" aria-hidden="true" />

                  <div className="intercom-transcript" aria-live="polite" aria-atomic="true">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.p
                        key={line?.text ? `${line.id}:${line.text}` : sessionFallback}
                        className={line?.role ? `is-${line.role}` : ''}
                        initial={{ opacity: 0, y: 7, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
                        transition={{ duration: line?.draft ? 0.16 : 0.34, ease: [0.16, 1, 0.3, 1] }}
                      >
                        {normalizeTranscriptText(line?.text) || sessionFallback}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </div>

            {phase === 'selecting' || phase === 'calling' || phase === 'mic-permission' ? (
              <button type="button" className="intercom-close" onClick={onClose} aria-label="Close voice conversation"><X size={13} /></button>
            ) : (
              <div className="intercom-controls no-drag">
                <button type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>
                  {muted ? <MicOff size={13} /> : <Mic size={13} />}
                </button>
                <button type="button" className="is-end" onClick={endSession} aria-label="End voice conversation"><PhoneOff size={13} /></button>
              </div>
            )}

            {idleWarning && <span className="intercom-idle-warning">Still there?</span>}
            {error && <span className="intercom-error">{error}</span>}
            {unavailable && <span className="intercom-error">Add an eligible receptionist and configure the voice agent.</span>}
          </motion.div>
        )}
      </AnimatePresence>
      <PrivacyNotice open={privacyOpen} busy={loading} onCancel={() => setPrivacyOpen(false)} onAccept={acceptPrivacy} />
    </>
  );
}

export default function NestIntercom(props) {
  return (
    <ConversationProvider>
      <NestIntercomInner {...props} />
    </ConversationProvider>
  );
}
