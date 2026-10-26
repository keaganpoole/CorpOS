import React from 'react';
import {
  ArrowDown, ArrowUp, ArrowUpDown, BadgeDollarSign, CalendarCheck, Check, PhoneIncoming, Quote,
  Route, Sparkles, TriangleAlert, UserPlus,
} from 'lucide-react';

const ICONS = {
  calls: PhoneIncoming, appointments: CalendarCheck, people: UserPlus,
  payments: BadgeDollarSign, workflows: Route, warnings: TriangleAlert,
  milestones: Sparkles, messages: Quote,
};

const PRIVATE_MESSAGES = {
  calls: 'Live call', appointments: 'Calendar update', people: 'Customer update',
  payments: 'Payment update', workflows: 'Automation update', warnings: 'Account attention needed',
  milestones: 'Business milestone', messages: 'A thought for today',
};

const SUBJECTS = {
  calls: 'Live call', appointments: 'Calendar', people: 'People', payments: 'Payment',
  workflows: 'Workflow', warnings: 'Warning', milestones: 'New milestone', messages: 'Message',
};

const normalizeCallDirection = (event) => {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const raw = String(
    event?.direction
      || payload.direction
      || payload.call_direction
      || payload.conversation_metadata?.phone_call?.direction
      || payload.conversation_initiation_data?.dynamic_variables?.direction
      || payload.conversation_initiation_data?.dynamic_variables?.call_direction
      || '',
  ).trim().toLowerCase();
  if (raw.includes('out')) return 'outbound';
  if (raw.includes('in')) return 'inbound';
  return 'unknown';
};

const iconForEvent = (event) => {
  if (event?.category !== 'calls') return ICONS[event?.category] || Check;
  const direction = normalizeCallDirection(event);
  if (direction === 'inbound') return ArrowDown;
  if (direction === 'outbound') return ArrowUp;
  if (event?.event_type === 'call_transferred') return ArrowUpDown;
  return PhoneIncoming;
};

const iconForPartOne = (event) => event?.category === 'calls' ? PhoneIncoming : iconForEvent(event);

const formatElapsed = (startedAt, now) => {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return 'Live now';
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

const splitDetail = (value = '') => {
  const parts = String(value).split('·').map((part) => part.trim()).filter(Boolean);
  return { first: parts[0] || '', second: parts.slice(1).join(' · ') };
};

const summaryReveals = (value = '') => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) || [normalized];
  const reveals = [];
  sentences.forEach((sentence) => {
    let remaining = sentence;
    while (remaining.length > 100) {
      let cut = remaining.lastIndexOf(' ', 100);
      if (cut < 45) cut = 100;
      reveals.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) reveals.push(remaining);
  });
  return reveals.slice(0, 8);
};

const payloadForEvent = (event) => event?.payload && typeof event.payload === 'object' ? event.payload : {};
const eventPerson = (event) => {
  const payload = payloadForEvent(event);
  return [payload.first_name, payload.last_name].filter(Boolean).join(' ').trim()
    || payload.name || payload.caller_name || payload.customer_name || '';
};
const eventContact = (event) => payloadForEvent(event).phone || payloadForEvent(event).email || '';
const eventDirection = (event) => {
  const direction = normalizeCallDirection(event);
  return direction === 'inbound' ? 'Inbound call' : direction === 'outbound' ? 'Outbound call' : '';
};
const milestoneContext = (event, safeMessage) => {
  if (safeMessage && safeMessage !== 'Test Business') return safeMessage;
  const fallback = {
    first_receptionist_hired: 'Your AI front desk is ready to help',
    first_staff_member_added: 'Your team is ready for bookings',
    first_call_received: 'Your front desk answered its first call',
    first_successful_call: 'Your front desk completed its first successful call',
    first_person_added: 'Your customer records are underway',
    first_appointment_booked: 'Your calendar is ready for business',
    first_appointment_completed: 'Your first customer appointment is complete',
    first_scenario_created: 'Your first automation is ready to run',
    first_scenario_run: 'Your first automation has run',
    first_successful_workflow: 'Your automation completed its first successful outcome',
    first_successful_payment: 'Your business has started collecting payments',
    first_receptionist_booking: 'Your receptionist booked its first appointment',
    first_repeat_customer: 'A customer has returned to your business',
    first_automated_booking: 'Your automation booked an appointment',
    business_setup_completed: 'Your business is ready for the next step',
  };
  return fallback[event?.event_type] || 'Business progress recorded';
};

const outcomeForEvent = (event) => ({
  call_active: 'Live now', call_completed: 'Completed', call_missed: 'Missed', call_failed: 'Failed', call_transferred: 'Transferred',
  usage_warning: 'Warning', minutes_exhausted: 'Exhausted',
  appointment_booked: 'Booked', appointment_rescheduled: 'Rescheduled', appointment_cancelled: 'Cancelled',
  appointment_updated: 'Updated', appointment_completed: 'Completed', appointment_missed: 'Missed',
  person_added: 'Added', person_updated: 'Updated',
  payment_received: 'Received', payment_failed: 'Failed', payment_refunded: 'Refunded',
  invoice_created: 'Created', invoice_paid: 'Paid', invoice_overdue: 'Overdue',
  workflow_failed: 'Failed', scenario_configuration_needed: 'Needs setup',
  several_missed_calls: 'Missed calls', several_failed_calls: 'Failed calls', integration_failure: 'Failed',
  no_receptionist_available: 'Unavailable', no_staff_available: 'Unavailable', staff_availability_missing: 'Needs setup',
  no_activity: 'No activity',
  business_setup_completed: 'Setup complete',
  daily_quote: 'Today',
}[event?.event_type] || (event?.category === 'milestones' ? 'Milestone reached' : 'Updated'));

const duplicateKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const removeRepeatedDetails = (content, event) => {
  const primary = String(content.primary || '').trim();
  const secondary = String(content.secondary || '').trim();
  const metric = String(content.metric || '').trim();
  const blocked = new Set([duplicateKey(primary), duplicateKey(event?.title)]);
  const uniqueSecondary = secondary && !blocked.has(duplicateKey(secondary)) ? content.secondary : '';
  const metricKey = duplicateKey(metric);
  return {
    ...content,
    secondary: uniqueSecondary,
    metric: metric && !blocked.has(metricKey) && metricKey !== duplicateKey(uniqueSecondary) ? content.metric : '',
  };
};

const contentForEvent = (event, now, privacyMode) => {
  const category = event.category;
  const payload = payloadForEvent(event);
  const safeMessage = privacyMode ? PRIVATE_MESSAGES[category] : (event.message || '');
  const elapsed = event.persistent ? formatElapsed(event.occurred_at, now) : '';
  const detail = splitDetail(safeMessage);
  const person = privacyMode ? '' : eventPerson(event);
  const contact = privacyMode ? '' : eventContact(event);
  const direction = privacyMode ? '' : eventDirection(event);
  const appointmentWhen = [payload.date, payload.time].filter(Boolean).join(' · ');

  const content = (() => { switch (category) {
    case 'calls':
      return { eyebrow: event.persistent ? 'Live call' : 'Call activity', primary: safeMessage || person || 'Call activity', secondary: direction || 'Call update', metric: elapsed || outcomeForEvent(event) };
    case 'appointments':
      return { eyebrow: 'Appointment', primary: person || detail.first || 'Customer appointment', secondary: appointmentWhen || (person ? detail.second : 'Scheduled appointment'), metric: outcomeForEvent(event) };
    case 'people':
      return {
        eyebrow: 'Customer',
        primary: person || (event.event_type === 'person_updated' ? 'Customer record' : safeMessage || 'Customer record'),
        secondary: contact || (event.event_type === 'person_updated' ? 'Contact information changed' : 'Details updated'),
        metric: outcomeForEvent(event),
      };
    case 'payments':
      return { eyebrow: 'Payment', primary: safeMessage || 'Payment update', secondary: person || 'Business payment', metric: outcomeForEvent(event) };
    case 'workflows':
      return { eyebrow: 'Automation', primary: safeMessage || 'Scenario failure', secondary: 'Scenario needs attention', metric: 'Review scenario' };
    case 'warnings':
      {
        const warningDetail = splitDetail(safeMessage);
        return {
          eyebrow: 'Attention',
          primary: warningDetail.first || 'Review this issue',
          secondary: warningDetail.second || person || 'Review in dashboard',
          metric: event.payload?.next_step || event.payload?.action || outcomeForEvent(event),
        };
      }
    case 'milestones':
      return { eyebrow: 'Milestone', primary: milestoneContext(event, safeMessage), secondary: 'Business progress', metric: outcomeForEvent(event) };
    case 'messages':
      return { eyebrow: 'For today', primary: safeMessage || 'A small step toward steady progress', secondary: event.event_type === 'daily_quote' ? 'Daily business quote' : 'Progress message', metric: outcomeForEvent(event) };
    default:
      return { eyebrow: 'Nest', primary: event.title, secondary: safeMessage, metric: '' };
  } })();
  return removeRepeatedDetails(content, event);
};

const subjectForEvent = (event) => ({
  eyebrow: 'Nest notification',
  primary: event.event_type === 'daily_quote' ? 'Daily business quote or progress message' : event.title || SUBJECTS[event.category] || 'Nest',
  secondary: '',
  metric: '',
});

const liveCallReceptionist = (event) => {
  if (!['call_active', 'call_completed'].includes(event?.event_type)) return null;
  const payload = payloadForEvent(event);
  const name = payload.receptionist_name || payload.agent_name || 'Receptionist';
  return {
    banner: payload.receptionist_banner_url || '',
  };
};

const LiveCallReceptionistArtwork = ({ event }) => {
  const receptionist = liveCallReceptionist(event);
  if (!receptionist) return null;
  return (
    <div className="nest-live-call-receptionist" aria-hidden="true">
      {receptionist.banner && <span className="nest-live-call-banner" style={{ backgroundImage: `url(${receptionist.banner})` }} />}
      <span className="nest-live-call-banner-shade" />
    </div>
  );
};

const liveActionIcon = (type) => type === 'appointment_booked' || type === 'appointment_updated' || type === 'appointment_cancelled'
  ? CalendarCheck : type === 'person_added' ? UserPlus : Check;

const LiveCallActionIndicators = ({ actions = [] }) => {
  if (!actions.length) return null;
  return (
    <div className="nest-live-call-actions" aria-label="Actions completed during this call">
      {actions.map((action) => {
        const ActionIcon = liveActionIcon(action.type);
        return <span key={action.id} className="nest-live-call-action" title={action.label} aria-label={action.label}><ActionIcon size={12} strokeWidth={1.7} /></span>;
      })}
    </div>
  );
};

const INTRO_WORDS = ['Nodemere', 'Events', 'Signal', 'Terminal'];

const ContentIcon = ({ Icon, mode, compact, partTwo = false, partOne = false }) => {
  if (mode === 'none') return null;
  return (
    <span className={`nest-content-icon nest-icon-${mode} ${partTwo ? 'nest-icon-part-two' : ''} ${partOne ? 'nest-icon-part-one' : ''}`}>
      <Icon size={partOne ? (compact ? 16 : 22) : (compact ? 13 : 17)} strokeWidth={1.6} />
    </span>
  );
};

const ReelPart = ({ event, content, Icon, compact, part, hideIcon = false }) => (
  <div className={`nest-content nest-reel-content nest-layout-${part === 1 ? 'return' : 'pivot'} nest-density-spacious nest-footprint-${part === 1 ? 'full' : 'medium'} nest-placement-center${event?.event_type === 'call_completed' && part === 2 && event?.payload?.summary ? ' nest-call-summary' : ''}`}>
      {!hideIcon && !(event?.event_type === 'call_active' && event?.direction === 'inbound') && (
        <ContentIcon Icon={part === 1 ? iconForPartOne(event) : Icon} mode="transform" compact={compact} partOne={part === 1} partTwo={part === 2} />
      )}
      <div className="nest-content-copy">
        <span className="nest-content-eyebrow">{content.eyebrow}</span>
        <span className={`nest-content-primary${event?.event_type === 'call_active' && event?.direction === 'inbound' && part === 1 ? ' is-incoming-call' : ''}`}>{content.primary}</span>
        {content.secondary && content.secondary !== content.primary && (
          <span className="nest-content-secondary">{content.secondary}</span>
        )}
        {content.metric && content.metric !== content.secondary && (
          <span className="nest-content-metric">{content.metric}</span>
        )}
      </div>
      {part === 2 && event.persistent && (
        <span className="nest-live-indicator" aria-label="Live"><span /></span>
      )}
  </div>
);


export {ReelPart,contentForEvent,iconForEvent};