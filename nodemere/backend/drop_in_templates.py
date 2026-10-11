"""Versioned, industry-aware drop-in defaults. Saved customer edits are independent."""
STATUSES = ('pending', 'confirmed', 'completed', 'missed', 'cancelled')


def template(key, name, description, prompt, category, statuses, icon='phone', industries=None):
    return dict(key=key, name=name, purpose=name[:30], description=description, prompt=prompt,
                category=category, statuses=list(statuses), icon=icon, industries=industries or [])


TEMPLATES = [
    template('confirm', 'Confirm Appointment', 'Make sure they are still joining you.', 'Confirm the appointment provided in your context. Confirm the date, time and service. If they need a change, use the available scheduling tools and confirm any change with the customer before saving it.', 'Appointments', ['pending'], 'calendar'),
    template('cancel-appointment', 'Cancel', 'Confirm that they want to cancel.', 'Discuss cancelling this appointment. Confirm that they want to cancel before changing the booking. If cancellation tools are unavailable, explain that the team will need to handle the request. Do not claim the appointment was cancelled unless the change succeeds.', 'Appointments', ['pending', 'confirmed'], 'calendar'),
    template('reminder', 'Appointment Reminder', 'A friendly heads-up before their visit.', 'Provide a friendly reminder of their appointment date, time and service. Answer preparation questions using the business information. Do not invent instructions.', 'Appointments', ['pending', 'confirmed'], 'bell'),
    template('reschedule', 'Reschedule', 'Help find a time that works better.', 'Discuss rescheduling this appointment. Ask their preferred time, check real availability with the scheduling tools, and obtain confirmation before changing the booking. Do not promise a slot without checking.', 'Appointments', ['pending', 'confirmed', 'cancelled', 'missed'], 'calendar'),
    template('rebook', 'Rebook', 'Turn a recent visit into the next one.', 'Ask whether they would like another appointment, and help book a suitable service using real availability. Confirm all details before creating a new booking; do not change the historical appointment.', 'Appointments', ['completed', 'cancelled', 'missed'], 'repeat'),
    template('missed', 'Missed You', 'Reconnect after a missed appointment.', 'Speak kindly about their missed appointment. Ask if they would like help booking again. Avoid blame, do not invent a cancellation fee, and check real availability before booking.', 'Customer Experience', ['missed'], 'heart'),
    template('cancelled', 'Cancellation Follow-Up', 'Keep the door open after a cancellation.', 'Follow up on their cancelled appointment. Ask if there is anything the business can help with and whether they want to arrange another visit. Respect their decision if they decline.', 'Customer Experience', ['cancelled'], 'heart'),
    template('google-review', 'Google Review', 'Invite an honest account of their visit.', 'Thank them for their visit, and politely invite an honest Google review of their experience, regardless of whether it was positive or negative. Never offer incentives or ask for a particular rating. Use the business review link only if it is available; never invent a link or claim to have sent one.', 'Reviews & Reputation', ['completed'], 'google'),
    template('feedback', 'Request Feedback', 'Listen to what went well and what could improve.', 'Ask for candid feedback about their appointment. Listen without pressure, summarize their feedback, and offer to pass concerns to the team. Do not promise compensation or an outcome without authorization.', 'Reviews & Reputation', ['completed'], 'message'),
    template('care', 'Experience Follow-Up', 'Give an unresolved concern personal attention.', 'Follow up on any concern documented for this appointment. Ask how the team can help and record what they share. If no concern is documented, ask how their experience was without assuming something went wrong. Escalate requests outside your authority.', 'Reviews & Reputation', ['completed'], 'heart'),
    template('thank-you', 'Thank You', 'A personal thank-you from your receptionist.', 'Thank them for choosing the business and visiting for this appointment. Keep the conversation warm and brief, ask if they need anything else, and respect their time.', 'Customer Experience', ['completed'], 'sparkles'),
    template('check-in', 'Check In', 'See how things are going after the service.', 'Check how things have been since their appointment. Answer questions within the business information and offer a team follow-up for anything you cannot resolve.', 'Customer Experience', ['completed'], 'heart'),
    template('win-back', 'Welcome Back', 'Invite a customer to reconnect.', 'Ask whether they would be interested in visiting again. Do not assume how long it has been unless the history confirms it. Mention only current documented services and offers. Respect a decline.', 'Sales & Retention', ['completed', 'cancelled', 'missed'], 'repeat'),
    template('service-follow-up', 'Service Follow-Up', 'Help with the next step after a visit.', 'Discuss the service connected to this appointment. Ask if they have questions or would like help with a next step. Use only documented recommendations and prices.', 'Sales & Retention', ['completed'], 'sparkles'),
    template('payment-reminder', 'Payment Reminder', 'A courteous reminder about a verified balance.', 'Discuss only an outstanding invoice verified through the available payment records. Confirm you are speaking with the customer before discussing the balance. Do not infer a balance from the appointment price. Never invent an amount, charge a card, or claim a payment link was sent without a successful tool result. If no verified balance exists, do not request payment.', 'Customer Experience', ['completed'], 'receipt'),
]

_BASE_TEMPLATES = {item['key']: item for item in TEMPLATES}
STATUS_STARTERS = {
    'pending': (
        ('Confirm', 'confirm', _BASE_TEMPLATES['confirm']['prompt']),
        ('Reschedule', 'reschedule', _BASE_TEMPLATES['reschedule']['prompt']),
        ('Cancel', 'cancel', _BASE_TEMPLATES['cancel-appointment']['prompt']),
    ),
    'confirmed': (
        ('Reschedule', 'reschedule', _BASE_TEMPLATES['reschedule']['prompt']),
        ('Cancel', 'cancel', _BASE_TEMPLATES['cancel-appointment']['prompt']),
    ),
    'cancelled': (
        ('Reschedule', 'reschedule', _BASE_TEMPLATES['reschedule']['prompt']),
    ),
    'completed': (
        ('Rebook', 'rebook', _BASE_TEMPLATES['rebook']['prompt']),
        ('Google Review', 'request a Google review', _BASE_TEMPLATES['google-review']['prompt']),
        ('Check In', 'check in', _BASE_TEMPLATES['check-in']['prompt']),
        ('Thank You', 'thank them', _BASE_TEMPLATES['thank-you']['prompt']),
        ('Request Feedback', 'request feedback', _BASE_TEMPLATES['feedback']['prompt']),
    ),
}

# Older seeded records remain editable, so only migrate untouched starter wording.
LEGACY_STARTER_PURPOSES = {
    'Confirm': {'confirm appointment', 'confirm the appointment'},
    'Reschedule': {'reschedule appointment', 'reschedule the appointment'},
    'Cancel': {'cancel appointment', 'cancel the appointment', 'canceled'},
}

def for_industry(value):
    return list(TEMPLATES)
