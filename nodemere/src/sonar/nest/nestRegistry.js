export const NEST_CATEGORIES = [
  { id: 'calls', prefix: 'C', label: 'Calls', sample: { title: 'Call in progress', message: 'Jordan Lee', event_type: 'call_active', priority: 'routine', persistent: true, occurred_at: new Date(Date.now() - 134000).toISOString() } },
  { id: 'appointments', prefix: 'A', label: 'Appointments', sample: { title: 'Appointment booked', message: 'Tomorrow · 10:30 AM', event_type: 'appointment_booked', priority: 'routine' } },
  { id: 'people', prefix: 'P', label: 'People', sample: { title: 'New person added', message: 'Alex Morgan', event_type: 'person_added', priority: 'routine' } },
  { id: 'payments', prefix: 'S', label: 'Sales & payments', sample: { title: 'Payment received', message: '$420.00', event_type: 'payment_received', priority: 'major' } },
  { id: 'workflows', prefix: 'W', label: 'Scenarios & workflows', sample: { title: 'Workflow completed', message: 'Appointment follow-up', event_type: 'workflow_completed', priority: 'routine' } },
  { id: 'warnings', prefix: 'X', label: 'Warnings', sample: { title: 'Minutes nearly exhausted', message: '12 minutes remaining', event_type: 'usage_warning', priority: 'critical' } },
  { id: 'milestones', prefix: 'M', label: 'Milestones', sample: { title: 'First appointment booked', message: 'A new chapter begins', event_type: 'first_appointment', priority: 'major' } },
  { id: 'messages', prefix: 'Q', label: 'Quotes & messages', sample: { title: 'Small steps compound into remarkable progress.', message: '', event_type: 'daily_quote', priority: 'routine' } },
];

// These are content-design decisions, not decorative scenes. Nest combines each
// archetype with a category-specific information model in NestStage.
export const NEST_ARCHETYPES = [
  { name: 'Quiet Sequence', description: 'A compact three-beat fade with enough room for every line to land cleanly.', layout: 'sequence', motion: 'fade', icon: 'quiet', density: 'balanced', footprint: 'compact', placement: 'center', traits: ['progressive', '30% canvas'] },
  { name: 'Identity Field', description: 'Identity leads from the center while context settles beside it with generous space.', layout: 'subject', motion: 'rise', icon: 'inline', density: 'spacious', footprint: 'medium', placement: 'center', traits: ['identity led', '50% canvas'] },
  { name: 'Outcome Field', description: 'The outcome arrives first and opens horizontally to reveal who or what it concerns.', layout: 'status', motion: 'expand', icon: 'mark', density: 'balanced', footprint: 'medium', placement: 'center', traits: ['status led', 'horizontal reveal'] },
  { name: 'Perfect Exchange', description: 'Nest dissolves into one immaculate sentence, then returns without visual residue.', layout: 'inline', motion: 'dissolve', icon: 'none', density: 'compact', footprint: 'compact', placement: 'center', traits: ['single line', 'perfect fade'] },
  { name: 'Open Baseline', description: 'A generous baseline gives a simple event more confidence without adding content.', layout: 'inline', motion: 'rise', icon: 'quiet', density: 'spacious', footprint: 'medium', placement: 'center', traits: ['negative space', 'baseline lift'] },
  { name: 'Editorial Horizon', description: 'An editorial lead sits at center with a wide field of quiet space around it.', layout: 'editorial', motion: 'fade', icon: 'none', density: 'spacious', footprint: 'wide', placement: 'center', traits: ['editorial', '70% canvas'] },
  { name: 'Vertical Turn', description: 'Information changes in place through a restrained upward roll and precise reflow.', layout: 'stack', motion: 'flip', icon: 'inline', density: 'balanced', footprint: 'medium', placement: 'center', traits: ['soft flip', 'position change'] },
  { name: 'Progressive Field', description: 'The primary answer begins at center, then the composition widens as context appears.', layout: 'subject', motion: 'expand', icon: 'none', density: 'spacious', footprint: 'wide', placement: 'center', traits: ['progressive', 'expands to 70%'] },
  { name: 'Living Punctuation', description: 'The icon behaves like punctuation inside a long, balanced typographic line.', layout: 'pivot', motion: 'rise', icon: 'pivot', density: 'spacious', footprint: 'wide', placement: 'center', traits: ['icon grammar', 'open baseline'] },
  { name: 'Weight Transfer', description: 'Meaning transfers across the row as one phrase yields visual weight to another.', layout: 'transfer', motion: 'dissolve', icon: 'none', density: 'spacious', footprint: 'wide', placement: 'center', traits: ['type motion', '70% canvas'] },
  { name: 'Counterbalance', description: 'Two pieces of information occupy opposing regions with composed asymmetry.', layout: 'split', motion: 'rise', icon: 'quiet', density: 'spacious', footprint: 'wide', placement: 'center', traits: ['asymmetry', 'counterweight'] },
  { name: 'Row Ledger', description: 'A full-width operational reading uses position—not boxes—to create structure.', layout: 'ledger', motion: 'expand', icon: 'none', density: 'balanced', footprint: 'full', placement: 'center', traits: ['distributed', '90% canvas'] },
  { name: 'Metric Architecture', description: 'The number becomes a spatial anchor while meaning occupies a separate row region.', layout: 'metric', motion: 'rise', icon: 'quiet', density: 'spacious', footprint: 'wide', placement: 'center', traits: ['numeric anchor', '70% canvas'] },
  { name: 'Delayed Context', description: 'A confident primary thought holds the centered composition before context arrives.', layout: 'stack', motion: 'stagger', icon: 'none', density: 'spacious', footprint: 'medium', placement: 'center', traits: ['primary first', 'centered spacing'] },
  { name: 'Icon Resolution', description: 'A refined state mark moves a few pixels and resolves into the reading rhythm.', layout: 'pivot', motion: 'icon-type', icon: 'transform', density: 'balanced', footprint: 'medium', placement: 'center', traits: ['micro-motion', 'icon resolution'] },
  { name: 'Live Architecture', description: 'Stable identity and changing live state share the row without becoming a badge cluster.', layout: 'live', motion: 'fade', icon: 'status', density: 'spacious', footprint: 'wide', placement: 'center', traits: ['persistent', 'distributed live state'] },
  { name: 'Measured Reveal', description: 'Reading order is expressed through a spacious upward sequence at center stage.', layout: 'stack', motion: 'rise', icon: 'quiet', density: 'spacious', footprint: 'medium', placement: 'center', traits: ['reading order', 'upward reveal'] },
  { name: 'Live Reposition', description: 'The identity remains anchored while changing information turns into a new position.', layout: 'live', motion: 'flip', icon: 'status', density: 'spacious', footprint: 'full', placement: 'center', traits: ['persistent', 'position transition'] },
  { name: 'Calm Urgency', description: 'Urgency expands around a centered composition through hierarchy and timing.', layout: 'alert', motion: 'expand', icon: 'mark', density: 'spacious', footprint: 'wide', placement: 'center', traits: ['calm urgency', '70% canvas'] },
  { name: 'Full-Row Return', description: 'A nearly row-wide thought contracts gracefully back into the idle Nest word.', layout: 'return', motion: 'dissolve', icon: 'none', density: 'spacious', footprint: 'full', placement: 'center', traits: ['soft return', '90% canvas'] },
];

export const NEST_CONCEPTS = Object.fromEntries(NEST_CATEGORIES.map((category) => [
  category.id,
  NEST_ARCHETYPES.map((archetype, index) => ({
    ...archetype,
    id: `${category.prefix}-${String(index + 1).padStart(2, '0')}`,
    category: category.id,
    scene: index + 1,
  })),
]));

export const DEFAULT_NEST_CONCEPTS = {
  calls: 'C-16', appointments: 'A-17', people: 'P-02', payments: 'S-13',
  workflows: 'W-01', warnings: 'X-19', milestones: 'M-06', messages: 'Q-20',
};

export const CURATED_NEST_QUOTES = [
  'Small steps compound into remarkable progress.', 'Clarity turns motion into momentum.',
  'Make the next useful thing beautifully simple.', 'Consistency is quiet confidence in motion.',
  'The strongest systems make good work feel natural.', 'Progress becomes visible when attention becomes deliberate.',
  'Build trust in the details people experience every day.', 'A calm system can still create extraordinary momentum.',
  'Good work compounds when the path stays clear.', 'Make room for the work that matters most.',
  'Precision is care made visible.', 'The future arrives through the details we improve today.',
];

export const getNestCategory = (categoryId) => NEST_CATEGORIES.find((category) => category.id === categoryId) || NEST_CATEGORIES[0];

export const getNestConcept = (categoryId, conceptId) => {
  const concepts = NEST_CONCEPTS[categoryId] || NEST_CONCEPTS.calls;
  return concepts.find((concept) => concept.id === conceptId) || concepts[0];
};

export const getDailyNestQuote = (date = new Date()) => {
  const dayKey = Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`);
  return CURATED_NEST_QUOTES[dayKey % CURATED_NEST_QUOTES.length];
};
