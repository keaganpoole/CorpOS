import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  AudioLines,
  CheckCircle2,
  Clock,
  Frown,
  Meh,
  Phone,
  Search,
  SlidersHorizontal,
  Smile,
  Timer,
  XCircle,
} from 'lucide-react';
import receptionistAvatar from '../../assets/a1.png';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE_URL = window.sonar?.apiUrl || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
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
    className: 'bg-cyan-400/8 text-cyan-300',
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
  const safeSeconds = Number(seconds || 0);
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

function normalizeCall(row) {
  const status = titleize(row.status || row.call_successful || 'Unknown', 'Unknown');
  const purpose = titleize(row.outcome || row.call_successful || 'General');
  return {
    id: row.id,
    name: row.caller_name || 'Unknown Caller',
    phone: row.caller_phone || row.from_number || 'Unknown number',
    summary: row.summary || row.notes || 'No summary captured yet.',
    purpose,
    status,
    sentiment: sentimentFromCall(row),
    duration: row.duration_seconds || 0,
    time: row.started_at || row.event_timestamp || row.created_at,
    receptionist: row.receptionist_name || row.agent_name || 'Receptionist',
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

function StatusBadge({ status }) {
  const config = STATUS_STYLES[normalized(status)] || STATUS_STYLES.completed;
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold', config.className)}>
      <Icon size={11} />
      {status}
    </span>
  );
}

function CallCard({ call, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative w-full rounded-2xl px-4 py-4 text-left transition duration-200',
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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-bold text-white">{call.name}</h3>
            <StatusBadge status={call.status} />
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
    </button>
  );
}

function TranscriptBubble({ entry }) {
  const isReceptionist = entry.speaker === 'receptionist';
  return (
    <div className={cn('flex items-end gap-3', isReceptionist ? 'justify-end' : 'justify-start')}>
      {!isReceptionist && (
        <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-[11px] font-bold text-zinc-300">
          C
        </div>
      )}
      <div className={cn('max-w-[74%]', isReceptionist ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-[13px] leading-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]',
            isReceptionist
              ? 'rounded-br-md bg-cyan-400/10 text-cyan-50'
              : 'rounded-bl-md bg-white/[0.06] text-zinc-100'
          )}
        >
          {entry.text}
        </div>
        <p className={cn('mt-1 text-[10px] text-zinc-700', isReceptionist ? 'text-right' : 'text-left')}>{entry.offset}</p>
      </div>
      {isReceptionist && (
        <img
          src={receptionistAvatar}
          alt=""
          className="mb-1 h-8 w-8 shrink-0 rounded-full object-cover"
        />
      )}
    </div>
  );
}

function AudioStrip({ call }) {
  const hasAudio = Boolean(call.audioUrl);

  return (
    <div className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-white/[0.035] px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-zinc-300">
        <AudioLines size={17} />
      </div>
      {hasAudio ? (
        <audio className="h-9 w-full" controls src={call.audioUrl}>
          <track kind="captions" />
        </audio>
      ) : (
        <div className="min-w-0 flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-1/3 rounded-full bg-zinc-600" />
          </div>
          <p className="mt-2 text-[11px] font-medium text-zinc-600">Recording unavailable</p>
        </div>
      )}
    </div>
  );
}

export default function CallLogsPage() {
  const { session } = useAuth();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_OPTIONS[0]);
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS[0]);
  const [sentimentFilter, setSentimentFilter] = useState(SENTIMENT_OPTIONS[0]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCallLogs() {
      if (!session?.access_token) {
        setCalls([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${API_BASE_URL}/api/sonar/call-logs?limit=100`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (!response.ok) throw new Error(`Call logs request failed (${response.status})`);
        const data = await response.json();
        if (cancelled) return;
        const normalizedCalls = Array.isArray(data) ? data.map(normalizeCall) : [];
        setCalls(normalizedCalls);
        setSelectedId((current) => current || normalizedCalls[0]?.id || null);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load call logs.');
          setCalls([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCallLogs();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const categoryOptions = useMemo(() => (
    [CATEGORY_OPTIONS[0], ...Array.from(new Set(calls.map((call) => call.purpose).filter(Boolean))).sort()]
  ), [calls]);

  const statusOptions = useMemo(() => (
    [STATUS_OPTIONS[0], ...Array.from(new Set(calls.map((call) => call.status).filter(Boolean))).sort()]
  ), [calls]);

  const filteredCalls = useMemo(() => {
    const query = normalized(searchQuery);
    return calls.filter((call) => {
      const matchesSearch = !query || [call.name, call.phone, call.summary, call.purpose, call.status]
        .some((value) => normalized(value).includes(query));
      const matchesCategory = categoryFilter === CATEGORY_OPTIONS[0] || call.purpose === categoryFilter;
      const matchesStatus = statusFilter === STATUS_OPTIONS[0] || call.status === statusFilter;
      const matchesSentiment = sentimentFilter === SENTIMENT_OPTIONS[0] || call.sentiment === sentimentFilter;
      return matchesSearch && matchesCategory && matchesStatus && matchesSentiment;
    });
  }, [calls, categoryFilter, searchQuery, sentimentFilter, statusFilter]);

  const selectedCall = filteredCalls.find((call) => call.id === selectedId) || filteredCalls[0] || null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#020202] text-zinc-100">
      <div className="shrink-0 border-b border-white/[0.05] px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/8 text-cyan-300">
              <Phone size={21} />
            </div>
            <div>
              <h2 className="text-[28px] font-black leading-none text-white">Call Logs</h2>
              <p className="mt-1 text-[12px] font-medium text-zinc-600">{loading ? 'Loading calls' : `${calls.length} recent calls`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-zinc-500">
            <SlidersHorizontal size={14} />
            <span>{filteredCalls.length} showing</span>
          </div>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-white/[0.05] xl:border-b-0 xl:border-r xl:border-white/[0.05]">
          <div className="shrink-0 space-y-3 bg-[#020202]/95 p-4">
            <label className="relative block">
              <span className="sr-only">Search call logs</span>
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search calls"
                className="h-11 w-full rounded-lg bg-white/[0.045] pl-10 pr-4 text-[13px] text-white outline-none transition placeholder:text-zinc-700 hover:bg-white/[0.06] focus:bg-white/[0.07]"
              />
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <FilterSelect label="Category" value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} />
              <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
              <FilterSelect label="Sentiment" value={sentimentFilter} onChange={setSentimentFilter} options={SENTIMENT_OPTIONS} />
            </div>
          </div>

          <div className="custom-scrollbar min-h-[320px] flex-1 overflow-y-auto px-3 py-2">
            {loading && (
              <div className="p-6 text-center">
                <p className="text-[13px] font-semibold text-zinc-300">Loading call logs</p>
              </div>
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
                  onClick={() => setSelectedId(call.id)}
                />
              </div>
            ))}
            {!loading && !error && filteredCalls.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-[13px] font-semibold text-zinc-300">No calls found</p>
                <p className="mt-2 text-[12px] text-zinc-600">{calls.length ? 'Adjust the filters or search another caller.' : 'New ElevenLabs post-call webhooks will appear here.'}</p>
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {selectedCall ? (
            <>
          <div className="shrink-0 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[24px] font-black leading-none text-white">{selectedCall.name}</h3>
                  <StatusBadge status={selectedCall.status} />
                  <span className="rounded-full bg-white/[0.045] px-2 py-1 text-[11px] text-zinc-300">{selectedCall.purpose}</span>
                  <SentimentIcon sentiment={selectedCall.sentiment} compact />
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
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-6 sm:px-7">
            <motion.div
              key={selectedCall.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
              className="mx-auto flex max-w-[860px] flex-col gap-4"
            >
              {selectedCall.transcript.length > 0 ? (
                selectedCall.transcript.map((entry, index) => (
                  <TranscriptBubble key={`${selectedCall.id}-${index}`} entry={entry} />
                ))
              ) : (
                <div className="rounded-2xl bg-white/[0.03] p-8 text-center">
                  <p className="text-[13px] font-semibold text-zinc-300">No transcript captured</p>
                  <p className="mt-2 text-[12px] text-zinc-600">The caller disconnected before a conversation was recorded.</p>
                </div>
              )}
            </motion.div>
          </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <p className="text-[14px] font-semibold text-zinc-300">No conversation selected</p>
                <p className="mt-2 text-[12px] text-zinc-600">Completed calls will show their transcript here.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
