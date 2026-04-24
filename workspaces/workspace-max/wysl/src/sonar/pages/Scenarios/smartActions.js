// Smart Actions — context-aware suggestions based on trigger + action type
// Each action has:
//   key: unique identifier
//   name: short display name
//   description: what the agent should do
//   instruction: LLM-readable text
//   appliesTo: array of action keys this suggestion is relevant to
//              ('call_customer', 'call_phone_number', 'send_to_phone_number', 'send_to_customer')

const SMART_ACTIONS = {
  // ─── Appointment Missed ───────────────────────────────
  appointment_missed: [
    { key: 'offer_reschedule', name: 'Offer Reschedule', description: 'Ask the customer to book a new time', instruction: 'Offer to reschedule their missed appointment. Present 2-3 available time slots and confirm their preferred time.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'leave_voicemail', name: 'Leave Voicemail', description: 'Leave a message asking them to call back', instruction: 'Leave a brief, professional voicemail letting the customer know they missed their appointment and to call back to reschedule.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'confirm_future_appt', name: 'Confirm Future Appointment', description: 'Check if they have an upcoming appointment', instruction: 'Verify whether the customer has any upcoming appointments already scheduled. Confirm the details with them.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'send_reschedule_link', name: 'Send Reschedule Link', description: 'Text a link to rebook', instruction: 'Send the customer an SMS with a friendly message to reschedule their missed appointment, including a booking link or phone number.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
    { key: 'send_followup_sms', name: 'Send Follow-up SMS', description: 'Text a gentle reminder', instruction: 'Send a friendly follow-up SMS letting the customer know they missed their appointment and to reach out when they are ready to rebook.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
  ],

  // ─── Appointment Soon ─────────────────────────────────
  appointment_soon: [
    { key: 'confirm_appt', name: 'Confirm Appointment', description: 'Ask the customer to confirm', instruction: 'Call to confirm their upcoming appointment. Verify the date, time, and let them know what to expect. Ask them to confirm they will attend.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'share_directions', name: 'Share Directions', description: 'Give directions or address info', instruction: 'Provide the business address, parking tips, and any directions that will help them arrive on time.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'send_confirmation_sms', name: 'Send Confirmation SMS', description: 'Text appointment details', instruction: 'Send an SMS confirming the appointment date, time, and location. Ask them to reply YES to confirm.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
    { key: 'send_prep_reminder', name: 'Send Prep Reminder', description: 'Text what to bring or prepare', instruction: 'Send an SMS with any preparation instructions or documents the customer should bring to their upcoming appointment.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
  ],

  // ─── Appointment Cancelled ────────────────────────────
  appointment_cancelled: [
    { key: 'offer_reschedule', name: 'Offer to Reschedule', description: 'Suggest new times', instruction: 'Acknowledge the cancellation and offer to find a new appointment time that works better for them.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'confirm_cancellation', name: 'Confirm Cancellation', description: 'Verify the cancellation', instruction: 'Confirm the appointment has been cancelled and ask if there is anything else you can help with.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'send_rebooking_sms', name: 'Send Rebooking SMS', description: 'Text rebooking options', instruction: 'Send an SMS confirming the cancellation and inviting the customer to rebook at their convenience.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
  ],

  // ─── Appointment Rescheduled ──────────────────────────
  appointment_rescheduled: [
    { key: 'confirm_new_time', name: 'Confirm New Time', description: 'Verify the updated time', instruction: 'Call to verify the customer received the updated appointment time and that it still works for them.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'send_updated_details', name: 'Send Updated Details', description: 'Text the new time', instruction: 'Send an SMS with the updated appointment time, clearly showing both the old and new times for clarity.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
  ],

  // ─── Appointment Confirmed ────────────────────────────
  appointment_confirmed: [
    { key: 'send_prep_info', name: 'Send Prep Info', description: 'Text what to prepare', instruction: 'Send the customer any preparation instructions, documents to bring, or pre-appointment steps they should complete.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
    { key: 'remind_day_before', name: 'Remind Day Before', description: 'Send a day-before reminder', instruction: 'Set up a reminder to text the customer the day before their appointment with a friendly heads-up.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
  ],

  // ─── Appointment Created ──────────────────────────────
  appointment_created: [
    { key: 'welcome_message', name: 'Welcome Message', description: 'Send a welcome with details', instruction: 'Send a warm welcome SMS confirming the newly booked appointment with all the key details — date, time, location, and any preparation notes.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
    { key: 'confirm_receipt', name: 'Confirm Receipt', description: 'Verify they got the booking', instruction: 'Call to confirm they successfully booked the appointment and answer any questions they may have about the upcoming visit.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Incoming Call ────────────────────────────────────
  incoming_call: [
    { key: 'greet_professionally', name: 'Professional Greeting', description: 'Answer with a warm greeting', instruction: 'Answer the call with a warm, professional greeting. Ask how you can help the caller today.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'take_message', name: 'Take a Message', description: 'Record a message for the team', instruction: 'Let the caller know the person they are looking for is unavailable. Take a detailed message including their name, number, and reason for calling.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Missed Call ──────────────────────────────────────
  missed_call: [
    { key: 'return_call', name: 'Return Call', description: 'Call the customer back', instruction: 'Call the customer back. Apologize for missing their call and ask how you can help.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'send_callback_sms', name: 'Send Callback SMS', description: 'Text that you missed their call', instruction: 'Send an SMS acknowledging the missed call. Let the customer know you tried to reach them and invite them to call back or reply with their question.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
  ],

  // ─── SMS Received ─────────────────────────────────────
  sms_received: [
    { key: 'reply_text', name: 'Reply to Message', description: 'Respond to the text', instruction: 'Read the incoming SMS and compose a helpful, relevant reply addressing their question or request.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
    { key: 'call_to_followup', name: 'Call to Follow Up', description: 'Call about their text', instruction: 'Call the customer to provide a more detailed response to the question or request they sent via text.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Customer Replied ────────────────────────────────
  customer_replied: [
    { key: 'continue_convo', name: 'Continue Conversation', description: 'Keep the conversation going', instruction: 'Read the customer reply and continue the conversation. Address any follow-up questions or concerns they raised.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
    { key: 'escalate_to_call', name: 'Escalate to Call', description: 'Switch to a phone call', instruction: 'The conversation needs more detail. Call the customer to continue the discussion over the phone.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Call Answered ────────────────────────────────────
  call_answered: [
    { key: 'deliver_message', name: 'Deliver Message', description: 'Share the intended message', instruction: 'The call was answered. Deliver your message clearly and professionally. Ask if they have any questions.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'verify_person', name: 'Verify Identity', description: 'Confirm you reached the right person', instruction: 'Politically verify you are speaking with the intended recipient before proceeding with your message.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Call Failed ──────────────────────────────────────
  call_failed: [
    { key: 'retry_call', name: 'Retry Call', description: 'Try calling again', instruction: 'The previous call attempt failed. Try calling the customer again. If it fails again, send an SMS instead.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'send_fallback_sms', name: 'Send Fallback SMS', description: 'Text instead of calling', instruction: 'The call could not connect. Send an SMS explaining the failed attempt and offering an alternative way to reach you.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
  ],

  // ─── Voicemail Received ───────────────────────────────
  voicemail_received: [
    { key: 'return_voicemail_call', name: 'Return Voicemail Call', description: 'Call back about their message', instruction: 'Call the customer back to address the voicemail they left. Reference their message and provide the help they requested.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'reply_sms_voicemail', name: 'Reply via SMS', description: 'Text about their voicemail', instruction: 'Send an SMS acknowledging their voicemail. Let them know you received their message and will get back to them shortly.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
  ],

  // ─── Payment Failed ───────────────────────────────────
  payment_failed: [
    { key: 'notify_payment_issue', name: 'Notify About Payment', description: 'Let them know the payment failed', instruction: 'Inform the customer that their recent payment did not go through. Clearly explain the amount owed and provide simple instructions to update their payment method or retry.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'send_payment_sms', name: 'Send Payment SMS', description: 'Text about the failed payment', instruction: 'Send an SMS notifying the customer that their payment failed. Include the amount and a link or instructions to update their payment method.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
  ],

  // ─── Record Created ───────────────────────────────────
  record_created: [
    { key: 'welcome_new_customer', name: 'Welcome New Customer', description: 'Send a welcome message', instruction: 'Send a welcome SMS to the new customer. Introduce the business, thank them for choosing you, and let them know how to reach you if they need anything.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
    { key: 'welcome_call', name: 'Welcome Call', description: 'Call to welcome them personally', instruction: 'Call the new customer to personally welcome them. Introduce the business, answer any questions, and make them feel valued.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Invoice Created ──────────────────────────────────
  invoice_created: [
    { key: 'send_invoice_sms', name: 'Send Invoice SMS', description: 'Text about the new invoice', instruction: 'Send an SMS notifying the customer of their new invoice. Include the amount and a link to view or pay it.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
    { key: 'explain_invoice', name: 'Explain Invoice', description: 'Walk them through the invoice', instruction: 'Call the customer to walk them through the invoice. Explain each line item and answer any questions about billing.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],
};

const GENERIC_SMART_ACTIONS = {
  call_customer: [
    { key: 'greet_caller', name: 'Greet Caller', description: 'Answer with a professional greeting', instruction: 'Answer the call with a warm, professional greeting. Ask how you can help.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],
  call_phone_number: [
    { key: 'greet_caller', name: 'Greet Caller', description: 'Answer with a professional greeting', instruction: 'Answer the call with a warm, professional greeting. Ask how you can help.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],
  send_to_phone_number: [
    { key: 'send_info_sms', name: 'Send Info SMS', description: 'Send helpful information', instruction: 'Send a helpful, relevant SMS to the customer based on the situation.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
  ],
  send_to_customer: [
    { key: 'send_info_sms', name: 'Send Info SMS', description: 'Send helpful information', instruction: 'Send a helpful, relevant SMS to the customer based on the situation.', appliesTo: ['send_to_phone_number', 'send_to_customer'] },
  ],
};

/**
 * Get smart actions for a given trigger + action combination
 * Filters by appliesTo to ensure relevance
 * @param {string} triggerKey - The trigger key (e.g., 'appointment_missed')
 * @param {string} actionKey - The action key (e.g., 'call_customer')
 * @returns {Array} Filtered array of smart action objects
 */
export function getSmartActions(triggerKey, actionKey) {
  const triggerActions = triggerKey ? (SMART_ACTIONS[triggerKey] || []) : [];
  const filtered = actionKey ? triggerActions.filter(a => a.appliesTo.includes(actionKey)) : triggerActions;
  // If no trigger-specific actions match, fall back to generic actions for this action type
  if (filtered.length === 0 && actionKey) {
    return GENERIC_SMART_ACTIONS[actionKey] || [];
  }
  return filtered;
}

/**
 * Get a smart action by key
 * @param {string} actionKey - The smart action key
 * @returns {Object|null} The smart action object or null
 */
export function getSmartActionByKey(actionKey) {
  for (const actions of Object.values(SMART_ACTIONS)) {
    const found = actions.find(a => a.key === actionKey);
    if (found) return found;
  }
  for (const actions of Object.values(GENERIC_SMART_ACTIONS)) {
    const found = actions.find(a => a.key === actionKey);
    if (found) return found;
  }
  return null;
}

export { GENERIC_SMART_ACTIONS };
export default SMART_ACTIONS;
