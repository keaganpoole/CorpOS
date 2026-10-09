import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownAZ,
  BadgeCheck,
  Check,
  ChevronDown,
  Clipboard,
  Copy,
  Filter,
  Globe2,
  Headphones,
  Languages,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { api } from '../sonar/lib/api';
import './VoiceCatalogPage.css';

const EMPTY_FILTERS = {
  gender: 'all',
  accent: 'all',
  language: 'all',
  category: 'all',
  age: 'all',
  useCase: 'all',
  availability: 'available',
};

const FILTER_LABELS = {
  gender: 'Gender',
  accent: 'Accent',
  language: 'Language',
  category: 'Category',
  age: 'Age',
  useCase: 'Use case',
  availability: 'Availability',
};

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'newest', label: 'Newest' },
  { value: 'category', label: 'Category' },
];

function prettyLabel(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function labelValues(voice, key) {
  const value = voice?.labels?.[key] ?? voice?.[key];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value === null || value === undefined || value === '') return [];
  return [String(value)];
}

function voiceSearchText(voice) {
  return [
    voice.name,
    voice.description,
    voice.voice_id,
    voice.category,
    ...Object.values(voice.labels || {}),
    ...(voice.verified_languages || []).map((item) => item.language || item.name || item),
  ].flat().filter(Boolean).join(' ').toLowerCase();
}

function voiceIsAvailable(voice) {
  return voice?.availability === 'available';
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(Number(value) > 10_000_000_000 ? Number(value) : Number(value) * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function displayLanguage(voice) {
  const language = labelValues(voice, 'language')[0];
  return language || voice.verified_languages?.[0]?.language || voice.verified_languages?.[0]?.name || '';
}

function VoiceAvatar({ voice, large = false }) {
  const initial = String(voice?.name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div className={`voice-catalog-avatar ${large ? 'is-large' : ''}`} aria-hidden="true">
      <span>{initial}</span>
      <i />
    </div>
  );
}

function Waveform({ voice, playing }) {
  const seed = String(voice?.voice_id || voice?.name || 'voice').split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return (
    <div className={`voice-catalog-waveform ${playing ? 'is-playing' : ''}`} aria-hidden="true">
      {Array.from({ length: 24 }, (_, index) => (
        <span key={index} style={{ height: `${8 + ((seed + index * 17) % 18)}px`, animationDelay: `${index * 22}ms` }} />
      ))}
    </div>
  );
}

function SelectField({ label, value, options, onChange, icon: Icon = ChevronDown }) {
  return (
    <label className="voice-catalog-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <Icon size={13} aria-hidden="true" />
    </label>
  );
}

function VoiceCard({ voice, selected, playing, onSelect, onPreview, onCopy }) {
  const unavailable = !voiceIsAvailable(voice);
  const language = displayLanguage(voice);
  const labels = [
    voice.category,
    labelValues(voice, 'gender')[0],
    labelValues(voice, 'accent')[0],
  ].filter(Boolean).slice(0, 3);

  return (
    <article className={`voice-catalog-card ${selected ? 'is-selected' : ''} ${unavailable ? 'is-unavailable' : ''}`}>
      <button type="button" className="voice-catalog-card-main" onClick={() => onSelect(voice.voice_id)}>
        <VoiceAvatar voice={voice} />
        <span className="voice-catalog-card-copy">
          <span className="voice-catalog-card-heading">
            <strong>{voice.name || 'Unnamed voice'}</strong>
            {voice.verified && <BadgeCheck size={14} className="voice-catalog-verified" aria-label="Verified voice" />}
          </span>
          <span className="voice-catalog-card-subtitle">{language || prettyLabel(voice.category) || 'Voice library'}</span>
          <span className="voice-catalog-card-tags">
            {labels.map((label) => <em key={label}>{prettyLabel(label)}</em>)}
            {voice.is_legacy && <em>Legacy</em>}
          </span>
        </span>
      </button>
      <div className="voice-catalog-card-footer">
        <Waveform voice={voice} playing={playing} />
        <button
          type="button"
          className="voice-catalog-play-button"
          onClick={() => onPreview(voice)}
          disabled={!voice.preview_url || unavailable}
          aria-label={playing ? `Pause preview of ${voice.name}` : `Play preview of ${voice.name}`}
          title={voice.preview_url ? (playing ? 'Pause preview' : 'Play preview') : 'No preview available'}
        >
          {playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        </button>
        <button type="button" className="voice-catalog-copy-button" onClick={() => onCopy(voice.voice_id)} title="Copy voice ID" aria-label={`Copy voice ID for ${voice.name}`}>
          <Copy size={13} />
        </button>
      </div>
      {unavailable && <span className="voice-catalog-unavailable-label"><AlertCircle size={12} /> {voice.availability === 'error' ? 'Could not check' : 'Unavailable'}</span>}
    </article>
  );
}

function VoiceDetail({ voice, playing, onPreview, onCopy, onClose }) {
  if (!voice) {
    return (
      <div className="voice-catalog-empty-detail">
        <Sparkles size={24} />
        <strong>Choose a voice to explore</strong>
        <span>See what it sounds like, inspect the metadata, and copy its ID when you’re ready.</span>
      </div>
    );
  }

  const labels = Object.entries(voice.labels || {}).filter(([, value]) => value !== null && value !== undefined && value !== '');
  const verifiedLanguages = voice.verified_languages || [];
  const availability = voice.availability === 'available' ? 'Available for your account' : voice.availability === 'unavailable' ? 'Unavailable' : 'Availability check failed';

  return (
    <div className="voice-catalog-detail">
      <div className="voice-catalog-detail-topline">
        <span className="voice-catalog-eyebrow">Voice profile</span>
        <button type="button" className="voice-catalog-detail-close" onClick={onClose} aria-label="Close voice details"><X size={16} /></button>
      </div>
      <div className="voice-catalog-detail-identity">
        <VoiceAvatar voice={voice} large />
        <div>
          <h2>{voice.name || 'Unnamed voice'}</h2>
          <p>{prettyLabel(voice.category) || 'Voice library'}{displayLanguage(voice) ? ` · ${prettyLabel(displayLanguage(voice))}` : ''}</p>
        </div>
        {voice.verified && <span className="voice-catalog-status-pill is-verified"><ShieldCheck size={13} /> Verified</span>}
      </div>

      <div className="voice-catalog-detail-player">
        <div className="voice-catalog-detail-player-header">
          <span><Headphones size={14} /> Preview</span>
          <span>{voice.preview_url ? 'Sample audio' : 'No preview supplied'}</span>
        </div>
        <div className="voice-catalog-detail-player-body">
          <button type="button" className="voice-catalog-detail-play" onClick={() => onPreview(voice)} disabled={!voice.preview_url || voice.availability !== 'available'} aria-label={playing ? 'Pause voice preview' : 'Play voice preview'}>
            {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
          </button>
          <Waveform voice={voice} playing={playing} />
        </div>
      </div>

      <div className="voice-catalog-id-box">
        <div><span>Voice ID</span><code>{voice.voice_id}</code></div>
        <button type="button" onClick={() => onCopy(voice.voice_id)}><Clipboard size={14} /> Copy ID</button>
      </div>

      {voice.description && <p className="voice-catalog-detail-description">{voice.description}</p>}

      <div className="voice-catalog-detail-section">
        <span className="voice-catalog-section-label">At a glance</span>
        <div className="voice-catalog-fact-grid">
          <div><UserRound size={14} /><span><small>Gender</small><strong>{prettyLabel(labelValues(voice, 'gender')[0]) || 'Not listed'}</strong></span></div>
          <div><Globe2 size={14} /><span><small>Accent</small><strong>{prettyLabel(labelValues(voice, 'accent')[0]) || 'Not listed'}</strong></span></div>
          <div><Languages size={14} /><span><small>Language</small><strong>{prettyLabel(displayLanguage(voice)) || 'Not listed'}</strong></span></div>
          <div><ShieldCheck size={14} /><span><small>Availability</small><strong>{availability}</strong></span></div>
        </div>
      </div>

      <div className="voice-catalog-detail-section">
        <span className="voice-catalog-section-label">Provider metadata</span>
        <dl className="voice-catalog-metadata">
          <div><dt>Tier access</dt><dd>{voice.available_for_tiers?.length ? voice.available_for_tiers.map(prettyLabel).join(', ') : 'Not specified'}</dd></div>
          <div><dt>Ownership</dt><dd>{voice.is_owner === true ? 'Owned by your workspace' : voice.is_owner === false ? 'ElevenLabs library' : 'Not specified'}</dd></div>
          <div><dt>Lifecycle</dt><dd>{voice.is_legacy ? 'Legacy voice' : 'Current voice'}{voice.created_at_unix ? ` · Added ${formatDate(voice.created_at_unix)}` : ''}</dd></div>
          <div><dt>Verification</dt><dd>{voice.verified ? 'Verified' : voice.voice_verification?.status || 'Not verified'}</dd></div>
        </dl>
      </div>

      {verifiedLanguages.length > 0 && (
        <div className="voice-catalog-detail-section">
          <span className="voice-catalog-section-label">Verified languages</span>
          <div className="voice-catalog-language-list">{verifiedLanguages.map((item, index) => <span key={`${item.language || item.name || 'language'}-${item.locale || 'locale'}-${index}`}>{prettyLabel(item.language || item.name)}{item.locale ? ` · ${item.locale}` : ''}</span>)}</div>
        </div>
      )}

      {labels.length > 0 && (
        <div className="voice-catalog-detail-section">
          <span className="voice-catalog-section-label">Labels</span>
          <div className="voice-catalog-label-list">{labels.map(([key, value]) => <span key={key}><b>{prettyLabel(key)}</b>{Array.isArray(value) ? value.join(', ') : String(value)}</span>)}</div>
        </div>
      )}
    </div>
  );
}

export default function VoiceCatalogPage() {
  const [voices, setVoices] = useState([]);
  const [stats, setStats] = useState({ total: 0, hidden: 0 });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');
  const [selectedId, setSelectedId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const audioRef = useRef(null);
  const [playingId, setPlayingId] = useState('');

  const loadVoices = async ({ includeUnavailable = false, recheck = false, silent = false } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const result = await api.getVoiceCatalog({ includeUnavailable, recheck });
      const nextVoices = Array.isArray(result?.voices) ? result.voices : [];
      setVoices(nextVoices);
      setStats(result?.stats || { total: nextVoices.length, hidden: 0 });
      setSelectedId((current) => (nextVoices.some((voice) => voice.voice_id === current) ? current : nextVoices[0]?.voice_id || ''));
    } catch (loadError) {
      setError(loadError.message || 'The voice library could not be loaded.');
    } finally {
      if (silent) setRefreshing(false); else setLoading(false);
    }
  };

  useEffect(() => {
    loadVoices();
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const filterOptions = useMemo(() => {
    const values = {};
    ['gender', 'accent', 'language', 'age', 'useCase'].forEach((key) => {
      const providerKey = key === 'useCase' ? 'use_case' : key;
      values[key] = [...new Set(voices.flatMap((voice) => [
        ...labelValues(voice, providerKey),
        ...(key === 'language' ? (voice.verified_languages || []).map((item) => item.language || item.name || item).filter(Boolean) : []),
      ]))].map(String).sort((a, b) => a.localeCompare(b));
    });
    values.category = [...new Set(voices.map((voice) => voice.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return values;
  }, [voices]);

  const filteredVoices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = voices.filter((voice) => {
      if (filters.availability === 'available' && !voiceIsAvailable(voice)) return false;
      if (filters.availability === 'unavailable' && voiceIsAvailable(voice)) return false;
      if (needle && !voiceSearchText(voice).includes(needle)) return false;
      if (filters.category !== 'all' && voice.category !== filters.category) return false;
      if (filters.gender !== 'all' && !labelValues(voice, 'gender').includes(filters.gender)) return false;
      if (filters.accent !== 'all' && !labelValues(voice, 'accent').includes(filters.accent)) return false;
      if (filters.language !== 'all' && !labelValues(voice, 'language').includes(filters.language) && !(voice.verified_languages || []).some((item) => (item.language || item.name) === filters.language)) return false;
      if (filters.age !== 'all' && !labelValues(voice, 'age').includes(filters.age)) return false;
      if (filters.useCase !== 'all' && !labelValues(voice, 'use_case').includes(filters.useCase)) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sort === 'newest') return Number(b.created_at_unix || 0) - Number(a.created_at_unix || 0);
      if (sort === 'category') return String(a.category || '').localeCompare(String(b.category || '')) || String(a.name || '').localeCompare(String(b.name || ''));
      return Number(b.verified) - Number(a.verified) || Number(b.is_owner) - Number(a.is_owner) || String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [filters, query, sort, voices]);

  const selectedVoice = voices.find((voice) => voice.voice_id === selectedId) || filteredVoices[0] || null;

  const togglePreview = (voice) => {
    if (!voice.preview_url || !voiceIsAvailable(voice)) return;
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.addEventListener('ended', () => setPlayingId(''));
      audioRef.current.addEventListener('error', () => setPlayingId(''));
    }
    if (playingId === voice.voice_id) {
      audioRef.current.pause();
      setPlayingId('');
      return;
    }
    audioRef.current.pause();
    audioRef.current.src = voice.preview_url;
    audioRef.current.play().then(() => setPlayingId(voice.voice_id)).catch(() => setPlayingId(''));
  };

  const copyVoiceId = async (voiceId) => {
    try {
      await navigator.clipboard.writeText(voiceId);
      setCopiedId(voiceId);
      window.setTimeout(() => setCopiedId((current) => current === voiceId ? '' : current), 1600);
    } catch {
      setError('Copy is unavailable in this browser.');
    }
  };

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const unavailableCount = voices.filter((voice) => !voiceIsAvailable(voice)).length || Number(stats.hidden || stats.unavailable || 0);

  return (
    <main className="voice-catalog-page">
      <header className="voice-catalog-header">
        <div className="voice-catalog-header-copy">
          <span className="voice-catalog-eyebrow"><Sparkles size={13} /> Nodemere library</span>
          <h1>Voice catalog</h1>
          <p>Find a voice that feels right, hear it in context, and keep the ID close when you’re ready to build.</p>
        </div>
        <div className="voice-catalog-header-actions">
          <span className="voice-catalog-private-badge"><ShieldCheck size={13} /> Private workspace</span>
          <button type="button" className="voice-catalog-refresh-button" onClick={() => loadVoices({ includeUnavailable: filters.availability !== 'available', recheck: true, silent: true })} disabled={refreshing || loading}>
            <RefreshCw size={14} className={refreshing ? 'is-spinning' : ''} /> {refreshing ? 'Checking…' : 'Recheck voices'}
          </button>
        </div>
      </header>

      <section className="voice-catalog-toolbar" aria-label="Voice catalog controls">
        <label className="voice-catalog-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names, accents, languages, or voice IDs" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={13} /></button>}
        </label>
        <button type="button" className={`voice-catalog-mobile-filter-button ${mobileFiltersOpen ? 'is-active' : ''}`} onClick={() => setMobileFiltersOpen((value) => !value)}><Filter size={14} /> Filters <span>{Object.values(filters).filter((value) => value !== 'all' && value !== 'available').length}</span></button>
        <div className={`voice-catalog-filters ${mobileFiltersOpen ? 'is-open' : ''}`}>
          {filterOptions.gender.length > 0 && <SelectField label={FILTER_LABELS.gender} value={filters.gender} options={[{ value: 'all', label: 'Any gender' }, ...filterOptions.gender.map((value) => ({ value, label: prettyLabel(value) }))]} onChange={(value) => setFilter('gender', value)} />}
          {filterOptions.accent.length > 0 && <SelectField label={FILTER_LABELS.accent} value={filters.accent} options={[{ value: 'all', label: 'Any accent' }, ...filterOptions.accent.map((value) => ({ value, label: prettyLabel(value) }))]} onChange={(value) => setFilter('accent', value)} />}
          {filterOptions.language.length > 0 && <SelectField label={FILTER_LABELS.language} value={filters.language} options={[{ value: 'all', label: 'Any language' }, ...filterOptions.language.map((value) => ({ value, label: prettyLabel(value) }))]} onChange={(value) => setFilter('language', value)} />}
          {filterOptions.category.length > 0 && <SelectField label={FILTER_LABELS.category} value={filters.category} options={[{ value: 'all', label: 'Any category' }, ...filterOptions.category.map((value) => ({ value, label: prettyLabel(value) }))]} onChange={(value) => setFilter('category', value)} />}
          {filterOptions.age.length > 0 && <SelectField label={FILTER_LABELS.age} value={filters.age} options={[{ value: 'all', label: 'Any age' }, ...filterOptions.age.map((value) => ({ value, label: prettyLabel(value) }))]} onChange={(value) => setFilter('age', value)} />}
          {filterOptions.useCase.length > 0 && <SelectField label={FILTER_LABELS.useCase} value={filters.useCase} options={[{ value: 'all', label: 'Any use case' }, ...filterOptions.useCase.map((value) => ({ value, label: prettyLabel(value) }))]} onChange={(value) => setFilter('useCase', value)} />}
          {unavailableCount > 0 && <SelectField label={FILTER_LABELS.availability} value={filters.availability} options={[{ value: 'available', label: 'Available only' }, { value: 'all', label: 'Show all' }, { value: 'unavailable', label: 'Unavailable only' }]} onChange={(value) => { setFilter('availability', value); if (value !== 'available' && !voices.some((voice) => !voiceIsAvailable(voice))) loadVoices({ includeUnavailable: true }); }} />}
          <SelectField label="Sort by" value={sort} options={SORT_OPTIONS} onChange={setSort} icon={ArrowDownAZ} />
        </div>
        <button type="button" className="voice-catalog-reset-button" onClick={() => { setFilters(EMPTY_FILTERS); setQuery(''); setSort('featured'); }}><SlidersHorizontal size={13} /> Reset</button>
      </section>

      <div className="voice-catalog-content">
        <section className="voice-catalog-results" aria-live="polite">
          <div className="voice-catalog-results-heading">
            <div><strong>{loading ? 'Loading voices…' : `${filteredVoices.length} voices`}</strong><span>{stats.hidden > 0 ? `${stats.hidden} hidden until checked` : 'Curated from your connected library'}</span></div>
            {unavailableCount > 0 && filters.availability === 'available' && <button type="button" onClick={() => { setFilter('availability', 'all'); loadVoices({ includeUnavailable: true }); }}><AlertCircle size={13} /> Show {unavailableCount} unavailable</button>}
          </div>
          {error && <div className="voice-catalog-error"><AlertCircle size={16} /><span>{error}</span><button type="button" onClick={() => loadVoices({ recheck: true })}>Try again</button></div>}
          {loading ? (
            <div className="voice-catalog-loading"><LoaderCircle size={22} className="is-spinning" /><span>Checking the library and availability…</span></div>
          ) : filteredVoices.length > 0 ? (
            <div className="voice-catalog-grid">
              {filteredVoices.map((voice) => <VoiceCard key={voice.voice_id} voice={voice} selected={selectedVoice?.voice_id === voice.voice_id} playing={playingId === voice.voice_id} onSelect={(voiceId) => { setSelectedId(voiceId); setDetailOpen(true); }} onPreview={togglePreview} onCopy={copyVoiceId} />)}
            </div>
          ) : (
            <div className="voice-catalog-no-results"><Search size={20} /><strong>No voices match those filters</strong><span>Try a broader search or reset the filters.</span><button type="button" onClick={() => { setFilters(EMPTY_FILTERS); setQuery(''); }}>Clear filters</button></div>
          )}
        </section>
        <aside className={`voice-catalog-detail-panel ${detailOpen && selectedVoice ? 'is-open' : ''}`}>
          <VoiceDetail voice={selectedVoice} playing={playingId === selectedVoice?.voice_id} onPreview={togglePreview} onCopy={copyVoiceId} onClose={() => setDetailOpen(false)} />
        </aside>
      </div>
      {copiedId && <div className="voice-catalog-copy-toast"><Check size={14} /> Voice ID copied</div>}
    </main>
  );
}
