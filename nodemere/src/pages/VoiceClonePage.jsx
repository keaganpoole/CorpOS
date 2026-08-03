import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, LoaderCircle, Mic, Pause, Upload, Wand2, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import './VoiceClonePage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';
const MAX_SAMPLES = 6;
const cloneSteps = [
  { id: 'voice', label: 'Voice', title: 'Name the voice' },
  { id: 'samples', label: 'Samples', title: 'Record your voice' },
  { id: 'create', label: 'Create', title: 'Review and create' },
];

const getSupportedMimeType = () => {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return types.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
};

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

function VoiceClonePage() {
  const { token } = useParams();
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const samplesRef = useRef([]);
  const [state, setState] = useState({ loading: true, status: null, message: '' });
  const [voiceName, setVoiceName] = useState('');
  const [samples, setSamples] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [removeNoise, setRemoveNoise] = useState(true);
  const [step, setStep] = useState(0);

  useEffect(() => {
    samplesRef.current = samples;
  }, [samples]);

  const loadState = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/contracts/${encodeURIComponent(token || '')}/clone`);
      const data = await response.json();
      setState({ ...data, loading: false });
      setVoiceName(data.voice_display_name || data.signer_name || 'Nodemere Custom Voice');
    } catch {
      setState({ loading: false, status: 'error', message: 'We could not load this clone link. Please try again.' });
    }
  }, [token]);

  useEffect(() => { loadState(); }, [loadState]);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    samplesRef.current.forEach((sample) => URL.revokeObjectURL(sample.url));
  }, []);

  const addSample = (file) => {
    if (!file || samples.length >= MAX_SAMPLES) return;
    const url = URL.createObjectURL(file);
    setSamples((current) => [...current, {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      name: file.name || `Voice sample ${current.length + 1}`,
      url,
      size: file.size,
    }]);
  };

  const startRecording = async () => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState((current) => ({ ...current, message: 'Microphone access was blocked. Allow microphone access or upload an audio file.' }));
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const type = mimeType || chunksRef.current[0]?.type || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `voice-sample-${samples.length + 1}.${extension}`, { type });
      addSample(file);
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
  };

  const removeSample = (sampleId) => {
    setSamples((current) => {
      const target = current.find((sample) => sample.id === sampleId);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((sample) => sample.id !== sampleId);
    });
  };

  const handleFileUpload = (event) => {
    Array.from(event.target.files || []).slice(0, MAX_SAMPLES - samples.length).forEach(addSample);
    event.target.value = '';
  };

  const handleClone = async () => {
    if (!samples.length || !voiceName.trim()) return;
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('voice_name', voiceName.trim());
      body.append('remove_background_noise', removeNoise ? 'true' : 'false');
      samples.forEach((sample) => body.append('files', sample.file, sample.file.name));
      const response = await fetch(`${API_BASE}/api/contracts/${encodeURIComponent(token)}/clone`, {
        method: 'POST',
        body,
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = data.detail || {};
        console.error('Voice clone failed:', detail || data);
        setState((current) => ({
          ...current,
          status: detail.status || 'error',
          message: detail.message || detail.debug || data.message || 'Voice cloning failed. Please try again.',
        }));
        return;
      }
      setState((current) => ({
        ...current,
        status: data.status,
        message: data.requires_verification ? 'Voice created. ElevenLabs says verification is required before use.' : 'Voice clone created and saved.',
        voice_id: data.voice_id,
        custom_voice_id: data.custom_voice_id,
        clone_ready: false,
      }));
    } catch {
      setState((current) => ({ ...current, status: 'error', message: 'Voice cloning failed. Please try again.' }));
    } finally {
      setSubmitting(false);
    }
  };

  const unavailable = ['not_found', 'expired', 'revoked', 'error'].includes(state.status);
  const needsSignature = state.status === 'draft' || state.status === 'unsigned';
  const complete = state.status === 'ready' || state.status === 'requires_verification' || state.status === 'cloned';
  const canClone = state.clone_ready && samples.length > 0 && voiceName.trim() && !submitting && !isRecording;
  const canContinue = step === 0 ? voiceName.trim() : step === 1 ? samples.length > 0 && !isRecording : canClone;

  const handleNext = () => {
    if (!canContinue) return;
    if (step < cloneSteps.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    handleClone();
  };

  return (
    <main className="voice-clone-page">
      <section className="voice-clone-panel" aria-live="polite">
        <div className="voice-clone-icon">
          {state.loading ? <LoaderCircle className="voice-clone-spin" size={30} /> : complete ? <CheckCircle2 size={31} /> : unavailable || needsSignature ? <CircleAlert size={31} /> : <Mic size={31} />}
        </div>

        {state.loading ? (
          <>
            <h1>Loading clone session</h1>
            <p>Checking the signed agreement.</p>
          </>
        ) : unavailable ? (
          <>
            <h1>Clone unavailable</h1>
            <p>{state.message || 'This clone link is no longer active.'}</p>
          </>
        ) : needsSignature ? (
          <>
            <h1>Agreement required</h1>
            <p>Sign the voice agreement before creating the clone.</p>
            <Link className="voice-clone-link" to={`/contract/${token}`}>Return to agreement</Link>
          </>
        ) : complete ? (
          <>
            <h1>Voice saved</h1>
            <p>{state.message || 'The custom voice information has been saved to Supabase.'}</p>
            {(state.voice_id || state.elevenlabs_voice_id) && <div className="voice-clone-result">ElevenLabs Voice ID: {state.voice_id || state.elevenlabs_voice_id}</div>}
          </>
        ) : (
          <>
            <div className="voice-clone-progress">
              <span>{cloneSteps[step].label} · {step + 1} of {cloneSteps.length}</span>
              <div><i style={{ width: `${((step + 1) / cloneSteps.length) * 100}%` }} /></div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={cloneSteps[step].id}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.18 }}
                className="voice-clone-slide"
              >
                <p className="voice-clone-eyebrow">Instant Voice Clone</p>
                <h1>{cloneSteps[step].title}</h1>

                {step === 0 && (
                  <>
                    <p className="voice-clone-copy">This is the name Nodemere will store for your AI receptionist voice.</p>
                    <label className="voice-clone-name">
                      Voice name
                      <input value={voiceName} onChange={(event) => setVoiceName(event.target.value)} />
                    </label>
                  </>
                )}

                {step === 1 && (
                  <>
                    <p className="voice-clone-copy">Use a quiet room. Speak naturally for 30 to 90 seconds. One clean sample is enough; a few samples are better.</p>
                    <div className="voice-clone-recorder">
                      <div className={`voice-clone-record-dot ${isRecording ? 'is-recording' : ''}`} />
                      <span>{isRecording ? formatTime(recordingSeconds) : `${samples.length}/${MAX_SAMPLES} samples`}</span>
                      <button type="button" onClick={isRecording ? stopRecording : startRecording} disabled={samples.length >= MAX_SAMPLES}>
                        {isRecording ? <Pause size={18} /> : <Mic size={18} />}
                        {isRecording ? 'Stop' : 'Record'}
                      </button>
                    </div>
                    <label className="voice-clone-upload">
                      <Upload size={18} />
                      Upload audio
                      <input type="file" accept="audio/*" multiple onChange={handleFileUpload} />
                    </label>
                    {samples.length > 0 && (
                      <div className="voice-clone-samples">
                        {samples.map((sample) => (
                          <div className="voice-clone-sample" key={sample.id}>
                            <audio controls src={sample.url} />
                            <button type="button" onClick={() => removeSample(sample.id)} aria-label={`Remove ${sample.name}`}><X size={16} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {step === 2 && (
                  <>
                    <p className="voice-clone-copy">Review the sample count and create the ElevenLabs instant voice clone.</p>
                    <div className="voice-clone-summary">
                      <span>Voice</span><strong>{voiceName}</strong>
                      <span>Samples</span><strong>{samples.length}</strong>
                    </div>
                    <label className="voice-clone-toggle">
                      <input type="checkbox" checked={removeNoise} onChange={(event) => setRemoveNoise(event.target.checked)} />
                      Remove background noise
                    </label>
                  </>
                )}

                {state.message && <p className="voice-clone-error">{state.message}</p>}
              </motion.div>
            </AnimatePresence>

            <div className="voice-clone-nav">
              <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || submitting || isRecording}>
                <ChevronLeft size={17} /> Back
              </button>
              <button type="button" onClick={handleNext} disabled={!canContinue}>
                {submitting ? <LoaderCircle className="voice-clone-spin" size={18} /> : step === cloneSteps.length - 1 ? <Wand2 size={18} /> : <ChevronRight size={18} />}
                {submitting ? 'Creating voice' : step === cloneSteps.length - 1 ? 'Create voice clone' : 'Continue'}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default VoiceClonePage;
