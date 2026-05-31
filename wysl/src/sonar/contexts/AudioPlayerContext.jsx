import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, Pause, Play, X } from 'lucide-react';

const AudioPlayerContext = createContext(null);

const formatDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
};

export const AudioPlayerProvider = ({ children }) => {
  const audioRef = useRef(null);
  const [track, setTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const playTrack = async (nextTrack) => {
    if (!nextTrack?.src) return;
    const audio = audioRef.current;
    if (!audio) return;

    const isSameTrack = track?.id === nextTrack.id && track?.src === nextTrack.src;
    if (!isSameTrack) {
      setTrack(nextTrack);
      setCurrentTime(0);
      setDuration(nextTrack.duration || 0);
      audio.src = nextTrack.src;
      audio.currentTime = 0;
    }

    try {
      await audio.play();
    } catch (error) {
      console.error('[AudioPlayer] Playback failed:', error);
    }
  };

  const toggleTrack = async (nextTrack) => {
    const audio = audioRef.current;
    if (!audio || !nextTrack?.src) return;
    const isSameTrack = track?.id === nextTrack.id && track?.src === nextTrack.src;
    if (!isSameTrack) {
      await playTrack(nextTrack);
      return;
    }
    if (audio.paused) {
      await playTrack(nextTrack);
    } else {
      audio.pause();
    }
  };

  const seek = (nextTime) => {
    const audio = audioRef.current;
    if (!audio) return;
    const boundedTime = Math.max(0, Math.min(Number(nextTime) || 0, duration || audio.duration || 0));
    audio.currentTime = boundedTime;
    setCurrentTime(boundedTime);
  };

  const stop = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  const value = useMemo(() => ({
    track,
    isPlaying,
    currentTime,
    duration,
    playTrack,
    toggleTrack,
    seek,
    stop,
  }), [track, isPlaying, currentTime, duration]);

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || track?.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
      >
        <track kind="captions" />
      </audio>
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) throw new Error('useAudioPlayer must be used inside AudioPlayerProvider');
  return context;
};

export const PersistentAudioPlayer = () => {
  const { track, isPlaying, currentTime, duration, toggleTrack, seek, stop } = useAudioPlayer();
  if (!track) return null;

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div className="fixed bottom-5 left-4 right-4 z-[80] rounded-2xl border border-white/[0.08] bg-[#080808]/95 px-4 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl xl:left-[264px] xl:right-[344px]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => toggleTrack(track)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-cyan-300 active:scale-95"
          aria-label={isPlaying ? 'Pause call recording' : 'Play call recording'}
        >
          {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex min-w-0 items-center gap-2">
            <AudioLines size={14} className="shrink-0 text-cyan-300" />
            <span className="truncate text-[12px] font-bold text-white">{track.title || 'Call recording'}</span>
            {track.subtitle && <span className="hidden truncate text-[11px] font-medium text-zinc-500 sm:block">{track.subtitle}</span>}
          </div>
          <button
            type="button"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const nextProgress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
              seek(nextProgress * duration);
            }}
            className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.09]"
            aria-label="Seek call recording"
          >
            <span className="absolute inset-y-0 left-0 rounded-full bg-zinc-100" style={{ width: `${Math.round(progress * 100)}%` }} />
          </button>
        </div>
        <div className="w-[82px] shrink-0 text-right text-[11px] font-medium tabular-nums text-zinc-500">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </div>
        <button
          type="button"
          onClick={stop}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
          aria-label="Close player"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
