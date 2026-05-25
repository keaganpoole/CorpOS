import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, AudioLines, Brain, Database, ArrowRight,
  Circle, Clock, Zap, CheckCircle, XCircle, AlertTriangle,
  Wifi, WifiOff, Activity, Radio, Globe, Server,
} from 'lucide-react';

const BASE_URL = 'http://127.0.0.1:7878';

// ─── All known endpoints ────────────────────────────────────
const ENDPOINTS = [
  // Server Tools (called by ElevenLabs during calls)
  { group: 'Server Tools', path: '/api/tools/identify-caller', method: 'POST', desc: 'Identify caller by phone', icon: '🔍', wsEvent: 'identify' },
  { group: 'Server Tools', path: '/api/tools/check-availability', method: 'POST', desc: 'Check appointment slots', icon: '📅', wsEvent: 'slots' },
  { group: 'Server Tools', path: '/api/tools/create-appointment', method: 'POST', desc: 'Book appointment', icon: '✅', wsEvent: 'book' },
  { group: 'Server Tools', path: '/api/tools/update-appointment', method: 'POST', desc: 'Reschedule appointment', icon: '🔄', wsEvent: 'reschedule' },
  { group: 'Server Tools', path: '/api/tools/cancel-appointment', method: 'POST', desc: 'Cancel appointment', icon: '❌', wsEvent: 'cancel' },
  { group: 'Server Tools', path: '/api/tools/lookup-customer', method: 'POST', desc: 'Search customer records', icon: '👤', wsEvent: 'search' },
  { group: 'Server Tools', path: '/api/tools/get-services', method: 'GET', desc: 'List active services', icon: '📋', wsEvent: 'services' },
  { group: 'Server Tools', path: '/api/tools/get-business-info', method: 'POST', desc: 'Knowledge base lookup', icon: '📖', wsEvent: 'info' },
  { group: 'Server Tools', path: '/api/tools/log-call-outcome', method: 'POST', desc: 'Log call result', icon: '📊', wsEvent: 'log' },
  { group: 'Server Tools', path: '/api/tools/transfer-call', method: 'POST', desc: 'Transfer to human', icon: '📞', wsEvent: 'transfer' },
  // Management API (dashboard)
  { group: 'Dashboard', path: '/api/sonar/business/profile', method: 'GET', desc: 'Business profile', icon: '🏢' },
  { group: 'Dashboard', path: '/api/sonar/business/profile', method: 'PUT', desc: 'Update profile', icon: '✏️' },
  { group: 'Dashboard', path: '/api/sonar/services', method: 'GET', desc: 'List services', icon: '📋' },
  { group: 'Dashboard', path: '/api/sonar/services', method: 'POST', desc: 'Create service', icon: '➕' },
  { group: 'Dashboard', path: '/api/sonar/appointments', method: 'GET', desc: 'List appointments', icon: '📅' },
  { group: 'Dashboard', path: '/api/sonar/appointments/stats', method: 'GET', desc: 'Appointment stats', icon: '📈' },
  { group: 'Dashboard', path: '/api/sonar/people', method: 'GET', desc: 'List customers', icon: '👥' },
  { group: 'Dashboard', path: '/api/sonar/people/search', method: 'GET', desc: 'Search customers', icon: '🔍' },
  { group: 'Dashboard', path: '/api/sonar/receptionists/hired', method: 'GET', desc: 'Hired receptionists', icon: '🤖' },
  { group: 'Dashboard', path: '/api/sonar/receptionists/catalog', method: 'GET', desc: 'Receptionist catalog', icon: '📚' },
  { group: 'Dashboard', path: '/api/sonar/call-logs', method: 'GET', desc: 'Call history', icon: '📜' },
  { group: 'Dashboard', path: '/api/sonar/call-logs/stats', method: 'GET', desc: 'Call analytics', icon: '📊' },
];

const METHOD_COLORS = {
  GET: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
  POST: 'from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400',
  PUT: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400',
  DELETE: 'from-rose-500/20 to-rose-500/5 border-rose-500/30 text-rose-400',
  PATCH: 'from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400',
};

const METHOD_BADGE = {
  GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DELETE: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  PATCH: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

// ─── Flow Node Component ────────────────────────────────────
function FlowNode({ icon: Icon, label, subtitle, active, pulseColor }) {
  return (
    <div className="flex flex-col items-center relative z-10">
      <motion.div
        className={`relative w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
          active
            ? `bg-gradient-to-br ${pulseColor} shadow-[0_0_30px_${pulseColor.includes('cyan') ? 'rgba(34,211,238,0.4)' : pulseColor.includes('violet') ? 'rgba(168,85,247,0.4)' : pulseColor.includes('blue') ? 'rgba(59,130,246,0.4)' : 'rgba(20,184,166,0.4)'}]`
            : 'bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800'
        }`}
        animate={active ? { scale: [1, 1.08, 1] } : {}}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Icon size={24} className={active ? 'text-white' : 'text-zinc-600'} />
        {active && (
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-white/30"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        )}
      </motion.div>
      <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</div>
      <div className="text-[9px] text-zinc-600">{subtitle}</div>
    </div>
  );
}

// ─── Flow Arrow with animated pulse ─────────────────────────
function FlowArrow({ active }) {
  return (
    <div className="flex items-center mx-1 relative w-20 h-16 justify-center">
      {/* Static line */}
      <div className="absolute w-full h-[1px] bg-zinc-800" />
      {/* Active glow */}
      {active && (
        <div className="absolute w-full h-[2px] bg-gradient-to-r from-cyan-500/50 via-violet-500/50 to-blue-500/50 shadow-[0_0_10px_rgba(34,211,238,0.3)]" />
      )}
      {/* Arrow */}
      <ArrowRight size={12} className={`absolute right-0 ${active ? 'text-blue-400' : 'text-zinc-700'}`} />
      {/* Traveling dot */}
      {active && (
        <motion.div
          className="absolute w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
          initial={{ left: '0%' }}
          animate={{ left: ['0%', '100%'] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
}

// ─── Endpoint Card ──────────────────────────────────────────
function EndpointCard({ ep, hits, lastHit, onFire }) {
  const isLit = onFire && Date.now() - new Date(onFire).getTime() < 1500;

  return (
    <motion.div
      className={`relative rounded-xl border p-3 transition-all duration-300 overflow-hidden ${
        isLit
          ? 'border-cyan-500/50 bg-gradient-to-br from-cyan-500/10 to-transparent shadow-[0_0_20px_rgba(34,211,238,0.15)]'
          : 'border-zinc-800/50 bg-zinc-950/50 hover:border-zinc-700/50'
      }`}
      animate={isLit ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      {/* Flash overlay */}
      {isLit && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      )}

      <div className="flex items-center gap-2 relative z-10">
        <span className="text-sm">{ep.icon}</span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${METHOD_BADGE[ep.method]}`}>
          {ep.method}
        </span>
        <span className="text-[11px] text-zinc-300 font-mono truncate flex-1">{ep.path.replace('/api/', '')}</span>
        {hits > 0 && (
          <span className="text-[10px] text-zinc-500 font-mono">{hits}×</span>
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5 relative z-10">
        <span className="text-[9px] text-zinc-600">{ep.desc}</span>
        {isLit && (
          <motion.span
            className="text-[9px] text-cyan-400 font-bold"
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.5 }}
          >
            FIRED
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Event Feed Item ────────────────────────────────────────
function FeedItem({ hit, index }) {
  const statusClass = hit.status < 300 ? 'text-emerald-400' : hit.status < 400 ? 'text-amber-400' : 'text-rose-400';
  const time = new Date(hit.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <motion.div
      className="flex items-center gap-3 py-1.5 px-3 rounded-lg hover:bg-zinc-900/30 transition-colors"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
    >
      <span className="text-[10px] text-zinc-600 font-mono w-16 shrink-0">{time}</span>
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${METHOD_BADGE[hit.method] || 'border-zinc-700 text-zinc-500'}`}>
        {hit.method}
      </span>
      <span className={`text-[10px] font-bold shrink-0 ${statusClass}`}>{hit.status}</span>
      <span className="text-[11px] text-zinc-400 font-mono truncate flex-1">{hit.endpoint.replace('/api/', '')}</span>
      <span className="text-[10px] text-zinc-600 font-mono w-12 text-right shrink-0">{hit.duration}ms</span>
      <span className={`text-[9px] shrink-0 ${
        hit.source === 'elevenlabs' ? 'text-violet-400' :
        hit.source === 'dashboard' ? 'text-cyan-400' :
        hit.source === 'supabase' ? 'text-amber-400' : 'text-zinc-500'
      }`}>
        {hit.source}
      </span>
    </motion.div>
  );
}

// ─── Main Routes Page ───────────────────────────────────────
export default function RoutesPage() {
  const [hits, setHits] = useState([]);
  const [stats, setStats] = useState({});
  const [connected, setConnected] = useState(false);
  const [flowActive, setFlowActive] = useState({ caller: false, elevenlabs: false, sonar: false, supabase: false });
  const [totalRequests, setTotalRequests] = useState(0);
  const [activeSource, setActiveSource] = useState(null);
  const feedRef = useRef(null);
  const wsRef = useRef(null);

  // Connect WebSocket for real-time route hits
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`ws://${BASE_URL.replace('http://', '')}`);
      wsRef.current = ws;

      ws.onopen = () => { setConnected(true); };
      ws.onclose = () => { setConnected(false); setTimeout(connect, 2000); };
      ws.onerror = () => { setConnected(false); };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'route_hit') {
            setHits(prev => [data, ...prev].slice(0, 200));
            setTotalRequests(prev => prev + 1);

            // Update stats
            setStats(prev => {
              const key = data.endpoint;
              const existing = prev[key] || { count: 0, durations: [] };
              return {
                ...prev,
                [key]: {
                  count: existing.count + 1,
                  durations: [...existing.durations, data.duration].slice(-20),
                },
              };
            });

            // Trigger flow animation
            if (data.source === 'elevenlabs') {
              setActiveSource('elevenlabs');
              setFlowActive({ caller: true, elevenlabs: true, sonar: true, supabase: data.endpoint.includes('tools') });
              setTimeout(() => {
                setFlowActive({ caller: false, elevenlabs: false, sonar: false, supabase: false });
                setActiveSource(null);
              }, 1200);
            } else if (data.source === 'dashboard') {
              setActiveSource('dashboard');
              setFlowActive({ caller: false, elevenlabs: false, sonar: true, supabase: true });
              setTimeout(() => {
                setFlowActive({ caller: false, elevenlabs: false, sonar: false, supabase: false });
                setActiveSource(null);
              }, 1000);
            }
          }
        } catch (e) { /* ignore parse errors */ }
      };
    };

    connect();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, [hits.length]);

  // Group endpoints
  const serverTools = useMemo(() => ENDPOINTS.filter(e => e.group === 'Server Tools'), []);
  const dashboard = useMemo(() => ENDPOINTS.filter(e => e.group === 'Dashboard'), []);

  return (
    <div className="h-full overflow-auto custom-scrollbar bg-[#020202] text-zinc-100 flex flex-col">
      {/* ── Header ── */}
      <div className="shrink-0 px-12 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-blue-400 bg-clip-text text-transparent">
                API Routes
              </span>
            </h2>
            <p className="text-[11px] text-zinc-600 mt-1">Real-time endpoint monitoring · live traffic flow</p>
          </div>

          {/* Connection status + counter */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-600 font-mono">{totalRequests} requests</span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
              connected
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-rose-500/30 bg-rose-500/10'
            }`}>
              {connected ? <Wifi size={10} className="text-emerald-400" /> : <WifiOff size={10} className="text-rose-400" />}
              <span className={`text-[10px] font-bold ${connected ? 'text-emerald-400' : 'text-rose-400'}`}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Flow Diagram ── */}
      <div className="shrink-0 px-12 pb-8">
        <div className="relative rounded-2xl border border-zinc-800/50 bg-gradient-to-b from-zinc-950 to-[#020202] p-8 overflow-hidden">
          {/* Grid background */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

          {/* Ambient glow */}
          {activeSource && (
            <motion.div
              className="absolute inset-0 opacity-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              style={{
                background: activeSource === 'elevenlabs'
                  ? 'radial-gradient(ellipse at center, rgba(168,85,247,0.3) 0%, transparent 70%)'
                  : 'radial-gradient(ellipse at center, rgba(34,211,238,0.3) 0%, transparent 70%)',
              }}
            />
          )}

          <div className="relative flex items-center justify-center gap-0 z-10">
            <FlowNode
              icon={Phone}
              label="Caller"
              subtitle="Phone call"
              active={flowActive.caller}
              pulseColor="from-emerald-500/20 to-emerald-500/5 border-emerald-500/30"
            />
            <FlowArrow active={flowActive.caller || flowActive.elevenlabs} />
            <FlowNode
              icon={AudioLines}
              label="ElevenLabs"
              subtitle="STT + LLM + TTS"
              active={flowActive.elevenlabs}
              pulseColor="from-violet-500/20 to-violet-500/5 border-violet-500/30"
            />
            <FlowArrow active={flowActive.elevenlabs || flowActive.sonar} />
            <FlowNode
              icon={Brain}
              label="Sonar API"
              subtitle="Server Tools"
              active={flowActive.sonar}
              pulseColor="from-cyan-500/20 to-cyan-500/5 border-cyan-500/30"
            />
            <FlowArrow active={flowActive.sonar || flowActive.supabase} />
            <FlowNode
              icon={Database}
              label="Supabase"
              subtitle="Data layer"
              active={flowActive.supabase}
              pulseColor="from-blue-500/20 to-blue-500/5 border-blue-500/30"
            />
          </div>

          {/* Flow labels */}
          <div className="relative flex items-center justify-center mt-4">
            <div className="w-16" />
            <div className="w-20 text-center text-[8px] text-zinc-700 uppercase tracking-widest">Voice I/O</div>
            <div className="w-20 text-center text-[8px] text-zinc-700 uppercase tracking-widest">Server Tools</div>
            <div className="w-20 text-center text-[8px] text-zinc-700 uppercase tracking-widest">CRUD</div>
            <div className="w-16" />
          </div>

          {/* Source indicator */}
          {activeSource && (
            <motion.div
              className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Radio size={10} className={activeSource === 'elevenlabs' ? 'text-violet-400' : 'text-cyan-400'} />
              <span className={`text-[9px] font-bold uppercase tracking-wider ${activeSource === 'elevenlabs' ? 'text-violet-400' : 'text-cyan-400'}`}>
                {activeSource === 'elevenlabs' ? 'Call in progress' : 'Dashboard activity'}
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Endpoint Grid + Feed (side by side) ── */}
      <div className="flex-1 min-h-0 px-12 pb-8 flex gap-6">
        {/* Left: Endpoint Grid */}
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          {/* Server Tools */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Server size={12} className="text-violet-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Server Tools</span>
              <span className="text-[9px] text-zinc-600 ml-1">ElevenLabs → Sonar</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {serverTools.map(ep => {
                const key = ep.path;
                const epStats = stats[key] || { count: 0 };
                const lastHitObj = hits.find(h => h.endpoint === ep.path);
                return (
                  <EndpointCard
                    key={ep.path + ep.method}
                    ep={ep}
                    hits={epStats.count}
                    onFire={lastHitObj?.timestamp}
                  />
                );
              })}
            </div>
          </div>

          {/* Dashboard */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe size={12} className="text-cyan-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Dashboard</span>
              <span className="text-[9px] text-zinc-600 ml-1">Frontend → Sonar</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {dashboard.map(ep => {
                const key = ep.path + ep.method;
                const epStats = stats[ep.path] || { count: 0 };
                const lastHitObj = hits.find(h => h.endpoint === ep.path && h.method === ep.method);
                return (
                  <EndpointCard
                    key={key}
                    ep={ep}
                    hits={epStats.count}
                    onFire={lastHitObj?.timestamp}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Live Feed */}
        <div className="w-96 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={12} className="text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Live Feed</span>
            <span className="text-[9px] text-zinc-600 ml-1">real-time traffic</span>
          </div>
          <div
            ref={feedRef}
            className="flex-1 rounded-xl border border-zinc-800/50 bg-zinc-950/30 overflow-y-auto custom-scrollbar"
          >
            {hits.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16">
                <Activity size={24} className="text-zinc-800 mb-3" />
                <span className="text-[11px] text-zinc-700">Waiting for traffic...</span>
                <span className="text-[9px] text-zinc-800 mt-1">Endpoints will light up when called</span>
              </div>
            ) : (
              <div className="py-1">
                <AnimatePresence>
                  {hits.slice(0, 60).map((hit, i) => (
                    <FeedItem key={`${hit.timestamp}-${i}`} hit={hit} index={i} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
