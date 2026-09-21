import { useEffect, useRef, useState } from 'react';

export default function useAudition(previews) {
  const audio = useRef(null), context = useRef(null), analyser = useRef(null), frame = useRef(0);
  const level = useRef(0);
  const playRequest = useRef(0);
  const [playing, setPlaying] = useState(null), [progress, setProgress] = useState(0), [error, setError] = useState('');
  const [tracks, setTracks] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const urls = [];
    const decode = async () => {
      const next = await Promise.all(previews.map(async preview => {
        const binary = atob(preview.audio_base_64);
        const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: preview.media_type || 'audio/mpeg' })); urls.push(url);
        let peaks = [];
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          context.current ||= new AudioContext();
          const buffer = await context.current.decodeAudioData(bytes.buffer.slice(0));
          const data = buffer.getChannelData(0), count = 90;
          peaks = Array.from({ length: count }, (_, index) => {
            const start = Math.floor(index * data.length / count), end = Math.floor((index + 1) * data.length / count);
            let peak = 0; for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(data[i]));
            return peak;
          });
        } catch { /* Audio still plays when waveform decoding is unavailable. */ }
        return { ...preview, url, peaks };
      }));
      if (!cancelled) setTracks(next);
    };
    audio.current?.pause(); setPlaying(null); setProgress(0); level.current=0;
    decode().catch(() => { if (!cancelled) setError('This preview could not be decoded. Generate another audition.'); });
    return () => { playRequest.current++; cancelled = true; audio.current?.pause(); cancelAnimationFrame(frame.current); level.current=0; urls.forEach(URL.revokeObjectURL); };
  }, [previews]);
  useEffect(() => () => { audio.current?.pause(); context.current?.close(); context.current=null; audio.current=null; analyser.current=null; cancelAnimationFrame(frame.current); }, []);
  const stop = () => { playRequest.current++; audio.current?.pause(); setPlaying(null); level.current=0; cancelAnimationFrame(frame.current); };
  const play = async track => {
    if (playing === track.generated_voice_id) { stop(); return; }
    stop(); setError(''); setProgress(0);
    const request = playRequest.current;
    try {
      if (!audio.current) {
        audio.current = new Audio();
        if (context.current) {
          analyser.current = context.current.createAnalyser(); analyser.current.fftSize=256;
          context.current.createMediaElementSource(audio.current).connect(analyser.current);
          analyser.current.connect(context.current.destination);
        }
      }
      audio.current.src = track.url;
      audio.current.onended = stop;
      audio.current.onerror = () => { stop(); setError('Playback failed. Try this audition again.'); };
      await context.current?.resume();
      if(request!==playRequest.current)return;
      await audio.current.play();
      if(request!==playRequest.current)return;
      setPlaying(track.generated_voice_id);
      const data = new Uint8Array(128);
      let lastProgress=0;
      const tick = now => {
        if(request!==playRequest.current)return;
        if (analyser.current) { analyser.current.getByteFrequencyData(data); level.current=data.reduce((a,b)=>a+b,0)/data.length/255; }
        if(now-lastProgress>40){lastProgress=now;setProgress(audio.current.duration ? audio.current.currentTime/audio.current.duration : 0);}
        frame.current=requestAnimationFrame(tick);
      }; frame.current=requestAnimationFrame(tick);
    } catch { if(request===playRequest.current){stop(); setError('Playback could not start. Please try again.');} }
  };
  return { tracks, play, stop, playing, progress, error, level };
}
