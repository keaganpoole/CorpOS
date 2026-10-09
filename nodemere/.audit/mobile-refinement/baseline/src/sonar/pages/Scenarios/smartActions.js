// Smart Actions — context-aware suggestions based on trigger + action type
// Each action has:
//   key: unique identifier
//   name: short display name
//   description: what the agent should do
//   instruction: LLM-readable text (concise, no redundancy)
//   appliesTo: array of action keys this suggestion is relevant to
//              ('call_customer', 'call_phone_number', 'send_to_phone_number', 'send_to_customer')

const SMART_ACTIONS = {
  // ─── Appointment Created ──────────────────────────────
  appointment_created: [
    { key: 'confirm_receipt', name: 'Confirm Booking', description: 'Verify they successfully booked', instruction: 'Confirm their appointment was received. Verify the date and time match what they expected.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'verify_details', name: 'Verify Details', description: 'Double-check appointment info', instruction: 'Confirm the appointment date, time, and service. Ask if anything needs to be changed.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'set_arrival_expectations', name: 'Set Arrival Expectations', description: 'Explain what to expect on arrival', instruction: 'Let them know what to expect when they arrive — where to go, what to bring, how early to arrive.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'pre_visit_questions', name: 'Pre-Visit Questions', description: 'Ask questions to prepare for the visit', instruction: 'Ask any questions that help prepare for their visit — special needs, paperwork to complete, relevant history.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'reschedule_appointment', name: 'Reschedule', description: 'Offer to move the appointment', instruction: 'Check if the booked time still works. If not, offer alternative slots.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Appointment Updated ──────────────────────────────
  appointment_updated: [
    { key: 'confirm_changes', name: 'Confirm Changes', description: 'Verify they received the update', instruction: 'Confirm they are aware of the updated appointment details. Read back the new date, time, or service changes.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'set_arrival_expectations', name: 'Set Arrival Expectations', description: 'Explain what to expect', instruction: 'Let them know what to expect at the updated appointment time — location, what to bring, timing.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'verify_new_time', name: 'Verify New Time', description: 'Make sure the new time works', instruction: 'Verify the rescheduled time still works for them. Offer alternatives if needed.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Appointment Cancelled ────────────────────────────
  appointment_cancelled: [
    { key: 'understand_reason', name: 'Understand Reason', description: 'Find out why they cancelled', instruction: 'Find out why they cancelled. Listen for concerns that could be resolved — scheduling conflict, cost, uncertainty.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'offer_reschedule', name: 'Offer to Reschedule', description: 'Suggest new times', instruction: 'Acknowledge the cancellation and offer alternative dates and times that might work better.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'retain_customer', name: 'Retain Customer', description: 'Try to keep them as a customer', instruction: 'Express that their business is valued. Address any concerns and encourage them to stay engaged — offer flexibility or alternatives.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Appointment Rescheduled ──────────────────────────
  appointment_rescheduled: [
    { key: 'confirm_new_time', name: 'Confirm New Time', description: 'Verify the updated time', instruction: 'Confirm the new appointment time and date. Make sure it works for them.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'set_arrival_expectations', name: 'Set Arrival Expectations', description: 'Explain what to expect', instruction: 'Let them know what to expect at the rescheduled time — where to go, what to bring.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Appointment Confirmed ────────────────────────────
  appointment_confirmed: [
    { key: 'confirm_reminder', name: 'Confirm Reminder', description: 'Make sure they are still planning to attend', instruction: 'Confirm they are still planning to attend. Ask if anything has changed since they confirmed.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'pre_visit_questions', name: 'Pre-Visit Questions', description: 'Ask questions to prepare', instruction: 'Ask any questions that help prepare for their visit — items to bring, paperwork, special needs.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'set_arrival_expectations', name: 'Set Arrival Expectations', description: 'Explain what to expect', instruction: 'Let them know what to expect when they arrive — parking, front desk, what to bring.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Appointment Soon ─────────────────────────────────
  appointment_soon: [
    { key: 'confirm_appointment', name: 'Confirm Appointment', description: 'Verify they are still coming', instruction: 'Confirm their upcoming appointment. Verify date and time. Ask if they have any questions before coming in.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'set_arrival_expectations', name: 'Set Arrival Expectations', description: 'Explain what to expect on arrival', instruction: 'Tell them what to expect — where to park, where to check in, what to bring, how early to arrive.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'pre_visit_questions', name: 'Pre-Visit Questions', description: 'Ask questions to prepare for the visit', instruction: 'Ask any questions that help prepare for the visit — special needs, items to bring, relevant history.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'reschedule_appointment', name: 'Reschedule', description: 'Offer to move the appointment', instruction: 'Check if the current time still works. If not, offer alternative slots.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Appointment Completed ────────────────────────────
  appointment_completed: [
    { key: 'check_satisfaction', name: 'Check Satisfaction', description: 'Ask if they are happy with the service', instruction: 'Ask how their visit went. Check if they are satisfied with the service they received.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'identify_unresolved', name: 'Identify Unresolved Issues', description: 'Find anything still outstanding', instruction: 'Ask if there is anything that was not addressed during their visit. Identify follow-up needs.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'request_review', name: 'Request Review', description: 'Ask for a review or testimonial', instruction: 'If they had a positive experience, politely ask them to leave a review or share a testimonial.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'offer_additional', name: 'Offer Additional Services', description: 'Suggest related services', instruction: 'Based on their visit, suggest any additional services or products that might benefit them.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'schedule_next', name: 'Schedule Next Appointment', description: 'Book a follow-up visit', instruction: 'Offer to schedule their next appointment while they are on the line. Find a time that works.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Appointment Missed ───────────────────────────────
  appointment_missed: [
    { key: 'investigate_missed', name: 'Investigate Missed Appt', description: 'Find out why they did not show', instruction: 'Find out why they missed the appointment. Listen for issues — forgot, emergency, scheduling conflict, anxiety.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'reschedule_appointment', name: 'Reschedule', description: 'Offer to book a new time', instruction: 'Offer to reschedule. Present a few available time slots and confirm their preferred time.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'discuss_cancellation_policy', name: 'Discuss Policy', description: 'Explain the cancellation/no-show policy', instruction: 'Politely explain the no-show or cancellation policy. Be factual, not punitive.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'leave_voicemail', name: 'Leave Voicemail', description: 'Leave a message asking them to call back', instruction: 'Leave a brief voicemail: they missed their appointment, please call back to reschedule.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Incoming Call ────────────────────────────────────
  incoming_call: [
    { key: 'identify_purpose', name: 'Identify Purpose', description: 'Find out why they are calling', instruction: 'Greet the caller and ask how you can help. Identify the purpose of their call.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'take_message', name: 'Take a Message', description: 'Record a message for the team', instruction: 'Let them know the person they need is unavailable. Take a detailed message — name, number, reason for calling.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'route_call', name: 'Route Call', description: 'Transfer to the right person or department', instruction: 'Determine who they need to speak with and transfer the call to the appropriate person or department.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Missed Call ──────────────────────────────────────
  missed_call: [
    { key: 'return_call', name: 'Return Call', description: 'Call them back', instruction: 'Call the customer back. Apologize for missing their call and ask how you can help.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'identify_reason', name: 'Identify Reason', description: 'Find out why they called', instruction: 'Find out the reason for their call. Ask what they needed and offer to help or connect them with the right person.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Call Failed ──────────────────────────────────────
  call_failed: [
    { key: 'retry_call', name: 'Retry Call', description: 'Try calling again', instruction: 'The previous call attempt failed. Try calling the customer again.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'leave_voicemail', name: 'Leave Voicemail', description: 'Leave a message', instruction: 'Leave a brief voicemail with your name, reason for calling, and a callback number.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Voicemail Received ───────────────────────────────
  voicemail_received: [
    { key: 'address_voicemail', name: 'Address Voicemail', description: 'Respond to what they left in the message', instruction: 'Reference the voicemail they left. Address their question or request directly.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'schedule_callback', name: 'Schedule Callback', description: 'Set a time to call them back', instruction: 'Let them know you received their voicemail. Offer a specific time to call them back.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Call Answered ────────────────────────────────────
  call_answered: [
    { key: 'verify_identity', name: 'Verify Identity', description: 'Confirm you reached the right person', instruction: 'Confirm you are speaking with the intended recipient before proceeding with your message.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'deliver_message', name: 'Deliver Message', description: 'Share the intended message', instruction: 'Deliver your message clearly and concisely. Ask if they have any questions.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── SMS Received ─────────────────────────────────────
  sms_received: [
    { key: 'address_question', name: 'Address Question', description: 'Respond to their text', instruction: 'Read the incoming SMS and respond to their question or request directly.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Customer Replied ────────────────────────────────
  customer_replied: [
    { key: 'follow_up', name: 'Follow Up', description: 'Continue from where the text left off', instruction: 'Read their reply and follow up on their question or request. Address any new information they provided.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Payment Failed ───────────────────────────────────
  payment_failed: [
    { key: 'investigate_payment', name: 'Investigate Payment', description: 'Find out what went wrong', instruction: 'Investigate the failed payment. Ask about their payment method — expired card, insufficient funds, wrong details.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'offer_payment_plan', name: 'Offer Payment Plan', description: 'Suggest alternative payment options', instruction: 'Offer flexible payment options — installment plan, different payment method, extended deadline.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'save_at_risk', name: 'Save At-Risk Customer', description: 'Prevent them from leaving', instruction: 'The customer may leave due to billing issues. Address their concerns, offer solutions, and keep them engaged.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'confirm_billing', name: 'Confirm Billing Info', description: 'Verify their payment details are correct', instruction: 'Verify their billing information — card number, billing address, expiration date. Identify what needs updating.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  payment_received: [
    { key: 'confirm_payment', name: 'Confirm Payment', description: 'Verify payment was received', instruction: 'Confirm their payment was received and processed. Thank them for their payment.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  refund_issued: [
    { key: 'confirm_payment', name: 'Confirm Refund', description: 'Let them know the refund has been issued', instruction: 'Confirm the refund has been issued, explain the amount, and set expectations for when it should appear.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  payment_link_sent: [
    { key: 'confirm_receipt', name: 'Confirm Receipt', description: 'Make sure they got the payment link', instruction: 'Confirm they received the payment link. Ask if they have any questions about it.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'explain_charges', name: 'Explain Charges', description: 'Walk them through the payment request', instruction: 'Walk the customer through the payment request. Explain each line item and answer any questions.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  subscription_created: [
    { key: 'confirm_receipt', name: 'Welcome Subscriber', description: 'Confirm the subscription is active', instruction: 'Confirm the subscription is active, explain what they now have access to, and answer immediate billing questions.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Record Created ───────────────────────────────────
  record_created: [
    { key: 'welcome_customer', name: 'Welcome Customer', description: 'Welcome them as a new customer', instruction: 'Welcome the new customer. Introduce the business, thank them for choosing you, and let them know how to reach you.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'collect_info', name: 'Collect Info', description: 'Gather missing details', instruction: 'Verify and collect any missing information — email, address, preferences, emergency contact.', appliesTo: ['call_customer', 'call_phone_number'] },
    { key: 'explain_services', name: 'Explain Services', description: 'Walk them through what you offer', instruction: 'Explain the services relevant to them. Set expectations for how your business works.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Record Updated ───────────────────────────────────
  record_updated: [
    { key: 'verify_changes', name: 'Verify Changes', description: 'Confirm the record update is correct', instruction: 'Confirm the changes made to their record are accurate. Ask if anything else needs updating.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],

  // ─── Record Deleted ───────────────────────────────────
  record_deleted: [
    { key: 'confirm_deletion', name: 'Confirm Deletion', description: 'Verify the record removal', instruction: 'Confirm the record has been removed. Ask if there is anything else you can help with.', appliesTo: ['call_customer', 'call_phone_number'] },
  ],
};

/**
 * Get smart actions for a given trigger + action combination
 * Filters by appliesTo to ensure only relevant actions are shown
 * @param {string} triggerKey - The trigger key (e.g., 'appointment_missed')
 * @param {string} actionKey - The action key (e.g., 'call_customer')
 * @returns {Array} Filtered array of smart action objects
 */
export function getSmartActions(triggerKey, actionKey) {
  if (!triggerKey) return [];
  const triggerActions = SMART_ACTIONS[triggerKey] || [];
  if (!actionKey) return triggerActions;
  return triggerActions.filter(a => a.appliesTo.includes(actionKey));
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
  return null;
}

export default SMART_ACTIONS;
