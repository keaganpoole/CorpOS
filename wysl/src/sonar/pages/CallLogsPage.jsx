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
  Phone,
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

const API_BASE_URL = window.sonar?.apiUrl || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const AVATAR_BASE = 'https://jspksetkrprvomilgtyj.supabase.co/storage/v1/object/public/Employee%20Badges';
const STATUS_OPTIONS = ['All statuses'];
const CATEGORY_OPTIONS = ['All categories'];
const SENTIMENT_OPTIONS = ['All sentiment', 'Positive', 'Neutral', 'Negative'];

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

function formatCallTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
  if (['success', 'successful', 'completed', 'done'].includes(success) || ['completed', 'done', 'success'].includes(status)) {
    return 'Positive';
  }
  if (['failure', 'failed', 'unsuccessful'].includes(success) || ['failed', 'error'].includes(status)) {
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
    transcript: normalizeTranscript(row.transcript_jsonb, row.transcript_text),
    raw: row,
  };
}

function FilterSelect({ value, onChange, options, label }) {
  return (
    <label className="min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg bg-white/[0.045] px-3 text-[12px] font-medium text-zinc-300 outline-none transition [color-scheme:dark] hover:bg-white/[0.06] focus:bg-white/[0.07]"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-zinc-950 text-zinc-100">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
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

function DirectionIcon({ direction, compact = false, withLabel = false }) {
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
        <Icon size={compact ? 15 : 18} />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <span className={cn('inline-flex items-center justify-center shrink-0', className)}>
        <Icon size={15} />
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
    <div className="px-4 py-6">
      <div className="flex items-center gap-3 text-zinc-500">
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center text-zinc-300">
          <motion.div
            animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.96, 1.04, 0.96] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <AudioLines size={15} />
          </motion.div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-zinc-400">Loading call logs</p>
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((index) => (
              <motion.span
                key={index}
                className="h-1 w-1 rounded-full bg-cyan-300/60"
                animate={{ opacity: [0.25, 0.85, 0.25] }}
                transition={{ duration: 1, repeat: Infinity, delay: index * 0.16, ease: 'easeInOut' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CallCard({ call, selected, checked, onClick, onToggleSelect, onToggleFavorite, onDelete }) {
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
        'group relative w-full rounded-2xl py-4 pl-11 pr-11 text-left transition duration-200',
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
            <DirectionIcon direction={call.direction} compact />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-zinc-500">
            <Phone size={12} />
            <span>{call.phone}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/[0.045] px-2 py-1 text-[11px] text-zinc-300">{call.purpose}</span>
          <SentimentIcon sentiment={call.sentiment} compact />
        </div>
      </div>

      <p className="mt-4 line-clamp-2 text-[13px] leading-5 text-zinc-400">{call.summary}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.03] px-2 py-1">
          <Timer size={11} />
          {formatDuration(call.duration)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.03] px-2 py-1">
          <Clock size={11} />
          {formatCallTime(call.time)}
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-[11px] font-bold text-zinc-300">
          {initial}
        </div>
      )}
      <div className={cn('flex max-w-[74%] flex-col', isReceptionist ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-[13px] leading-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]',
            isReceptionist
              ? 'rounded-br-md bg-cyan-400/10 text-zinc-50'
              : 'rounded-bl-md bg-white/[0.06] text-zinc-100'
          )}
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-[11px] font-bold text-zinc-100">
          {initial}
        </div>
      )}
    </div>
  );
}

function AudioStrip({ call }) {
  const hasAudio = Boolean(call.audioUrl);
  const audioPlayer = useAudioPlayer();
  const track = {
    id: call.id,
    src: call.audioUrl,
    title: call.name || 'Call recording',
    subtitle: `${call.phone} - ${formatCallTime(call.time)}`,
    duration: call.duration || 0,
  };
  const isActiveTrack = audioPlayer.track?.id === call.id && audioPlayer.track?.src === call.audioUrl;
  const isPlaying = isActiveTrack && audioPlayer.isPlaying;
  const currentTime = isActiveTrack ? audioPlayer.currentTime : 0;
  const duration = isActiveTrack ? (audioPlayer.duration || call.duration || 0) : (call.duration || 0);

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const progressPercent = `${Math.round(progress * 100)}%`;
  const togglePlayback = async () => {
    if (!hasAudio) return;
    await audioPlayer.toggleTrack(track);
  };

  return (
    <div className="rounded-xl bg-white/[0.035] px-3 py-3">
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

export default function CallLogsPage() {
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
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_OPTIONS[0]);
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS[0]);
  const [sentimentFilter, setSentimentFilter] = useState(SENTIMENT_OPTIONS[0]);
  const [deleteTargetIds, setDeleteTargetIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const listScrollRef = useRef(null);
  const searchReadyRef = useRef(false);

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

  const categoryOptions = useMemo(() => (
    [CATEGORY_OPTIONS[0], ...Array.from(new Set(calls.map((call) => call.purpose).filter(Boolean))).sort()]
  ), [calls]);

  const statusOptions = useMemo(() => (
    [STATUS_OPTIONS[0], ...Array.from(new Set(calls.map((call) => call.status).filter(Boolean))).sort()]
  ), [calls]);

  const filteredCalls = useMemo(() => {
    const query = normalized(searchQuery);
    return calls.filter((call) => {
      const matchesSearch = !query || [call.name, call.phone, call.summary, call.purpose, call.status, call.receptionist, call.raw?.notes, call.raw?.agent_name]
        .some((value) => normalized(value).includes(query));
      const matchesCategory = categoryFilter === CATEGORY_OPTIONS[0] || call.purpose === categoryFilter;
      const matchesStatus = statusFilter === STATUS_OPTIONS[0] || call.status === statusFilter;
      const matchesSentiment = sentimentFilter === SENTIMENT_OPTIONS[0] || call.sentiment === sentimentFilter;
      return matchesSearch && matchesCategory && matchesStatus && matchesSentiment;
    }).sort((a, b) => {
      if (a.isFavorited !== b.isFavorited) return a.isFavorited ? -1 : 1;
      return new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime();
    });
  }, [calls, categoryFilter, searchQuery, sentimentFilter, statusFilter]);

  const selectedCall = filteredCalls.find((call) => call.id === selectedId) || filteredCalls[0] || null;
  const selectedDeleteCount = selectedForDelete.length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#020202] text-zinc-100">
      <div className="shrink-0 border-b border-white/[0.05] px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center brand-icon">
              <Phone size={21} />
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-white leading-none">Call Logs</h2>
              <p className="mt-1 text-[12px] font-medium text-zinc-600">{loading ? 'Loading calls' : `${calls.length}${hasMore ? '+' : ''} recent calls`}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)]">
        <aside className="relative flex min-h-0 flex-col border-b border-white/[0.05] after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-white/[0.05] xl:border-b-0 xl:border-r xl:border-white/[0.05]">
          <div className="shrink-0 space-y-3 bg-[#020202]/95 p-4">
            <label className="relative block">
              <span className="sr-only">Search call logs</span>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search calls"
                    className="h-11 w-full rounded-lg bg-white/[0.045] pl-10 pr-4 text-[13px] text-white outline-none transition placeholder:text-zinc-700 hover:bg-white/[0.06] focus:bg-white/[0.07]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => loadCallLogs({ force: true, searchQuery })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/[0.045] text-zinc-500 transition hover:bg-white/[0.06] hover:text-white active:scale-95"
                  aria-label="Refresh call logs"
                  title="Refresh call logs"
                >
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <FilterSelect label="Category" value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} />
              <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
              <FilterSelect label="Sentiment" value={sentimentFilter} onChange={setSentimentFilter} options={SENTIMENT_OPTIONS} />
            </div>
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

          <div ref={listScrollRef} onScroll={handleListScroll} className="custom-scrollbar min-h-[320px] flex-1 overflow-y-auto px-3 py-2">
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
          <div className="shrink-0 p-5 sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[24px] font-black leading-none text-white">{selectedCall.name}</h3>
                    <DirectionIcon direction={selectedCall.direction} withLabel />
                    <span className="inline-flex items-center gap-1.5">
                      <SentimentIcon sentiment={selectedCall.sentiment} compact />
                      <span className="rounded-full bg-white/[0.045] px-2 py-1 text-[11px] text-zinc-300">{selectedCall.purpose}</span>
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-zinc-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={13} />
                      {selectedCall.phone}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={13} />
                      {formatCallTime(selectedCall.time)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Timer size={13} />
                      {formatDuration(selectedCall.duration)}
                    </span>
                  </div>
                </div>
                <div className="w-full lg:w-[340px]">
                  <AudioStrip call={selectedCall} />
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
