import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';

const LETTERS = {
  E: ['Extraverted', 'Brings an outgoing, expressive energy to conversations and readily engages with callers.'],
  I: ['Introverted', 'Brings a quieter, more reserved presence and tends to speak with intention rather than filling the space.'],
  S: ['Observant', 'Stays grounded in what’s happening right now, giving conversations a practical, down-to-earth feel.'],
  N: ['Intuitive', 'Looks beyond what’s immediately said, giving conversations a more curious, open-ended feel.'],
  T: ['Thinking', 'Approaches conversations with a more matter-of-fact tone, favoring objectivity over emotional expression.'],
  F: ['Feeling', 'Leans into the human side of conversation, putting more emphasis on warmth, empathy, and personal connection.'],
  J: ['Judging', 'Prefers a clear sense of direction, giving conversations a more structured and settled rhythm.'],
  P: ['Prospecting', 'Prefers to stay flexible and follow the moment, giving conversations a more spontaneous, go-with-the-flow rhythm.'],
};

export const MBTI_PROFILES = {
  INTJ: { name: 'Architect', summary: 'Cool, composed, and straight to the point, with an understated confidence. Keeps things purposeful without needing to be the biggest personality in the room.', strengths: ['Strategic', 'Independent', 'Decisive'], phone: 'They ask helpful questions, find clear answers, and stay calm when a caller has a complicated request.' },
  INTP: { name: 'Logician', summary: 'Thoughtful with a slightly quirky edge, making conversations feel relaxed rather than rehearsed. More comfortable being genuine than perfectly polished.', strengths: ['Analytical', 'Inventive', 'Objective'], phone: 'They listen carefully, explain things clearly, and look for a helpful answer when a request is unusual.' },
  ENTJ: { name: 'Commander', summary: 'Bold and self-assured, with a presence that tends to take charge of the conversation. Friendly when it fits, but rarely one to dance around the point.', strengths: ['Confident', 'Efficient', 'Organized'], phone: 'They quickly understand what the caller needs and confidently guide them to the next step.' },
  ENTP: { name: 'Debater', summary: 'Engaging and flexible, with a curious presence that keeps conversations feeling fresh. Prefers an open exchange over a tightly controlled conversational style.', strengths: ['Resourceful', 'Adaptable', 'Quick-witted'], phone: 'They think on their feet, keep the conversation natural, and adjust easily when plans change.' },
  INFJ: { name: 'Advocate', summary: 'Calm and genuinely caring, with a knack for picking up on the feeling behind the words. More heart to heart than quick banter.', strengths: ['Insightful', 'Empathetic', 'Principled'], phone: 'They listen with care, respond kindly, and help callers feel understood while finding a way forward.' },
  INFP: { name: 'Mediator', summary: 'Soft-spoken and sincere, with a natural warmth that makes conversations feel personal rather than transactional. Less take-charge, more meet-you-where-you-are.', strengths: ['Compassionate', 'Creative', 'Open-minded'], phone: 'They give callers time to explain, respond warmly, and tailor their help to each person.' },
  ENFJ: { name: 'Protagonist', summary: 'Confidently friendly, with a natural tendency to cheer people on and keep the conversation moving. More personal and expressive than reserved or strictly businesslike.', strengths: ['Encouraging', 'Reliable', 'Persuasive'], phone: 'They make callers feel welcome, offer reassurance, and explain what to expect next.' },
  ENFP: { name: 'Campaigner', summary: 'Bubbly and personable, with an infectious energy that quickly makes conversations feel less formal. More expressive by nature, so subtle and reserved is not really the vibe.', strengths: ['Enthusiastic', 'Creative', 'Sociable'], phone: 'They bring friendly energy to every call and make routine conversations feel more personal.' },
  ISTJ: { name: 'Logistician', summary: 'Calm and matter-of-fact, with a dependable presence that makes calls feel orderly and predictable. More reserved and traditional than expressive or spontaneous.', strengths: ['Reliable', 'Thorough', 'Practical'], phone: 'They take down details carefully, share accurate information, and make sure follow-up steps are clear.' },
  ISFJ: { name: 'Defender', summary: 'Calm, considerate, and naturally service-minded, bringing a personal touch without becoming overly familiar. More likely to listen and accommodate than strongly steer the conversation.', strengths: ['Supportive', 'Patient', 'Attentive'], phone: 'They offer patient, thoughtful help and make sure callers feel looked after.' },
  ESTJ: { name: 'Executive', summary: 'Straightforward and grounded, with a no-nonsense style that keeps conversations from wandering too far. Less playful by nature, but never needlessly stiff.', strengths: ['Direct', 'Structured', 'Dependable'], phone: 'They get callers to the right person, explain things clearly, and keep busy calls on track.' },
  ESFJ: { name: 'Consul', summary: 'Treats good service as making someone feel genuinely looked after, not just answering their question. This gives calls a more personal, social flavor than a strictly professional one.', strengths: ['Welcoming', 'Loyal', 'Considerate'], phone: 'They give each caller a friendly welcome and make sure they feel cared for.' },
  ISTP: { name: 'Virtuoso', summary: 'The low-key problem-solver vibe, relaxed, observant, and not interested in making things more complicated than they need to be. Usually keeps the conversation lean rather than filling the space.', strengths: ['Calm', 'Resourceful', 'Pragmatic'], phone: 'They stay calm, get to the point, and help solve the caller’s problem without fuss.' },
  ISFP: { name: 'Adventurer', summary: 'Soft-spoken and easy to be around, with a natural feel for the mood of the call. Tends to follow the moment rather than force the conversation into a set rhythm.', strengths: ['Flexible', 'Charming', 'Sensitive'], phone: 'They keep calls relaxed and friendly, adapting their help to the person they’re speaking with.' },
  ESTP: { name: 'Entrepreneur', summary: 'Has a natural “let’s get to it” energy that keeps calls from feeling sluggish. Comfortable jumping in and taking the conversation wherever it needs to go.', strengths: ['Bold', 'Perceptive', 'Responsive'], phone: 'They respond quickly, keep things moving, and help callers decide what to do next.' },
  ESFP: { name: 'Entertainer', summary: 'Feels like the receptionist who already knows everyone’s name. Sociable, expressive, and welcoming, with more emphasis on connection than keeping every call perfectly streamlined.', strengths: ['Energetic', 'Friendly', 'Spontaneous'], phone: 'They bring a cheerful welcome and make callers feel comfortable from the start.' },
};

const NAME_PERSONALIZED_TYPES = new Set(['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ISFJ', 'ENFJ']);

export const getMbtiProfileSummary = (type, name) => {
  const normalizedType = String(type || '').toUpperCase();
  const summary = MBTI_PROFILES[normalizedType]?.summary || '';
  const cleanName = String(name || '').trim();
  if (!summary || !cleanName || !NAME_PERSONALIZED_TYPES.has(normalizedType)) return summary;
  if (normalizedType === 'INTJ') return `${cleanName} is cool, composed, and straight to the point, with an understated confidence. Keeps things purposeful without needing to be the biggest personality in the room.`;
  if (normalizedType === 'INTP') return `Thoughtful with a slightly quirky edge, ${cleanName} makes conversations feel relaxed rather than rehearsed. More comfortable being genuine than perfectly polished.`;
  if (normalizedType === 'ENTJ') return `${cleanName} is bold and self-assured, with a presence that tends to take charge of the conversation. Friendly when it fits, but rarely one to dance around the point.`;
  if (normalizedType === 'ENTP') return `Engaging and flexible, ${cleanName} brings a curious presence that keeps conversations feeling fresh. Prefers an open exchange over a tightly controlled conversational style.`;
  if (normalizedType === 'INFJ') return `Calm and genuinely caring, ${cleanName} has a knack for picking up on the feeling behind the words. More heart to heart than quick banter.`;
  if (normalizedType === 'INFP') return `Soft-spoken and sincere, ${cleanName} brings a natural warmth that makes conversations feel personal rather than transactional. Less take-charge, more meet-you-where-you-are.`;
  if (normalizedType === 'ISFJ') return `Calm, considerate, and naturally service-minded, ${cleanName} brings a personal touch without becoming overly familiar. More likely to listen and accommodate than strongly steer the conversation.`;
  if (normalizedType === 'ENFJ') return `${cleanName} is confidently friendly, with a natural tendency to cheer people on and keep the conversation moving. More personal and expressive than reserved or strictly businesslike.`;
  return summary;
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
  const profile = MBTI_PROFILES[type] || { name: 'Personality type', summary: person?.personality?.personality || 'This profile describes the communication style and preferences this receptionist is designed to bring to conversations.', strengths: [], phone: 'Their personality helps shape the tone, pace, and style they use with callers.' };
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
      <motion.section role="dialog" aria-modal="true" aria-labelledby="mbti-personality-title" className="relative w-full max-w-[620px] overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#070707]/[0.97] shadow-[0_28px_90px_rgba(0,0,0,.62)]" initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .98 }} transition={{ duration: .2 }} onMouseDown={(event) => event.stopPropagation()}>
        <MbtiSpectrumLine type={type} />
        <div className="pointer-events-none absolute right-[-110px] top-[-130px] h-72 w-72 rounded-full blur-[90px]" style={{ background: `${SPECTRUM[type]?.[0] || '#c4b5fd'}18` }} />
        <div className="relative p-7 sm:px-9 sm:py-8">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-zinc-600"><Sparkles size={14} /><span>Personality profile</span></div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 id="mbti-personality-title" className="text-[36px] font-semibold tracking-[-.05em] text-white">{type || 'MBTI'}</h2>
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-600 transition hover:text-white" aria-label="Close personality profile"><X size={17} /></button>
          </div>

          {type.length === 4 && (
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {type.split('').map((letter) => <div key={letter} className="flex items-start gap-3 rounded-lg border border-white/[.045] bg-transparent px-3.5 py-3"><div className="flex w-[82px] shrink-0 items-baseline gap-1.5"><strong className="text-xl text-white">{letter}</strong><span className="text-[11px] font-semibold text-zinc-400">{LETTERS[letter]?.[0]}</span></div><p className="min-w-0 pt-0.5 text-[11px] leading-[1.6] text-zinc-500">{LETTERS[letter]?.[1]}</p></div>)}
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
