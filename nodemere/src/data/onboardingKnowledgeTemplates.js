import { additionalBusinessBriefContexts, additionalIndustryExamples } from './onboardingIndustryTemplates';

export const industryExamples = {
  'Home Services': {
    serviceName: 'Roof repair',
    about: `Business overview:
We are a family-owned residential roofing company based in Portland, Maine. We help homeowners protect their homes with clear roofing guidance, reliable repairs, and professional installation work.

Why customers come to us:
Customers usually reach out when their home feels exposed, urgent, or uncertain. They are not just looking for roofing work; they are looking for confidence that the problem will be understood and handled responsibly.

How we should be represented:
Sound calm, practical, and trustworthy. Customers may be worried about leaks, storm damage, cost, or urgency, so explain next steps clearly and avoid overpromising before an inspection.

What customers should understand:
- We handle roof repairs, asphalt shingles, metal roofing, flat roofs, gutter installation, and siding.
- We are licensed and insured.
- Workmanship warranty details are confirmed based on the service performed.
- Emergency or active leak situations should be treated as higher priority.

Service area:
We serve Greater Portland and much of southern Maine, including Portland, South Portland, Scarborough, Westbrook, Falmouth, Cape Elizabeth, Gorham, Windham, Cumberland, Yarmouth, Freeport, and nearby communities.

Boundaries:
Do not diagnose the exact cause of roof damage without an inspection. If the customer has active leaking, storm damage, or safety concerns, collect details and help schedule the soonest appropriate follow-up.
`,
    policies: `We require at least 24 hours' notice for non-emergency appointments.
We allow same-day emergency visits only for active leaks, storm damage, or safety issues.
We do not schedule roof inspections before collecting the property address.
We do not provide final repair pricing without an inspection.
We require photos before prioritizing storm-damage calls when the customer can provide them safely.
We do not send crews onto roofs during unsafe weather conditions.
We require homeowner or property-manager approval before performing any paid repair work.
We require deposits for replacement projects above $5,000.
We do not begin replacement projects until the signed estimate and deposit are received.
We do not work on properties outside our normal service area without manager approval.
We do not handle interior water-damage restoration.
We do not provide mold remediation services.
We do not install customer-supplied roofing materials.
We do not perform warranty work for roofs installed by another contractor unless approved.
We schedule commercial property visits only after collecting the building type and access details.
We require tenant coordination details before visiting occupied rental properties.
We do not guarantee same-day repairs during major storm periods.
We require final payment when work is complete unless another arrangement is approved.
We do not accept cash payments in the field.
We require all warranty questions to be routed to the office for review.`,
    faq: `Q: Do you offer free estimates?
A: Yes, estimates are available for most larger projects. Emergency visits or diagnostic calls may have a service fee.

Q: How soon can someone come out?
A: Availability depends on the schedule and urgency. Emergency issues are prioritized whenever possible.

Q: Are you licensed and insured?
A: Yes, we are licensed and insured.

Q: What areas do you serve?
A: We serve Cumberland County and most of Southern Maine.

Q: Do you handle emergency repairs?
A: Yes, callers with active leaks, storm damage, or urgent issues should be prioritized for the soonest available appointment.`,
    serviceDescription: (serviceName) => `Service overview:
This service helps homeowners fix roof issues before they turn into larger damage. It is for leaks, missing or damaged shingles, storm damage, flashing problems, small punctures, worn sealant, and other localized roofing issues.

Best fit:
This service is a good fit when a customer notices water stains, active leaking, loose or missing shingles, damage after heavy wind or hail, exposed flashing, or a roof problem that seems limited to one area.

What is included:
- Inspection of the affected area
- Identification of the likely cause of the issue
- Clear explanation of the repair options
- Repair of common localized roof problems when possible
- Recommendation for a larger estimate if the issue is more extensive

What customers can expect:
Customers can expect a straightforward assessment, practical repair guidance, and a clear next step. If the issue can be repaired during the visit, the technician will explain the work before moving forward. If the roof needs a larger repair or replacement estimate, the customer will be guided toward the right follow-up.

Recommended next step:
Ask where the issue is located, whether there is active leaking, when the problem started, and whether there was recent storm damage. If the customer is dealing with an active leak or urgent damage, prioritize the soonest available appointment.`,
  },
  'Real Estate': {
    serviceName: 'Buyer consultation',
    about: `Business overview:
We are a residential real estate team based in Portland, Maine. We help buyers, sellers, and relocating families make informed decisions in a competitive local market.

Why customers come to us:
Customers often come to us during major life transitions. They want steady guidance, local insight, and the feeling that someone is helping them make smart decisions instead of pushing them through a transaction.

How we should be represented:
Sound knowledgeable, responsive, and steady. Customers may be making high-stakes decisions, so keep answers clear and encourage the right next step instead of guessing.

What customers should understand:
- We help with buying, selling, relocation, listing preparation, showings, and consultations.
- First-time buyers may need guidance on pre-approval, budget, timeline, and next steps.
- Sellers may need help understanding pricing, timing, preparation, and listing strategy.
- Urgent offer, showing, or inspection deadlines should be prioritized.

Service area:
We serve Greater Portland and nearby communities, including South Portland, Scarborough, Falmouth, Cape Elizabeth, Westbrook, Cumberland, and surrounding areas.

Boundaries:
Do not provide legal, tax, lending, or appraisal advice. Route those questions to the appropriate licensed professional or team member.`,
    policies: `We require at least 24 hours' notice for occupied-property showings.
We allow same-day showings only when the seller has approved them.
We require mortgage pre-approval before scheduling private showings.
We require proof of funds before showing properties listed above $1 million.
We do not accept residential listings below $200,000.
We do not accept listings more than 50 miles from our office.
We do not handle rental properties.
We do not provide property management services.
We do not represent buyers purchasing foreclosure or auction properties.
We do not reduce our standard commission without broker approval.
We do not hold open houses unless specifically requested by the seller.
We require professional photography for every new listing.
We do not allow overlapping private showings.
We require listing agreements to have a minimum 90-day term.
We do not accept buyer representation agreements shorter than 30 days.
We do not provide complimentary home valuations outside our normal service area.
We do not schedule listing consultations without first collecting the property address.
We do not schedule private showings outside 8:00 AM to 8:00 PM.
We limit private showings to 60 minutes unless additional time is approved.
We do not accept cash payments at the office.`,
    faq: `Q: Can you help first-time buyers?
A: Yes, we regularly help first-time buyers understand the process and prepare for next steps.

Q: Do I need pre-approval before seeing homes?
A: It is strongly recommended because it helps clarify budget and makes offers stronger.

Q: What areas do you cover?
A: We serve Greater Portland and nearby communities.

Q: Can you help sell my home?
A: Yes, we can schedule a listing consultation to review the property, timing, and pricing strategy.

Q: Can you help with relocation?
A: Yes, relocation inquiries can be routed to the team after collecting the customer's timeline, preferred areas, budget, and current location.`,
    serviceDescription: (serviceName) => `Service overview:
This service helps prospective buyers understand the buying process, clarify their goals, and decide what steps to take before touring homes or making offers.

Best fit:
This service is a good fit for first-time buyers, relocating buyers, or anyone who wants guidance before actively searching.

What is included:
- Review of buying goals and timeline
- Discussion of preferred locations and property needs
- Guidance on financing readiness and pre-approval
- Overview of the search, offer, inspection, and closing process
- Recommendation for next steps based on buyer readiness

What customers can expect:
Customers can expect a clear, low-pressure conversation that helps them understand what to do next and how to prepare for a successful home search.

Recommended next step:
Ask about budget, preferred areas, timeline, financing status, and must-have features. If the buyer is ready, help schedule a consultation or connect them with the right team member.`,
  },
  'Beauty & Wellness': {
    serviceName: 'Signature facial',
    about: `Business overview:
We are a boutique skincare and wellness studio focused on calm, personalized treatments. We help clients improve skin health while creating a relaxing, professional experience.

Why customers come to us:
Clients often come to us because they want to feel better in their skin and trust someone to guide them thoughtfully. The experience should feel personal, attentive, and reassuring rather than clinical or rushed.

How we should be represented:
Sound warm, polished, and reassuring. Clients may be unsure which treatment fits them, so guide them gently and encourage consultation when needed.

What customers should understand:
- Treatments are personalized based on skin goals, comfort level, and treatment history.
- For health, medical, or other sensitive concerns, route the client to an authorized team member before collecting details.
- Cleanliness, consistency, and client comfort are important parts of the experience.
- Recurring appointments may be recommended depending on skin goals.

Service style:
Appointments should feel calm, professional, and never rushed.

Boundaries:
Do not make medical claims or diagnose skin conditions. For medical or other sensitive concerns, route the client to an authorized team member.`,
    policies: `We require at least 24 hours' notice for cancellations or rescheduling.
We charge a cancellation fee for missed appointments without notice.
We require a card on file for appointments longer than 90 minutes.
We do not accept walk-ins for advanced treatments.
We require new clients to complete intake questions before their first appointment.
We do not perform treatments on clients with active skin irritation unless the provider approves.
Questions involving allergies, sensitivities, pregnancy, or recent procedures are routed to an authorized team member before details are collected.
We do not perform certain treatments within 14 days of injectables, peels, or laser procedures.
We do not allow guests in treatment rooms unless approved in advance.
We require clients under 18 to have parent or guardian consent.
We do not issue refunds for completed services.
We allow service adjustments only within 7 days of the original appointment.
We require deposits for bridal, event, or mobile bookings.
We do not hold recurring appointment times without provider approval.
We do not book mobile appointments outside the normal service area.
We require final payment at the time of service.
We do not accept checks for first-time clients.
We do not guarantee specific product results.
We require patch tests for selected products or treatments when recommended by the provider.
We route medical skin concerns to a qualified healthcare professional.`,
    faq: `Q: Do you work with sensitive skin?
A: Yes, treatment recommendations can be adjusted for sensitive skin.

Q: How do I know which service to book?
A: If unsure, clients can book a consultation or choose a starter treatment and discuss goals before the service.

Q: Should I arrive early?
A: Arriving a few minutes early is recommended.

Q: Can I book recurring appointments?
A: Yes, recurring appointments can be discussed based on treatment goals.

Q: What should I mention before booking?
A: An authorized team member can explain the approved intake process for information that may affect treatment suitability.`,
    serviceDescription: (serviceName) => `Service overview:
This service is a personalized skincare treatment designed to refresh the skin, support skin health, and create a calm, restorative experience.

Best fit:
This service is a good fit for clients who want a professional facial, help with dryness or congestion, or a relaxing treatment tailored to their skin goals.

What is included:
- Skin check-in and goal review
- Cleansing and preparation
- Customized treatment steps based on skin needs
- Product recommendations when appropriate
- Guidance for follow-up care

What customers can expect:
Clients can expect a relaxing appointment, clear communication, and a treatment adapted to their comfort level and skin condition.

Recommended next step:
Ask about skin goals, sensitivities, recent treatments, and preferred appointment time. If the client is unsure what to book, recommend a consultation or starter facial.`,
  },
  Automotive: {
    serviceName: 'Brake inspection',
    about: `Business overview:
We are a local auto repair shop focused on honest diagnostics, clear estimates, and dependable vehicle maintenance.

Why customers come to us:
Customers usually reach out when something feels wrong, inconvenient, or unsafe. They want straightforward answers, fair guidance, and confidence about what needs attention now versus later.

How we should be represented:
Sound direct, practical, and safety-focused. Customers may be stressed about vehicle issues, so ask for symptoms clearly and help them understand the next step.

What customers should understand:
- We help with common maintenance, diagnostics, brake concerns, warning lights, and repair needs for most passenger vehicles.
- Useful intake details include year, make, model, mileage, symptoms, warning lights, and when the issue started.
- Final pricing may depend on inspection, parts, and labor.
- Brake, steering, tire, overheating, or drivability concerns should be treated as higher priority.

Service style:
Communication should be straightforward and transparent about what is known, what needs inspection, and what can wait.

Boundaries:
Do not diagnose the exact repair or guarantee pricing without technician review.`,
    policies: `We require the vehicle year, make, model, and mileage before scheduling repair work.
We require diagnostic approval before performing paid diagnostic work.
We do not provide final repair pricing without inspecting the vehicle.
We do not install customer-supplied parts unless manager approval is given.
We require payment before releasing the vehicle.
We do not accept vehicles with active fuel leaks unless the shop approves the drop-off.
We prioritize brake, steering, tire, overheating, and no-start concerns.
We do not guarantee same-day completion without parts availability confirmation.
We require customer approval before any work exceeds the original estimate.
We do not perform body work or collision repair.
We do not perform state inspections outside posted inspection hours.
We do not work on commercial fleet vehicles without an account on file.
We require keys to be left in the approved drop box for after-hours drop-off.
We do not allow customers in service bays.
We require abandoned vehicles to be picked up within 3 business days after completion.
We charge storage fees for completed vehicles not picked up on time.
We do not accept cash payments after hours.
We require towing details before accepting a vehicle delivered by tow truck.
We do not diagnose intermittent issues by phone.
We require written approval for repairs requested by anyone other than the vehicle owner.`,
    faq: `Q: Can you diagnose warning lights?
A: Yes, diagnostic appointments can be scheduled for warning lights and vehicle symptoms.

Q: Do I need an appointment?
A: Appointments are recommended so the shop can plan technician time.

Q: Can you give an exact price over the phone?
A: Some services can be estimated, but final pricing may depend on inspection and parts.

Q: What information should I provide?
A: Vehicle year, make, model, mileage, symptoms, and when the issue started are helpful.

Q: Can I wait while the vehicle is being serviced?
A: Waiting may be possible for shorter services, but timing depends on the repair, inspection needs, and shop schedule.`,
    serviceDescription: (serviceName) => `Service overview:
This service helps drivers understand whether their brakes are safe, worn, noisy, or in need of repair.

Best fit:
This service is a good fit when a customer hears squeaking or grinding, feels vibration while braking, notices reduced stopping power, or has a brake warning light.

What is included:
- Review of the customer's brake concern
- Inspection of visible brake components
- Assessment of likely wear or safety issues
- Explanation of repair recommendations
- Estimate or next step based on findings

What customers can expect:
Customers can expect a practical safety-focused inspection and clear guidance on whether the vehicle needs immediate work or planned maintenance.

Recommended next step:
Ask for the vehicle year, make, model, symptoms, and when the issue started. If braking feels unsafe, recommend the earliest available appointment.`,
  },
  Hospitality: {
    serviceName: 'Private event reservation',
    about: `Business overview:
We are a neighborhood restaurant and event space known for seasonal food, attentive service, and intimate gatherings.

Why customers come to us:
Guests come to us for experiences that feel welcoming, memorable, and well cared for. Whether it is a dinner reservation or a private event, they want the planning and hospitality to feel easy and personal.

How we should be represented:
Sound warm, organized, and hospitality-first. Guests should feel welcomed, understood, and guided toward the right reservation or event follow-up.

What customers should understand:
- We help with standard reservations, group dining, small celebrations, private dinners, and event inquiries.
- Important event details include date, time, guest count, event type, food preferences, and accessibility needs.
- Larger groups or private events may require advance planning and team follow-up.
- Dietary restrictions should be captured so the team can confirm options.

Service style:
The tone should feel gracious, polished, and helpful without making availability promises before checking.

Boundaries:
Do not guarantee a reservation, private room, menu item, or accommodation until availability is confirmed by the team.`,
    policies: `We require reservations for parties of 8 or more.
We require a deposit for private events.
We do not hold private event dates without a signed agreement.
We require final guest counts at least 7 days before private events.
We do not guarantee patio seating.
We do not seat incomplete parties during peak dinner service.
We hold reservations for 15 minutes before releasing the table.
We do not accept outside food or beverages without manager approval.
We require cake-cutting approval before guests bring a celebration cake.
We require dietary restrictions to be submitted before prix fixe or private event menus are finalized.
We do not split checks for parties larger than 8.
We apply automatic gratuity to parties of 6 or more.
We do not book private events less than 72 hours in advance.
We do not guarantee specific tables.
We do not allow event setup before the approved access time.
We require a room fee or minimum spend for private rooms.
We do not allow confetti, glitter, open flames, or wall-mounted decorations.
We require accessibility requests to be noted when booking.
We do not accept cash deposits for events.
We require cancellations for large parties to be handled by a manager.`,
    faq: `Q: Do you take reservations?
A: Yes, reservations are available based on date, time, and party size.

Q: Can you host private events?
A: Yes, private events can be discussed based on guest count and availability.

Q: Can you accommodate dietary restrictions?
A: Guests should share dietary needs when booking so the team can confirm options.

Q: What information is needed for an event?
A: Date, time, guest count, event type, and food or beverage preferences are helpful.

Q: Can I request a specific table or room?
A: Requests can be noted, but seating or room availability must be confirmed by the team.`,
    serviceDescription: (serviceName) => `Service overview:
This service helps guests plan a private dinner, celebration, meeting, or small event with the right space, timing, and service setup.

Best fit:
This service is a good fit for birthdays, rehearsal dinners, business meals, family gatherings, and other planned group experiences.

What is included:
- Review of preferred date and time
- Guest count and event style discussion
- Food, beverage, and seating preference notes
- Availability check or follow-up with the events team
- Next-step guidance for confirming the reservation

What customers can expect:
Guests can expect a warm, organized planning process and clear follow-up about availability, options, and any requirements.

Recommended next step:
Ask for the date, time, guest count, event type, budget range if relevant, and any dietary or accessibility needs.`,
  },
  'Professional Services': {
    serviceName: 'Initial consultation',
    about: `Business overview:
We are a professional services firm that helps clients make organized, informed decisions with clear guidance and reliable follow-through.

Why customers come to us:
Clients often come to us when the stakes are meaningful and the details matter. They want judgment, structure, and the sense that their situation is being handled carefully and professionally.

How we should be represented:
Sound professional, composed, and precise. Clients may have sensitive or deadline-driven matters, so collect the right context and route them carefully.

What customers should understand:
- New clients usually start with an initial consultation.
- Routine scheduling details include the preferred time, general service requested, and preferred contact method.
- The team may need to review details before giving specific guidance.
- Deadline-driven matters should be flagged for priority follow-up.

Service style:
Communication should be clear, discreet, and careful with client information.

Boundaries:
Do not provide legal, financial, tax, or technical advice unless it has been approved by the appropriate professional on the team.`,
    policies: `We require an initial consultation before accepting new client work.
We do not provide advice before a formal engagement is approved.
We require conflict checks before scheduling certain consultations.
We require deadlines to be disclosed before booking.
We do not accept matters with deadlines inside 48 hours without partner approval.
We require signed engagement letters before work begins.
We require retainers for selected services.
We do not accept walk-in consultations.
We do not schedule consultations without collecting the client's legal name and contact information.
Document review, confidential matters, and identity-dependent requests are routed to an authorized team member.
We do not discuss client matters with third parties without written authorization.
We require billing questions to be routed to the office manager.
We do not guarantee outcomes.
We do not accept cash payments.
We require cancellation notice at least 24 hours before consultations.
We charge for missed consultations unless waived by the firm.
We do not accept work outside our licensed jurisdiction or service scope.
We require urgent matters to be marked for same-day review.
We do not provide free second opinions without approval.
We route sensitive, regulated, confidential, or identity-dependent requests to an authorized team member.`,
    faq: `Q: Do you offer consultations?
A: Yes, initial consultations can be scheduled to understand the client's needs.

Q: What should I prepare?
A: An authorized team member can explain the appropriate next steps and any approved document process.

Q: Can you give advice immediately?
A: The team may need to review the situation before giving specific guidance.

Q: How do I know if you can help?
A: A consultation is the best next step to determine fit and scope.

Q: Do you handle urgent matters?
A: Urgent matters should be flagged with the deadline, background, and best contact information so the team can review priority and fit.`,
    serviceDescription: (serviceName) => `Service overview:
This service helps new clients explain their situation, clarify their goals, and determine whether the firm is the right fit.

Best fit:
This service is a good fit when someone has a new matter, a deadline, a business question, or wants professional guidance before deciding next steps.

What is included:
- Overview of the client's situation
- Review of goals, timeline, and urgency
- Identification of relevant background details
- Discussion of possible next steps
- Follow-up recommendation based on fit and scope

What customers can expect:
Clients can expect a professional conversation focused on understanding the issue and routing them toward the right next step.

Recommended next step:
Ask what the client needs help with, whether there is a deadline, and the best contact information for follow-up.`,
  },
  Retail: {
    serviceName: 'Personal shopping appointment',
    about: `Business overview:
We are a local retail shop focused on thoughtful products, helpful recommendations, and a friendly in-store experience.

Why customers come to us:
Customers come to us because they want more than a transaction. They want help finding the right item, gift, or option without feeling overwhelmed or left to sort it out alone.

How we should be represented:
Sound warm, helpful, and practical. Customers may need help choosing between options, finding gifts, checking availability, or understanding store policies.

What customers should understand:
- We help with product questions, recommendations, gift ideas, store availability, pickup questions, and general shopping guidance.
- Good recommendation details include recipient, occasion, style, use case, budget, and timing.
- Holds, special orders, and returns depend on item availability and store policy.
- Accurate contact information is important for order or pickup follow-up.

Service style:
The experience should feel friendly, low-pressure, and easy to navigate.

Boundaries:
Do not guarantee inventory, holds, returns, or delivery timing until confirmed by the store.`,
    policies: `We hold unpaid items for a maximum of 24 hours.
We require payment before placing special orders.
We do not accept returns on final-sale items.
We do not accept returns without proof of purchase.
We allow exchanges within 14 days for eligible items.
We do not refund shipping fees.
We require manager approval for returns over $250.
We do not guarantee restock dates.
We require customer contact information for all holds and special orders.
We do not ship fragile items unless packaging is approved.
We do not offer local delivery outside the approved delivery area.
We require ID for order pickup above $500.
We do not accept personal checks.
We do not price-match online marketplaces.
We do not apply expired promotions.
We require gift-wrapping requests before checkout is completed.
We do not accept worn, washed, opened, or damaged items for return.
We do not reserve limited inventory during major sales.
We require wholesale inquiries to be routed to the owner or manager.
We do not provide product warranties beyond the manufacturer's stated warranty.`,
    faq: `Q: Can you check if an item is in stock?
A: Yes, customers can ask about availability and the team can confirm when possible.

Q: Do you offer gift recommendations?
A: Yes, recommendations can be made based on recipient, occasion, and budget.

Q: Can you hold an item?
A: Holds may be available depending on the item and store policy.

Q: What is your return policy?
A: Return eligibility depends on item condition, timing, and the store's policy.

Q: Can you order an item that is not currently in stock?
A: Special orders may be available depending on supplier availability, payment requirements, and store policy.`,
    serviceDescription: (serviceName) => `Service overview:
This service helps customers get tailored product recommendations for gifts, events, wardrobe needs, home items, or everyday purchases.

Best fit:
This service is a good fit when a customer wants help choosing between options, shopping for someone else, or finding items that match a style, need, or budget.

What is included:
- Review of customer preferences
- Product recommendations based on need and budget
- Help narrowing options
- Guidance on availability, pickup, or next steps
- Follow-up if an item needs to be ordered or held

What customers can expect:
Customers can expect friendly, practical help that makes shopping easier and more focused.

Recommended next step:
Ask what the customer is shopping for, who it is for, preferred style or use, budget, and timing.`,
  },
  'Other General Business': {
    serviceName: 'Initial consultation',
    about: `Business overview:
We are a local business focused on responsive service, clear communication, and helping customers get the right support quickly.

Why customers come to us:
Customers usually come to us because they need clarity, movement, or help figuring out what to do next. They want to feel understood quickly and guided toward the right outcome without unnecessary friction.

How we should be represented:
Sound helpful, organized, and straightforward. Customers should feel that their request is understood and that the next step is clear.

What customers should understand:
- We help customers clarify what they need, understand available options, and move toward the right follow-up.
- Important intake details include the request, timing, urgency, location if relevant, and best contact information.
- Pricing, availability, and scope may depend on the details.
- Urgent requests should be flagged for priority follow-up.

Service style:
Keep communication practical, friendly, and focused on helping the customer move forward.

Boundaries:
Do not promise exact pricing, timing, or outcomes before the request has been reviewed by the right person.`,
    policies: `We require the customer's name, contact information, and reason for the request before scheduling.
We do not provide final pricing without reviewing the scope of work.
We require deposits for projects above $1,000.
We do not begin work without customer approval.
We require at least 24 hours' notice for appointment cancellations.
We do not schedule appointments outside normal service hours without manager approval.
We do not accept work outside our normal service area without approval.
We require urgent requests to be flagged for same-day review.
We do not guarantee same-day availability.
We require written approval before changing the agreed scope.
We do not accept cash payments for deposits.
We require final payment when the service is complete.
We do not handle requests outside our stated service categories.
We require special access instructions before visiting customer locations.
We do not schedule work at unsafe locations.
We require customer-provided materials to be approved before use.
We do not offer refunds for completed work unless management approves.
We require warranty questions to be reviewed by the office.
We do not discuss account details with unauthorized third parties.
We require after-hours requests to be approved before dispatching staff.`,
    faq: `Q: How do I get started?
A: The best first step is to share what you need help with and the team can recommend the next step.

Q: Do I need an appointment?
A: Some requests require an appointment, depending on the service and availability.

Q: Can you give pricing over the phone?
A: General pricing may be available, but final pricing can depend on the details.

Q: How quickly can someone follow up?
A: Follow-up timing depends on availability and urgency.

Q: What information should I provide?
A: The customer should share the request, timing, location if relevant, urgency, and best contact information.`,
    serviceDescription: (serviceName) => `Service overview:
This service helps customers who need support, guidance, or a specific outcome related to this offering.

Best fit:
This service is a good fit when the customer's request matches the service scope and they need help deciding or taking the next step.

What is included:
- Review of the customer's request
- Clarification of needs, timing, and expectations
- Explanation of available options
- Recommendation for the right next step
- Scheduling or follow-up when appropriate

What customers can expect:
Customers can expect clear communication, practical guidance, and help moving forward without confusion.

Recommended next step:
Ask what the customer needs, when they need it, and the best way to follow up. If it is a fit, help them schedule or connect with the right person.`,
  },
  ...additionalIndustryExamples,
};

export const businessBriefSectionDefinitions = [
  { id: 'story', label: 'Story' },
  { id: 'identity', label: 'Identity' },
  { id: 'whatWeDo', label: 'What We Do' },
  { id: 'whoWeServe', label: 'Who We Serve' },
  { id: 'serviceArea', label: 'Service Area' },
  { id: 'operations', label: 'Operations' },
  { id: 'credentials', label: 'Licenses & Credentials' },
  { id: 'additionalContext', label: 'Extra Context' },
];

export const businessBriefIndustryContext = {
  'Home Services': {
    story: '[founder\'s name] opened the company in [year] after several years working in roofing, exterior repair, and residential property maintenance. Many of the company\'s earliest calls came from homeowners dealing with leaks, storm damage, aging shingles, and gutter issues, but a steady number of those customers continued calling back for larger repairs, replacement projects, and ongoing property needs. That repeat work gradually changed the company from a small repair-focused operation into a broader roofing and exterior services business.\n\nThe company grew around that original customer base, gradually adding field crews, office support, service vehicles, and relationships with suppliers, property managers, builders, and local homeowners. Because much of the work came through referrals and repeat property owners, the business developed around practical follow-through rather than one-time jobs. As the company became more established locally, it also became familiar with the roof types, older homes, seasonal weather patterns, and common property issues found throughout the area.\n\nToday, the company serves a wider mix of homeowners, landlords, commercial property owners, and property managers, but its beginnings are still part of how it operates. Repair calls and storm-related work remain part of the business, while much of its day-to-day work now includes planned replacements, inspections, estimates, and larger roofing projects. Its local presence has grown alongside that work, making the company a familiar contractor for both urgent roof problems and long-term property upkeep.',
    identity: '**Legal business name:** [Legal business name]\n**Doing business as:** [DBA / Trade name, if applicable]\n**Founded:** [Year]\n**Founder:** [Founder\'s name]\n**Ownership:** [Independent / Family-owned / Partnership / Other]\n**Primary location:** [City, State]\n**Primary market:** [Residential / Commercial / Both]',
    whatWeDo: 'The company specializes in residential and commercial roofing, working on both existing properties and new construction. Its work ranges from addressing individual roofing problems to managing larger roofing projects from initial evaluation through completion.\n\nProjects vary in size, property type, and complexity, with the appropriate approach determined by the condition of the property, the work involved, and the customer\'s goals.',
    whoWeServe: 'The company commonly works with:\n\n- Homeowners\n- Landlords and rental property owners\n- Commercial property owners\n- Property managers\n- Real estate professionals\n- Builders and contractors\n- Businesses and organizations',
    serviceArea: 'The company primarily serves [primary city/region] and surrounding communities. Its normal operating territory includes [counties, cities, radius, or broader territory].\n\nProjects outside the normal service area may be considered depending on the location and scope of the project.',
    properties: 'The company commonly works on:\n\n- Single-family homes\n- Multi-family properties\n- Apartment buildings\n- Commercial buildings\n- Retail properties\n- Office buildings\n- Garages and outbuildings\n- New construction\n- Other residential and light-commercial structures',
    howWeWork: 'The company takes a practical, straightforward approach to roofing. Rather than assuming every property needs the same solution, it first works to understand the property, why the customer is reaching out, and what actually needs attention.\n\nDepending on the situation, this may involve gathering information about the property, evaluating the roof or affected area, documenting relevant conditions, and discussing the customer\'s goals. From there, the company determines an appropriate path forward based on the findings and scope of the work.\n\nClear communication is an important part of the process. Customers are kept informed about what has been identified, what the project is expected to involve, and what the next steps are.',
    operations: 'The company operates as [brief description of the operation, e.g. a locally operated roofing contractor serving residential and commercial properties throughout the region].\n\n**Field operations:** [In-house crews / Subcontractors / Combination]\n**Primary office:** [Location]\n**Operating territory:** [Local / Regional / Multi-state / Other]\n**Seasonal operations:** [Year-round / Seasonal / Details]',
    credentials: 'The company maintains the licenses, registrations, and professional credentials applicable to the work it performs.\n\n- **[License type]:** [License number] — [State / Jurisdiction]\n- **[License type]:** [License number] — [State / Jurisdiction]\n- **[License type]:** [License number] — [State / Jurisdiction]\n\n**Contractor registrations:** [Registrations, if applicable]\n**Manufacturer certifications:** [Certifications, if applicable]\n**Professional certifications:** [Certifications, if applicable]\n**Industry affiliations:** [Associations or organizations, if applicable]',
    additionalContext: '**Insured:** [Yes / No / Details]\n**Bonded:** [Yes / No / Not applicable]\n**Emergency handling:** [How urgent leaks, storm damage, or safety concerns should be prioritized]\n**Property access notes:** [Gate codes, tenant coordination, roof access, pets, or parking details to collect]\n**Materials or work limitations:** [Roof types, product lines, project sizes, or work the company does not handle]\n**Preferred customer details:** [Photos, property type, approximate roof age, issue location, or recent weather event]',
  },
  'Real Estate': {
    story: '[founder\'s name] opened the company in [year] after several years working with buyers, sellers, and local property owners. Many of the company\'s earliest clients came through open houses, buyer referrals, neighborhood listings, and relationships with people already active in the local market. A surprising number of those early clients returned later for another purchase, a sale, an investment property, or a referral to someone else, which gradually shifted the company from transaction-by-transaction work into a more established real estate practice.\n\nThe company grew around that original client base, gradually expanding its understanding of neighborhoods, price ranges, school districts, inspection patterns, and the differences between nearby communities. Because many clients came through referrals or repeat relationships, the business developed around long-term market familiarity rather than one-off lead volume. As the company became more established locally, it also built connections through brokerage affiliations, referral partners, community sponsorships, landlord relationships, builders, and other professionals involved in property decisions.\n\nToday, the company serves a broader mix of buyers, sellers, investors, relocating families, and property owners, but its beginnings are still part of how it operates. First-time guidance, seller preparation, neighborhood knowledge, and practical transaction support remain central to the business. Its local involvement has continued alongside that growth, making the company not only a real estate resource, but also a familiar presence in the market it serves.',
    identity: '**Legal business name:** [Legal business name]\n**Doing business as:** [DBA / Trade name, if applicable]\n**Founded:** [Year]\n**Founder:** [Founder\'s name]\n**Ownership:** [Independent / Partnership / Brokerage / Other]\n**Primary location:** [City, State]\n**Primary market:** [Residential / Commercial / Both]',
    whatWeDo: 'The company provides real estate guidance for people making decisions about buying, selling, investing in, or managing property. Its work may include helping clients understand the market, evaluate opportunities, prepare for a transaction, and move from an initial question to a well-supported decision.\n\nThe right approach depends on the property, the client\'s goals, the timing, and the complexity of the transaction.',
    whoWeServe: 'The company commonly works with:\n\n- Home buyers\n- Home sellers\n- Relocating families\n- Property investors\n- Landlords and property owners\n- Commercial property clients\n- Builders and developers\n- Real estate professionals',
    serviceArea: 'The company primarily serves [primary city/region] and surrounding communities. Its normal operating territory includes [counties, cities, radius, or broader territory].\n\nClients or properties outside the normal market may be considered depending on the location and scope of the need.',
    properties: 'The company commonly works with:\n\n- Single-family homes\n- Condominiums\n- Multi-family properties\n- Rental properties\n- Land and development sites\n- Commercial buildings\n- Investment properties\n- New construction\n- Other residential and commercial property types',
    howWeWork: 'The company takes a thoughtful, practical approach to real estate. It first works to understand the client\'s goals, timing, financial considerations, and the property or opportunity involved.\n\nThe team gathers the relevant details, explains what matters, identifies options, and helps the client understand the next decision. Communication stays clear and organized throughout the process so clients know what is happening and what is expected next.',
    operations: 'The company operates as [brief description of the operation, e.g. an independent real estate practice serving buyers, sellers, and property owners throughout the region].\n\n**Team structure:** [Solo agent / Team / Brokerage / Other]\n**Primary office:** [Location]\n**Operating territory:** [Local / Regional / Multi-state / Other]\n**Market focus:** [Residential / Commercial / Both]',
    credentials: 'The company maintains the licenses, registrations, and professional credentials applicable to its real estate work.\n\n- **[License type]:** [License number] — [State / Jurisdiction]\n- **[License type]:** [License number] — [State / Jurisdiction]\n\n**Brokerage affiliation:** [Brokerage, if applicable]\n**Professional certifications:** [Certifications, if applicable]\n**Industry affiliations:** [Associations or organizations, if applicable]',
    additionalContext: '**Languages supported:** [Languages]\n**Brokerage affiliation:** [Brokerage, if applicable]\n**Client confidentiality notes:** [Details the receptionist should avoid sharing or should route carefully]\n**Transaction specialties:** [First-time buyers, listings, relocation, investment properties, commercial, or other focus areas]\n**Urgent transaction triggers:** [Offers, showings, inspections, financing deadlines, or closing issues that need priority follow-up]',
  },
  ...additionalBusinessBriefContexts,
};

export const sharedBusinessBriefContext = {
  'Beauty & Wellness': {
    story: '[founder\'s name] opened the company in [year] after several years working independently in the beauty and wellness industry. Many of the company\'s earliest clients came through weddings, special events, referrals, and focused appointment work, but a surprising number continued coming back long after the original occasion or first visit was over. That repeat business eventually changed the direction of the company from primarily one-time or event-based work into a permanent beauty and wellness practice.\n\nThe company grew around that original client base, gradually adding providers, treatment rooms, product knowledge, and a broader range of appointments. Because many clients had been with the business since its earlier days, the studio developed around repeat relationships rather than a high-volume, walk-in approach. As the business became more established locally, it also began building community ties through neighborhood clients, local events, wellness partnerships, fundraisers, bridal work, and occasional support for charitable causes.\n\nToday, the company serves a much broader clientele, but its beginnings are still part of how it operates. Special occasions remain part of the business, while most of its day-to-day work now comes from regular appointments, recurring services, and returning clients. Its local involvement has continued alongside that growth, making the company not only a place people visit for appointments, but also a familiar part of the community.',
    identity: '**Legal business name:** [Legal business name]\n**Doing business as:** [DBA / Trade name, if applicable]\n**Founded:** [Year]\n**Founder:** [Founder\'s name]\n**Ownership:** [Independent / Partnership / Other]\n**Primary location:** [City, State]\n**Primary market:** [In-studio / Mobile / Both]',
    whatWeDo: 'The company provides personalized beauty, wellness, and self-care experiences that help clients feel cared for, confident, and comfortable. Its work is shaped around the client\'s goals, preferences, history, and the appropriate level of care for the appointment.\n\nThe experience may be ongoing or occasional, with recommendations guided by the client\'s needs rather than a one-size-fits-all approach.',
    whoWeServe: 'The company commonly works with:\n\n- New clients\n- Returning clients\n- Individuals preparing for an event\n- Clients seeking ongoing care\n- Clients with specific beauty or wellness goals\n- People looking for a calm, personalized experience',
    serviceArea: 'The company primarily serves [primary city/region] and surrounding communities. Its normal operating territory includes [neighborhoods, cities, radius, or broader territory].\n\nRequests outside the normal service area may be considered depending on the format and availability.',
    properties: 'The company commonly works in:\n\n- The primary studio or office\n- Private treatment rooms\n- Wellness spaces\n- Client homes, if mobile care is offered\n- Event or venue settings, if applicable\n- Other approved appointment environments',
    howWeWork: 'The company takes a personalized, consultative approach. It first learns what the client is hoping to accomplish, what they have tried before, and any preferences or considerations that should shape the experience.\n\nThe team then recommends an appropriate path, explains what the appointment involves, and keeps the experience comfortable and organized from start to finish. Consistency, cleanliness, and respectful care are central to how the company operates.',
    operations: 'The company operates as [brief description of the operation, e.g. a locally operated studio providing personalized beauty and wellness care by appointment].\n\n**Care team:** [Solo provider / In-house team / Combination]\n**Primary location:** [Location]\n**Operating territory:** [Studio-based / Mobile / Regional / Other]\n**Appointment model:** [By appointment / Walk-in / Combination]',
    credentials: 'The company maintains the licenses, registrations, and professional credentials applicable to the care it provides.\n\n- **[License type]:** [License number] — [State / Jurisdiction]\n- **[License type]:** [License number] — [State / Jurisdiction]\n\n**Professional certifications:** [Certifications, if applicable]\n**Product or manufacturer certifications:** [Certifications, if applicable]\n**Industry affiliations:** [Associations or organizations, if applicable]',
    additionalContext: '**Insured:** [Yes / No / Details]\n**Languages supported:** [Languages]\n**Sensitive-request handling:** [Authorized team member or handoff process for health, medical, or other sensitive concerns]\n**Service limitations:** [Treatments, conditions, products, or appointment types the company does not support]\n**Routine scheduling details:** [Event date, provider preference, or other non-sensitive booking details]',
  },
  'Automotive': {
    story: '[founder\'s name] opened the company in [year] after several years working hands-on with vehicle maintenance, diagnostics, and repair. Many of the shop\'s earliest customers came in for routine work like oil changes, brakes, inspections, tires, and warning lights, but a steady number continued returning whenever another vehicle issue came up. That repeat business gradually changed the company from a small repair option into a regular automotive shop for local drivers and families.\n\nThe company grew around that original customer base, gradually adding service bays, technicians, repair equipment, parts relationships, and capacity for more complex diagnostic work. Because many customers returned with the same vehicles over time, the shop developed around maintenance history, practical repair planning, and long-term familiarity with customer vehicles rather than isolated one-time visits. As the business became more established locally, it also built ties with nearby employers, small businesses, fleet operators, used-car buyers, and families with multiple vehicles.\n\nToday, the company serves a broader mix of individual drivers, commuters, families, businesses, and fleet accounts, but its beginnings are still part of how it operates. Routine maintenance remains part of the business, while much of its day-to-day work now includes diagnostics, repairs, safety concerns, estimates, and ongoing vehicle care. Its local relationships have continued alongside that growth, making the shop not only a place people visit when something breaks, but also a familiar part of how customers keep their vehicles dependable.',
    identity: '**Legal business name:** [Legal business name]\n**Doing business as:** [DBA / Trade name, if applicable]\n**Founded:** [Year]\n**Founder:** [Founder\'s name]\n**Ownership:** [Independent / Family-owned / Partnership / Other]\n**Primary location:** [City, State]\n**Primary market:** [Consumer / Fleet / Both]',
    whatWeDo: 'The company helps vehicle owners maintain, understand, and repair their cars, trucks, and other vehicles. Its work ranges from routine care to diagnosing concerns and addressing problems that affect safety, reliability, or day-to-day use.\n\nThe appropriate path depends on the vehicle, the symptoms, the findings, and the customer\'s goals and timing.',
    whoWeServe: 'The company commonly works with:\n\n- Individual vehicle owners\n- Families with multiple vehicles\n- Commuters\n- Fleet owners and operators\n- Businesses with work vehicles\n- Used-vehicle buyers\n- Drivers preparing for a trip or inspection',
    serviceArea: 'The company primarily serves [primary city/region] and surrounding communities. Its normal operating territory includes [cities, radius, or broader territory].\n\nVehicle or mobile requests outside the normal service area may be considered depending on the location and scope.',
    properties: 'The company commonly works on:\n\n- Passenger cars\n- Pickup trucks\n- SUVs and vans\n- Fleet vehicles\n- Hybrid or electric vehicles, if supported\n- Light commercial vehicles\n- Other vehicle types within the company\'s capabilities',
    howWeWork: 'The company takes a diagnostic, straightforward approach. It first gathers the driver\'s description of the concern, the vehicle\'s history, and any timing or safety considerations.\n\nThe team evaluates the vehicle, explains what was found, outlines the appropriate options, and communicates what should happen next. Customers should leave with a clearer understanding of the work and why it is recommended.',
    operations: 'The company operates as [brief description of the operation, e.g. a locally operated automotive shop serving personal and commercial vehicles throughout the region].\n\n**Technicians:** [In-house / Subcontractors / Combination]\n**Primary shop:** [Location]\n**Operating territory:** [Local / Regional / Mobile / Other]\n**Vehicle focus:** [Passenger / Commercial / Both]',
    credentials: 'The company maintains the licenses, registrations, and professional credentials applicable to the automotive work it performs.\n\n- **[License or registration]:** [Number] — [State / Jurisdiction]\n- **[Certification]:** [Number] — [Issuing organization]\n\n**Manufacturer certifications:** [Certifications, if applicable]\n**Professional certifications:** [Certifications, if applicable]\n**Industry affiliations:** [Associations or organizations, if applicable]',
    additionalContext: '**Insured:** [Yes / No / Details]\n**Languages supported:** [Languages]\n**Vehicle limitations:** [Makes, models, systems, vehicle sizes, or work not supported]\n**Priority safety concerns:** [Brake, steering, tire, overheating, no-start, warning light, or drivability issues]\n**Preferred vehicle details:** [Year, make, model, mileage, symptoms, warning lights, and when the issue started]',
  },
  'Hospitality': {
    story: '[founder\'s name] opened the company in [year] after several years working in hospitality, food service, lodging, events, or venue operations. Many of the company\'s earliest guests came through dinner service, private events, lodging stays, catering, weddings, group dining, or seasonal visitors, but a meaningful number returned for later occasions, repeat visits, and referrals. That repeat guest activity gradually changed the company from a focused hospitality offering into a more established local destination.\n\nThe company grew around that original guest base, gradually adding staff, guest spaces, event capacity, kitchen or lodging systems, reservation processes, and relationships with planners, vendors, tourism partners, farms, breweries, and local organizations. Because many guests first discovered the business through a specific occasion and later returned for different reasons, the operation developed around both everyday hospitality and special-event coordination. As the business became more established locally, it also became connected to festivals, charities, business associations, venues, and community events.\n\nToday, the company serves a broader mix of local guests, travelers, families, corporate groups, event hosts, and private parties, but its beginnings are still part of how it operates. Special occasions remain part of the business, while regular reservations, seasonal service, group inquiries, and repeat guests now shape much of its day-to-day work. Its local involvement has continued alongside that growth, making the company not only a place people visit, but also a familiar part of the area\'s hospitality community.',
    identity: '**Legal business name:** [Legal business name]\n**Doing business as:** [DBA / Trade name, if applicable]\n**Founded:** [Year]\n**Founder:** [Founder\'s name]\n**Ownership:** [Independent / Family-owned / Partnership / Other]\n**Primary location:** [City, State]\n**Primary market:** [Dining / Lodging / Events / Combination]',
    whatWeDo: 'The company creates hospitality experiences for guests, whether they are visiting for a meal, an overnight stay, a private gathering, or a special occasion. Its work combines a welcoming environment with the planning, coordination, and attention needed to make the guest experience feel easy and cared for.\n\nThe right approach depends on the type of visit, the size of the group, the occasion, and what the guest needs from the company.',
    whoWeServe: 'The company commonly works with:\n\n- Individual guests\n- Families and groups\n- Local residents\n- Travelers and visitors\n- Corporate or organizational groups\n- Guests planning celebrations\n- Event hosts and private party organizers',
    serviceArea: 'The company primarily serves [primary city/region] and surrounding communities. Its normal operating territory includes [neighborhoods, cities, radius, or broader territory].\n\nGuests or events outside the normal area may be considered depending on the format, timing, and scope.',
    properties: 'The company commonly operates in or hosts guests at:\n\n- Restaurants or dining rooms\n- Guest rooms or lodging spaces\n- Private event rooms\n- Outdoor or seasonal spaces\n- Wedding or celebration venues\n- Corporate or group event settings\n- Other approved hospitality environments',
    howWeWork: 'The company takes an attentive, organized approach to hospitality. It first understands the guest\'s purpose, timing, group size, preferences, and any details that could shape the experience.\n\nThe team then explains the available options, confirms the important details, and coordinates the next step clearly. Warmth and responsiveness matter, but so do accuracy, preparation, and following through on what was promised.',
    operations: 'The company operates as [brief description of the operation, e.g. a locally operated hospitality business welcoming guests for dining, lodging, and private gatherings].\n\n**Team structure:** [In-house team / Seasonal team / Combination]\n**Primary location:** [Location]\n**Operating territory:** [Single location / Multi-location / Regional / Other]\n**Guest model:** [Reservations / Walk-ins / Events / Combination]',
    credentials: 'The company maintains the licenses, registrations, and professional credentials applicable to the hospitality operation.\n\n- **[License or permit]:** [Number] - [State / Jurisdiction]\n- **[License or permit]:** [Number] - [State / Jurisdiction]\n\n**Food service permits:** [Permits, if applicable]\n**Alcohol license:** [License details, if applicable]\n**Event or lodging registrations:** [Registrations, if applicable]\n**Industry affiliations:** [Associations or organizations, if applicable]',
    additionalContext: '**Languages supported:** [Languages]\n**Accessibility details:** [Parking, entrances, seating, mobility access, restrooms, or lodging access notes]\n**Guest considerations:** [Dietary restrictions, allergies, celebration details, room preferences, or special accommodations]\n**Event intake details:** [Date, time, guest count, event type, budget, food preferences, and setup needs]\n**Availability limitations:** [Private rooms, catering, lodging, group size, seasonal service, or blackout dates]',
  },
  'Professional Services': {
    story: '[founder\'s name] opened the company in [year] after several years working independently or inside a larger professional environment. Many of the company\'s earliest clients came through referrals, prior professional relationships, local businesses, industry contacts, and community organizations, but a surprising number continued relying on the company after the first matter or project was complete. That repeat work gradually changed the company from a small practice handling individual engagements into a more established professional services firm.\n\nThe company grew around that original client base, gradually adding team members, office or remote capacity, partner relationships, systems for intake, and a more defined set of service categories. Because many clients stayed with the business over time, the practice developed around long-term relationships, confidentiality, technical knowledge, and familiarity with each client\'s broader situation rather than isolated one-time requests. As the company became more established locally, it also built presence through professional associations, chamber involvement, nonprofit boards, referral partners, speaking events, and local business networks.\n\nToday, the company serves a broader mix of individuals, families, small businesses, organizations, founders, and professional clients, but its beginnings are still part of how it operates. Project-based work remains part of the business, while much of its day-to-day work now comes from ongoing engagements, recurring clients, advisory needs, and referrals. Its local and professional involvement has continued alongside that growth, making the company not only a provider of specialized services, but also a known resource within its business community.',
    identity: '**Legal business name:** [Legal business name]\n**Doing business as:** [DBA / Trade name, if applicable]\n**Founded:** [Year]\n**Founder:** [Founder\'s name]\n**Ownership:** [Independent / Partnership / Firm / Other]\n**Primary location:** [City, State]\n**Primary market:** [Individual / Business / Both]',
    whatWeDo: 'The company provides specialized guidance, expertise, or support that helps clients make informed decisions and accomplish important goals. Its work may involve understanding a situation, analyzing the relevant details, developing a path forward, and supporting the client through implementation or ongoing needs.\n\nThe approach depends on the client\'s circumstances, the complexity of the matter, the required expertise, and the desired outcome.',
    whoWeServe: 'The company commonly works with:\n\n- Individuals and families\n- Small businesses\n- Larger organizations\n- Founders and leadership teams\n- Professionals and decision-makers\n- Referral partners\n- Clients with ongoing or project-based needs',
    serviceArea: 'The company primarily serves [primary city/region] and surrounding communities. Its normal operating territory includes [counties, cities, radius, or broader territory].\n\nRemote or out-of-area engagements may be considered depending on the work, jurisdiction, and scope.',
    properties: 'The company commonly works with:\n\n- Individuals and households\n- Small and mid-sized businesses\n- Corporate departments\n- Nonprofit or community organizations\n- Professional practices\n- Remote or distributed teams\n- Other client environments relevant to the company\'s work',
    howWeWork: 'The company takes a thoughtful, structured approach to professional work. It first understands the client\'s goals, situation, constraints, and definition of a useful outcome.\n\nThe team organizes the relevant information, explains the available path, and sets expectations about scope, timing, and next steps. Clients should understand both the recommendation and the reasoning behind it, with communication that remains clear throughout the engagement.',
    operations: 'The company operates as [brief description of the operation, e.g. an independent professional practice serving individuals and businesses through project-based and ongoing engagements].\n\n**Team structure:** [Solo practitioner / In-house team / Partner network / Combination]\n**Primary office:** [Location]\n**Operating territory:** [Local / Regional / National / Other]\n**Engagement model:** [Consultation / Project-based / Retainer / Combination]',
    credentials: 'The company maintains the licenses, registrations, and professional credentials applicable to the work it performs.\n\n- **[License or registration]:** [Number] - [State / Jurisdiction]\n- **[Certification]:** [Number] - [Issuing organization]\n\n**Professional certifications:** [Certifications, if applicable]\n**Regulatory registrations:** [Registrations, if applicable]\n**Industry affiliations:** [Associations or organizations, if applicable]',
    additionalContext: '**Languages supported:** [Languages]\n**Restricted-request handling:** [Sensitive, regulated, confidential, or identity-dependent requests to route to an authorized team member]\n**Routine scheduling details:** [General service category, preferred time, deadline, or preferred contact method]\n**Service limitations:** [Work types, jurisdictions, client types, or situations the company does not handle]\n**Referral relationships:** [Trusted partners or professionals for needs outside the company scope]',
  },
  'Retail': {
    story: '[founder\'s name] opened the company in [year] after starting with a focused product idea, storefront, online shop, market presence, family retail background, or gap in the local shopping market. Many of the company\'s earliest customers came through neighborhood shopping, pop-up markets, online orders, tourists, gift buyers, or wholesale relationships, but a surprising number continued returning for new products, repeat purchases, recommendations, and seasonal needs. That repeat business gradually changed the company from a small retail concept into a more established shop.\n\nThe company grew around that original customer base, gradually adding staff, inventory systems, product categories, fulfillment processes, supplier relationships, and a clearer sense of what customers returned for. Because many shoppers came back repeatedly, the business developed around product familiarity, local taste, recurring gift needs, and customer questions rather than simple transactions. As the company became more established locally, it also built ties through markets, events, downtown associations, schools, charities, makers, artists, suppliers, and business groups.\n\nToday, the company serves a broader mix of local shoppers, online customers, gift buyers, wholesale buyers, tourists, and returning customers, but its beginnings are still part of how it operates. The original product focus remains part of the business, while much of its day-to-day work now includes new inventory, fulfillment, product guidance, pickup, delivery, shipping, and repeat customer needs. Its local involvement has continued alongside that growth, making the company not only a place people shop, but also a familiar part of the community.',
    identity: '**Legal business name:** [Legal business name]\n**Doing business as:** [DBA / Trade name, if applicable]\n**Founded:** [Year]\n**Founder:** [Founder\'s name]\n**Ownership:** [Independent / Family-owned / Partnership / Other]\n**Primary location:** [City, State]\n**Primary market:** [Consumer / Business / Both]',
    whatWeDo: 'The company curates and sells products that help customers meet everyday needs, find a meaningful gift, or choose something that fits their preferences and budget. Its role is more than making products available; it helps customers compare options, understand what is different, and make a decision they feel good about.\n\nThe best recommendation depends on the customer\'s intended use, priorities, timing, and the products currently available.',
    whoWeServe: 'The company commonly works with:\n\n- Local shoppers\n- Gift buyers\n- Returning customers\n- Customers looking for specific products\n- Families and households\n- Small business or wholesale buyers\n- Customers seeking product guidance',
    serviceArea: 'The company primarily serves [primary city/region] and surrounding communities. Its normal operating territory includes [neighborhoods, cities, shipping area, or broader territory].\n\nOrders or customers outside the normal area may be supported depending on delivery, shipping, and product availability.',
    properties: 'The company commonly operates through:\n\n- A retail storefront\n- A showroom or studio\n- Pop-up or market locations\n- An online store\n- Local delivery or pickup locations\n- Wholesale or partner settings\n- Other approved sales environments',
    howWeWork: 'The company takes a helpful, product-aware approach to retail. It first understands what the customer is looking for, how the product will be used, the customer\'s preferences, and any timing or budget considerations.\n\nThe team explains relevant options without pressure, confirms availability and fulfillment details, and helps the customer take the right next step. A good experience is clear, welcoming, and useful even when the customer is still deciding.',
    operations: 'The company operates as [brief description of the operation, e.g. an independent retail business serving local shoppers through a storefront and online sales].\n\n**Sales channels:** [Storefront / Online / Wholesale / Combination]\n**Primary location:** [Location]\n**Operating territory:** [Local / Regional / National / Other]\n**Fulfillment model:** [Pickup / Delivery / Shipping / Combination]',
    credentials: 'The company maintains the registrations, permits, and professional credentials applicable to the products and sales channels it operates.\n\n- **[License or registration]:** [Number] - [State / Jurisdiction]\n- **[Certification]:** [Number] - [Issuing organization]\n\n**Product certifications:** [Certifications, if applicable]\n**Resale or specialty permits:** [Permits, if applicable]\n**Industry affiliations:** [Associations or organizations, if applicable]',
    additionalContext: '**Languages supported:** [Languages]\n**Product limitations:** [Products, brands, categories, sizes, or custom requests not carried]\n**Fulfillment options:** [In-store pickup, delivery, shipping, local drop-off, gift wrapping, or special orders]\n**Customer preference details:** [Budget, recipient, occasion, style, sizing, use case, or pickup deadline]\n**Return or exchange notes:** [Final sale items, receipt requirements, warranty handling, or approval rules]',
  },
  'Other General Business': {
    story: '[founder\'s name] opened the company in [year] after industry experience, family business history, purchase of an existing company, a side business becoming full-time, or visible demand in the local market. Many of the company\'s earliest customers came through referrals, neighborhood awareness, local businesses, online orders, community groups, or prior professional relationships, but a meaningful number continued returning as their needs changed. That repeat business gradually changed the company from a narrow early offering into a more established local operation.\n\nThe company grew around that original customer base, gradually adding team members, locations, vehicles, facilities, online presence, service capacity, or a broader set of products and services. Because many customers came back over time, the business developed around familiarity with recurring needs rather than isolated one-time requests. As the company became more established locally, it also built presence through community events, partnerships, sponsorships, notable projects, recurring customers, local organizations, or industry groups.\n\nToday, the company serves a broader mix of customers than it did at the beginning, but its origins are still part of how it operates. The original products or services remain part of the business, while much of its day-to-day work now comes from repeat customers, referrals, expanded offerings, and ongoing community visibility. Its local involvement has continued alongside that growth, making the company not only a provider of products or services, but also a familiar part of the market it serves.',
    identity: '**Legal business name:** [Legal business name]\n**Doing business as:** [DBA / Trade name, if applicable]\n**Founded:** [Year]\n**Founder:** [Founder\'s name]\n**Ownership:** [Independent / Family-owned / Partnership / Other]\n**Primary location:** [City, State]\n**Primary market:** [Consumer / Business / Both]',
    whatWeDo: 'The company provides [broad description of what the company does] for customers who need [general need, outcome, or type of support]. Its work may involve guidance, coordination, products, projects, or ongoing support depending on the customer\'s situation.\n\nThe right approach is shaped by the customer\'s goals, timing, circumstances, and the scope of the request.',
    whoWeServe: 'The company commonly works with:\n\n- [Primary customer group]\n- [Secondary customer group]\n- [Business or organizational customer group]\n- [Referral or professional partner group]\n- [Other important customer group]',
    serviceArea: 'The company primarily serves [primary city/region] and surrounding communities. Its normal operating territory includes [counties, cities, radius, or broader territory].\n\nRequests outside the normal service area may be considered depending on the location, format, and scope.',
    properties: 'The company commonly works in or with:\n\n- [Primary customer, property, or operating environment]\n- [Secondary customer, property, or operating environment]\n- [Commercial or professional environment]\n- [Remote, mobile, or online environment]\n- [Other important environment]',
    howWeWork: 'The company takes a practical, thoughtful approach. It first works to understand the customer\'s situation, what they are trying to accomplish, and what details should shape the next step.\n\nFrom there, the company explains the available path, sets clear expectations, and follows through in a way that keeps the customer informed and confident. The experience should reflect what this company does especially well: [specific approach, strength, or point of difference].',
    operations: 'The company operates as [brief description of the operation and the market it serves].\n\n**Team structure:** [Solo / In-house team / Subcontractors / Combination]\n**Primary location:** [Location]\n**Operating territory:** [Local / Regional / Multi-state / Other]\n**Operating model:** [By appointment / Walk-in / Project-based / Online / Other]',
    credentials: 'The company maintains the licenses, registrations, and professional credentials applicable to the work it performs.\n\n- **[License or registration]:** [Number] - [State / Jurisdiction]\n- **[Certification]:** [Number] - [Issuing organization]\n\n**Professional certifications:** [Certifications, if applicable]\n**Industry affiliations:** [Associations or organizations, if applicable]',
    additionalContext: '**Insured:** [Yes / No / Details]\n**Languages supported:** [Languages]\n**Customer intake priorities:** [Need, deadline, location, budget, account status, or preferred contact method]\n**Service limitations:** [Work, products, locations, customer types, or situations the company does not support]\n**Priority request triggers:** [Emergencies, deadlines, high-value accounts, safety issues, or time-sensitive needs]',
  },
};

export const fallbackBusinessBriefContext = {
  story: '[founder\'s name] opened the company in [year] after industry experience, family business history, purchase of an existing company, independent work, or visible demand in the local market. Many of the company\'s earliest customers came through referrals, neighborhood awareness, local businesses, online orders, community groups, or prior professional relationships, but a meaningful number continued returning as their needs changed. That repeat business gradually changed the company from a narrow early offering into a more established local operation.\n\nThe company grew around that original customer base, gradually adding team members, locations, vehicles, facilities, online presence, service capacity, or a broader set of products and services. Because many customers came back over time, the business developed around familiarity with recurring needs rather than isolated one-time requests. As the company became more established locally, it also built presence through community events, partnerships, sponsorships, notable projects, recurring customers, local organizations, or industry groups.\n\nToday, the company serves a broader mix of customers than it did at the beginning, but its origins are still part of how it operates. The original products or services remain part of the business, while much of its day-to-day work now comes from repeat customers, referrals, expanded offerings, and ongoing community visibility. Its local involvement has continued alongside that growth, making the company not only a provider of products or services, but also a familiar part of the market it serves.',
  identity: '**Legal business name:** [Legal business name]\n**Doing business as:** [DBA / Trade name, if applicable]\n**Founded:** [Year]\n**Founder:** [Founder\'s name]\n**Ownership:** [Independent / Family-owned / Partnership / Other]\n**Primary location:** [City, State]\n**Primary market:** [Customer or market type]',
  whatWeDo: 'The company provides [broad description of what the company does]. It helps customers make progress on [general customer need or outcome] through a process shaped around the details of each request.\n\nThe right approach depends on the customer\'s goals, timing, circumstances, and the scope of the work involved.',
  whoWeServe: 'The company commonly works with:\n\n- [Primary customer group]\n- [Secondary customer group]\n- [Professional or commercial customer group]\n- [Other important customer group]',
  serviceArea: 'The company primarily serves [primary city/region] and surrounding communities. Its normal operating territory includes [counties, cities, radius, or broader territory].\n\nRequests outside the normal service area may be considered depending on the location and scope.',
  howWeWork: 'The company takes a practical, thoughtful approach. It first works to understand the customer\'s situation, what they are trying to accomplish, and what details should shape the next step.\n\nFrom there, the company explains the available path, sets clear expectations, and follows through in a way that keeps the customer informed and confident.',
  operations: 'The company operates as [brief description of the operation and the market it serves].\n\n**Team structure:** [Solo / In-house team / Subcontractors / Combination]\n**Primary location:** [Location]\n**Operating territory:** [Local / Regional / Multi-state / Other]\n**Operating model:** [By appointment / Walk-in / Project-based / Other]',
  credentials: 'The company maintains the licenses, registrations, and professional credentials applicable to the work it performs.\n\n- **[License or registration]:** [Number] — [State / Jurisdiction]\n- **[Certification]:** [Number] — [Issuing organization]\n\n**Professional certifications:** [Certifications, if applicable]\n**Industry affiliations:** [Associations or organizations, if applicable]',
  additionalContext: '**Insured:** [Yes / No / Details]\n**Languages supported:** [Languages]\n**Customer intake priorities:** [Need, deadline, location, budget, account status, or preferred contact method]\n**Service limitations:** [Work, products, locations, customer types, or situations the company does not support]\n**Priority request triggers:** [Emergencies, deadlines, safety issues, account concerns, or time-sensitive needs]',
};

export const getIndustryExample = (industry) => industryExamples[industry] || industryExamples['Other General Business'];
export const allIndustryExampleValues = (key) => Object.values(industryExamples).map((example) => example[key]);
export const getFaqExamples = (industry) => String(getIndustryExample(industry).faq || '')
  .split(/\n\n(?=Q:)/)
  .map((example) => example.trim())
  .filter(Boolean);

export const getBusinessBriefContext = (industry) => (
  businessBriefIndustryContext[industry] || sharedBusinessBriefContext[industry] || fallbackBusinessBriefContext
);

export const getBusinessBriefSections = (industry) => {
  const context = getBusinessBriefContext(industry);

  return businessBriefSectionDefinitions.map((section) => ({
    ...section,
    template: context[section.id],
  }));
};

export const formatBusinessBriefTemplate = (section) => {
  if (section.id === 'story') return section.template;
  const lines = String(section.template || '')
    .replace(/^The company commonly works with:\n\n/, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.reduce((result, line) => {
    const isStructuredLine = line.startsWith('-') || line.startsWith('**');
    const previous = result[result.length - 1];
    const previousIsStructuredLine = previous?.startsWith('-') || previous?.startsWith('**');

    if (!isStructuredLine && previous && !previousIsStructuredLine) {
      result[result.length - 1] = `${previous} ${line}`;
      return result;
    }

    result.push(line);
    return result;
  }, []).join('\n').trim();
};
export const getBusinessBriefTemplateVariants = (section) => [
  String(section.template || '').trim(),
  formatBusinessBriefTemplate(section),
];
export const buildBusinessBriefSection = (section) => `${section.label}:\n\n${formatBusinessBriefTemplate(section)}`;
export const buildFullBusinessBrief = (sections) => sections.map(buildBusinessBriefSection).join('\n\n');
export const allBusinessBriefContexts = () => [
  ...Object.values(businessBriefIndustryContext),
  ...Object.values(sharedBusinessBriefContext),
  fallbackBusinessBriefContext,
];

export const allBusinessBriefSections = () => allBusinessBriefContexts().flatMap((context) => (
  businessBriefSectionDefinitions.map((section) => ({
    ...section,
    template: context[section.id],
  }))
));

export const generatedBusinessBriefPlaceholders = () => new Set(
  allBusinessBriefContexts().flatMap((context) => Object.values(context).flatMap((value) =>
    String(value || '').match(/\[([^\]]+)\]/g)?.map((match) => match.slice(1, -1)) || []
  ))
);

export const normalizeBusinessBriefPlaceholder = (value) => String(value || '')
  .replace(/^\[/, '')
  .replace(/\]$/, '')
  .trim()
  .toLowerCase();

export const LONG_TEXT_LIMIT_VALUE = 40000;
