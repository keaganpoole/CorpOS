import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';

const LETTERS = {
  I: ['Introverted', 'Recharges through reflection and focused interaction.'],
  E: ['Extraverted', 'Gains energy through active conversation and connection.'],
  N: ['Intuitive', 'Notices patterns, possibilities, and the bigger picture.'],
  S: ['Observant', 'Grounds decisions in details and practical information.'],
  T: ['Thinking', 'Leans on logic, consistency, and objective tradeoffs.'],
  F: ['Feeling', 'Prioritizes empathy, values, and the human impact.'],
  J: ['Judging', 'Prefers structure, clarity, and a decided path forward.'],
  P: ['Prospecting', 'Stays flexible, curious, and responsive as things change.'],
};

const PROFILES = {
  INTJ: { name: 'Architect', summary: 'Strategic, composed, and quietly confident. They naturally organize complex information into a clear path forward.', strengths: ['Strategic', 'Independent', 'Decisive'], phone: 'Expect focused questions, efficient problem-solving, and calm control of complicated requests.' },
  INTP: { name: 'Logician', summary: 'Curious, analytical, and inventive. They enjoy understanding how things work and finding elegant answers to unusual problems.', strengths: ['Analytical', 'Inventive', 'Objective'], phone: 'Expect thoughtful clarification, precise answers, and creative solutions when the usual script is not enough.' },
  ENTJ: { name: 'Commander', summary: 'Direct, organized, and naturally decisive. They are comfortable taking ownership and moving conversations toward a result.', strengths: ['Confident', 'Efficient', 'Organized'], phone: 'Expect a crisp pace, clear next steps, and confident guidance through high-stakes or time-sensitive calls.' },
  ENTP: { name: 'Debater', summary: 'Quick-thinking, resourceful, and energized by possibility. They adapt rapidly and enjoy finding a smarter angle.', strengths: ['Resourceful', 'Adaptable', 'Quick-witted'], phone: 'Expect lively problem-solving, flexible conversation, and an easy recovery when a caller changes direction.' },
  INFJ: { name: 'Advocate', summary: 'Insightful, considerate, and purpose-driven. They listen for what someone means as carefully as what they say.', strengths: ['Insightful', 'Empathetic', 'Principled'], phone: 'Expect patient listening, emotionally aware responses, and thoughtful guidance that still feels structured.' },
  INFP: { name: 'Mediator', summary: 'Gentle, imaginative, and deeply empathetic. They create space for people to feel understood before guiding them forward.', strengths: ['Compassionate', 'Creative', 'Open-minded'], phone: 'Expect a warm, unhurried tone, careful listening, and responses shaped around the caller’s individual needs.' },
  ENFJ: { name: 'Protagonist', summary: 'Warm, persuasive, and people-focused. They naturally build trust and help others feel confident about the next step.', strengths: ['Encouraging', 'Reliable', 'Persuasive'], phone: 'Expect polished warmth, clear reassurance, and a strong instinct for keeping the caller engaged and comfortable.' },
  ENFP: { name: 'Campaigner', summary: 'Expressive, imaginative, and infectiously optimistic. They bring energy to conversations without losing sight of the person.', strengths: ['Enthusiastic', 'Creative', 'Sociable'], phone: 'Expect an upbeat welcome, natural rapport, and energetic adaptability that makes routine calls feel personal.' },
  ISTJ: { name: 'Logistician', summary: 'Dependable, practical, and detail-conscious. They value accuracy and make sure important steps are completed properly.', strengths: ['Reliable', 'Thorough', 'Practical'], phone: 'Expect consistent service, careful information capture, and dependable follow-through on every commitment.' },
  ISFJ: { name: 'Defender', summary: 'Attentive, patient, and quietly devoted to helping. They remember the details that make service feel personal.', strengths: ['Supportive', 'Patient', 'Attentive'], phone: 'Expect a gentle welcome, careful note-taking, and reassuring help for callers who need extra patience.' },
  ESTJ: { name: 'Executive', summary: 'Clear, practical, and highly organized. They are comfortable setting expectations and keeping a process on track.', strengths: ['Direct', 'Structured', 'Dependable'], phone: 'Expect decisive routing, concise explanations, and firm control of busy or operationally complex calls.' },
  ESFJ: { name: 'Consul', summary: 'Friendly, attentive, and community-minded. They notice social cues quickly and want every caller to feel looked after.', strengths: ['Welcoming', 'Loyal', 'Considerate'], phone: 'Expect personable service, active reassurance, and a strong awareness of what makes the caller comfortable.' },
  ISTP: { name: 'Virtuoso', summary: 'Calm, observant, and practical under pressure. They diagnose what matters quickly and prefer useful action over unnecessary fuss.', strengths: ['Calm', 'Resourceful', 'Pragmatic'], phone: 'Expect concise troubleshooting, steady composure, and fast adaptation when a call becomes unpredictable.' },
  ISFP: { name: 'Adventurer', summary: 'Gentle, observant, and naturally personable. They respond to the moment with warmth and understated creativity.', strengths: ['Flexible', 'Charming', 'Sensitive'], phone: 'Expect a relaxed conversational style, subtle empathy, and service that adjusts naturally to each caller.' },
  ESTP: { name: 'Entrepreneur', summary: 'Energetic, perceptive, and action-oriented. They read a situation quickly and keep momentum high.', strengths: ['Bold', 'Perceptive', 'Responsive'], phone: 'Expect confident improvisation, fast decisions, and an engaging pace that moves callers toward action.' },
  ESFP: { name: 'Entertainer', summary: 'Playful, generous, and socially intuitive. They make people feel welcome and bring brightness to everyday interactions.', strengths: ['Energetic', 'Friendly', 'Spontaneous'], phone: 'Expect an expressive welcome, immediate rapport, and a memorable sense of warmth throughout the call.' },
};

const MOTION = {
  INTJ: ['architecture', '#818cf8', '#c084fc', '#67e8f9', 6.8], INTP: ['constellation', '#93c5fd', '#a78bfa', '#e0e7ff', 7.2],
  ENTJ: ['command', '#f472b6', '#8b5cf6', '#60a5fa', 6.2], ENTP: ['prism', '#22d3ee', '#c084fc', '#f472b6', 6.5],
  INFJ: ['aurora', '#a5b4fc', '#f0abfc', '#99f6e4', 7.6], INFP: ['wonderland', '#c4b5fd', '#f9a8d4', '#bae6fd', 8.0],
  ENFJ: ['radiance', '#fb7185', '#c084fc', '#fcd34d', 6.9], ENFP: ['fireflies', '#f9a8d4', '#67e8f9', '#c4b5fd', 6.6],
  ISTJ: ['architecture', '#94a3b8', '#818cf8', '#cbd5e1', 7.0], ISFJ: ['ember', '#fda4af', '#d8b4fe', '#fde68a', 7.5],
  ESTJ: ['command', '#fb7185', '#6366f1', '#a5b4fc', 6.0], ESFJ: ['radiance', '#f9a8d4', '#fcd34d', '#c4b5fd', 6.8],
  ISTP: ['constellation', '#67e8f9', '#94a3b8', '#a78bfa', 6.7], ISFP: ['aurora', '#86efac', '#f9a8d4', '#bae6fd', 7.7],
  ESTP: ['prism', '#fb7185', '#22d3ee', '#a78bfa', 5.9], ESFP: ['fireflies', '#fbbf24', '#f472b6', '#67e8f9', 6.3],
};

const MBTI_STYLES = `
  @keyframes mbti-architecture { 0%{opacity:0;transform:scaleX(.04)} 18%{opacity:1;transform:scaleX(.44)} 34%{transform:scaleX(.44) translateX(28%);filter:brightness(1.8)} 52%{transform:scaleX(.82) translateX(-7%)} 70%{transform:scaleX(1);box-shadow:0 0 22px var(--mbti-b)} 100%{opacity:0;transform:scaleX(1)} }
  @keyframes mbti-constellation { 0%{opacity:0;clip-path:inset(0 100% 0 0)} 24%{opacity:.8;clip-path:inset(0 58% 0 0)} 38%{opacity:.35;filter:brightness(2.4)} 62%{opacity:1;clip-path:inset(0 0 0 0);box-shadow:0 0 18px var(--mbti-c)} 100%{opacity:0} }
  @keyframes mbti-command { 0%{opacity:0;transform:scaleX(.01);filter:brightness(4)} 16%{opacity:1;transform:scaleX(.06);box-shadow:0 0 38px white} 34%{transform:scaleX(1);filter:brightness(2.1)} 58%{transform:scaleX(.94);filter:brightness(1.15)} 72%{transform:scaleX(1);box-shadow:0 0 24px var(--mbti-a)} 100%{opacity:0} }
  @keyframes mbti-prism { 0%{opacity:0;transform:translateX(-80%) scaleX(.2)} 22%{opacity:1;transform:translateX(24%) scaleX(.64);filter:hue-rotate(0deg) brightness(1.8)} 46%{transform:translateX(-9%) scaleX(1);filter:hue-rotate(65deg)} 68%{filter:hue-rotate(-30deg) brightness(1.4);box-shadow:0 0 26px var(--mbti-b)} 100%{opacity:0;transform:translateX(0) scaleX(1)} }
  @keyframes mbti-aurora { 0%{opacity:0;transform:scaleX(.2);filter:blur(4px)} 25%{opacity:.78;transform:scaleX(.74);filter:blur(1.4px)} 48%{opacity:1;transform:scaleX(.93);filter:blur(.2px) saturate(1.7)} 66%{transform:scaleX(1);box-shadow:0 0 16px var(--mbti-a),0 0 34px var(--mbti-c)} 100%{opacity:0;filter:blur(0)} }
  @keyframes mbti-wonderland { 0%{opacity:0;transform:scaleX(.08);filter:blur(5px) saturate(.7)} 20%{opacity:.72;transform:scaleX(.66);filter:blur(1.6px) saturate(1.4)} 42%{opacity:1;transform:scaleX(.94);filter:blur(.2px) saturate(1.8)} 58%{transform:scaleX(.88);filter:brightness(1.7)} 72%{transform:scaleX(1);box-shadow:0 0 18px var(--mbti-a),0 0 38px var(--mbti-c)} 100%{opacity:0} }
  @keyframes mbti-radiance { 0%{opacity:0;transform:scaleX(0)} 22%{opacity:1;transform:scaleX(1);filter:brightness(1.8)} 38%{opacity:.45} 50%{opacity:1;box-shadow:0 0 30px var(--mbti-a)} 66%{opacity:.65;filter:brightness(1.25)} 78%{opacity:1} 100%{opacity:0} }
  @keyframes mbti-fireflies { 0%{opacity:0;transform:scaleX(.16)} 18%{opacity:.9;transform:scaleX(.78)} 32%{opacity:.38;filter:brightness(2)} 43%{opacity:1;transform:scaleX(.92)} 56%{opacity:.52} 69%{opacity:1;transform:scaleX(1);box-shadow:0 0 26px var(--mbti-c)} 100%{opacity:0} }
  @keyframes mbti-ember { 0%{opacity:0;transform:scaleX(.1);filter:blur(3px)} 28%{opacity:.7;transform:scaleX(.68);filter:blur(1px)} 50%{opacity:.95;transform:scaleX(.9);filter:brightness(1.35)} 70%{opacity:1;transform:scaleX(1);box-shadow:0 0 20px var(--mbti-a)} 100%{opacity:0} }
  @keyframes mbti-return { 0%,62%{opacity:0} 76%{opacity:.28} 100%{opacity:1} }
  @keyframes mbti-flow { from{background-position:0% 50%} to{background-position:200% 50%} }
  @keyframes mbti-sheen { 0%,72%{opacity:0;transform:translateX(-140%)} 79%{opacity:.3} 88%{opacity:.88;transform:translateX(250%)} 94%,100%{opacity:0;transform:translateX(520%)} }
  @keyframes mbti-star { 0%,12%{opacity:0;transform:translate(-18px,-50%) scale(.15)} 32%{opacity:1;transform:translate(0,-50%) scale(1.4);filter:brightness(2.5)} 58%{opacity:.55;transform:translate(16px,-50%) scale(.7)} 82%,100%{opacity:0;transform:translate(34px,-50%) scale(.15)} }
  @keyframes mbti-aura { 0%{opacity:0;transform:scaleX(.2)} 38%{opacity:.65;transform:scaleX(.85)} 68%{opacity:.32;transform:scaleX(1)} 100%{opacity:0} }
  @media (prefers-reduced-motion:reduce){.mbti-spectrum *{animation-duration:.001ms!important;animation-iteration-count:1!important}}
`;

function MbtiSpectrumLine({ type }) {
  const [motionName, a, b, c, duration] = MOTION[type] || MOTION.INFP;
  const particleCount = type?.startsWith('E') ? 11 : 7;
  return (
    <>
      <style>{MBTI_STYLES}</style>
      <div className="mbti-spectrum relative h-[3px] w-full overflow-visible rounded-t-[30px]" style={{ '--mbti-a': a, '--mbti-b': b, '--mbti-c': c }}>
        <div className="absolute inset-0 overflow-hidden rounded-t-[30px] bg-white/[0.025]">
          <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(90deg, ${a}, ${b}, ${c}, ${a})`, backgroundSize: '240% 100%', transformOrigin: motionName === 'architecture' ? 'left center' : 'center', animation: `mbti-${motionName} ${duration}s cubic-bezier(.16,1,.3,1) forwards, mbti-flow 2.4s linear infinite` }} />
          <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(90deg,#FF32AC,#8B5CF6,#FF32AC)', backgroundSize: '200% 100%', animation: `mbti-return ${duration}s ease-in-out forwards, mbti-flow 3.6s linear ${duration * .68}s infinite` }} />
          <div className="absolute inset-y-[-5px] left-0 w-[34%] rounded-full blur-[2px]" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.1),white,rgba(255,255,255,.1),transparent)', animation: `mbti-sheen ${duration}s cubic-bezier(.16,1,.3,1) forwards, mbti-sheen 8s cubic-bezier(.16,1,.3,1) ${duration}s infinite` }} />
        </div>
        <div className="pointer-events-none absolute inset-x-[8%] top-1/2 h-4 -translate-y-1/2 rounded-full blur-[7px]" style={{ background: `linear-gradient(90deg,transparent,${a}88,${c}66,transparent)`, animation: `mbti-aura ${duration}s ease-in-out forwards` }} />
        {Array.from({ length: particleCount }, (_, index) => (
          <span key={index} className="pointer-events-none absolute top-1/2 h-[2px] w-[2px] rounded-full bg-white" style={{ left: `${9 + ((index * 79) % 86)}%`, boxShadow: `0 0 5px ${index % 2 ? b : c}`, animation: `mbti-star ${2.4 + (index % 4) * .42}s ease-in-out ${.25 + index * .19}s forwards` }} />
        ))}
      </div>
    </>
  );
}

export default function MbtiPersonalityModal({ person, onClose }) {
  const type = String(person?.personality?.mbti || person?.personality_type || '').toUpperCase();
  const profile = PROFILES[type] || { name: 'Personality type', summary: person?.personality?.personality || 'This profile describes the communication style and preferences this receptionist is designed to bring to conversations.', strengths: [], phone: 'Their personality helps shape the tone, pace, and style they use with callers.' };
  const firstName = person?.first_name || person?.full_name || 'This receptionist';

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <motion.div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 px-5 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose} onClick={(event) => event.stopPropagation()}>
      <motion.section role="dialog" aria-modal="true" aria-labelledby="mbti-personality-title" className="relative w-full max-w-[560px] overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#070707]/[0.97] shadow-[0_28px_90px_rgba(0,0,0,.62)]" initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .98 }} transition={{ duration: .2 }} onMouseDown={(event) => event.stopPropagation()}>
        <MbtiSpectrumLine type={type} />
        <div className="pointer-events-none absolute right-[-110px] top-[-130px] h-72 w-72 rounded-full blur-[90px]" style={{ background: `${MOTION[type]?.[1] || '#c4b5fd'}18` }} />
        <div className="relative p-7 sm:p-8">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-zinc-600"><Sparkles size={14} /><span>Personality profile</span></div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 id="mbti-personality-title" className="text-[32px] font-semibold tracking-[-.05em] text-white">{type || 'MBTI'}</h2>
                <span className="text-[15px] font-medium text-zinc-500">{profile.name}</span>
              </div>
              <p className="mt-3 max-w-[470px] text-[13px] leading-6 text-zinc-400">{profile.summary}</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-600 transition hover:text-white" aria-label="Close personality profile"><X size={17} /></button>
          </div>

          {type.length === 4 && (
            <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {type.split('').map((letter) => <div key={letter} className="rounded-xl border border-white/[.07] bg-white/[.025] p-3"><div className="flex items-baseline gap-1.5"><strong className="text-lg text-white">{letter}</strong><span className="truncate text-[10px] font-semibold text-zinc-500">{LETTERS[letter]?.[0]}</span></div><p className="mt-2 text-[10px] leading-[1.55] text-zinc-600">{LETTERS[letter]?.[1]}</p></div>)}
            </div>
          )}

          <div className="mt-7 border-t border-white/[.06] pt-6">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-600">Natural strengths</p>
            <div className="mt-3 flex flex-wrap gap-2">{profile.strengths.map((strength) => <span key={strength} className="rounded-full border border-white/[.08] bg-white/[.04] px-3 py-1.5 text-[11px] font-medium text-zinc-300">{strength}</span>)}</div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-600">How {firstName} may sound on the phone</p>
            <p className="mt-2 text-[12px] leading-5 text-zinc-400">{profile.phone}</p>
          </div>

          <p className="mt-5 text-center text-[10px] leading-4 text-zinc-700">MBTI is a helpful communication lens, not a limit on how a person can think or behave.</p>
        </div>
      </motion.section>
    </motion.div>,
    document.body,
  );
}
