"""Versioned, industry-aware drop-in defaults. Saved customer edits are independent."""
STATUSES = ('pending', 'confirmed', 'completed', 'missed', 'cancelled')


def template(key, name, description, prompt, category, statuses, icon='phone', industries=None, purpose=None):
    return dict(key=key, name=name, purpose=purpose or name[:30], description=description, prompt=prompt,
                category=category, statuses=list(statuses), icon=icon, industries=industries or [])


TEMPLATES = [
    template('confirm', 'Confirm', 'Check if they’re still planning to attend their appointment.', 'Check whether the customer is still planning to attend their upcoming appointment and share any important preparation instructions for their service, if applicable.', 'Appointments', ['pending'], 'calendar', purpose='confirm'),
    template('cancel-appointment', 'Cancel', 'Explain that you need to cancel their appointment.', 'Explain that their appointment needs to be canceled, acknowledge the inconvenience, and offer to help them reschedule or book another time.', 'Appointments', ['pending', 'confirmed'], 'calendar', purpose='cancel'),
    template('reminder', 'Appointment Reminder', 'Remind them of their upcoming appointment.', 'Remind the customer about their upcoming appointment, provide relevant details, and share any important preparation instructions for their service, if applicable.', 'Appointments', ['pending', 'confirmed'], 'bell', purpose='remind them'),
    template('reschedule', 'Reschedule', 'Help them find a better time for their appointment.', 'Help the customer move their appointment to a more convenient time.', 'Appointments', ['pending', 'confirmed', 'cancelled', 'missed'], 'calendar', purpose='reschedule'),
    template('rebook', 'Rebook', 'Help them schedule another appointment.', 'Encourage the customer to schedule another appointment and assist them if they’re interested.', 'Appointments', ['completed', 'cancelled', 'missed'], 'repeat', purpose='rebook'),
    template('running-behind', 'Running Behind', 'Update them about a delay to their upcoming appointment.', 'Apologize for the delay, explain how it affects their appointment, and share the updated arrival or start time if available.', 'Appointments', ['pending', 'confirmed'], 'bell', purpose='explain the delay'),
    template('missing-information', 'Missing Information', 'Collect information needed before their appointment.', 'Explain what information is still needed for their upcoming appointment and help them provide it.', 'Appointments', ['pending', 'confirmed'], 'message', purpose='request missing information'),
    template('thank-you', 'Thank You', 'Thank them for their recent visit.', 'Thank the customer for their recent visit and express appreciation for choosing the business.', 'Customer Experience', ['completed'], 'sparkles', purpose='thank them'),
    template('check-in', 'Check In', 'See how their experience went.', 'Check how things have been since their appointment and address any questions or concerns.', 'Customer Experience', ['completed'], 'heart', purpose='check in'),
    template('payment-reminder', 'Payment Reminder', 'Remind them about an outstanding payment.', 'Talk through any outstanding balance and help if they have questions.', 'Customer Experience', ['completed'], 'receipt', purpose='discuss payment'),
    template('google-review', 'Google Review', 'Invite them to leave a Google review.', 'Thank the customer for their visit and invite them to share their experience through an honest Google review.', 'Reviews & Reputation', ['completed'], 'google', purpose='request a review'),
    template('feedback', 'Request Feedback', 'Ask for feedback about their experience.', 'Ask the customer about their experience and gather any feedback they’d like to share.', 'Reviews & Reputation', ['completed'], 'message', purpose='request feedback'),
    template('care', 'Resolve a Concern', 'Follow up on a concern about their experience.', 'Follow up on a previously reported concern and see whether there’s anything further the business can do to help.', 'Reviews & Reputation', ['completed'], 'heart', purpose='resolve a concern'),
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
        ('Google Review', 'request a review', _BASE_TEMPLATES['google-review']['prompt']),
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
