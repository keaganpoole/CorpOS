const BASE = 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/audition_faces';

const portrait = (gender, category, file, overrides = {}) => ({
  src: `${BASE}/${gender}/${category}/${file}`,
  position: gender === 'man' ? '60% 48%' : '54% 48%',
  scale: 1,
  ...overrides,
});

const paired = (category, manFile, womanFile, overrides = {}) => ({
  Male: portrait('man', category, manFile, overrides.Male),
  Female: portrait('woman', category, womanFile, overrides.Female),
});

// Production portrait manifest. Supabase objects are publicly readable by exact
// path, but the bucket does not expose directory listing to the app client.
export const STUDIO_PORTRAITS = Object.freeze({
  gender: {
    Male: portrait('man', 'temperament', 'calm_man.png', { position: '60% 47%', scale: 1.01 }),
    Female: portrait('woman', 'temperament', 'friendly_woman.png', { position: '54% 48%', scale: 1.01 }),
  },
  age: {
    'Young adult': paired('age', 'young_adult.png', 'young_adult_2.png', {
      Male: { position: '60% 48%', scale: 1.02 },
      Female: { position: '54% 48%', scale: 1.02 },
    }),
    'Middle-aged': paired('age', 'middle_aged.png', 'middle_aged.png', {
      Male: { position: '60% 48%', scale: 1.01 },
      Female: { position: '54% 48%', scale: 0.92 },
    }),
    Mature: paired('age', 'mature.png', 'mature.png', {
      Male: { position: '60% 48%' },
      Female: { position: '54% 48%' },
    }),
  },
  accent: {
    African: paired('ethnicity', 'african_man.png', 'african.png'),
    American: paired('ethnicity', 'american_man.png', 'american.png'),
    Australian: paired('ethnicity', 'australian_man.png', 'australian.png'),
    British: paired('ethnicity', 'british_man.png', 'british.png'),
    Canadian: paired('ethnicity', 'canadian_man.png', 'canadian.png'),
    Chinese: paired('ethnicity', 'chinese_man.png', 'chinese.png', {
      Male: { position: '60% 46.5%', scale: 1.09, origin: '18% 50%' },
      Female: { position: '54% 48%', scale: 1.035 },
    }),
    Indian: paired('ethnicity', 'indian_man.png', 'indian.png'),
    Irish: paired('ethnicity', 'irish_man.png', 'irish.png'),
    Italian: paired('ethnicity', 'italian_man.png', 'italian.png'),
    Japanese: paired('ethnicity', 'japanese_man.png', 'japanese.png', {
      Male: { position: '56.5% 48%', scale: 1.02 },
      Female: { position: '51% 48%', scale: 1.01 },
    }),
    'Hispanic / Latina': paired('ethnicity', 'hispanic_man.png', 'latina_woman'),
  },
  tone: {
    Calm: paired('temperament', 'calm_man.png', 'calm_woman.png'),
    Caring: paired('temperament', 'caring_man.png', 'caring_woman.png'),
    Charming: paired('temperament', 'charming_man.png', 'charming_woman.png'),
    Friendly: paired('temperament', 'motivational_man.png', 'friendly_woman.png'),
    Motivational: paired('temperament', 'confident_man.png', 'motivational_woman.png'),
    Playful: paired('temperament', 'playful_man.png', 'playful_woman.png'),
    Serious: paired('temperament', 'serious_man.png', 'serious_woman.png'),
  },
});
