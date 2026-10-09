import { useCallback, useEffect, useRef } from 'react';

// Measure the actual microphone waveform. The SDK's frequency-bin average is
// not a loudness measurement and can stay high for quiet background noise.
export default function useIntercomMicrophone() {
  const meterRef = useRef(null);
  const generationRef = useRef(0);
  const stop = useCallback(() => {
    generationRef.current += 1;
    const meter = meterRef.current;
    meterRef.current = null;
    if (!meter) return;
    meter.source.disconnect();
    meter.stream.getTracks().forEach((track) => track.stop());
    meter.context.close().catch(() => {});
  }, []);

  const start = useCallback(async () => {
    stop();
    const generation = generationRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
    });
    if (generation !== generationRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('Microphone setup was cancelled.');
    }
    let context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      meterRef.current = { stream, context, source, analyser, samples: new Float32Array(analyser.fftSize) };
      await context.resume();
      if (generation !== generationRef.current) throw new Error('Microphone setup was cancelled.');
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      if (context && context.state !== 'closed') context.close().catch(() => {});
      if (generation === generationRef.current) stop();
      throw error;
    }
  }, [stop]);

  const sample = useCallback(() => {
    const meter = meterRef.current;
    const track = meter?.stream.getAudioTracks()[0];
    if (!track || track.readyState !== 'live' || !track.enabled || track.muted || meter.context.state !== 'running') {
      return { available: false, level: 0 };
    }
    meter.analyser.getFloatTimeDomainData(meter.samples);
    let sum = 0;
    let mean = 0;
    for (const value of meter.samples) { sum += value * value; mean += value; }
    mean /= meter.samples.length;
    const rms = Math.sqrt(Math.max(0, sum / meter.samples.length - mean * mean));
    return { available: true, level: Number.isFinite(rms) ? rms : 0 };
  }, []);

  const setMuted = useCallback((muted) => {
    meterRef.current?.stream.getAudioTracks().forEach((track) => { track.enabled = !muted; });
  }, []);

  useEffect(() => stop, [stop]);
  return { start, stop, sample, setMuted };
}
