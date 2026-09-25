export const CHARACTERISTICS = [
  { key: 'gender', label: 'Gender', title: 'Choose a\ngender.', hint: "Set the foundation for your receptionist's voice.", options: ['Feminine', 'Masculine'], notes: ['Clear. Expressive. Distinct.', 'Grounded. Resonant. Present.'] },
  { key: 'age', label: 'Age', title: 'Choose an age\nrange.', hint: 'Choose the age range that best fits your brand.', options: ['Young adult', 'Middle-aged', 'Mature'], notes: ['Fresh and youthful', 'Experienced and assured', 'Mature and established'] },
  { key: 'accent', label: 'Accent', title: 'Choose an\naccent.', hint: 'Give their voice an authentic sound rooted in place and culture.', options: ['African', 'American', 'Australian', 'British', 'Canadian', 'Chinese', 'Indian', 'Irish', 'Italian', 'Japanese', 'Hispanic / Latina'], notes: ['African accent', 'American accent', 'Australian accent', 'British accent', 'Canadian accent', 'Chinese accent', 'Indian accent', 'Irish accent', 'Italian accent', 'Japanese accent', 'Latina accent'] },
  { key: 'tone', label: 'Personality', title: 'Set the vibe.', hint: 'Give their voice a personality people can feel and remember.', control: 'blend', options: ['Calm', 'Caring', 'Charming', 'Friendly', 'Motivational', 'Playful', 'Serious'], notes: ['Steady and reassuring', 'Attentive and warm', 'Polished with ease', 'Open and welcoming', 'Bright and encouraging', 'Light and expressive', 'Focused and composed'] },
];

export const SUB_ACCENTS = {
  African: ['Nigerian', 'Ghanaian', 'Kenyan', 'South African', 'Ethiopian', 'Ugandan'],
  American: ['New York', 'New England', 'Texan', 'Midwest', 'Californian', 'Southern'],
  Australian: ['Sydney', 'Melbourne', 'Queensland', 'Adelaide', 'Perth', 'Tasmanian'],
  British: ['London', 'Yorkshire', 'Scottish', 'Welsh', 'Liverpool', 'Manchester'],
  Canadian: ['Toronto', 'Quebec English', 'Newfoundland', 'Maritime', 'Vancouver', 'Ottawa Valley'],
  Chinese: ['Beijing', 'Shanghai', 'Cantonese-influenced', 'Taiwanese', 'Sichuanese', 'Hong Kong'],
  Indian: ['Hindi-influenced', 'Bengali-influenced', 'Tamil-influenced', 'Punjabi-influenced', 'Gujarati-influenced', 'Malayalam-influenced'],
  Irish: ['Dublin', 'Cork', 'Belfast', 'Galway', 'Limerick', 'Donegal'],
  Italian: ['Roman', 'Sicilian', 'Neapolitan', 'Tuscan', 'Milanese', 'Venetian'],
  Japanese: ['Tokyo', 'Kansai', 'Osaka', 'Kyoto', 'Hokkaido', 'Okinawan'],
  'Hispanic / Latina': ['Mexican', 'Puerto Rican', 'Cuban', 'Colombian', 'Argentinian', 'Dominican'],
};

const COUNTRY_LANDSCAPE_BASE = 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/audition_faces/countries';

export const ACCENT_LANDSCAPES = {
  African: `${COUNTRY_LANDSCAPE_BASE}/african_landscape2.png`,
  American: `${COUNTRY_LANDSCAPE_BASE}/american_landscape2.png`,
  Australian: `${COUNTRY_LANDSCAPE_BASE}/australian_landscape2.png`,
  British: `${COUNTRY_LANDSCAPE_BASE}/british_landscape2.png`,
  Canadian: `${COUNTRY_LANDSCAPE_BASE}/canadian_landscape2.png`,
  Chinese: `${COUNTRY_LANDSCAPE_BASE}/chinese_landscape2.png`,
  Indian: `${COUNTRY_LANDSCAPE_BASE}/indian_landscape2.png`,
  Irish: `${COUNTRY_LANDSCAPE_BASE}/irish_landscape2.png`,
  Italian: `${COUNTRY_LANDSCAPE_BASE}/italian_landscape2.png`,
  Japanese: `${COUNTRY_LANDSCAPE_BASE}/japanese_landscape2.png`,
  'Hispanic / Latina': `${COUNTRY_LANDSCAPE_BASE}/latino_landscape2.png`,
};

// Studio DNA colors use cinematic light families rather than literal flags.
export const ACCENT_PALETTES = {
  African: ['#080708', '#8b3f6f', '#d7a86a'], American: ['#070912', '#2c5cff', '#d94a63'],
  Australian: ['#071014', '#15a6b8', '#d8aa61'], British: ['#090914', '#6847d8', '#d15c7a'],
  Canadian: ['#0d070b', '#cf3659', '#e2b9a5'], Indian: ['#0d0709', '#c76230', '#e1b84d'],
  Chinese: ['#0d0709', '#cf3c4d', '#d7a35f'], Irish: ['#07100b', '#2f8a68', '#d4bd7a'], Italian: ['#07100f', '#42805f', '#d75d77'],
  Japanese: ['#0b0910', '#cc6387', '#d9b4c4'],
  'Hispanic / Latina': ['#0e0709', '#d04f55', '#d79b4e'],
};

export const SUB_ACCENT_PALETTES = {
  Nigerian: ['#080708', '#8a3d73', '#dfa966'], Ghanaian: ['#080708', '#a84563', '#d9af4f'], Kenyan: ['#070708', '#7d3e5a', '#d5a978'],
  'South African': ['#070912', '#2761d8', '#d29457'], Ethiopian: ['#07100b', '#3d8d65', '#d8ad4c'], Ugandan: ['#080708', '#8c4a58', '#d5a45b'],
  'New York': ['#070912', '#2f5cff', '#d64b63'], 'New England': ['#080d13', '#3d67d8', '#d7b0a3'],
  Texan: ['#0d0709', '#bd4f47', '#d8a25d'], Midwest: ['#080d12', '#5164d2', '#d8b16d'],
  Californian: ['#071014', '#13a6bf', '#d7a968'], Southern: ['#0d0709', '#c05166', '#d5a065'],
  Roman: ['#07100f', '#42805f', '#d65d77'], Sicilian: ['#0d0709', '#b04c69', '#d89b64'],
  Neapolitan: ['#0d0709', '#c04f5f', '#d5a46e'], Tuscan: ['#080d09', '#6d8056', '#dbb55d'],
  Milanese: ['#080a12', '#5a57c8', '#d1b1a0'], Venetian: ['#071014', '#168e9a', '#d4b17b'],
  Sydney: ['#071014', '#149eb5', '#d9a95e'], Melbourne: ['#080a14', '#5262d5', '#d1a988'],
  Queensland: ['#07100b', '#27a06f', '#d6ad5f'], Adelaide: ['#0d070b', '#9c4b67', '#d5aa7d'],
  Perth: ['#071014', '#148da4', '#d7a965'], Tasmanian: ['#07100f', '#338874', '#d0b476'],
  London: ['#090914', '#6847d8', '#d15c7a'], Yorkshire: ['#080d13', '#4a6dcf', '#d2ad85'], Scottish: ['#080d16', '#2d65d6', '#d6b992'],
  Welsh: ['#0d0709', '#c34960', '#d5ac62'], Liverpool: ['#080a14', '#6a57d2', '#d56d83'], Manchester: ['#080b14', '#5967d5', '#d0ac8d'],
  Toronto: ['#0d070b', '#cf3659', '#e1b5a2'], 'Quebec English': ['#080d16', '#3566d5', '#d6aaa2'], Newfoundland: ['#080d14', '#4b72d3', '#d5b095'],
  Maritime: ['#071014', '#1889b5', '#d2ae80'], Vancouver: ['#07100b', '#2b8f72', '#d2b27e'], 'Ottawa Valley': ['#0a080e', '#7b59ca', '#d3b099'],
  Beijing: ['#0d0709', '#cf3c4d', '#d7a35f'], Shanghai: ['#0d0709', '#c94a5e', '#d6a16a'], 'Cantonese-influenced': ['#0d0709', '#d04a4d', '#d2ac6f'],
  Taiwanese: ['#07100f', '#268f7b', '#d7a866'], Sichuanese: ['#0d0708', '#d3483a', '#d78f50'], 'Hong Kong': ['#080a14', '#655bd1', '#d56275'],
  'Hindi-influenced': ['#0d0709', '#c76230', '#e1b84d'], 'Bengali-influenced': ['#0d0709', '#bd4b66', '#d9a45f'],
  'Tamil-influenced': ['#0d0709', '#b35535', '#d9a956'], 'Punjabi-influenced': ['#0d0709', '#c56a37', '#dfb64b'],
  'Gujarati-influenced': ['#0d0709', '#af6541', '#dcb45b'], 'Malayalam-influenced': ['#07100b', '#378c66', '#d4b35c'],
  Dublin: ['#07100b', '#2f8a68', '#d4bd7a'], Cork: ['#07100b', '#47905f', '#d8b86c'], Belfast: ['#080b14', '#5960d0', '#d56a80'],
  Galway: ['#071014', '#238883', '#d3ba7b'], Limerick: ['#07100b', '#568d62', '#d6b56b'], Donegal: ['#07100f', '#3d8978', '#d0bd82'],
  Tokyo: ['#0b0910', '#cc6387', '#d9b4c4'], Kansai: ['#0d0709', '#bd4e74', '#d7ad9b'], Osaka: ['#0d0709', '#c75367', '#d7a866'],
  Kyoto: ['#0b0910', '#9a64c8', '#d6b2bf'], Hokkaido: ['#071014', '#3b8fb5', '#d2bcb9'], Okinawan: ['#071014', '#1aa0a5', '#d7a27a'],
  Mexican: ['#0d0709', '#c04f4c', '#d99a4d'], 'Puerto Rican': ['#070912', '#2d60dc', '#d4556a'], Cuban: ['#071014', '#2877d8', '#d65d68'],
  Colombian: ['#0d0907', '#d0923b', '#d7545e'], Argentinian: ['#071014', '#23a0c5', '#d2b59b'], Dominican: ['#070912', '#3c66d9', '#d5586d'],
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
  const accents = values.accents?.length ? values.accents : values.accent ? [{ accent: values.accent, subAccent: values.subAccent }] : [];
  const accentDirection = accents.map(({ accent, subAccent }) => subAccent
    ? `a natural ${accent.toLowerCase()} accent, lightly colored by ${subAccent.toLowerCase()}`
    : `a natural ${accent.toLowerCase()} accent`);
  const accentSentence = accentDirection.length === 1
    ? `The voice should carry ${accentDirection[0]}.`
    : accentDirection.length > 1
      ? `Blend ${joinNatural(accentDirection)} in a balanced, distinct way.`
      : '';
  return [`${age ? `A ${age}` : 'An adult'} ${gender} receptionist voice.`,
    accentSentence,
    buildToneDirection(values.toneWeights, values.tone),
    'Clear articulation, a comfortable conversational pace, and natural pauses. Studio-quality audio.'].filter(Boolean).join(' ');
}
// Keep the edited prose separate: selections never silently replace writing.
export function composeDescription(values, direction) {
  return [buildVoiceDescription(values), direction.trim()].filter(Boolean).join('\n\n');
}
