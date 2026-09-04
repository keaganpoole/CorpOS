import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  AudioLines,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Frown,
  Meh,
  Play,
  Pause,
  RefreshCw,
  Search,
  Star,
  Square,
  Smile,
  Timer,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useCallLogs } from '../contexts/CallLogsContext';
import CubePreloader from '../components/CubePreloader';

const API_BASE_URL = window.sonar?.apiUrl || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const AVATAR_BASE = 'https://jspksetkrprvomilgtyj.supabase.co/storage/v1/object/public/Employee%20Badges';
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const weekdayTimeFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const monthDayTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const monthDayYearTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const STATUS_STYLES = {
  completed: {
    icon: CheckCircle2,
    className: 'bg-emerald-400/8 text-emerald-300',
  },
  done: {
    icon: CheckCircle2,
    className: 'bg-emerald-400/8 text-emerald-300',
  },
  success: {
    icon: CheckCircle2,
    className: 'bg-emerald-400/8 text-emerald-300',
  },
  failed: {
    icon: XCircle,
    className: 'bg-rose-400/8 text-rose-300',
  },
  failure: {
    icon: XCircle,
    className: 'bg-rose-400/8 text-rose-300',
  },
  missed: {
    icon: AlertCircle,
    className: 'bg-amber-400/8 text-amber-300',
  },
  escalated: {
    icon: AlertCircle,
    className: 'bg-cyan-400/8 brand-icon',
  },
};

const SENTIMENT_STYLES = {
  positive: {
    icon: Smile,
    className: 'text-emerald-300 bg-emerald-400/8',
  },
  neutral: {
    icon: Meh,
    className: 'text-zinc-300 bg-white/[0.04]',
  },
  negative: {
    icon: Frown,
    className: 'text-rose-300 bg-rose-400/8',
  },
};

const cn = (...classes) => classes.filter(Boolean).join(' ');

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatCallTime(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  const safeNow = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const diffMs = safeNow.getTime() - date.getTime();
  if (diffMs < MINUTE_MS) return 'Just now';

  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (diffMs < 12 * HOUR_MS) {
    const hours = Math.floor(diffMs / HOUR_MS);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const today = startOfLocalDay(safeNow);
  const callDay = startOfLocalDay(date);
  const dayDiff = Math.round((today.getTime() - callDay.getTime()) / DAY_MS);
  const timeText = timeFormatter.format(date);

  if (dayDiff === 0) return `Today at ${timeText}`;
  if (dayDiff === 1) return `Yesterday at ${timeText}`;
  if (dayDiff > 1 && dayDiff < 7) return weekdayTimeFormatter.format(date).replace(',', ' at');
  if (date.getFullYear() === safeNow.getFullYear()) return monthDayTimeFormatter.format(date).replace(',', ' at');
  return monthDayYearTimeFormatter.format(date).replace(/, (\d{4}),/, ', $1 at');
}

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function titleize(value, fallback = 'General') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sentimentFromCall(call) {
  const success = normalized(call.call_successful);
  const status = normalized(call.status);
  if (['true', 'yes', 'success', 'successful', 'completed', 'done'].includes(success) || ['completed', 'done', 'success', 'successful'].includes(status)) {
    return 'Positive';
  }
  if (['false', 'no', 'failure', 'failed', 'unsuccessful'].includes(success) || ['failed', 'failure', 'error', 'unsuccessful'].includes(status)) {
    return 'Negative';
  }
  return 'Neutral';
}

function directionFromCall(call) {
  const agentName = normalized(call.agent_name || call.raw?.agent_name);
  if (agentName.includes('outbound')) return 'outbound';
  if (agentName.includes('inbound')) return 'inbound';

  const raw = normalized(
    call.direction
    || call.raw?.direction
    || call.raw?.conversation_metadata?.phone_call?.direction
    || call.raw?.conversation_initiation_data?.dynamic_variables?.direction
    || call.raw?.conversation_initiation_data?.dynamic_variables?.call_direction
  );
  if (raw.includes('out')) return 'outbound';
  if (raw.includes('in')) return 'inbound';
  return 'unknown';
}

function transcriptOffset(seconds) {
  if (seconds === null || seconds === undefined || seconds === '') return '';
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function transcriptFromText(text) {
  if (!text) return [];
  return String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [speaker, ...rest] = line.split(':');
      const hasSpeaker = rest.length > 0;
      const speakerValue = hasSpeaker ? speaker : 'caller';
      return {
        speaker: normalized(speakerValue).includes('agent') || normalized(speakerValue).includes('receptionist') ? 'receptionist' : 'customer',
        text: hasSpeaker ? rest.join(':').trim() : line,
        offset: '',
      };
    });
}

function normalizeTranscript(turns, fallbackText) {
  if (!Array.isArray(turns) || turns.length === 0) return transcriptFromText(fallbackText);
  return turns
    .map((turn) => {
      const role = normalized(turn.role || turn.speaker);
      const text = String(turn.message || turn.text || turn.content || '').trim();
      if (!text) return null;
      return {
        speaker: role === 'agent' || role === 'assistant' || role === 'receptionist' ? 'receptionist' : 'customer',
        text,
        offset: transcriptOffset(turn.time_in_call_secs),
      };
    })
    .filter(Boolean);
}

export function normalizeCall(row) {
  const purpose = titleize(row.outcome || row.call_successful || 'General');
  const receptionistName = row.receptionist_name || row.agent_name || 'Receptionist';
  const avatarName = normalized(receptionistName);
  return {
    id: row.id,
    name: row.caller_name || 'Unknown Caller',
    phone: row.caller_phone || row.from_number || 'Unknown number',
    summary: row.summary || row.notes || 'No summary captured yet.',
    purpose,
    status: titleize(row.status || row.call_successful || 'Unknown', 'Unknown'),
    sentiment: sentimentFromCall(row),
    direction: directionFromCall(row),
    duration: row.duration_seconds || 0,
    time: row.started_at || row.event_timestamp || row.created_at,
    receptionist: receptionistName,
    receptionistAvatar: row.receptionist_avatar || (avatarName && avatarName !== 'receptionist' ? `${AVATAR_BASE}/${avatarName}.jpg` : ''),
    isFavorited: Boolean(row.is_favorited),
    audioUrl: row.audio_url || '',
    hasAudio: Boolean(row.has_audio),
    transcript: normalizeTranscript(row.transcript_jsonb, row.transcript_text),
    raw: row,
  };
}

function SentimentIcon({ sentiment, compact = false }) {
  const config = SENTIMENT_STYLES[normalized(sentiment)] || SENTIMENT_STYLES.neutral;
  const Icon = config.icon;
  return (
    <div className={cn('flex items-center justify-center rounded-full', compact ? 'h-8 w-8' : 'h-10 w-10', config.className)}>
      <Icon size={compact ? 15 : 18} />
    </div>
  );
}

function DirectionIcon({ direction, compact = false, withLabel = false, gradient = false }) {
  const normalizedDirection = normalized(direction);
  const isOutbound = normalizedDirection === 'outbound';
  const isInbound = normalizedDirection === 'inbound';
  const Icon = isOutbound ? ArrowUpRight : ArrowDownLeft;
  const label = isOutbound ? 'Outbound' : isInbound ? 'Inbound' : 'Unknown';
  const className = isOutbound
    ? 'text-zinc-200'
    : isInbound
      ? 'text-zinc-200'
      : 'text-zinc-400';

  if (!withLabel) {
    return (
      <span className={cn('inline-flex items-center justify-center shrink-0 align-middle', className)}>
        <Icon size={compact ? 15 : 18} style={gradient ? { stroke: 'url(#callLogsArrowGradient)' } : undefined} />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <span className={cn('inline-flex items-center justify-center shrink-0', className)}>
        <Icon size={15} style={gradient ? { stroke: 'url(#callLogsArrowGradient)' } : undefined} />
      </span>
      <span className="text-[12px] font-medium text-zinc-400">{label}</span>
    </span>
  );
}

function SelectionToggle({ checked, visible, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full bg-[#090909]/88 text-zinc-400 transition duration-200',
        checked ? 'opacity-100 text-white' : visible ? 'opacity-100 hover:text-zinc-100' : 'pointer-events-none opacity-0'
      )}
    >
      {checked ? <Check size={13} /> : <Square size={12} />}
    </button>
  );
}

function DeleteConfirmModal({ count, onCancel, onConfirm, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#080808] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-zinc-100">
          <Trash2 size={18} />
        </div>
        <h3 className="mt-5 text-[22px] font-black text-white">Delete conversation{count > 1 ? 's' : ''}</h3>
        <p className="mt-2 text-[13px] leading-6 text-zinc-400">
          {count > 1 ? `Delete ${count} selected conversations?` : 'Delete this conversation?'} This cannot be undone.
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-xl bg-white/[0.045] px-4 text-[13px] font-semibold text-zinc-300 transition hover:bg-white/[0.07]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="h-11 rounded-xl bg-white px-4 text-[13px] font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CallLogsLoader() {
  return (
    <div className="flex min-h-[320px] items-center justify-center px-4 py-6">
      <CubePreloader size={18} />
    </div>
  );
}

function CallCard({ call, selected, checked, onClick, onToggleSelect, onToggleFavorite, onDelete, now }) {
  return (
    <div
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        'group relative w-full rounded-2xl py-3 pl-11 pr-11 text-left transition duration-200',
        selected
          ? 'bg-transparent'
          : 'bg-transparent hover:bg-white/[0.025]'
      )}
    >
      {selected && (
        <motion.span
          layoutId="call-log-active-rail"
          className="absolute bottom-3 left-0 top-3 w-px rounded-full bg-white/90"
          transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        aria-label="Delete conversation"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(call.id);
        }}
        className="absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#090909]/88 text-zinc-400 opacity-0 transition duration-200 hover:text-zinc-100 group-hover:opacity-100"
      >
        <X size={13} />
      </button>
      <button
        type="button"
        aria-label={call.isFavorited ? 'Remove favorite' : 'Favorite conversation'}
        aria-pressed={call.isFavorited}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite(call.id);
        }}
        className={cn(
          'absolute right-3 top-10 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#090909]/88 transition duration-200',
          call.isFavorited
            ? 'text-amber-300 opacity-100'
            : 'text-zinc-500 opacity-0 hover:text-amber-200 group-hover:opacity-100'
        )}
      >
        {call.isFavorited && (
          <motion.span
            key={`${call.id}-favorite-glow`}
            className="absolute inset-0 rounded-full bg-amber-300/15"
            initial={{ scale: 0.65, opacity: 0 }}
            animate={{ scale: 1.7, opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            aria-hidden="true"
          />
        )}
        <motion.span
          animate={call.isFavorited ? { scale: [1, 1.28, 1], rotate: [0, -10, 0] } : { scale: 1, rotate: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          className="relative z-10 inline-flex"
        >
          <Star size={13} fill={call.isFavorited ? 'currentColor' : 'none'} />
        </motion.span>
      </button>
      <div className={cn('absolute left-3 top-3 z-10 transition duration-200', checked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
        <SelectionToggle
          checked={checked}
          visible
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect(call.id);
          }}
          label={checked ? 'Deselect conversation' : 'Select conversation'}
        />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-bold text-white">{call.name}</h3>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-zinc-500">
            <DirectionIcon direction={call.direction} compact gradient />
            <span className="font-medium text-zinc-400">{call.phone}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SentimentIcon sentiment={call.sentiment} compact />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.03] px-2 py-1">
          <Timer size={11} />
          {formatDuration(call.duration)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.03] px-2 py-1">
          <Clock size={11} />
          {formatCallTime(call.time, now)}
        </span>
      </div>
    </div>
  );
}

function TranscriptBubble({ entry, receptionistAvatar, receptionistName, customerName }) {
  const isReceptionist = entry.speaker === 'receptionist';
  const [avatarFailed, setAvatarFailed] = useState(false);
  const speakerName = isReceptionist ? receptionistName : customerName;
  const fallbackInitial = isReceptionist ? 'R' : 'C';
  const initial = String(speakerName || fallbackInitial).trim().charAt(0).toUpperCase() || fallbackInitial;

  useEffect(() => {
    setAvatarFailed(false);
  }, [receptionistAvatar]);

  return (
    <div className={cn('flex items-center gap-3', isReceptionist ? 'justify-end' : 'justify-start')}>
      {!isReceptionist && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-zinc-800 text-[11px] font-bold text-zinc-300">
          {initial}
        </div>
      )}
      <div className={cn('flex max-w-[74%] flex-col', isReceptionist ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-[13px] leading-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]',
            isReceptionist
              ? 'rounded-br-md text-white'
              : 'rounded-bl-md text-white'
          )}
          style={{ backgroundColor: isReceptionist ? '#007AFF' : '#2C2C2E' }}
        >
          {entry.text}
        </div>
        <div className={cn('mt-1 flex max-w-full items-center gap-1.5 text-[10px]', isReceptionist ? 'justify-end text-right' : 'justify-start text-left')}>
          <span className="truncate font-semibold text-zinc-500">{speakerName || (isReceptionist ? 'Receptionist' : 'Caller')}</span>
          {entry.offset && (
            <>
              <span className="text-zinc-800">•</span>
              <span className="shrink-0 text-zinc-700">{entry.offset}</span>
            </>
          )}
        </div>
      </div>
      {isReceptionist && receptionistAvatar && !avatarFailed && (
        <img
          src={receptionistAvatar}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover"
          onError={() => setAvatarFailed(true)}
        />
      )}
      {isReceptionist && (!receptionistAvatar || avatarFailed) && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-zinc-800 text-[11px] font-bold text-zinc-300">
          {initial}
        </div>
      )}
    </div>
  );
}

function AudioStrip({ call, now }) {
  const hasAudio = Boolean(call.hasAudio);
  const { session } = useAuth();
  const [playbackError, setPlaybackError] = useState('');
  const audioPlayer = useAudioPlayer();
  const track = {
    id: call.id,
    src: call.audioUrl,
    title: call.name || 'Call recording',
    subtitle: `${call.phone} - ${formatCallTime(call.time, now)}`,
    duration: call.duration || 0,
  };
  const isActiveTrack = audioPlayer.track?.id === call.id;
  const isPlaying = isActiveTrack && audioPlayer.isPlaying;
  const currentTime = isActiveTrack ? audioPlayer.currentTime : 0;
  const duration = isActiveTrack ? (audioPlayer.duration || call.duration || 0) : (call.duration || 0);

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const progressPercent = `${Math.round(progress * 100)}%`;
  const togglePlayback = async () => {
    if (!hasAudio) return;
    setPlaybackError('');
    try {
      if (isActiveTrack) { await audioPlayer.toggleTrack(audioPlayer.track); return; }
      const response = await fetch(`${API_BASE_URL}/api/sonar/call-logs/${encodeURIComponent(call.id)}/playback`, { method:'POST', headers:{Authorization:`Bearer ${session.access_token}`} });
      if (!response.ok) throw new Error('Recording access failed. Verify your access and try again.');
      const result = await response.json();
      let source = result.url;
      if (result.requires_authorization) {
        // Relative, fixed-origin endpoint only. Do not forward JWTs to storage.
        const audioResponse = await fetch(`${API_BASE_URL}/api/sonar/call-logs/${encodeURIComponent(call.id)}/audio`, {headers:{Authorization:`Bearer ${session.access_token}`}});
        if (!audioResponse.ok) throw new Error('Recording access failed.');
        source = URL.createObjectURL(await audioResponse.blob());
      }
      await audioPlayer.toggleTrack({...track, src:source});
    } catch (error) { setPlaybackError(error.message); }
  };

  return (
    <div className="rounded-xl bg-white/[0.035] px-3 py-3">
      {playbackError && <p role="alert" className="mb-2 text-xs text-red-300">{playbackError}</p>}
      {hasAudio ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlayback}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.09] text-zinc-100 transition hover:bg-white/[0.14] active:scale-95"
            aria-label={isPlaying ? 'Pause call recording' : 'Play call recording'}
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(event) => {
                  if (!duration) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const nextProgress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
                  if (!isActiveTrack) {
                    audioPlayer.playTrack(track).then(() => audioPlayer.seek(nextProgress * duration));
                    return;
                  }
                  audioPlayer.seek(nextProgress * duration);
                }}
                className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08]"
                aria-label="Seek call recording"
              >
                <span className="absolute inset-y-0 left-0 rounded-full bg-zinc-200 transition-[width]" style={{ width: progressPercent }} />
              </button>
              <div className="w-[76px] text-right text-[11px] font-medium tabular-nums text-zinc-500">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-zinc-600">
            <AudioLines size={14} />
          </div>
          <div className="h-1.5 min-w-0 flex-1 rounded-full bg-white/[0.06]" />
          <div className="w-[76px] text-right text-[11px] font-medium tabular-nums text-zinc-700">
            {formatDuration(call.duration || 0)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CallLogsPage({ onToolbarMetaChange = null }) {
  const { session } = useAuth();
  const {
    calls,
    setCalls,
    loading,
    error,
    setError,
    selectedId,
    setSelectedId,
    selectedForDelete,
    setSelectedForDelete,
    loadCallLogs,
    loadingMore,
    hasMore,
  } = useCallLogs();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeNow, setTimeNow] = useState(() => new Date());
  const [deleteTargetIds, setDeleteTargetIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const listScrollRef = useRef(null);
  const searchReadyRef = useRef(false);

  useEffect(() => {
    onToolbarMetaChange?.({ count: calls.length, loading });
  }, [calls.length, loading, onToolbarMetaChange]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setTimeNow(new Date()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!searchReadyRef.current) {
      searchReadyRef.current = true;
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      loadCallLogs({ force: true, searchQuery });
    }, 280);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const handleListScroll = () => {
    const element = listScrollRef.current;
    if (!element || loading || loadingMore || !hasMore) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 180) {
      loadCallLogs({ append: true, searchQuery });
    }
  };

  const toggleSelectCall = (callId) => {
    setSelectedForDelete((current) => (
      current.includes(callId)
        ? current.filter((id) => id !== callId)
        : [...current, callId]
    ));
  };

  const openDeleteModal = (ids) => {
    const normalizedIds = ids.filter(Boolean);
    if (!normalizedIds.length) return;
    setDeleteTargetIds(normalizedIds);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTargetIds([]);
  };

  const handleDeleteCalls = async () => {
    if (!deleteTargetIds.length || !session?.access_token) return;
    setDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/sonar/call-logs/delete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: deleteTargetIds }),
      });
      if (!response.ok) throw new Error(`Delete request failed (${response.status})`);
      const data = await response.json();
      const deletedIds = Array.isArray(data.deleted_ids) ? data.deleted_ids : deleteTargetIds;
      let nextSelectedId = null;
      setCalls((current) => {
        const remaining = current.filter((call) => !deletedIds.includes(call.id));
        nextSelectedId = remaining[0]?.id || null;
        return remaining;
      });
      setSelectedForDelete((current) => current.filter((id) => !deletedIds.includes(id)));
      setSelectedId((current) => (
        deletedIds.includes(current)
          ? nextSelectedId
          : current
      ));
      setDeleteTargetIds([]);
      loadCallLogs();
    } catch (err) {
      setError(err.message || 'Failed to delete call logs.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleFavorite = async (callId) => {
    if (!session?.access_token) return;
    const target = calls.find((call) => call.id === callId);
    if (!target) return;

    const nextValue = !target.isFavorited;
    setCalls((current) => current.map((call) => (
      call.id === callId ? { ...call, isFavorited: nextValue } : call
    )));

    try {
      const response = await fetch(`${API_BASE_URL}/api/sonar/call-logs/${callId}/favorite`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_favorited: nextValue }),
      });
      if (!response.ok) throw new Error(`Favorite request failed (${response.status})`);
    } catch (err) {
      setCalls((current) => current.map((call) => (
        call.id === callId ? { ...call, isFavorited: target.isFavorited } : call
      )));
      setError(err.message || 'Failed to update favorite.');
    }
  };

  const filteredCalls = useMemo(() => {
    const query = normalized(searchQuery);
    return calls.filter((call) => {
      const matchesSearch = !query || [call.name, call.phone, call.summary, call.purpose, call.status, call.receptionist, call.raw?.notes, call.raw?.agent_name]
        .some((value) => normalized(value).includes(query));
      return matchesSearch;
    }).sort((a, b) => {
      if (a.isFavorited !== b.isFavorited) return a.isFavorited ? -1 : 1;
      return new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime();
    });
  }, [calls, searchQuery]);

  const selectedBaseCall = filteredCalls.find((call) => call.id === selectedId) || filteredCalls[0] || null;
  const [callDetails, setCallDetails] = useState(null);
  useEffect(() => {
    setCallDetails(null);
    if (!selectedBaseCall?.id || !session?.access_token) return undefined;
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/sonar/call-logs/${encodeURIComponent(selectedBaseCall.id)}/details`, {
      headers:{ Authorization:`Bearer ${session.access_token}` }, signal:controller.signal,
    }).then(async response => { if (!response.ok) throw new Error('Could not load call details'); return response.json(); })
      .then(setCallDetails).catch(error => { if (error.name !== 'AbortError') setError(error.message); });
    return () => controller.abort();
  }, [selectedBaseCall?.id, session?.access_token]);
  const selectedCall = selectedBaseCall && callDetails?.id === selectedBaseCall.id
    ? {...selectedBaseCall, transcript:normalizeTranscript(callDetails.transcript_jsonb,callDetails.transcript_text), raw:{...selectedBaseCall.raw,...callDetails}}
    : selectedBaseCall;
  const selectedDeleteCount = selectedForDelete.length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#020202] text-zinc-100">
      <svg width="0" height="0" className="pointer-events-none absolute" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="callLogsArrowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brandGradientStart)" />
            <stop offset="100%" stopColor="var(--brandGradientEnd)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)]">
        <aside className="relative flex min-h-0 flex-col border-b border-white/[0.05] bg-white/[0.02] after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-white/[0.05] xl:border-b-0 xl:border-r xl:border-white/[0.05]">
          <div className="shrink-0 space-y-3 bg-transparent px-4 pb-3 pt-8">
            <label className="relative block">
              <span className="sr-only">Search call logs</span>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search calls"
                    className="w-full rounded-md border border-white/[0.06] bg-white/[0.02] py-2 pl-9 pr-8 text-[12px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:!outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-700 transition-colors hover:text-white"
                      aria-label="Clear call log search"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedForDelete([]);
                    loadCallLogs({ force: true, searchQuery });
                  }}
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-zinc-500 transition-colors hover:border-white/[0.10] hover:bg-white/[0.035] hover:text-white active:scale-95"
                  aria-label="Refresh call logs"
                  title="Refresh call logs"
                >
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </label>
            {selectedDeleteCount > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-white/[0.035] px-3 py-2">
                <span className="text-[12px] font-medium text-zinc-400">{selectedDeleteCount} selected</span>
                <button
                  type="button"
                  onClick={() => openDeleteModal(selectedForDelete)}
                  className="inline-flex h-8 items-center gap-2 rounded-lg bg-white px-3 text-[12px] font-semibold text-black transition hover:bg-zinc-200"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            )}
          </div>

          <div ref={listScrollRef} onScroll={handleListScroll} className="custom-scrollbar min-h-[320px] flex-1 overflow-y-auto px-3 pb-2 pt-2">
            {loading && (
              <CallLogsLoader />
            )}
            {!loading && error && (
              <div className="p-6 text-center">
                <p className="text-[13px] font-semibold text-rose-300">{error}</p>
              </div>
            )}
            {!loading && !error && filteredCalls.map((call) => (
              <div key={call.id} className="border-b border-white/[0.04] last:border-b-0">
                <CallCard
                  call={call}
                  selected={selectedCall?.id === call.id}
                  checked={selectedForDelete.includes(call.id)}
                  onClick={() => {
                    if (selectedForDelete.length > 0) {
                      toggleSelectCall(call.id);
                      return;
                    }
                    setSelectedId(call.id);
                  }}
                  onToggleSelect={toggleSelectCall}
                  onToggleFavorite={handleToggleFavorite}
                  onDelete={(callId) => openDeleteModal([callId])}
                  now={timeNow}
                />
              </div>
            ))}
            {!loading && !error && loadingMore && (
              <div className="py-5 text-center">
                <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-700 animate-pulse">Loading more calls</span>
              </div>
            )}
            {!loading && !error && filteredCalls.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-[13px] font-semibold text-zinc-300">No calls found</p>
                <p className="mt-2 text-[12px] text-zinc-600">{calls.length ? 'Adjust the filters or search another caller.' : 'Call details will appear here.'}</p>
              </div>
            )}
          </div>
        </aside>

        <section className="relative flex min-h-0 flex-col after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-white/[0.05]">
          {selectedCall ? (
            <>
          <div className="shrink-0 px-5 pb-5 pt-8 sm:px-6 sm:pb-6 sm:pt-8">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[24px] font-black leading-none text-white">{selectedCall.name}</h3>
                    <span className="inline-flex items-center gap-1.5">
                      <SentimentIcon sentiment={selectedCall.sentiment} compact />
                      <span className="rounded-full bg-white/[0.045] px-2 py-1 text-[11px] text-zinc-300">{selectedCall.purpose}</span>
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-zinc-500">
                    <span className="inline-flex items-center gap-1.5">
                      <DirectionIcon direction={selectedCall.direction} compact gradient />
                      <span className="font-medium text-zinc-400">{selectedCall.phone}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={13} />
                      {formatCallTime(selectedCall.time, timeNow)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Timer size={13} />
                      {formatDuration(selectedCall.duration)}
                    </span>
                  </div>
                </div>
                <div className="w-full lg:w-[340px]">
                  <AudioStrip call={selectedCall} now={timeNow} />
                </div>
              </div>
              <div className="w-full">
                <p className="w-full text-[13px] leading-6 text-zinc-400">
                  {selectedCall.summary}
                </p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 px-4 pb-6 sm:px-7">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/[0.05] bg-white/[0.02]">
              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
                <motion.div
                  key={selectedCall.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24 }}
                  className="mx-auto flex max-w-[860px] flex-col gap-4"
                >
                  {selectedCall.transcript.length > 0 ? (
                    selectedCall.transcript.map((entry, index) => (
                      <TranscriptBubble
                        key={`${selectedCall.id}-${index}`}
                        entry={entry}
                        receptionistAvatar={selectedCall.receptionistAvatar}
                        receptionistName={selectedCall.receptionist}
                        customerName={selectedCall.name}
                      />
                    ))
                  ) : (
                    <div className="rounded-2xl bg-white/[0.03] p-8 text-center">
                      <p className="text-[13px] font-semibold text-zinc-300">No transcript captured</p>
                      <p className="mt-2 text-[12px] text-zinc-600">The caller disconnected before a conversation was recorded.</p>
                    </div>
                  )}
                </motion.div>
              </div>
            </div>
          </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <p className="text-[14px] font-semibold text-zinc-300">No conversation selected</p>
                <p className="mt-2 text-[12px] text-zinc-600">Calls transcripts will appear here.</p>
              </div>
            </div>
          )}
        </section>
      </div>
      {deleteTargetIds.length > 0 && (
        <DeleteConfirmModal
          count={deleteTargetIds.length}
          onCancel={closeDeleteModal}
          onConfirm={handleDeleteCalls}
          deleting={deleting}
        />
      )}
    </div>
  );
}
