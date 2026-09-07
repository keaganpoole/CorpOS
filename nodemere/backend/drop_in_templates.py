"""Versioned, industry-aware drop-in defaults. Saved customer edits are independent."""
STATUSES = ('pending', 'confirmed', 'completed', 'missed', 'cancelled')


def template(key, name, description, prompt, category, statuses, icon='phone', industries=None):
    return dict(key=key, name=name, purpose=name[:30], description=description, prompt=prompt,
                category=category, statuses=list(statuses), icon=icon, industries=industries or [])


TEMPLATES = [
    template('confirm', 'Confirm Appointment', 'Make sure they are still joining you.', 'Call the customer to confirm the appointment provided in your context. Confirm the date, time and service. If they need a change, use the available scheduling tools and confirm any change with the customer before saving it.', 'Appointments', ['pending'], 'calendar'),
    template('reminder', 'Appointment Reminder', 'A friendly heads-up before their visit.', 'Call the customer with a friendly reminder of their appointment date, time and service. Answer preparation questions using the business information. Do not invent instructions.', 'Appointments', ['pending', 'confirmed'], 'bell'),
    template('reschedule', 'Reschedule', 'Help find a time that works better.', 'Call the customer about rescheduling this appointment. Ask their preferred time, check real availability with the scheduling tools, and obtain confirmation before changing the booking. Do not promise a slot without checking.', 'Appointments', ['pending', 'confirmed', 'cancelled', 'missed'], 'calendar'),
    template('rebook', 'Rebook', 'Turn a recent visit into the next one.', 'Call the customer, ask whether they would like another appointment, and help book a suitable service using real availability. Confirm all details before creating a new booking; do not change the historical appointment.', 'Appointments', ['completed', 'cancelled', 'missed'], 'repeat'),
    template('missed', 'Missed You', 'Reconnect after a missed appointment.', 'Call the customer kindly about their missed appointment. Ask if they would like help booking again. Avoid blame, do not invent a cancellation fee, and check real availability before booking.', 'Customer Experience', ['missed'], 'heart'),
    template('cancelled', 'Cancellation Follow-Up', 'Keep the door open after a cancellation.', 'Call the customer to follow up on their cancelled appointment. Ask if there is anything the business can help with and whether they want to arrange another visit. Respect their decision if they decline.', 'Customer Experience', ['cancelled'], 'heart'),
    template('google-review', 'Google Review', 'Invite an honest account of their visit.', 'Call the customer, thank them for their visit, and politely invite an honest Google review of their experience, regardless of whether it was positive or negative. Never offer incentives or ask for a particular rating. Use the business review link only if it is available; never invent a link or claim to have sent one.', 'Reviews & Reputation', ['completed'], 'google'),
    template('feedback', 'Request Feedback', 'Listen to what went well and what could improve.', 'Call the customer and ask for candid feedback about their appointment. Listen without pressure, summarize their feedback, and offer to pass concerns to the team. Do not promise compensation or an outcome without authorization.', 'Reviews & Reputation', ['completed'], 'message'),
    template('care', 'Experience Follow-Up', 'Give an unresolved concern personal attention.', 'Call the customer to follow up on any concern documented for this appointment. Ask how the team can help and record what they share. If no concern is documented, ask how their experience was without assuming something went wrong. Escalate requests outside your authority.', 'Reviews & Reputation', ['completed'], 'heart'),
    template('thank-you', 'Thank You', 'A personal thank-you from your receptionist.', 'Call the customer to thank them for choosing the business and visiting for this appointment. Keep the conversation warm and brief, ask if they need anything else, and respect their time.', 'Customer Experience', ['completed'], 'sparkles'),
    template('check-in', 'Check In', 'See how things are going after the service.', 'Call the customer to check how things have been since their appointment. Answer questions within the business information and offer a team follow-up for anything you cannot resolve.', 'Customer Experience', ['completed'], 'heart'),
    template('win-back', 'Welcome Back', 'Invite a customer to reconnect.', 'Call the customer and ask whether they would be interested in visiting again. Do not assume how long it has been unless the history confirms it. Mention only current documented services and offers. Respect a decline.', 'Sales & Retention', ['completed', 'cancelled', 'missed'], 'repeat'),
    template('service-follow-up', 'Service Follow-Up', 'Help with the next step after a visit.', 'Call the customer about the service connected to this appointment. Ask if they have questions or would like help with a next step. Use only documented recommendations and prices.', 'Sales & Retention', ['completed'], 'sparkles'),
    template('payment-reminder', 'Payment Reminder', 'A courteous reminder about a verified balance.', 'Call the customer only about an outstanding invoice verified through the available payment records. Confirm you are speaking with the customer before discussing the balance. Do not infer a balance from the appointment price. Never invent an amount, charge a card, or claim a payment link was sent without a successful tool result. If no verified balance exists, do not request payment.', 'Customer Experience', ['completed'], 'receipt'),
]

# These keys exactly match the industries offered by onboarding.
INDUSTRY_VISITS = {
    'Home Services': ('Project Check-In', 'the completed home service and any documented next steps', 'Visit Preparation', 'property access and the documented scope of the service'),
    'Real Estate': ('Viewing Follow-Up', 'their property viewing and any questions for the agent', 'Viewing Reminder', 'the viewing time, meeting location and access instructions'),
    'Automotive': ('Vehicle Service Check-In', 'their recent vehicle service and any remaining concerns', 'Service Visit Reminder', 'vehicle drop-off arrangements and documented service details'),
    'Beauty & Wellness': ('Aftercare Check-In', 'their visit and the business-approved aftercare instructions', 'Visit Preparation', 'the documented preparation instructions for their selected service'),
    'Hospitality': ('Stay Follow-Up', 'their stay or hospitality visit and feedback for the team', 'Arrival Check-In', 'arrival time and documented check-in or reservation instructions'),
    'Professional Services': ('Consultation Follow-Up', 'the consultation and any documented next steps for the professional', 'Consultation Reminder', 'meeting arrangements and any documents requested by the professional'),
    'Retail': ('Shopping Visit Follow-Up', 'their shopping appointment and questions about products discussed', 'Visit Reminder', 'the shopping appointment and any documented items to bring'),
    'Cleaning Services': ('Cleaning Check-In', 'their completed cleaning and any areas needing attention', 'Access Check', 'property access, pets and documented cleaning arrangements'),
    'Landscaping': ('Garden Care Check-In', 'the completed landscaping and documented maintenance advice', 'Site Visit Reminder', 'site access and the landscaping work scheduled'),
    'Plumbing': ('Repair Check-In', 'their plumbing service and whether they need the team to follow up', 'Plumbing Visit Reminder', 'property access and the reported plumbing issue'),
    'HVAC': ('Comfort Check-In', 'their recent HVAC service and any remaining comfort concerns', 'HVAC Visit Reminder', 'equipment access and the scheduled service'),
    'Electrical': ('Service Check-In', 'their electrical service and questions for the qualified electrician', 'Electrician Visit Reminder', 'property access and the documented electrical work'),
    'Pest Control': ('Treatment Check-In', 'their treatment and business-approved follow-up guidance', 'Treatment Preparation', 'the documented preparation instructions for their treatment'),
    'Moving & Storage': ('Move Follow-Up', 'their move or storage visit and any unresolved logistics', 'Moving Day Check', 'the booked moving time, access and documented logistics'),
    'Construction & Remodeling': ('Project Follow-Up', 'the project appointment and documented next steps', 'Site Meeting Reminder', 'site meeting time, access and project documents requested'),
    'Photography': ('Session Follow-Up', 'their photography session and documented delivery expectations', 'Session Preparation', 'session location, timing and the photographer-approved preparation guide'),
    'Catering & Food Service': ('Event Dining Follow-Up', 'their catering or dining experience and feedback for the team', 'Reservation Check', 'the reservation or catering appointment details and dietary requests for the team'),
    'Events & Venues': ('Event Follow-Up', 'their event or venue visit and questions for the coordinator', 'Venue Visit Reminder', 'venue visit arrangements and the confirmed meeting point'),
    'Fitness & Recreation': ('Session Check-In', 'their fitness or recreation session and interest in booking again', 'Session Reminder', 'session timing and business-approved preparation instructions'),
    'Pet Services': ('Pet Visit Follow-Up', 'their pet service visit and questions for the team', 'Pet Visit Preparation', 'arrival arrangements and documents the business has requested'),
    'Travel & Tours': ('Tour Follow-Up', 'their tour or travel consultation and feedback for the team', 'Departure Reminder', 'the booked meeting point, time and confirmed tour instructions'),
    'Interior Design': ('Design Consultation Follow-Up', 'their consultation and documented next steps with the designer', 'Design Meeting Reminder', 'meeting arrangements and any materials the designer requested'),
    'Marketing & Creative': ('Creative Consultation Follow-Up', 'their consultation and questions about the documented project brief', 'Briefing Reminder', 'the meeting time and materials requested for the creative briefing'),
    'IT Services': ('Support Follow-Up', 'their support appointment and any unresolved issues for the technician', 'Support Visit Reminder', 'the support appointment and approved access arrangements; never request passwords'),
    'Repair Services': ('Repair Follow-Up', 'their repair appointment and questions for the technician', 'Repair Visit Reminder', 'the repair appointment and documented drop-off or access instructions'),
    'Wholesale & Distribution': ('Account Visit Follow-Up', 'their account appointment and documented next steps', 'Account Meeting Reminder', 'the account meeting and any order references requested by the team'),
    'Other General Business': ('Visit Follow-Up', 'their appointment and any questions for the team', 'Visit Preparation', 'their appointment and documented preparation instructions'),
}
for industry, (follow_name, follow_topic, prep_name, prep_topic) in INDUSTRY_VISITS.items():
    slug = ''.join(c if c.isalnum() else '-' for c in industry.lower()).strip('-')
    TEMPLATES.append(template(f'{slug}-follow', follow_name, f'A follow-up tailored to {industry.lower()}.',
        f'Call the customer to discuss {follow_topic}. Use the appointment context and verified business information. Record concerns and hand off specialist questions. Do not invent advice, offers or commitments.',
        'For Your Industry', ['completed'], 'sparkles', [industry]))
    TEMPLATES.append(template(f'{slug}-prepare', prep_name, f'Help customers prepare for their {industry.lower()} appointment.',
        f'Call the customer to confirm {prep_topic}. Use only the details provided by the appointment and business. Ask about missing details and pass them to the team rather than making assumptions.',
        'For Your Industry', ['pending', 'confirmed'], 'calendar', [industry]))


def for_industry(value):
    if isinstance(value, dict):
        value = value.get('industry', '')
    industry = value if value in INDUSTRY_VISITS else 'Other General Business'
    return [t for t in TEMPLATES if not t['industries'] or industry in t['industries']]
