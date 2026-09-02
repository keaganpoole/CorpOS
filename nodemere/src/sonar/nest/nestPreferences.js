import {
  AlertTriangle, Calendar, CreditCard, ListChecks, MessageSquareText, Phone, Sparkles, Users, Workflow,
} from 'lucide-react';

export const NEST_NOTIFICATION_GROUPS = [
  {
    key: 'calls', label: 'Calls', icon: Phone, description: 'Call activity and call-related alerts.',
    notifications: [
      ['call_active', 'Call in progress'], ['call_completed', 'Call completed'], ['call_missed', 'Call missed'],
      ['call_failed', 'Call failed'], ['call_transferred', 'Call transferred'], ['usage_warning', 'Call minutes running low'],
      ['minutes_exhausted', 'Call minutes exhausted'],
    ],
  },
  {
    key: 'appointments', label: 'Appointments', icon: Calendar, description: 'Bookings, changes, and appointment outcomes.',
    notifications: [
      ['appointment_booked', 'Appointment booked'], ['appointment_rescheduled', 'Appointment rescheduled'],
      ['appointment_cancelled', 'Appointment cancelled'], ['appointment_updated', 'Appointment updated'],
      ['appointment_completed', 'Appointment completed'], ['appointment_missed', 'Appointment missed'],
    ],
  },
  {
    key: 'people', label: 'People & customers', icon: Users, description: 'Customer records and relationship milestones.',
    notifications: [
      ['person_added', 'New person added'], ['person_updated', 'Person record updated'],
      ['first_repeat_customer', 'Returning customer recognized'], ['customer_milestone', 'Customer milestone reached'],
      ['person_missing_information', 'Customer record needs information'],
    ],
  },
  {
    key: 'staff', label: 'Staff & receptionists', icon: Users, description: 'Team changes and availability issues.',
    notifications: [
      ['receptionist_hired', 'Receptionist hired'], ['receptionist_activated', 'Receptionist activated'],
      ['first_staff_member_added', 'First staff member added'], ['staff_availability_missing', 'Staff availability missing'],
      ['no_staff_available', 'No staff available for booking'],
    ],
  },
  {
    key: 'workflows', label: 'Scenarios & automations', icon: Workflow, description: 'Scenario activity, outcomes, and failures.',
    notifications: [
      ['workflow_failed', 'Scenario failed'],
    ],
  },
  {
    key: 'payments', label: 'Payments & revenue', icon: CreditCard, description: 'Payments, invoices, and revenue activity.',
    notifications: [
      ['payment_received', 'Payment received'], ['payment_failed', 'Payment failed'], ['payment_refunded', 'Payment refunded'],
      ['invoice_created', 'Invoice created'], ['invoice_paid', 'Invoice paid'], ['invoice_overdue', 'Invoice overdue'],
      ['revenue_milestone', 'Revenue milestone reached'],
    ],
  },
  {
    key: 'milestones', label: 'Milestones & progress', icon: Sparkles, description: 'Meaningful firsts and business progress.',
    notifications: [
      ['first_receptionist_hired', 'First receptionist hired'], ['first_staff_member_added', 'First staff member added'],
      ['first_call_received', 'First call received'], ['first_successful_call', 'First successful call'],
      ['first_person_added', 'First person added'], ['first_appointment_booked', 'First appointment booked'],
      ['first_appointment_completed', 'First appointment completed'],
      ['first_successful_payment', 'First successful payment'], ['first_receptionist_booking', 'First receptionist booking'],
      ['first_repeat_customer', 'First repeat customer'], ['first_automated_booking', 'First automated booking'],
      ['business_setup_completed', 'Business setup completed'],
    ],
  },
  {
    key: 'warnings', label: 'Warnings & system issues', icon: AlertTriangle, description: 'Issues that may need your attention.',
    notifications: [
      ['several_missed_calls', 'Several missed calls'], ['several_failed_calls', 'Several failed calls'],
      ['integration_failure', 'Integration needs attention'], ['no_receptionist_available', 'No receptionist available'],
      ['no_activity', 'No activity recorded'],
    ],
  },
  {
    key: 'messages', label: 'Quotes & messages', icon: MessageSquareText, description: 'Daily business quotes and progress messages.',
    notifications: [['daily_quote', 'Daily business quote or progress message']],
  },
].map((group) => ({
  ...group,
  notifications: group.notifications.map(([key, label]) => ({ key, label })),
}));

export const DEFAULT_NEST_PREFERENCES = {
  enabled: true,
  categories: Object.fromEntries(NEST_NOTIFICATION_GROUPS.map(({ key }) => [key, true])),
  notifications: Object.fromEntries(
    NEST_NOTIFICATION_GROUPS.flatMap(({ notifications }) => notifications.map(({ key }) => [key, true]))
  ),
};

export const NEST_NOTIFICATION_GROUP_BY_KEY = Object.fromEntries(
  NEST_NOTIFICATION_GROUPS.flatMap(({ key: groupKey, notifications }) => notifications.map(({ key }) => [key, groupKey]))
);

export const normalizeNestPreferences = (value = {}) => ({
  ...DEFAULT_NEST_PREFERENCES,
  ...(value || {}),
  categories: { ...DEFAULT_NEST_PREFERENCES.categories, ...(value?.categories || {}) },
  notifications: { ...DEFAULT_NEST_PREFERENCES.notifications, ...(value?.notifications || {}) },
});
