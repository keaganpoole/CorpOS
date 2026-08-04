import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ScenarioIntroNode from '../components/ScenarioIntroNode';
import SplashScreenAlternate from '../components/SplashScreenAlternate';
import './VoiceCloneExperience.css';

const API_BASE = import.meta.env.VITE_API_URL || '';
const MAX_SAMPLES = 6;
const FLOW_EASE = [0.22, 1, 0.36, 1];

const stages = [
  { id: 'agreement', label: 'Agreement', title: 'Review and confirm' },
  { id: 'sample', label: 'Voice Sample', title: 'Give your voice a foundation' },
  { id: 'clone', label: 'Instant Clone', title: 'Your voice, made ready' },
];

const consentRows = [
  {
    id: 'voice',
    title: 'This is my voice',
    copy: 'I confirm that I am submitting recordings of my own voice and have the authority to provide this consent.',
  },
  {
    id: 'identity',
    title: 'Create an AI version of my voice',
    copy: 'I authorize Nodemere to create an AI-generated voice from the recordings I provide.',
  },
  {
    id: 'usage',
    title: 'Use it for approved business interactions',
    copy: 'I authorize the generated voice to be used for the business purposes described in the agreement.',
  },
];

const processingStatuses = [
  'Preparing your recordings',
  'Analyzing vocal characteristics',
  'Building your voice model',
  'Finalizing your voice',
];

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

function getSupportedMimeType() {
  if (typeof window === 'undefined' || !window.MediaRecorder) return '';
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return types.find((type) => window.MediaRecorder.isTypeSupported?.(type)) || '';
}

function isSupportedAudioFile(file) {
  if (!file) return false;
  if (file.type?.startsWith('audio/')) return true;
  return /\.(aac|m4a|mp3|ogg|wav|webm)$/i.test(file.name || '');
}

function getInitialStage(locationState) {
  if (locationState?.voiceFlowStage === 'sample') return 2;
  return 0;
}

function FlowProgress({ stage }) {
  const current = stages[stage - 1];
  if (!current) return null;
  const progress = (stage / stages.length) * 100;
  return (
    <div className="voice-flow-progress" aria-label={`Voice Clone, step ${stage} of ${stages.length}`}>
      <span>Voice Clone · {stage} of {stages.length}</span>
      <div className="voice-flow-progress-track" aria-hidden="true">
        <motion.i
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.65, ease: FLOW_EASE }}
        />
      </div>
      <span className="voice-flow-progress-stage">{current.label}</span>
    </div>
  );
}

function IntroNode({ onBegin }) {
  return (
    <ScenarioIntroNode
      nodeId="voice-clone-intro"
      onActivate={onBegin}
      ariaLabel="Begin creating your voice clone"
    />
  );
}

function ConsentRow({ row, checked, onChange, disabled }) {
  return (
    <label className={`voice-consent-row ${checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span className="voice-consent-check" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
      <span className="voice-consent-copy">
        <strong>{row.title}</strong>
        <small>{row.copy}</small>
      </span>
    </label>
  );
}

function SignaturePad({ canvasRef, hasSignature, onBegin, onDraw, onEnd, onClear }) {
  return (
    <div className="voice-signature-block">
      <div className="voice-section-heading">
        <div>
          <span className="voice-field-label">Signature</span>
          <p>Sign once to record your consent.</p>
        </div>
        <button type="button" className="voice-quiet-action" onClick={onClear} disabled={!hasSignature}>
          <RotateCcw size={13} /> Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className={`voice-signature-canvas ${hasSignature ? 'has-signature' : ''}`}
        onPointerDown={onBegin}
        onPointerMove={onDraw}
        onPointerUp={onEnd}
        onPointerLeave={onEnd}
        aria-label="Draw your signature"
      />
    </div>
  );
}

function AgreementSlide({
  form,
  setForm,
  accepted,
  setAccepted,
  signed,
  hasSignature,
  canvasRef,
  onSignatureBegin,
  onSignatureDraw,
  onSignatureEnd,
  onClearSignature,
  errorMessage,
}) {
  const canEdit = !signed;
  return (
    <div className="voice-flow-slide voice-agreement-slide">
      <div className="voice-slide-intro">
        <p className="voice-flow-eyebrow">Consent and authorization</p>
        <h1>Review and confirm</h1>
        <p>Review how your voice may be created and used, then confirm your consent to continue.</p>
      </div>

      <div className="voice-identity-fields">
        <label>
          <span className="voice-field-label">Full name</span>
          <input value={form.signer_name} onChange={(event) => setForm((current) => ({ ...current, signer_name: event.target.value }))} autoComplete="name" readOnly={!canEdit} />
        </label>
        <label>
          <span className="voice-field-label">Email</span>
          <input value={form.signer_email} onChange={(event) => setForm((current) => ({ ...current, signer_email: event.target.value }))} autoComplete="email" type="email" readOnly={!canEdit} />
        </label>
      </div>

      <div className="voice-consent-list" aria-label="Consent confirmations">
        {consentRows.map((row) => (
          <ConsentRow
            key={row.id}
            row={row}
            checked={accepted[row.id]}
            onChange={(checked) => setAccepted((current) => ({ ...current, [row.id]: checked }))}
            disabled={!canEdit}
          />
        ))}
      </div>

      {signed ? (
        <div className="voice-signed-note" role="status">
          <CheckCircle2 size={16} /> Consent recorded. Continue to create your voice.
        </div>
      ) : (
        <SignaturePad
          canvasRef={canvasRef}
          hasSignature={hasSignature}
          onBegin={onSignatureBegin}
          onDraw={onSignatureDraw}
          onEnd={onSignatureEnd}
          onClear={onClearSignature}
        />
      )}
      {errorMessage ? <p className="voice-flow-error" role="alert">{errorMessage}</p> : null}
    </div>
  );
}

function VoiceObject({ mode, level = 0, reduceMotion }) {
  const icon = mode === 'complete' ? <Check size={34} strokeWidth={1.55} /> : mode === 'processing' ? <Sparkles size={32} strokeWidth={1.35} /> : <Mic size={34} strokeWidth={1.45} />;
  return (
    <div className={`voice-object-wrap is-${mode}`} style={{ '--voice-level': level }}>
      <motion.div
        className="voice-object"
        animate={reduceMotion ? undefined : { scale: 1 + Math.min(level, 1) * 0.045 }}
        transition={{ type: 'spring', stiffness: 190, damping: 24, mass: 0.7 }}
      >
        <span className="voice-object-aura" aria-hidden="true" />
        <span className="voice-object-ring voice-object-ring-one" aria-hidden="true" />
        <span className="voice-object-ring voice-object-ring-two" aria-hidden="true" />
        <span className="voice-object-surface" aria-hidden="true" />
        <span className="voice-object-glyph" aria-hidden="true">{icon}</span>
      </motion.div>
    </div>
  );
}

function WhiteBrandOrb({ size = 140, finishMode = 'alabaster-brand', isRecording = false }) {
  const [glow, setGlow] = useState({ active: false, x: 50, y: 50 });
  const finishStyles = {
    'smoked-violet': 'radial-gradient(circle at 45% 40%, #2e1038 0%, #170b24 75%, #09030f 100%)',
    'platinum-aurora': 'radial-gradient(circle at 45% 40%, #f1f5f9 0%, #cbd5e1 45%, #8B5CF6 80%, #311042 100%)',
    'alabaster-brand': 'radial-gradient(circle at 45% 40%, #f8fafc 0%, #cbd5e1 38%, #3b2149 82%, #180e25 100%)',
  };

  const updateGlow = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setGlow({
      active: true,
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div
      className={`voice-brand-orb ${glow.active ? 'is-glowing' : ''} ${isRecording ? 'is-recording' : ''}`}
      style={{ '--voice-brand-orb-size': `${size}px`, '--voice-orb-glow-x': `${glow.x}%`, '--voice-orb-glow-y': `${glow.y}%` }}
      onPointerMove={updateGlow}
      onPointerEnter={updateGlow}
      onPointerLeave={() => setGlow((current) => ({ ...current, active: false }))}
      aria-hidden="true"
    >
      <div className="voice-brand-orb-shadow" />
      <div className="voice-brand-orb-body">
        <div className="voice-brand-orb-depth" style={{ background: finishStyles[finishMode] || finishStyles['alabaster-brand'] }} />
        <div className="voice-brand-orb-swirl" />
        <div className="voice-brand-orb-ring-wrap">
          <div className="voice-brand-orb-ring" />
        </div>
        <div className="voice-brand-orb-core" />
        <div className="voice-brand-orb-specks">
          <span />
          <span />
        </div>
        <div className="voice-brand-orb-rim" />
        <div className="voice-brand-orb-sheen" />
      </div>
    </div>
  );
}

function CaptureSlide({
  samples,
  isRecording,
  recordingSeconds,
  inputLevel,
  onStartRecording,
  onStopRecording,
  onUpload,
  onRemove,
  onReplace,
  onAddAnother,
  onPlay,
  playingSampleId,
  onDuration,
  reduceMotion,
  mediaError,
}) {
  const latestSample = samples[samples.length - 1];
  const hasSamples = samples.length > 0;
  return (
    <div className={`voice-flow-slide voice-capture-slide ${hasSamples ? 'has-samples' : ''}`}>
      <div className="voice-slide-intro voice-slide-intro-centered">
        <p className="voice-flow-eyebrow">Voice sample</p>
        <h1>{hasSamples ? 'Your voice has a foundation' : 'Give your voice a foundation'}</h1>
        <p>{hasSamples ? `${samples.length === 1 ? '1 voice sample ready.' : `${samples.length} voice samples ready.`} You can continue when it sounds clean.` : 'Speak naturally for 30–90 seconds. One clean recording is enough, but additional samples can improve the result.'}</p>
      </div>

      <WhiteBrandOrb size={140} isRecording={isRecording} />

      {isRecording ? (
        <div className="voice-capture-active" role="status" aria-live="polite">
          <span className="voice-recording-indicator" aria-hidden="true" />
          <span className="voice-recording-time">{formatTime(recordingSeconds)}</span>
          <span className="voice-recording-label">Listening</span>
        </div>
      ) : hasSamples ? (
        <div className="voice-sample-review" aria-label="Recorded voice samples">
          <div className="voice-sample-review-top">
            <div>
              <span className="voice-flow-eyebrow">Ready to continue</span>
              <strong>{samples.length === 1 ? '1 sample' : `${samples.length} samples`}</strong>
            </div>
          </div>
          <div className="voice-sample-list">
            {samples.map((sample) => (
              <div className="voice-sample-row" key={sample.id}>
                <audio
                  src={sample.url}
                  preload="metadata"
                  onLoadedMetadata={(event) => onDuration(sample.id, event.currentTarget.duration)}
                  onEnded={() => onPlay(null)}
                  ref={(node) => { if (node) node.dataset.sampleId = sample.id; }}
                />
                <button type="button" className="voice-sample-playback" onClick={() => onPlay(sample.id)} aria-label={`${playingSampleId === sample.id ? 'Pause' : 'Preview'} ${sample.name || 'voice sample'}`}>
                  {playingSampleId === sample.id ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <div className="voice-sample-row-copy">
                  <strong>{sample.name || 'Voice sample'}</strong>
                  <span>{sample.duration ? formatTime(sample.duration) : 'Sample ready'}</span>
                </div>
                <button type="button" className="voice-sample-delete" onClick={() => onRemove(sample.id)} aria-label={`Remove ${sample.name || 'voice sample'}`}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="voice-sample-actions">
            <button type="button" className="voice-quiet-action" onClick={onStartRecording} disabled={samples.length >= MAX_SAMPLES}>
              <Mic size={13} /> Record another
            </button>
            <button type="button" className="voice-quiet-action" onClick={onAddAnother} disabled={samples.length >= MAX_SAMPLES}>
              <Upload size={13} /> Upload more
            </button>
          </div>
        </div>
      ) : (
        <div className="voice-capture-actions">
          <button type="button" className="voice-primary-button" onClick={onStartRecording}>
            <Mic size={17} /> Start recording
          </button>
          <label className="voice-secondary-action">
            <Upload size={14} /> Have a recording already? Upload audio
            <input type="file" accept="audio/*" multiple onChange={onUpload} />
          </label>
        </div>
      )}

      {isRecording ? (
        <button type="button" className="voice-stop-button" onClick={onStopRecording}>
          <span className="voice-stop-square" /> Stop recording
        </button>
      ) : null}
      {mediaError ? <p className="voice-flow-error" role="alert">{mediaError}</p> : null}
    </div>
  );
}

function CloneSlide({
  cloneState,
  voiceName,
  setVoiceName,
  submitting,
  processingIndex,
  onRetry,
  onBack,
  onPreview,
  hasPreview,
  previewUrl,
  reduceMotion,
}) {
  const complete = ['ready', 'requires_verification', 'cloned'].includes(cloneState.status);
  const failed = cloneState.status === 'error' || cloneState.status === 'invalid' || cloneState.status === 'unsupported' || cloneState.status === 'too_large';
  return (
    <div className={`voice-flow-slide voice-clone-slide ${complete ? 'is-complete' : ''}`}>
      <div className="voice-slide-intro voice-slide-intro-centered">
        <p className="voice-flow-eyebrow">Instant clone</p>
        <h1>{complete ? 'Your voice is ready' : failed ? 'The voice needs another pass' : 'Building your voice'}</h1>
        <p>{complete ? 'Your voice can now be used for the approved business interactions in the agreement.' : failed ? (cloneState.message || 'We could not complete the clone. Your recordings are still here to try again.') : processingStatuses[processingIndex]}</p>
      </div>

      <VoiceObject mode={complete ? 'complete' : 'processing'} level={complete ? 0 : 0.2 + processingIndex * 0.08} reduceMotion={reduceMotion} />

      {complete ? (
        <div className="voice-complete-card">
          <div className="voice-complete-preview">
            <div>
              <span className="voice-flow-eyebrow">Preview</span>
              <strong>{voiceName || 'Your Nodemere voice'}</strong>
            </div>
            <button type="button" className="voice-primary-button voice-preview-button" onClick={onPreview} disabled={!hasPreview}>
              <Play size={16} /> {hasPreview ? 'Preview voice' : 'Preview unavailable'}
            </button>
          </div>
          {previewUrl ? <audio id="voice-preview-audio" src={previewUrl} preload="metadata" onEnded={() => onPreview('stop')} /> : null}
          {!hasPreview ? <p className="voice-preview-note">The current clone service does not return a provider preview yet.</p> : null}
          {cloneState.requires_verification ? <p className="voice-verification-note">The provider requires verification before this voice can be used.</p> : null}
          <label className="voice-clone-name-field">
            <span className="voice-field-label">Voice name</span>
            <input value={voiceName} onChange={(event) => setVoiceName(event.target.value)} />
          </label>
        </div>
      ) : failed ? (
        <div className="voice-error-actions">
          <button type="button" className="voice-primary-button" onClick={onRetry}><RotateCcw size={16} /> Try again</button>
          <button type="button" className="voice-secondary-button" onClick={onBack}>Back to samples</button>
        </div>
      ) : (
        <div className="voice-processing-sequence" aria-live="polite">
          {processingStatuses.map((status, index) => (
            <motion.span
              key={status}
              className={index === processingIndex ? 'is-current' : index < processingIndex ? 'is-done' : ''}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: index <= processingIndex ? 1 : 0.28, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.45, ease: FLOW_EASE }}
            >
              {index < processingIndex ? <Check size={13} /> : <i />}{status}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}

function FlowCard({ children, stage, onBack, canContinue, onContinue, submitting, continueLabel = 'Continue' }) {
  return (
    <motion.section
      className="voice-flow-card"
      initial={{ opacity: 0, y: 26, scale: 0.975, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -18, scale: 1.01, filter: 'blur(8px)' }}
      transition={{ duration: 0.68, ease: FLOW_EASE }}
      aria-live="polite"
    >
      <div className="voice-flow-studio-mark" aria-hidden="true">
        Nodemere <span>Studio</span>
      </div>
      <FlowProgress stage={stage} />
      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          className="voice-flow-stage-content"
          initial={{ opacity: 0, x: 22, filter: 'blur(7px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, x: -22, filter: 'blur(7px)' }}
          transition={{ duration: 0.46, ease: FLOW_EASE }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
      <div className="voice-flow-navigation">
        <button type="button" className="voice-back-button" onClick={onBack} disabled={stage <= 1 || submitting}>
          <ChevronLeft size={15} /> Back
        </button>
        {canContinue || submitting ? (
          <button type="button" className="voice-primary-button voice-continue-button" onClick={onContinue} disabled={!canContinue || submitting}>
            {submitting ? <LoaderCircle className="voice-spin" size={16} /> : null}
            {submitting ? 'Saving' : continueLabel}<ChevronRight size={15} />
          </button>
        ) : null}
      </div>
    </motion.section>
  );
}

export default function VoiceCloneExperience() {
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [showAlternateSplash, setShowAlternateSplash] = useState(true);
  const [stage, setStage] = useState(() => getInitialStage(location.state));
  const [cloneState, setCloneState] = useState({ loading: true, status: null, message: '' });
  const [form, setForm] = useState({ signer_name: '', signer_email: '' });
  const [accepted, setAccepted] = useState({ voice: false, identity: false, usage: false });
  const [hasSignature, setHasSignature] = useState(false);
  const [voiceName, setVoiceName] = useState('Nodemere Custom Voice');
  const [samples, setSamples] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [inputLevel, setInputLevel] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [mediaError, setMediaError] = useState('');
  const [playingSampleId, setPlayingSampleId] = useState(null);

  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const samplesRef = useRef([]);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);
  const cloneRequestedRef = useRef(false);

  const isSigned = ['signed', 'cloned', 'ready', 'requires_verification'].includes(cloneState.status);
  const unavailable = ['not_found', 'expired', 'revoked', 'error'].includes(cloneState.status);
  const needsSignature = !isSigned;
  const activeError = cloneState.message;

  const finishAlternateSplash = useCallback(() => {
    setShowAlternateSplash(false);
    setStage(isSigned ? 2 : 1);
  }, [isSigned]);

  const loadCloneState = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/contracts/${encodeURIComponent(token || '')}/clone`);
      const data = await response.json();
      setCloneState({ ...data, loading: false });
      setVoiceName(data.voice_display_name || data.signer_name || 'Nodemere Custom Voice');
      setForm({ signer_name: data.signer_name || '', signer_email: data.signer_email || '' });
      if (data.status === 'signed' || data.status === 'cloned') setAccepted({ voice: true, identity: true, usage: true });
    } catch {
      setCloneState({ loading: false, status: 'error', message: 'We could not load this clone link. Please try again.' });
    }
  }, [token]);

  useEffect(() => {
    loadCloneState();
  }, [loadCloneState]);

  useEffect(() => {
    samplesRef.current = samples;
  }, [samples]);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close?.();
    samplesRef.current.forEach((sample) => URL.revokeObjectURL(sample.url));
  }, []);

  useEffect(() => {
    if (stage !== 1 || !needsSignature) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const setup = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const context = canvas.getContext('2d');
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineWidth = 2.2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#f4f4f5';
    };
    setup();
    window.addEventListener('resize', setup);
    return () => window.removeEventListener('resize', setup);
  }, [needsSignature, stage]);

  useEffect(() => {
    if (stage !== 2 || !isRecording || !analyserRef.current) return undefined;
    const analyser = analyserRef.current;
    const buffer = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      buffer.forEach((value) => { const normalized = (value - 128) / 128; sum += normalized * normalized; });
      setInputLevel(Math.min(1, Math.sqrt(sum / buffer.length) * 2.7));
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      setInputLevel(0);
    };
  }, [isRecording, stage]);

  useEffect(() => {
    if (stage !== 3 || !samples.length || cloneRequestedRef.current || !isSigned) return;
    cloneRequestedRef.current = true;
    const createClone = async () => {
      setSubmitting(true);
      setCloneState((current) => ({ ...current, status: 'processing', message: '' }));
      try {
        const body = new FormData();
        body.append('voice_name', voiceName.trim() || 'Nodemere Custom Voice');
        body.append('remove_background_noise', 'true');
        samples.forEach((sample) => body.append('files', sample.file, sample.file.name));
        const response = await fetch(`${API_BASE}/api/contracts/${encodeURIComponent(token)}/clone`, { method: 'POST', body });
        const data = await response.json();
        if (!response.ok) {
          const detail = data.detail || {};
          throw new Error(detail.message || detail.debug || data.message || 'Voice cloning failed. Please try again.');
        }
        setCloneState((current) => ({ ...current, ...data, status: data.status || 'ready', message: data.requires_verification ? 'Voice created. Verification is required before use.' : 'Voice clone created and saved.' }));
      } catch (error) {
        setCloneState((current) => ({ ...current, status: 'error', message: error.message || 'Voice cloning failed. Please try again.' }));
      } finally {
        setSubmitting(false);
      }
    };
    createClone();
  }, [isSigned, samples, stage, token, voiceName]);

  useEffect(() => {
    if (stage !== 3 || !submitting) return undefined;
    const timer = window.setInterval(() => setProcessingIndex((current) => Math.min(processingStatuses.length - 1, current + 1)), 1250);
    return () => window.clearInterval(timer);
  }, [stage, submitting]);

  const addSample = useCallback((file) => {
    if (!file || samplesRef.current.length >= MAX_SAMPLES) return;
    if (!isSupportedAudioFile(file)) {
      setMediaError('Use an MP3, WAV, M4A, OGG, AAC, or WEBM audio file.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setMediaError('Each audio sample must be 25 MB or smaller.');
      return;
    }
    const url = URL.createObjectURL(file);
    const sample = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, file, name: file.name || `Voice sample ${samplesRef.current.length + 1}`, url, size: file.size, duration: null };
    samplesRef.current = [...samplesRef.current, sample];
    setSamples(samplesRef.current);
    setMediaError('');
  }, []);

  const startRecording = async () => {
    setMediaError('');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMediaError('Recording is not supported in this browser. Upload an audio file instead.');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMediaError('Microphone access was blocked. Allow microphone access or upload an audio file.');
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
      source.connect(analyserRef.current);
    } catch {
      analyserRef.current = null;
    }
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data?.size) chunksRef.current.push(event.data); };
    recorder.onerror = () => setMediaError('The recording stopped unexpectedly. Try again or upload an audio file.');
    recorder.onstop = () => {
      const type = mimeType || chunksRef.current[0]?.type || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `voice-sample-${samplesRef.current.length + 1}.${extension}`, { type });
      const url = URL.createObjectURL(file);
      const sample = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, file, name: file.name, url, size: file.size, duration: recordingSeconds };
      samplesRef.current = [...samplesRef.current, sample];
      setSamples(samplesRef.current);
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      chunksRef.current = [];
    };
    recorder.start();
    setRecordingSeconds(0);
    setIsRecording(true);
    timerRef.current = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    analyserRef.current = null;
    audioContextRef.current?.close?.();
    audioContextRef.current = null;
  };

  const removeSample = (sampleId) => {
    setSamples((current) => {
      const target = current.find((sample) => sample.id === sampleId);
      if (target) URL.revokeObjectURL(target.url);
      const next = current.filter((sample) => sample.id !== sampleId);
      samplesRef.current = next;
      return next;
    });
  };

  const handleUpload = (event) => {
    const files = Array.from(event.target.files || []).slice(0, MAX_SAMPLES - samplesRef.current.length);
    files.forEach(addSample);
    event.target.value = '';
  };

  const togglePlayback = (sampleId) => {
    if (!sampleId) {
      document.querySelectorAll('.voice-sample-review audio, #voice-preview-audio').forEach((audio) => audio.pause());
      setPlayingSampleId(null);
      return;
    }
    const node = document.querySelector(`audio[data-sample-id="${sampleId}"]`);
    if (!node) return;
    if (playingSampleId === sampleId) {
      node.pause();
      setPlayingSampleId(null);
    } else {
      document.querySelectorAll('.voice-sample-review audio').forEach((audio) => audio.pause());
      node.play().then(() => setPlayingSampleId(sampleId)).catch(() => setMediaError('This sample could not be played in the browser.'));
    }
  };

  const togglePreview = (action) => {
    const node = document.getElementById('voice-preview-audio');
    if (!node) return;
    if (action === 'stop' || !node.paused) {
      node.pause();
      setPlayingSampleId(null);
      return;
    }
    node.play().then(() => setPlayingSampleId('voice-preview')).catch(() => setMediaError('This sample could not be played in the browser.'));
  };

  const updateDuration = (sampleId, duration) => {
    if (!Number.isFinite(duration)) return;
    setSamples((current) => current.map((sample) => sample.id === sampleId ? { ...sample, duration } : sample));
  };

  const getSignaturePoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const beginSignature = (event) => {
    event.preventDefault();
    canvasRef.current?.setPointerCapture?.(event.pointerId);
    const context = canvasRef.current?.getContext('2d');
    const point = getSignaturePoint(event);
    drawingRef.current = true;
    context?.beginPath();
    context?.moveTo(point.x, point.y);
  };

  const drawSignature = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const context = canvasRef.current?.getContext('2d');
    const point = getSignaturePoint(event);
    context?.lineTo(point.x, point.y);
    context?.stroke();
    setHasSignature(true);
  };

  const endSignature = () => { drawingRef.current = false; };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const submitAgreement = async () => {
    if (isSigned) {
      setStage(2);
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/contracts/${encodeURIComponent(token)}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name: form.signer_name.trim(),
          signer_email: form.signer_email.trim(),
          signature_data_url: canvasRef.current?.toDataURL('image/png'),
          consent: accepted,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail?.message || 'The agreement could not be signed.');
      setCloneState((current) => ({ ...current, status: 'signed', clone_ready: true, loading: false }));
      setStage(2);
    } catch (error) {
      setCloneState((current) => ({ ...current, message: error.message || 'The agreement could not be signed. Please try again.' }));
    } finally {
      setSubmitting(false);
    }
  };

  const continueFromSample = () => {
    if (!samples.length || isRecording) return;
    setProcessingIndex(0);
    setStage(3);
  };

  const retryClone = () => {
    cloneRequestedRef.current = false;
    setProcessingIndex(0);
    setStage(2);
  };

  const pageReady = !cloneState.loading;
  const canAgreementContinue = isSigned || (form.signer_name.trim() && form.signer_email.trim() && hasSignature && Object.values(accepted).every(Boolean));
  const canSampleContinue = samples.length > 0 && !isRecording;
  const cloneComplete = ['ready', 'requires_verification', 'cloned'].includes(cloneState.status);
  const hasPreview = samples.length > 0;

  const content = useMemo(() => {
    if (stage === 1) return <AgreementSlide form={form} setForm={setForm} accepted={accepted} setAccepted={setAccepted} signed={!needsSignature || isSigned} hasSignature={hasSignature} canvasRef={canvasRef} onSignatureBegin={beginSignature} onSignatureDraw={drawSignature} onSignatureEnd={endSignature} onClearSignature={clearSignature} errorMessage={cloneState.message} />;
    if (stage === 2) return <CaptureSlide samples={samples} isRecording={isRecording} recordingSeconds={recordingSeconds} inputLevel={inputLevel} onStartRecording={startRecording} onStopRecording={stopRecording} onUpload={handleUpload} onRemove={removeSample} onReplace={() => document.getElementById('voice-replace-upload')?.click()} onAddAnother={() => document.getElementById('voice-add-upload')?.click()} onPlay={togglePlayback} playingSampleId={playingSampleId} onDuration={updateDuration} reduceMotion={reduceMotion} mediaError={mediaError} />;
    return <CloneSlide cloneState={cloneState} voiceName={voiceName} setVoiceName={setVoiceName} submitting={submitting} processingIndex={processingIndex} onRetry={retryClone} onBack={() => setStage(2)} onPreview={togglePreview} hasPreview={hasPreview} previewUrl={samples[samples.length - 1]?.url} reduceMotion={reduceMotion} />;
  }, [accepted, cloneState, form, hasPreview, hasSignature, inputLevel, isRecording, isSigned, mediaError, needsSignature, playingSampleId, processingIndex, recordingSeconds, reduceMotion, samples, stage, submitting, voiceName]);

  if (showAlternateSplash) {
    return <SplashScreenAlternate onAnimationEnd={finishAlternateSplash} />;
  }

  if (!pageReady) {
    return <main className="voice-flow-page"><div className="voice-flow-status"><LoaderCircle className="voice-spin" size={24} /><span>Preparing your voice session</span></div></main>;
  }

  if (unavailable) {
    return (
      <main className="voice-flow-page">
        <div className="voice-flow-status voice-flow-status-card"><CircleAlert size={25} /><h1>Voice session unavailable</h1><p>{activeError || 'This voice session is no longer active.'}</p></div>
      </main>
    );
  }

  return (
    <main className={`voice-flow-page ${stage === 0 ? 'is-intro' : ''}`}>
      <AnimatePresence mode="wait" initial={false}>
        {stage === 0 ? (
          <IntroNode key="intro" onBegin={() => setStage(1)} />
        ) : (
          <FlowCard
            key="flow"
            stage={stage}
            onBack={() => setStage((current) => Math.max(1, current - 1))}
            canContinue={stage === 1 ? canAgreementContinue : stage === 2 ? canSampleContinue : cloneComplete}
            onContinue={stage === 1 ? submitAgreement : stage === 2 ? continueFromSample : () => navigate('/')}
            submitting={submitting}
            continueLabel={stage === 1 ? (isSigned ? 'Continue to sample' : 'Sign and continue') : stage === 2 ? 'Continue to clone' : 'Finish'}
          >
            {content}
          </FlowCard>
        )}
      </AnimatePresence>
      <input id="voice-replace-upload" className="voice-hidden-upload" type="file" accept="audio/*" multiple onChange={handleUpload} />
      <input id="voice-add-upload" className="voice-hidden-upload" type="file" accept="audio/*" multiple onChange={handleUpload} />
      {stage === 3 && cloneComplete ? <button type="button" className="voice-secondary-floating-action" onClick={() => setStage(2)}><Upload size={13} /> Replace samples</button> : null}
    </main>
  );
}
