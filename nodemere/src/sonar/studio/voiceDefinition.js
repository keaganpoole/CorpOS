export const CHARACTERISTICS = [
  { key: 'gender', label: 'Gender', title: 'Every voice starts\nwith a presence.', hint: 'Choose the foundation. Make it unmistakably yours.', options: ['Feminine', 'Masculine'], notes: ['Clear. Expressive. Distinct.', 'Grounded. Resonant. Present.'] },
  { key: 'age', label: 'Age', title: 'A little life\nin every word.', hint: 'Shape the perceived age of the voice.', options: ['Young adult', 'Middle-aged', 'Mature'], notes: ['A fresh, youthful character', 'An experienced, assured presence', 'Depth and lived-in character'] },
  { key: 'accent', label: 'Ethnicity', title: 'Who is taking\nshape?', hint: 'Define the receptionist’s visual identity and presence.', options: ['African', 'American', 'Australian', 'British', 'Canadian', 'Indian', 'Irish', 'Italian', 'Hispanic / Latina'], notes: ['Distinct and composed', 'Polished and familiar', 'Bright and natural', 'Refined and poised', 'Open and approachable', 'Warm and expressive', 'Characterful and clear', 'Elegant and assured', 'Vivid and welcoming'] },
  { key: 'tone', label: 'Tone', title: 'Set the feeling\nof the first hello.', hint: 'The emotional delivery your callers will hear.', options: ['Balanced', 'Calm', 'Caring', 'Charming', 'Friendly', 'Motivational', 'Playful', 'Serious'], notes: ['Even and measured', 'Steady and reassuring', 'Attentive and warm', 'Polished with ease', 'Open and welcoming', 'Bright and encouraging', 'Light and expressive', 'Focused and composed'] },
  { key: 'personality', label: 'Personality', title: 'Make a voice\nfeel like someone.', hint: 'Choose up to three qualities that work together.', options: ['Empathetic', 'Direct', 'Playful', 'Relaxed', 'Energetic', 'Thoughtful'], notes: ['Attentive to every caller', 'Gets to the point', 'A light touch of wit', 'Natural and unhurried', 'Lively and engaged', 'Deliberate and considered'] },
];
export const DEFAULT_PREVIEW = 'Hello, thank you for calling. I’m here to help you find what you need, answer your questions, or arrange a time that works for you. How can I make your day a little easier?';
export function buildVoiceDescription(values) {
  const gender = { Feminine: 'feminine', Masculine: 'masculine' }[values.gender] || 'natural';
  return [`A ${values.age?.toLowerCase() || 'adult'} ${gender} receptionist voice.`,
    values.accent ? `The visual identity direction is ${values.accent.toLowerCase()}.` : '',
    values.tone ? `The emotional delivery is ${values.tone.toLowerCase()}.` : '',
    values.personality?.length ? `The speaking character is ${values.personality.join(', ').toLowerCase()}.` : '',
    'Clear articulation, a comfortable conversational pace, and natural pauses. Studio-quality audio.'].filter(Boolean).join(' ');
}
// Keep the edited prose separate: selections never silently replace writing.
export function composeDescription(values, direction) {
  return [buildVoiceDescription(values), direction.trim()].filter(Boolean).join('\n\n');
}
