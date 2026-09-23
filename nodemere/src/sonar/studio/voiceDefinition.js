export const CHARACTERISTICS = [
  { key: 'gender', label: 'Gender', title: 'Every voice starts\nwith a presence.', hint: 'Choose the foundation. Make it unmistakably yours.', options: ['Feminine', 'Masculine'], notes: ['Clear. Expressive. Distinct.', 'Grounded. Resonant. Present.'] },
  { key: 'age', label: 'Age', title: 'A little life\nin every word.', hint: 'Shape the perceived age of the voice.', options: ['Young adult', 'Middle-aged', 'Mature'], notes: ['A fresh, youthful character', 'An experienced, assured presence', 'Depth and lived-in character'] },
  { key: 'accent', label: 'Ethnicity', title: 'Who is taking\nshape?', hint: 'Define the receptionist’s visual identity and presence.', options: ['African', 'American', 'Australian', 'British', 'Canadian', 'Indian', 'Irish', 'Italian', 'Hispanic / Latina'], notes: ['Distinct and composed', 'Polished and familiar', 'Bright and natural', 'Refined and poised', 'Open and approachable', 'Warm and expressive', 'Characterful and clear', 'Elegant and assured', 'Vivid and welcoming'] },
  { key: 'tone', label: 'Tone', title: 'Blend the feeling\nof the first hello.', hint: 'Choose the ingredients of the delivery, then decide how much of each belongs in the voice.', control: 'blend', options: ['Calm', 'Caring', 'Charming', 'Friendly', 'Motivational', 'Playful', 'Serious'], notes: ['Steady and reassuring', 'Attentive and warm', 'Polished with ease', 'Open and welcoming', 'Bright and encouraging', 'Light and expressive', 'Focused and composed'] },
];

export const SUB_ACCENTS = {
  African: ['Nigerian', 'Ghanaian', 'Kenyan', 'South African', 'Ethiopian', 'Ugandan'],
  American: ['New York', 'New England', 'Texan', 'Midwest', 'Californian', 'Southern'],
  Australian: ['Sydney', 'Melbourne', 'Queensland', 'Adelaide', 'Perth', 'Tasmanian'],
  British: ['London', 'Yorkshire', 'Scottish', 'Welsh', 'Liverpool', 'Manchester'],
  Canadian: ['Toronto', 'Quebec English', 'Newfoundland', 'Maritime', 'Vancouver', 'Ottawa Valley'],
  Indian: ['Hindi-influenced', 'Bengali-influenced', 'Tamil-influenced', 'Punjabi-influenced', 'Gujarati-influenced', 'Malayalam-influenced'],
  Irish: ['Dublin', 'Cork', 'Belfast', 'Galway', 'Limerick', 'Donegal'],
  Italian: ['Roman', 'Sicilian', 'Neapolitan', 'Tuscan', 'Milanese', 'Venetian'],
  'Hispanic / Latina': ['Mexican', 'Puerto Rican', 'Cuban', 'Colombian', 'Argentinian', 'Dominican'],
};

export const DEFAULT_PREVIEW = 'Hello, thank you for calling. I’m here to help you find what you need, answer your questions, or arrange a time that works for you. How can I make your day a little easier?';

const TONE_LANGUAGE = {
  Calm: { noun: 'calm', adjective: 'calm', phrase: 'steady and reassuring' },
  Caring: { noun: 'care', adjective: 'caring', phrase: 'attentive and warm' },
  Charming: { noun: 'charm', adjective: 'charming', phrase: 'polished and approachable' },
  Friendly: { noun: 'friendliness', adjective: 'friendly', phrase: 'open and welcoming' },
  Motivational: { noun: 'energy', adjective: 'motivational', phrase: 'bright and encouraging' },
  Playful: { noun: 'playfulness', adjective: 'playful', phrase: 'light and expressive' },
  Serious: { noun: 'seriousness', adjective: 'serious', phrase: 'focused and composed' },
};

const TONE_LOUDNESS = {
  Calm: -.25,
  Caring: -.05,
  Charming: .1,
  Friendly: .15,
  Motivational: .45,
  Playful: .35,
  Serious: -.1,
};

function weightedTones(toneWeights = {}) {
  return Object.entries(toneWeights)
    .map(([tone, value]) => ({ tone, value: Number(value) || 0, language: TONE_LANGUAGE[tone] || { noun: tone.toLowerCase(), adjective: tone.toLowerCase(), phrase: tone.toLowerCase() } }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function joinNatural(parts) {
  if (parts.length <= 1) return parts[0] || '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
}

function toneLevel(value) {
  if (value >= 85) return 'defining';
  if (value >= 60) return 'leading';
  if (value >= 30) return 'supporting';
  return 'accent';
}

export function describeToneWeights(toneWeights = {}) {
  return weightedTones(toneWeights)
    .map(({ tone, value }) => `${tone.toLowerCase()} ${toneLevel(value)}`)
    .join(', ');
}

export function inferLoudnessFromToneWeights(toneWeights = {}, fallback = .25) {
  const tones = weightedTones(toneWeights);
  if (!tones.length) return fallback;
  const total = tones.reduce((sum, { value }) => sum + value, 0);
  const weighted = tones.reduce((sum, { tone, value }) => sum + (TONE_LOUDNESS[tone] ?? 0) * value, 0) / total;
  return Math.max(-1, Math.min(1, Number(weighted.toFixed(1))));
}

export function buildToneDirection(toneWeights = {}, fallbackTone = '') {
  const tones = weightedTones(toneWeights);
  if (!tones.length) return fallbackTone ? `The emotional delivery should feel ${fallbackTone.toLowerCase()}.` : '';

  const defining = tones.filter(({ value }) => value >= 85);
  const leading = tones.filter(({ value }) => value >= 60 && value < 85);
  const supporting = tones.filter(({ value }) => value >= 30 && value < 60);
  const accents = tones.filter(({ value }) => value > 0 && value < 30);
  const leadGroup = defining.length ? defining : leading.length ? leading : tones.slice(0, 1);
  const lines = [];

  if (leadGroup.length === 1) {
    const lead = leadGroup[0];
    lines.push(`The emotional delivery should be led by a ${lead.language.phrase} ${lead.language.noun}.`);
  } else {
    lines.push(`The emotional delivery should be led by ${joinNatural(leadGroup.map(({ language }) => language.phrase))}.`);
  }

  const supportingGroup = supporting.filter(item => !leadGroup.includes(item));
  if (supportingGroup.length) lines.push(`Let ${joinNatural(supportingGroup.map(({ language }) => language.noun))} come through as ${supportingGroup.length === 1 ? 'a supporting quality' : 'supporting qualities'}.`);
  if (accents.length) lines.push(`Use just a light trace of ${joinNatural(accents.map(({ language }) => language.noun))}.`);

  const omitted = CHARACTERISTICS.find(item => item.key === 'tone')?.options
    .filter(tone => !tones.some(item => item.tone === tone)) || [];
  const avoid = omitted.filter(tone => ['Motivational', 'Playful', 'Serious'].includes(tone));
  if (avoid.length && tones.length >= 2) lines.push(`Avoid making the delivery feel ${joinNatural(avoid.map(tone => TONE_LANGUAGE[tone].adjective))}.`);

  return lines.join(' ');
}

export function buildVoiceDescription(values) {
  const gender = { Feminine: 'feminine', Masculine: 'masculine' }[values.gender] || 'natural';
  const age = values.age?.toLowerCase();
  return [`${age ? `A ${age}` : 'An adult'} ${gender} receptionist voice.`,
    values.accent ? values.subAccent ? `The accent direction is ${values.accent.toLowerCase()}, with a subtle ${values.subAccent.toLowerCase()} regional character.` : `The accent direction is ${values.accent.toLowerCase()}.` : '',
    buildToneDirection(values.toneWeights, values.tone),
    'Clear articulation, a comfortable conversational pace, and natural pauses. Studio-quality audio.'].filter(Boolean).join(' ');
}
// Keep the edited prose separate: selections never silently replace writing.
export function composeDescription(values, direction) {
  return [buildVoiceDescription(values), direction.trim()].filter(Boolean).join('\n\n');
}
