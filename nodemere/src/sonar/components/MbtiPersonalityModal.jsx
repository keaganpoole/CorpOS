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

const SPECTRUM = {
  INTJ: ['#111827', '#4f46e5', '#67e8f9', 5.8], INTP: ['#0f172a', '#3b82f6', '#c4b5fd', 6.4],
  ENTJ: ['#4c0519', '#e11d48', '#8b5cf6', 5.2], ENTP: ['#083344', '#06b6d4', '#d946ef', 5.7],
  INFJ: ['#0f172a', '#7c3aed', '#e9d5ff', 6.7], INFP: ['#4c0519', '#ff315f', '#fecdd3', 7.1],
  ENFJ: ['#7c2d12', '#fb7185', '#facc15', 5.9], ENFP: ['#701a75', '#ec4899', '#2dd4bf', 5.6],
  ISTJ: ['#0f172a', '#475569', '#cbd5e1', 6.1], ISFJ: ['#4c1d24', '#fb7185', '#fef3c7', 6.6],
  ESTJ: ['#450a0a', '#dc2626', '#4338ca', 5.1], ESFJ: ['#7c2d12', '#fb7185', '#fde68a', 5.8],
  ISTP: ['#082f49', '#0891b2', '#64748b', 5.5], ISFP: ['#052e16', '#22c55e', '#f9a8d4', 6.8],
  ESTP: ['#431407', '#f97316', '#ef4444', 4.9], ESFP: ['#422006', '#facc15', '#f43f5e', 5.4],
};

const EASINGS = {
  INTJ: 'cubic-bezier(.55,0,.25,1)', INTP: 'cubic-bezier(.45,0,.25,1)', ENTJ: 'cubic-bezier(.25,.75,.2,1)', ENTP: 'cubic-bezier(.35,0,.25,1)',
  INFJ: 'cubic-bezier(.4,0,.15,1)', INFP: 'cubic-bezier(.22,.75,.18,1)', ENFJ: 'cubic-bezier(.25,.75,.25,1)', ENFP: 'cubic-bezier(.3,.8,.25,1)',
  ISTJ: 'cubic-bezier(.45,0,.25,1)', ISFJ: 'cubic-bezier(.4,0,.3,1)', ESTJ: 'cubic-bezier(.3,.7,.2,1)', ESFJ: 'cubic-bezier(.3,.75,.25,1)',
  ISTP: 'cubic-bezier(.55,0,.3,1)', ISFP: 'cubic-bezier(.35,0,.2,1)', ESTP: 'cubic-bezier(.45,0,.25,1)', ESFP: 'cubic-bezier(.3,.75,.25,1)',
};

const MBTI_STYLES = `
  @keyframes mbti-brand-return{0%,58%{opacity:0}76%{opacity:.3}100%{opacity:1}}
  @keyframes mbti-brand-flow{from{background-position:0% 50%}to{background-position:200% 50%}}
  @keyframes mbti-god-sheen{0%,74%{opacity:0;transform:translateX(-140%)}82%{opacity:.22}89%{opacity:.8;transform:translateX(260%)}95%,100%{opacity:0;transform:translateX(540%)}}
  @keyframes mbti-lens{0%,76%{opacity:0;transform:translateX(-180%)}86%{opacity:.65}94%,100%{opacity:0;transform:translateX(760%)}}
  @keyframes mbti-intj{0%{opacity:0;clip-path:inset(0 100% 0 0)}18%{opacity:1;clip-path:inset(0 76% 0 0)}32%{clip-path:inset(0 52% 0 0)}48%{clip-path:inset(0 28% 0 0);filter:brightness(1.8)}68%{clip-path:inset(0);box-shadow:0 0 14px var(--mbti-b)}100%{opacity:0}}
  @keyframes mbti-intp{0%{opacity:0;background-position:0% 50%;filter:blur(1.2px)}26%{opacity:.62;background-position:30% 50%;filter:blur(.3px)}54%{opacity:.84;background-position:62% 50%;filter:blur(0) brightness(1.12)}78%{opacity:.52;background-position:88% 50%}100%{opacity:0;background-position:100% 50%}}
  @keyframes mbti-entj{0%{opacity:0;transform:translateX(-105%);filter:brightness(3)}20%{opacity:1;transform:translateX(-35%)}37%{transform:translateX(0);box-shadow:0 0 22px var(--mbti-a)}52%{transform:translateX(18%);filter:brightness(1.5)}72%{transform:translateX(0)}100%{opacity:0}}
  @keyframes mbti-entp{0%{opacity:0;background-position:0% 50%;filter:hue-rotate(0)}24%{opacity:.68;background-position:28% 50%}52%{opacity:.88;background-position:58% 50%;filter:hue-rotate(18deg) brightness(1.15)}78%{opacity:.58;background-position:84% 50%;filter:hue-rotate(0)}100%{opacity:0;background-position:100% 50%}}
  @keyframes mbti-infj{0%{opacity:0;filter:blur(2px);background-position:0% 50%}28%{opacity:.58;filter:blur(.7px);background-position:32% 50%}56%{opacity:.82;filter:blur(.1px) saturate(1.25);background-position:66% 50%}79%{opacity:.5;filter:blur(.35px);background-position:90% 50%}100%{opacity:0;background-position:100% 50%}}
  @keyframes mbti-infp{0%{opacity:0;filter:blur(1.4px) saturate(.85);background-position:0% 50%}28%{opacity:.6;filter:blur(.4px) saturate(1.1);background-position:32% 50%}56%{opacity:.84;filter:blur(0) saturate(1.3);background-position:66% 50%}79%{opacity:.52;filter:brightness(1.08);background-position:90% 50%}100%{opacity:0;background-position:100% 50%}}
  @keyframes mbti-enfj{0%{opacity:0;transform:translateX(-55%);filter:brightness(.9)}27%{opacity:.64;transform:translateX(-22%)}55%{opacity:.86;transform:translateX(0);filter:brightness(1.12)}79%{opacity:.52;transform:translateX(8%);box-shadow:0 0 9px var(--mbti-a)}100%{opacity:0;transform:translateX(12%)}}
  @keyframes mbti-enfp{0%{opacity:0;background-size:320% 100%;background-position:0% 50%;filter:brightness(.9)}22%{opacity:.68;background-position:28% 50%;filter:brightness(1.05)}52%{opacity:.88;background-position:62% 50%;filter:brightness(1.18)}78%{opacity:.58;background-position:88% 50%;filter:brightness(1.05)}100%{opacity:0;background-position:100% 50%}}
  @keyframes mbti-istj{0%{opacity:0;clip-path:inset(0 100% 0 0)}20%{opacity:1;clip-path:inset(0 80% 0 0)}40%{clip-path:inset(0 60% 0 0)}60%{clip-path:inset(0 40% 0 0)}80%{clip-path:inset(0 20% 0 0);filter:brightness(1.5)}92%{clip-path:inset(0)}100%{opacity:0}}
  @keyframes mbti-isfj{0%{opacity:0;filter:brightness(.75)}25%{opacity:.62;filter:brightness(.95)}54%{opacity:.86;filter:brightness(1.12);box-shadow:0 0 9px var(--mbti-c)}78%{opacity:.54;filter:brightness(1)}100%{opacity:0}}
  @keyframes mbti-estj{0%{opacity:0;background-position:0% 50%;filter:saturate(.85)}26%{opacity:.64;background-position:28% 50%;filter:saturate(1)}58%{opacity:.84;background-position:62% 50%;filter:saturate(1.08) brightness(1.06)}80%{opacity:.52;background-position:88% 50%;box-shadow:0 0 7px var(--mbti-b)}100%{opacity:0;background-position:100% 50%;filter:saturate(1)}}
  @keyframes mbti-esfj{0%{opacity:0;background-position:100% 50%;filter:brightness(.9)}25%{opacity:.65;background-position:72% 50%}54%{opacity:.86;background-position:40% 50%;filter:brightness(1.14);box-shadow:0 0 9px var(--mbti-a)}78%{opacity:.55;background-position:16% 50%;filter:brightness(1)}100%{opacity:0;background-position:0% 50%}}
  @keyframes mbti-istp{0%{opacity:0;transform:translateX(105%)}18%{opacity:1;transform:translateX(45%);filter:brightness(2)}34%{transform:translateX(-8%)}48%{opacity:.35;transform:translateX(16%)}62%{opacity:1;transform:translateX(-3%);box-shadow:0 0 16px var(--mbti-a)}100%{opacity:0;transform:translateX(-45%)}}
  @keyframes mbti-isfp{0%{opacity:0;background-position:0% 50%;filter:blur(1.2px)}28%{opacity:.6;background-position:32% 50%;filter:blur(.35px)}56%{opacity:.83;background-position:66% 50%;filter:hue-rotate(8deg) saturate(1.25)}79%{opacity:.5;background-position:90% 50%;filter:hue-rotate(0)}100%{opacity:0;background-position:100% 50%}}
  @keyframes mbti-estp{0%{opacity:0;transform:translateX(-18%);filter:brightness(.9)}23%{opacity:.7;transform:translateX(-7%)}52%{opacity:.9;transform:translateX(4%);filter:brightness(1.18)}78%{opacity:.56;transform:translateX(14%);box-shadow:0 0 10px var(--mbti-b)}100%{opacity:0;transform:translateX(22%)}}
  @keyframes mbti-esfp{0%{opacity:0;background-position:0% 50%;filter:brightness(.9)}23%{opacity:.7;background-position:30% 50%}52%{opacity:.9;background-position:65% 50%;filter:brightness(1.18)}78%{opacity:.58;background-position:90% 50%;filter:hue-rotate(10deg);box-shadow:0 0 10px var(--mbti-c)}100%{opacity:0;background-position:100% 50%}}
  @media (prefers-reduced-motion:reduce){.mbti-spectrum *{animation-duration:.001ms!important;animation-iteration-count:1!important}}
`;

function MbtiSpectrumLine({ type }) {
  const resolvedType = SPECTRUM[type] ? type : 'INFP';
  const [a, b, c, baseDuration] = SPECTRUM[resolvedType];
  const duration = baseDuration * .5;
  const lower = resolvedType.toLowerCase();
  const easing = EASINGS[resolvedType];
  const pattern = resolvedType === 'ISTJ'
    ? `repeating-linear-gradient(90deg,${a} 0 8%,transparent 8% 10%,${b} 10% 18%,transparent 18% 20%)`
    : resolvedType === 'ESTJ'
      ? `linear-gradient(90deg,${a},${b},${c},#818cf8,${b},${a})`
    : resolvedType === 'INTP'
      ? `radial-gradient(circle at 12% 50%,${c} 0 1px,transparent 1.5px),radial-gradient(circle at 38% 50%,${a} 0 1px,transparent 1.5px),radial-gradient(circle at 67% 50%,${b} 0 1px,transparent 1.5px),linear-gradient(90deg,${a},${b},${c})`
      : `linear-gradient(90deg,${a},${b},${c},${a})`;

  return (
    <>
      <style>{MBTI_STYLES}</style>
      <div className="mbti-spectrum relative h-[4px] w-full overflow-hidden rounded-t-[30px] bg-white/[.025]" style={{ '--mbti-a': a, '--mbti-b': b, '--mbti-c': c }}>
        <div className="absolute inset-0 rounded-full" style={{ backgroundImage: pattern, backgroundSize: resolvedType === 'ISTJ' ? '100% 100%' : '260% 100%', animation: `mbti-${lower} ${duration}s ${easing} forwards` }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.1),transparent 42%,rgba(0,0,0,.3))' }} />
        <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(90deg,#FF32AC,#8B5CF6,#FF32AC)', backgroundSize: '200% 100%', animation: `mbti-brand-return ${duration}s ease-in-out forwards,mbti-brand-flow 3.6s linear ${duration * .72}s infinite` }} />
        <div className="absolute inset-y-[-4px] left-0 w-[38%] rounded-full blur-[2px]" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.08),rgba(255,255,255,.72),rgba(255,255,255,.08),transparent)', animation: `mbti-god-sheen ${duration}s cubic-bezier(.16,1,.3,1) forwards,mbti-god-sheen 8s cubic-bezier(.16,1,.3,1) ${duration}s infinite` }} />
        <div className="absolute inset-y-0 left-0 w-[14%]" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.8),transparent)', animation: `mbti-lens ${duration}s cubic-bezier(.16,1,.3,1) forwards,mbti-lens 8s cubic-bezier(.16,1,.3,1) ${duration}s infinite` }} />
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
        <div className="pointer-events-none absolute right-[-110px] top-[-130px] h-72 w-72 rounded-full blur-[90px]" style={{ background: `${SPECTRUM[type]?.[0] || '#c4b5fd'}18` }} />
        <div className="relative p-6 sm:px-8 sm:py-7">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-zinc-600"><Sparkles size={14} /><span>Personality profile</span></div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 id="mbti-personality-title" className="text-[32px] font-semibold tracking-[-.05em] text-white">{type || 'MBTI'}</h2>
              </div>
              <p className="mt-3 max-w-[470px] text-[13px] leading-6 text-zinc-400">{profile.phone}</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-600 transition hover:text-white" aria-label="Close personality profile"><X size={17} /></button>
          </div>

          {type.length === 4 && (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {type.split('').map((letter) => <div key={letter} className="rounded-xl border border-white/[.07] bg-white/[.025] p-3"><div className="flex items-baseline gap-1.5"><strong className="text-lg text-white">{letter}</strong><span className="truncate text-[10px] font-semibold text-zinc-500">{LETTERS[letter]?.[0]}</span></div><p className="mt-2 text-[10px] leading-[1.55] text-zinc-600">{LETTERS[letter]?.[1]}</p></div>)}
            </div>
          )}

          <div className="mt-10 border-t border-white/[.045] pt-5">
            <p className="text-center text-[10px] leading-4 text-zinc-700">MBTI is a helpful communication lens, not a limit on how a person can think or behave.</p>
          </div>
        </div>
      </motion.section>
    </motion.div>,
    document.body,
  );
}
