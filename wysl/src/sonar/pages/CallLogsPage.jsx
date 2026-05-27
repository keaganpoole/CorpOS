import React, { useMemo, useState } from 'react';
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

const STATUS_OPTIONS = ['All statuses', 'Completed', 'Failed', 'Missed', 'Escalated'];
const CATEGORY_OPTIONS = ['All categories', 'Booking', 'Billing', 'Support', 'Reschedule', 'General'];
const SENTIMENT_OPTIONS = ['All sentiment', 'Positive', 'Neutral', 'Negative'];

const STATUS_STYLES = {
  completed: {
    icon: CheckCircle2,
    className: 'bg-emerald-400/8 text-emerald-300',
  },
  failed: {
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

const mockCallLogs = [
  {
    id: 'call-001',
    name: 'Mara Ellis',
    phone: '(617) 555-0188',
    summary: 'Booked a new patient cleaning and confirmed insurance details before ending the call.',
    purpose: 'Booking',
    status: 'Completed',
    sentiment: 'Positive',
    duration: 312,
    time: '2026-05-26T15:42:00-04:00',
    receptionist: 'Breezy',
    audioUrl: '',
    transcript: [
      { speaker: 'customer', text: 'Hi, I wanted to see if you have any appointments open this week for a cleaning.', offset: '0:04' },
      { speaker: 'receptionist', text: 'Absolutely. I can help with that. Are you a new or returning patient?', offset: '0:10' },
      { speaker: 'customer', text: 'New patient. I just moved nearby and found you online.', offset: '0:18' },
      { speaker: 'receptionist', text: 'Welcome to the area. I have Thursday at 10:30 AM or Friday at 2:00 PM. Which works better?', offset: '0:28' },
      { speaker: 'customer', text: 'Thursday morning would be perfect.', offset: '0:37' },
      { speaker: 'receptionist', text: 'You are set for Thursday at 10:30 AM. I also noted that you will bring your insurance card and ID.', offset: '0:48' },
    ],
  },
  {
    id: 'call-002',
    name: 'Caleb Brooks',
    phone: '(312) 555-0142',
    summary: 'Asked about an invoice balance and requested a callback from billing about duplicate charges.',
    purpose: 'Billing',
    status: 'Escalated',
    sentiment: 'Neutral',
    duration: 188,
    time: '2026-05-26T14:18:00-04:00',
    receptionist: 'Breezy',
    audioUrl: '',
    transcript: [
      { speaker: 'customer', text: 'I got two invoices that look almost identical. I need someone to check if I was charged twice.', offset: '0:03' },
      { speaker: 'receptionist', text: 'I can take the details and have billing review it. What is the invoice number on the first one?', offset: '0:13' },
      { speaker: 'customer', text: 'It is INV-2048. The second one ends in 2050.', offset: '0:25' },
      { speaker: 'receptionist', text: 'I have both noted. I will mark this for billing follow-up today and include your callback number.', offset: '0:38' },
    ],
  },
  {
    id: 'call-003',
    name: 'Priya Narang',
    phone: '(415) 555-0194',
    summary: 'Rescheduled a consultation after a conflict and confirmed the updated calendar invite.',
    purpose: 'Reschedule',
    status: 'Completed',
    sentiment: 'Positive',
    duration: 224,
    time: '2026-05-26T12:07:00-04:00',
    receptionist: 'Breezy',
    audioUrl: '',
    transcript: [
      { speaker: 'customer', text: 'I have an appointment tomorrow afternoon, but a meeting came up. Can I move it?', offset: '0:05' },
      { speaker: 'receptionist', text: 'Yes. I see your consultation at 3:30 PM. The next openings are Friday at 11:00 AM or Monday at 9:15 AM.', offset: '0:16' },
      { speaker: 'customer', text: 'Friday at 11 works.', offset: '0:31' },
      { speaker: 'receptionist', text: 'Done. Your consultation is now Friday at 11:00 AM, and the calendar invite has been updated.', offset: '0:40' },
    ],
  },
  {
    id: 'call-004',
    name: 'Andre Wallace',
    phone: '(718) 555-0166',
    summary: 'Caller reported an urgent service issue, but the call dropped before full triage was completed.',
    purpose: 'Support',
    status: 'Failed',
    sentiment: 'Negative',
    duration: 76,
    time: '2026-05-26T10:29:00-04:00',
    receptionist: 'Breezy',
    audioUrl: '',
    transcript: [
      { speaker: 'customer', text: 'I need help right away. The system stopped working again and nobody has called me back.', offset: '0:02' },
      { speaker: 'receptionist', text: 'I am sorry that happened. I can prioritize this. Can you tell me what changed before it stopped working?', offset: '0:14' },
      { speaker: 'customer', text: 'It started after the technician left yesterday. Now the panel is blank.', offset: '0:27' },
    ],
  },
  {
    id: 'call-005',
    name: 'Unknown Caller',
    phone: '(904) 555-0131',
    summary: 'Missed call after two rings with no voicemail left.',
    purpose: 'General',
    status: 'Missed',
    sentiment: 'Neutral',
    duration: 22,
    time: '2026-05-25T17:54:00-04:00',
    receptionist: 'Breezy',
    audioUrl: '',
    transcript: [],
  },
];

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
        'w-full rounded-2xl px-4 py-4 text-left transition duration-200',
        selected
          ? 'bg-white/[0.055]'
          : 'bg-transparent hover:bg-white/[0.025]'
      )}
    >
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
        <SentimentIcon sentiment={call.sentiment} compact />
      </div>

      <p className="mt-4 line-clamp-2 text-[13px] leading-5 text-zinc-400">{call.summary}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
        <span className="rounded-full bg-white/[0.045] px-2 py-1 text-zinc-300">{call.purpose}</span>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_OPTIONS[0]);
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS[0]);
  const [sentimentFilter, setSentimentFilter] = useState(SENTIMENT_OPTIONS[0]);
  const [selectedId, setSelectedId] = useState(mockCallLogs[0]?.id);

  const filteredCalls = useMemo(() => {
    const query = normalized(searchQuery);
    return mockCallLogs.filter((call) => {
      const matchesSearch = !query || [call.name, call.phone, call.summary, call.purpose, call.status]
        .some((value) => normalized(value).includes(query));
      const matchesCategory = categoryFilter === CATEGORY_OPTIONS[0] || call.purpose === categoryFilter;
      const matchesStatus = statusFilter === STATUS_OPTIONS[0] || call.status === statusFilter;
      const matchesSentiment = sentimentFilter === SENTIMENT_OPTIONS[0] || call.sentiment === sentimentFilter;
      return matchesSearch && matchesCategory && matchesStatus && matchesSentiment;
    });
  }, [categoryFilter, searchQuery, sentimentFilter, statusFilter]);

  const selectedCall = filteredCalls.find((call) => call.id === selectedId) || filteredCalls[0] || mockCallLogs[0];

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
              <p className="mt-1 text-[12px] font-medium text-zinc-600">{mockCallLogs.length} recent calls</p>
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
              <FilterSelect label="Category" value={categoryFilter} onChange={setCategoryFilter} options={CATEGORY_OPTIONS} />
              <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
              <FilterSelect label="Sentiment" value={sentimentFilter} onChange={setSentimentFilter} options={SENTIMENT_OPTIONS} />
            </div>
          </div>

          <div className="custom-scrollbar min-h-[320px] flex-1 overflow-y-auto px-3 py-2">
            {filteredCalls.map((call) => (
              <div key={call.id} className="border-b border-white/[0.04] last:border-b-0">
                <CallCard
                  call={call}
                  selected={selectedCall?.id === call.id}
                  onClick={() => setSelectedId(call.id)}
                />
              </div>
            ))}
            {filteredCalls.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-[13px] font-semibold text-zinc-300">No calls found</p>
                <p className="mt-2 text-[12px] text-zinc-600">Adjust the filters or search another caller.</p>
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          <div className="shrink-0 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[24px] font-black leading-none text-white">{selectedCall.name}</h3>
                  <StatusBadge status={selectedCall.status} />
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
        </section>
      </div>
    </div>
  );
}
