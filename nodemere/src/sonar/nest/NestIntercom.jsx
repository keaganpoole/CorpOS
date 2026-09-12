import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { AnimatePresence, motion } from 'framer-motion';
import { AudioLines, Check, Mic, MicOff, PhoneOff, X } from 'lucide-react';
import { api } from '../lib/api';
import { useNest } from './NestRuntime';

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

const fallbackInitial = (name) => String(name || 'R').trim().slice(0, 1).toUpperCase();
const receptionistImage = (receptionist) => receptionist?.avatar || receptionist?.banner_url || '';
const PRESENCE_SHAPES = [
  'M50 5 C63 4 75 13 79 25 C84 39 96 47 91 61 C87 73 74 77 67 89 C59 101 44 95 35 88 C24 79 10 77 9 63 C8 49 21 42 23 29 C25 15 36 6 50 5 Z',
  'M50 8 C65 8 73 18 82 28 C91 39 91 52 83 61 C75 70 77 84 65 91 C53 98 42 91 32 87 C20 82 11 73 13 60 C15 48 25 42 24 30 C23 18 36 7 50 8 Z',
  'M50 5 C64 7 83 11 82 25 C81 39 93 44 89 58 C86 72 68 73 65 87 C62 99 48 98 37 91 C25 83 10 79 10 64 C10 50 25 45 25 32 C25 18 37 3 50 5 Z',
];

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
  const { queueLength, setVoiceActive } = useNest();
  const [bootstrap, setBootstrap] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [phase, setPhase] = useState('selecting');
  const [line, setLine] = useState(null);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const [error, setError] = useState('');
  const sessionRef = useRef(null);
  const transcriptRef = useRef([]);
  const agentDraftRef = useRef('');
  const lastActivityRef = useRef(Date.now());
  const endingRef = useRef(false);
  const endTransportRef = useRef(() => {});

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
    if (open) {
      setPhase('selecting');
      setError('');
      setLine(null);
    }
    return () => setVoiceActive(false);
  }, [open, setVoiceActive]);

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
    endingRef.current = true;
    const session = sessionRef.current;
    if (session?.intercom_id) {
      try {
        await api.saveIntercomConversation({
          intercom_id: session.intercom_id,
          elevenlabs_conversation_id: session.elevenlabs_conversation_id,
          agent_id: session.agent_id,
          receptionist: session.receptionist,
          transcript: transcriptRef.current,
          usage: bootstrap?.usage || session.usage || {},
          started_at: session.started_at,
          ended_at: new Date().toISOString(),
        });
      } catch {
        // Final user and agent turns are already persisted incrementally.
      }
    }
    sessionRef.current = null;
    transcriptRef.current = [];
    agentDraftRef.current = '';
    setLine(null);
    setIdleWarning(false);
    setMuted(false);
    setPhase('selecting');
    endingRef.current = false;
    if (close) onClose?.();
  }, [bootstrap?.usage, onClose]);

  const conversation = useConversation({
    micMuted: muted,
    onConnect: ({ conversationId }) => {
      if (sessionRef.current) {
        sessionRef.current.elevenlabs_conversation_id = conversationId;
        api.recordIntercomTurn({
          intercom_id: sessionRef.current.intercom_id,
          elevenlabs_conversation_id: conversationId,
          role: 'agent',
        }).catch(() => {});
      }
      lastActivityRef.current = Date.now();
      setPhase('listening');
    },
    onDisconnect: () => {
      if (sessionRef.current && !endingRef.current) finalizeSession();
    },
    onError: (message) => {
      setError(String(message || 'Voice had trouble connecting.'));
      if (sessionRef.current) finalizeSession({ close: false });
      else setPhase('selecting');
    },
    onModeChange: ({ mode }) => {
      lastActivityRef.current = Date.now();
      setIdleWarning(false);
      setPhase(mode === 'speaking' ? 'speaking' : 'listening');
    },
    onMessage: (message) => {
      const nextLine = createLine(message);
      if (nextLine) appendFinalLine(nextLine);
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

  const beginSession = async ({ force = false, receptionistId = selectedId } = {}) => {
    if (!receptionistId || (loading && !force)) return;
    setLoading(true);
    setError('');
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
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
          tts: session.receptionist?.voice_id ? { voiceId: session.receptionist.voice_id } : undefined,
        },
      });
    } catch (err) {
      setError(err.message || 'Voice could not start.');
      setPhase('selecting');
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
    conversation.endSession();
    endingRef.current = false;
    finalizeSession();
  };

  const unavailable = bootstrap && (!bootstrap.agent_configured || !(bootstrap.receptionists || []).length);
  const hasTranscript = Boolean(line?.text);
  const receptionists = bootstrap?.receptionists || [];
  const pickerCount = receptionists.length > 4 ? 'many' : receptionists.length;
  const sessionStatus = muted
    ? 'Muted'
    : phase === 'speaking'
      ? 'Speaking'
      : phase === 'connecting'
        ? 'Connecting'
        : 'Listening';
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
              {phase === 'selecting' && selectedReceptionist && (
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
              ) : selectedReceptionist && (
                <motion.div
                  className={`intercom-session-stage is-${phase}`}
                  initial={{ opacity: 0, scale: 0.94, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="intercom-session-presence" aria-hidden="true">
                    <motion.svg className="intercom-presence-contour" viewBox="0 0 100 100" aria-hidden="true">
                      <motion.path
                        className="intercom-presence-contour-glow"
                        d={PRESENCE_SHAPES[0]}
                        animate={{ d: [...PRESENCE_SHAPES, PRESENCE_SHAPES[0]] }}
                        transition={{ duration: phase === 'speaking' ? 2.1 : 5.2, repeat: Infinity, ease: [0.45, 0.02, 0.34, 1] }}
                      />
                      <motion.path
                        className="intercom-presence-contour-line"
                        d={PRESENCE_SHAPES[0]}
                        animate={{ d: [...PRESENCE_SHAPES, PRESENCE_SHAPES[0]] }}
                        transition={{ duration: phase === 'speaking' ? 2.1 : 5.2, repeat: Infinity, ease: [0.45, 0.02, 0.34, 1] }}
                      />
                    </motion.svg>
                    <span className="intercom-session-portrait">
                      {receptionistImage(selectedReceptionist)
                        ? <img src={receptionistImage(selectedReceptionist)} alt="" />
                        : <span className="intercom-receptionist-fallback">{fallbackInitial(selectedReceptionist.name)}</span>}
                    </span>
                  </div>

                  <div className="intercom-session-status">
                    <AudioLines size={17} strokeWidth={1.7} aria-hidden="true" />
                    <span>{sessionStatus}</span>
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
                        {line?.text || sessionFallback}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </div>

            {phase === 'selecting' ? (
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
