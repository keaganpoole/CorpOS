export const CHARACTERISTICS = [
  { key: 'gender', label: 'Gender', title: 'Every voice starts\nwith a presence.', hint: 'Choose the foundation. Make it unmistakably yours.', options: ['Feminine', 'Masculine', 'Androgynous'], notes: ['Clear. Expressive. Distinct.', 'Grounded. Resonant. Present.', 'Balanced. Versatile. Individual.'] },
  { key: 'age', label: 'Age', title: 'A little life\nin every word.', hint: 'Shape the perceived age of the voice.', options: ['Young adult', 'Middle-aged', 'Mature'], notes: ['A fresh, youthful character', 'An experienced, assured presence', 'Depth and lived-in character'] },
  { key: 'accent', label: 'Accent', title: 'Where does\nyour voice belong?', hint: 'A natural accent, with clear conversational articulation.', options: ['American', 'British', 'Australian', 'Irish', 'Canadian', 'Indian'], notes: ['General American', 'Contemporary Southern English', 'General Australian', 'Light Irish', 'General Canadian', 'Indian English'] },
  { key: 'tone', label: 'Tone', title: 'Set the feeling\nof the first hello.', hint: 'The emotional delivery your callers will hear.', options: ['Friendly', 'Calm', 'Upbeat', 'Warm', 'Confident', 'Professional'], notes: ['Open and welcoming', 'Steady and reassuring', 'Bright and optimistic', 'Soft and personable', 'Assured and clear', 'Polished and composed'] },
  { key: 'personality', label: 'Personality', title: 'Make a voice\nfeel like someone.', hint: 'Choose up to three qualities that work together.', options: ['Empathetic', 'Direct', 'Playful', 'Relaxed', 'Energetic', 'Thoughtful'], notes: ['Attentive to every caller', 'Gets to the point', 'A light touch of wit', 'Natural and unhurried', 'Lively and engaged', 'Deliberate and considered'] },
];
export const DEFAULT_PREVIEW = 'Hello, thank you for calling. I’m here to help you find what you need, answer your questions, or arrange a time that works for you. How can I make your day a little easier?';
export function buildVoiceDescription(values) {
  const gender = { Feminine: 'feminine', Masculine: 'masculine', Androgynous: 'androgynous' }[values.gender] || 'natural';
  return [`A ${values.age?.toLowerCase() || 'adult'} ${gender} receptionist voice${values.accent ? ` with a natural ${values.accent} accent` : ''}.`,
    values.tone ? `The emotional delivery is ${values.tone.toLowerCase()}.` : '',
    values.personality?.length ? `The speaking character is ${values.personality.join(', ').toLowerCase()}.` : '',
    'Clear articulation, a comfortable conversational pace, and natural pauses. Studio-quality audio.'].filter(Boolean).join(' ');
}
// Keep the edited prose separate: selections never silently replace writing.
export function composeDescription(values, direction) {
  return [buildVoiceDescription(values), direction.trim()].filter(Boolean).join('\n\n');
}
