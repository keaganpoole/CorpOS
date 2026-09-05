import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import SplashScreenAlternate from '../components/SplashScreenAlternate';
import ModalSpectrumLine from '../components/ModalSpectrumLine';
import SnapDropdown from '../components/SnapDropdown';
import {
  additionalBusinessBriefContexts,
  additionalIndustries,
  additionalIndustryExamples,
} from '../data/onboardingIndustryTemplates';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  Eye,
  Lightbulb,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Maximize2,
  Phone,
  Search,
  Trash2,
  FileText,
  Wand2,
  X,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const LONG_TEXT_LIMIT = 40000;

const steps = [
  {
    id: 'business',
    title: 'Tell us about your business',
    description: 'Start with the essentials your receptionist needs to know about your business.',
  },
  {
    id: 'contact',
    title: 'Business Details',
    description: 'Add your business details. You can always update them later.',
  },
  {
    id: 'operations',
    title: 'How should scheduling work?',
    description: 'Set when the business is open, when your receptionist should answer inbound calls, and when outbound calls can be made. Drag a bar to move a schedule, or drag either end to adjust its start and end time.',
  },
  {
    id: 'context',
    title: 'Tell us about your company.',
    description: 'Write a practical business brief that helps the AI understand what the company is, how it operates, what makes it distinct, and why customers choose it.',
  },
  {
    id: 'policies',
    title: 'Define your business policies.',
    description: 'Add the business rules your receptionist should know for cancellations, deposits, warranties, service areas, payment terms, emergencies, and anything callers commonly need clarified.',
  },
  {
    id: 'faq',
    title: 'Frequently asked questions',
    description: 'Add common customer questions and answers so your receptionist can respond consistently.',
  },
  {
    id: 'services',
    title: 'What services do you offer?',
    description: 'Give your receptionist the knowledge it needs to explain what you offer, make helpful service recommendations, and guide customers toward the right next step when they are ready to book.',
  },
];

const industries = [
  'Home Services',
  'Real Estate',
  'Automotive',
  'Beauty & Wellness',
  'Hospitality',
  'Professional Services',
  'Retail',
  ...additionalIndustries,
  'Other General Business',
];

const industryGroups = [
  {
    label: 'Home & Property',
    industries: ['Home Services', 'Real Estate', 'Cleaning Services', 'Landscaping', 'Plumbing', 'HVAC', 'Electrical', 'Pest Control', 'Construction & Remodeling', 'Interior Design'],
  },
  {
    label: 'Vehicles & Moving',
    industries: ['Automotive', 'Moving & Storage', 'Repair Services'],
  },
  {
    label: 'Personal & Recreation',
    industries: ['Beauty & Wellness', 'Fitness & Recreation', 'Pet Services', 'Travel & Tours'],
  },
  {
    label: 'Hospitality & Events',
    industries: ['Hospitality', 'Catering & Food Service', 'Events & Venues', 'Photography'],
  },
  {
    label: 'Business & Creative',
    industries: ['Professional Services', 'Marketing & Creative', 'IT Services'],
  },
  {
    label: 'Retail & Distribution',
    industries: ['Retail', 'Wholesale & Distribution'],
  },
  {
    label: 'Other',
    industries: ['Other General Business'],
  },
];

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const scheduleLayerTypes = [
  {
    id: 'business',
    label: 'Business Hours',
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-blue-600',
    glow: '0 0 16px rgba(6, 182, 212, 0.4)',
  },
  {
    id: 'inbound',
    label: 'Inbound Calls',
    color: '#14b8a6',
    gradient: 'from-teal-400 to-emerald-500',
    glow: '0 0 16px rgba(20, 184, 166, 0.4)',
  },
  {
    id: 'outbound',
    label: 'Outbound Calls',
    color: '#f97316',
    gradient: 'from-orange-400 to-red-500',
    glow: '0 0 16px rgba(249, 115, 22, 0.38)',
  },
];

const colorblindScheduleLayerTypes = [
  {
    id: 'business',
    label: 'Business Hours',
    color: '#0072b2',
    gradient: 'from-[#0072b2] to-[#56b4e9]',
    glow: '0 0 16px rgba(0, 114, 178, 0.36)',
  },
  {
    id: 'inbound',
    label: 'Inbound Calls',
    color: '#009e73',
    gradient: 'from-[#009e73] to-[#66c2a5]',
    glow: '0 0 16px rgba(0, 158, 115, 0.36)',
  },
  {
    id: 'outbound',
    label: 'Outbound Calls',
    color: '#d55e00',
    gradient: 'from-[#d55e00] to-[#e69f00]',
    glow: '0 0 16px rgba(213, 94, 0, 0.36)',
  },
];

const getScheduleLayerTypes = (colorblindMode = false) => (
  colorblindMode ? colorblindScheduleLayerTypes : scheduleLayerTypes
);

const scheduleTimeline = { start: 0, end: 24 };
const OUTBOUND_LATE_HOURS_TERMS_KEY = 'outbound_late_hours_acknowledgment_v1';
const OUTBOUND_LATE_HOURS_TERMS_STORAGE_KEY = `nodemere-${OUTBOUND_LATE_HOURS_TERMS_KEY}`;
const OUTBOUND_LATE_HOURS_START = 20;
const OUTBOUND_LATE_HOURS_END = 8;

const hasAcceptedOutboundLateHoursTerms = (profile) => (
  profile?.terms_of_service?.[OUTBOUND_LATE_HOURS_TERMS_KEY]?.accepted === true
);

const readStoredOutboundLateHoursTerms = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(OUTBOUND_LATE_HOURS_TERMS_STORAGE_KEY) || 'null');
    return stored?.accepted === true ? stored : null;
  } catch {
    return null;
  }
};

const isOutboundLateHoursLayer = (layer) => (
  Boolean(layer?.enabled)
  && (Number(layer.start) < OUTBOUND_LATE_HOURS_END || Number(layer.end) >= OUTBOUND_LATE_HOURS_START)
);

const scheduleHasOutboundLateHours = (schedule) => {
  const normalized = cleanScheduleForStorage(schedule);
  return days.some((day) => {
    const dayValue = normalized.days[day];
    return Boolean(dayValue?.enabled) && isOutboundLateHoursLayer(dayValue.layers?.outbound);
  });
};

const createDefaultSchedule = () => ({
  schema_version: 1,
  timeline: scheduleTimeline,
  days: days.reduce((result, day) => {
    const weekend = day === 'Saturday' || day === 'Sunday';
    result[day] = {
      enabled: !weekend,
      layers: {
        business: { start: 9, end: 17, enabled: true },
        inbound: { start: 9, end: 17, enabled: true },
        outbound: { start: 9.5, end: 16.5, enabled: true },
      },
    };
    return result;
  }, {}),
  ...days.reduce((result, day) => {
    const weekend = day === 'Saturday' || day === 'Sunday';
    result[day] = { enabled: !weekend, open: weekend ? '10:00' : '09:00', close: weekend ? '14:00' : '17:00' };
    return result;
  }, {}),
});

const industryExamples = {
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
We route sensitive, regulated, confidential, or identity-dependent requests to an authorized team member.`,
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
Sound professional, composed, and precise. Collect only ordinary contact and scheduling details; route sensitive, regulated, confidential, or identity-dependent requests to an authorized team member.

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

const getIndustryExample = (industry) => industryExamples[industry] || industryExamples['Other General Business'];
const allIndustryExampleValues = (key) => Object.values(industryExamples).map((example) => example[key]);
const allServiceDescriptionExamples = () => Object.values(industryExamples).map((example) => example.serviceDescription(example.serviceName));
const aboutTemplate = getIndustryExample('Home Services').about;

const businessBriefSectionDefinitions = [
  { id: 'story', label: 'Story' },
  { id: 'identity', label: 'Identity' },
  { id: 'whatWeDo', label: 'What We Do' },
  { id: 'whoWeServe', label: 'Who We Serve' },
  { id: 'serviceArea', label: 'Service Area' },
  { id: 'operations', label: 'Operations' },
  { id: 'credentials', label: 'Licenses & Credentials' },
  { id: 'additionalContext', label: 'Extra Context' },
];

const businessBriefIndustryContext = {
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

const sharedBusinessBriefContext = {
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

const fallbackBusinessBriefContext = {
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

const getBusinessBriefContext = (industry) => (
  businessBriefIndustryContext[industry] || sharedBusinessBriefContext[industry] || fallbackBusinessBriefContext
);

const getBusinessBriefSections = (industry) => {
  const context = getBusinessBriefContext(industry);

  return businessBriefSectionDefinitions.map((section) => ({
    ...section,
    template: context[section.id],
  }));
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const formatBusinessBriefTemplate = (section) => {
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
const getBusinessBriefTemplateVariants = (section) => [
  String(section.template || '').trim(),
  formatBusinessBriefTemplate(section),
];
const buildBusinessBriefSection = (section) => `${section.label}:\n\n${formatBusinessBriefTemplate(section)}`;
const buildFullBusinessBrief = (sections) => sections.map(buildBusinessBriefSection).join('\n\n');
const allBusinessBriefContexts = () => [
  ...Object.values(businessBriefIndustryContext),
  ...Object.values(sharedBusinessBriefContext),
  fallbackBusinessBriefContext,
];
const allBusinessBriefSections = () => allBusinessBriefContexts().flatMap((context) => (
  businessBriefSectionDefinitions.map((section) => ({
    ...section,
    template: context[section.id],
  }))
));
const normalizeBusinessBriefPlaceholder = (value) => String(value || '')
  .replace(/^\[/, '')
  .replace(/\]$/, '')
  .trim()
  .toLowerCase();
const generatedBusinessBriefPlaceholders = () => new Set(
  allBusinessBriefSections().flatMap((section) => (
    [...String(section.template || '').matchAll(/\[([^\]]+)\]/g)]
      .map((match) => normalizeBusinessBriefPlaceholder(match[1]))
  )),
);
const hasBusinessBriefSection = (value, section) => (
  new RegExp(`(?:^|\\n\\n)${escapeRegExp(section.label)}:\\n\\n`, 'm').test(value || '')
);
const getBusinessBriefSectionText = (value, section, sections) => {
  const labels = sections.map((item) => item.label);
  const pattern = new RegExp(
    `(?:^|\\n\\n)${escapeRegExp(section.label)}:\\n\\n([\\s\\S]*?)(?=\\n\\n(?:${labels.map((label) => escapeRegExp(`${label}:`)).join('|')})\\n\\n|$)`,
    'm',
  );
  return String(value || '').match(pattern)?.[1]?.trim() || '';
};
const replaceBusinessBriefSection = (value, section, sections) => {
  if (!hasBusinessBriefSection(value, section)) {
    return [String(value || '').trim(), buildBusinessBriefSection(section)].filter(Boolean).join('\n\n');
  }
  const labels = sections.map((item) => item.label);
  const pattern = new RegExp(
    `((?:^|\\n\\n)${escapeRegExp(section.label)}:\\n\\n)[\\s\\S]*?(?=\\n\\n(?:${labels.map((label) => escapeRegExp(`${label}:`)).join('|')})\\n\\n|$)`,
    'm',
  );
  return String(value || '').replace(pattern, `$1${formatBusinessBriefTemplate(section)}`).replace(/\n{3,}/g, '\n\n').trim();
};
const removeBusinessBriefSection = (value, section, sections) => {
  const labels = sections.map((item) => item.label);
  const pattern = new RegExp(
    `(?:^|\\n\\n)${escapeRegExp(section.label)}:\\n\\n[\\s\\S]*?(?=\\n\\n(?:${labels.map((label) => escapeRegExp(`${label}:`)).join('|')})\\n\\n|$)`,
    'm',
  );
  return String(value || '').replace(pattern, '').replace(/\n{3,}/g, '\n\n').trim();
};
const isGeneratedBusinessBriefSection = (value, section) => (
  allBusinessBriefSections().some((candidate) => (
    candidate.id === section.id && getBusinessBriefTemplateVariants(candidate).includes(String(value || '').trim())
  ))
);
const refreshGeneratedBusinessBriefSections = (value, nextSections) => {
  const currentValue = String(value || '');
  if (!currentValue.trim()) return currentValue;

  return nextSections.reduce((nextValue, section) => {
    if (!hasBusinessBriefSection(nextValue, section)) return nextValue;
    const currentSectionText = getBusinessBriefSectionText(nextValue, section, allBusinessBriefSections());
    if (!isGeneratedBusinessBriefSection(currentSectionText, section)) return nextValue;
    return replaceBusinessBriefSection(nextValue, section, allBusinessBriefSections());
  }, currentValue);
};
const legacyNamedAboutExamples = [
  `We're Hartley Roofing, a family-owned roofing company based in Portland, Maine. My dad started this business back in 2006 with nothing but a truck and a ladder, and we've been keeping roofs tight ever since.

We specialize in residential roofing: asphalt shingles, metal roofing, flat roofs, and repairs. We also do gutter installation and siding.

We're licensed and insured, and every job comes with a workmanship warranty on top of the manufacturer warranty.

We proudly serve the Greater Portland area and much of southern Maine, including Portland, South Portland, Scarborough, Westbrook, Falmouth, Cape Elizabeth, Gorham, Windham, Cumberland, Yarmouth, Freeport, and surrounding communities.
`,
  `We're Harbor & Pine Realty, a residential real estate team based in Portland, Maine. We help buyers, sellers, and relocating families make clear decisions in a competitive local market.

Our team focuses on practical guidance, fast communication, and a calm process from the first conversation through closing.

We serve Greater Portland and nearby communities, including South Portland, Scarborough, Falmouth, Cape Elizabeth, Westbrook, and Cumberland.`,
  `We're Luma Skin Studio, a boutique skincare and wellness studio focused on calm, personalized treatments. We help clients improve skin health while creating a relaxing, professional experience.

Our approach is thoughtful and consultative. We tailor recommendations based on skin goals, comfort level, and treatment history.

We serve clients by appointment and prioritize cleanliness, consistency, and a peaceful client experience.`,
  `We're Northline Auto Care, a local repair shop focused on honest diagnostics, clear estimates, and dependable vehicle maintenance.

We help drivers understand what their vehicle needs, what can wait, and what should be handled soon for safety or reliability.

Our team works on common maintenance and repair needs for most passenger vehicles, with a focus on straightforward communication.`,
  `We're The Bramble House, a warm neighborhood restaurant and event space known for seasonal food, attentive service, and intimate gatherings.

We help guests plan dinners, small celebrations, and private events with clear communication and a welcoming experience.

Our team focuses on hospitality that feels personal, organized, and easy for guests.`,
  `We're Meridian Advisory Group, a professional services firm that helps clients make organized, informed decisions with clear guidance and reliable follow-through.

We focus on practical advice, responsive communication, and a professional process from first inquiry through ongoing support.

Our team works with individuals and businesses that value clarity, preparation, and trusted expertise.`,
  `We're Elm & Co., a local retail shop focused on thoughtful products, helpful recommendations, and a friendly in-store experience.

We help customers find gifts, everyday essentials, and pieces that fit their needs, style, and budget.

Our team values warm service, practical product knowledge, and making shopping easier for every customer.`,
  `We're Summit Client Services, a local business focused on responsive service, clear communication, and helping customers get the right support quickly.

We work with customers who value practical guidance, dependable follow-through, and a straightforward experience.

Our team focuses on understanding each request, answering questions clearly, and helping customers take the right next step.`,
];

const removedAboutIntro = `Who are you? Tell your story. Your AI receptionist uses this to answer questions about your business.

EXAMPLE:

`;

const policiesTemplate = '';
const policiesPlaceholder = getIndustryExample('Home Services').policies;

const removedPoliciesIntro = `Add the policies your AI receptionist should follow during calls.

EXAMPLE:

`;

const faqTemplate = '';
const faqPlaceholder = getIndustryExample('Home Services').faq;
const getFaqExamples = (industry) => String(getIndustryExample(industry).faq || '')
  .split(/\n\n(?=Q:)/)
  .map((example) => example.trim())
  .filter(Boolean);

const removedFaqIntro = `Add common customer questions and the answers your AI receptionist should give.

EXAMPLE:

`;

const unitOptions = [
  { value: 'session', label: 'Session' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const blankService = () => ({
  id: `service-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: '',
  description: '',
  category: 'General',
  price_type: 'fixed',
  price_min: '',
  price_max: '',
  unit: 'session',
  is_active: true,
});

const serviceDescriptionMagicTemplate = (serviceName, industry) => {
  const example = getIndustryExample(industry);
  const name = String(serviceName || '').trim() || example.serviceName;
  return example.serviceDescription(name);
};

const formatServicePrice = (service) => {
  const unit = service.unit ? ` / ${service.unit}` : '';
  if (service.price_type === 'free') return 'Free';
  if (service.price_type === 'quote') return 'Quote required';
  if (service.price_type === 'range') return `$${service.price_min || 0} - $${service.price_max || 0}${unit}`;
  if (service.price_type === 'starting_at') return `From $${service.price_min || 0}${unit}`;
  return service.price_min ? `$${service.price_min}${unit}` : 'Price not set';
};

const formatPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const formatZip = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const formatState = (value) => String(value || '').replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase();

const formatCurrencyInput = (value) => {
  const cleaned = String(value || '').replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

const formatIntegerInput = (value, maxLength = 3) => String(value || '').replace(/\D/g, '').slice(0, maxLength);
const limitLongText = (value) => String(value || '').slice(0, LONG_TEXT_LIMIT);
const possessiveName = (value) => {
  const name = String(value || '').trim();
  if (!name) return '';
  return `${name}${name.toLowerCase().endsWith('s') ? "'" : "'s"}`;
};
const formatBusinessNameInput = (value) => String(value || '')
  .replace(/\S+/g, (word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`);

const isEmailComplete = (value) => {
  const email = String(value || '').trim();
  return !email || (email.includes('@') && email.indexOf('@') > 0 && email.indexOf('@') < email.length - 1);
};

const fieldClass =
  'h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white !outline-none ring-0 transition placeholder:text-zinc-700 focus:border-white/[0.16] focus:!outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0 [color-scheme:dark]';

const smallFieldClass =
  'h-10 w-full rounded-xl border border-white/[0.06] bg-[#070707]/85 px-3 text-[12px] text-zinc-300 !outline-none ring-0 transition placeholder:text-zinc-700 focus:border-white/[0.14] focus:!outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0 [color-scheme:dark]';

const Field = ({ label, hint, children }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <div className="text-[13px] font-normal text-zinc-400">
        {label}
        {hint ? <span className="text-zinc-600"> ({hint})</span> : null}
      </div>
    </div>
    {children}
  </div>
);

const CharacterLimitNotice = ({ value, limit = LONG_TEXT_LIMIT }) => {
  const remaining = Math.max(0, limit - String(value || '').length);
  if (remaining > 1000) return null;

  return (
    <div className="pointer-events-none absolute right-4 top-3 z-10 rounded-full bg-[#0d0d0d]/90 px-2 py-1 text-[10px] font-semibold text-rose-300">
      {remaining.toLocaleString()} / {limit.toLocaleString()} characters left
    </div>
  );
};

const moveCaretToEnd = (element) => {
  const selection = window.getSelection?.();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

const escapeEditableHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/\[([^\]]+)\]/g, (match, placeholder) => {
    const className = generatedBusinessBriefPlaceholders().has(normalizeBusinessBriefPlaceholder(placeholder))
      ? 'business-brief-placeholder-highlight'
      : 'business-brief-placeholder-edited';
    return `<span class="${className}">[${placeholder}]</span>`;
  });

const refreshEditedPlaceholderStyles = (editor) => {
  const generatedPlaceholders = generatedBusinessBriefPlaceholders();
  editor.querySelectorAll('.business-brief-placeholder-highlight').forEach((placeholder) => {
    if (generatedPlaceholders.has(normalizeBusinessBriefPlaceholder(placeholder.textContent))) return;
    placeholder.classList.remove('business-brief-placeholder-highlight');
    placeholder.classList.add('business-brief-placeholder-edited');
  });
};

const selectEditablePlaceholder = (event) => {
  const placeholder = event.target.closest?.('.business-brief-placeholder-highlight, .business-brief-placeholder-edited');
  if (!placeholder || !event.currentTarget.contains(placeholder)) return;

  const selection = window.getSelection?.();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(placeholder);
  selection.removeAllRanges();
  selection.addRange(range);
};

const EditableBusinessBrief = ({ value, onChange, maxLength = LONG_TEXT_LIMIT, editorRef }) => {
  const lastInputValueRef = useRef(String(value || ''));

  useEffect(() => {
    const editor = editorRef.current;
    const nextValue = String(value || '');
    if (!editor) return;
    if (editor.textContent === nextValue && lastInputValueRef.current === nextValue) return;
    editor.innerHTML = escapeEditableHtml(nextValue);
    lastInputValueRef.current = nextValue;
  }, [value]);

  return (
    <div
      ref={editorRef}
      contentEditable
      role="textbox"
      aria-multiline="true"
      suppressContentEditableWarning
      onBeforeInput={(event) => {
        if (!event.inputType?.startsWith('insert')) return;
        const editor = event.currentTarget;
        const currentValue = editor.textContent || '';
        const selectedTextLength = window.getSelection?.()?.toString().length || 0;
        if (currentValue.length - selectedTextLength >= maxLength) {
          event.preventDefault();
        }
      }}
      onPaste={(event) => {
        event.preventDefault();
        const editor = event.currentTarget;
        const currentValue = editor.textContent || '';
        const pastedText = event.clipboardData.getData('text/plain');
        const selection = window.getSelection?.();
        const selectedTextLength = selection?.rangeCount ? String(selection.toString()).length : 0;
        const available = maxLength - (currentValue.length - selectedTextLength);
        if (available <= 0) return;
        document.execCommand('insertText', false, pastedText.slice(0, available));
      }}
      onInput={(event) => {
        const editor = event.currentTarget;
        let nextValue = editor.textContent || '';
        if (nextValue.length > maxLength) {
          nextValue = nextValue.slice(0, maxLength);
          editor.textContent = nextValue;
          moveCaretToEnd(editor);
        }
        refreshEditedPlaceholderStyles(editor);
        lastInputValueRef.current = nextValue;
        onChange(nextValue);
      }}
      onClick={selectEditablePlaceholder}
      onBlur={(event) => {
        const nextValue = event.currentTarget.textContent || '';
        event.currentTarget.innerHTML = escapeEditableHtml(nextValue);
      }}
      className={`${fieldClass} h-[459px] overflow-y-auto whitespace-pre-wrap resize-none py-4 leading-6`}
    />
  );
};

const SelectCard = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-2xl border p-4 text-left transition-all duration-300 ${
      active
        ? 'border-white bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.10)]'
        : 'border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:border-white/[0.16] hover:bg-white/[0.055] hover:text-zinc-200'
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      {active ? (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-white">
          <Check className="h-3.5 w-3.5 stroke-[3]" />
        </div>
      ) : null}
    </div>
  </button>
);

const Toggle = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`flex h-6 w-10 items-center rounded-full border p-0.5 transition-all ${
      value ? 'border-emerald-400/30 bg-emerald-400/15' : 'border-white/[0.08] bg-black/30'
    }`}
  >
    <div
      className={`h-4 w-4 rounded-full transition-transform ${
        value ? 'translate-x-4 bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.35)]' : 'translate-x-0 bg-zinc-200'
      }`}
    />
  </button>
);

const formatScheduleTime = (decimalHours) => {
  const totalMinutes = Math.round(Number(decimalHours || 0) * 60) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
};

const formatScheduleDuration = (decimalHours) => {
  const minutes = Math.round(Number(decimalHours || 0) * 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder}m`;
};

const cleanScheduleForStorage = (schedule) => {
  const source = scheduleIsValid(schedule) ? schedule : createDefaultSchedule();
  return {
    schema_version: 1,
    timeline: { start: scheduleTimeline.start, end: scheduleTimeline.end },
    days: Object.fromEntries(days.map((day) => [
      day,
      {
        enabled: Boolean(source.days[day].enabled),
        layers: Object.fromEntries(scheduleLayerTypes.map(({ id }) => [
          id,
          {
            enabled: Boolean(source.days[day].layers[id].enabled),
            start: Number(source.days[day].layers[id].start),
            end: Number(source.days[day].layers[id].end),
          },
        ])),
      },
    ])),
  };
};

const scheduleIsValid = (value) => (
  value && value.schema_version === 1 && Number(value.timeline?.start) === scheduleTimeline.start && Number(value.timeline?.end) === scheduleTimeline.end && value.days && days.every((day) => {
    const dayValue = value.days[day];
    return dayValue && typeof dayValue.enabled === 'boolean' && scheduleLayerTypes.every(({ id }) => {
      const layer = dayValue.layers?.[id];
      const start = Number(layer?.start);
      const end = Number(layer?.end);
      return layer && typeof layer.enabled === 'boolean' && Number.isFinite(start) && Number.isFinite(end) && start >= scheduleTimeline.start && end <= scheduleTimeline.end && start < end;
    });
  })
);

const formatWeeklyHours = (hours) => {
  const rounded = Math.round(Number(hours || 0) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}h`;
};

const LateHoursTermsModal = ({ isSaving = false, onAccept, onClose }) => {
  const [secondsRemaining, setSecondsRemaining] = useState(10);
  const canAccept = secondsRemaining === 0 && !isSaving;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
    >
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0a0a0a] shadow-[0_28px_90px_rgba(0,0,0,0.6)]"
      >
        <div className="border-b border-white/[0.06] px-7 py-6">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="outbound-notice-gradient inline-block text-[11px] font-bold uppercase tracking-[0.18em]">
                Outbound calling notice
              </p>
              <h2 className="mt-2 text-[22px] font-black tracking-[-0.04em] text-white">Late-hours calling</h2>
            </div>
            <button type="button" onClick={onClose} className="mt-0.5 text-zinc-600 transition hover:text-white" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="px-7 py-6">
          <p className="text-sm leading-6 text-zinc-300">
            Calling customers outside normal business hours may lead to complaints, lower answer rates, and could be subject to local telemarketing or consumer protection regulations. Only enable overnight calling if it fits your business, you have appropriate customer consent, and you're confident it complies with applicable laws.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] px-7 py-5">
          <button type="button" onClick={onClose} className="h-10 rounded-full px-6 text-sm font-medium text-zinc-500 transition hover:text-white">
            Review schedule
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!canAccept}
            className={`flex h-10 min-w-[168px] items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition disabled:cursor-wait ${
              canAccept
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'border border-white/[0.08] bg-white/[0.04] text-zinc-500'
            }`}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <span>Yes, I accept</span>
                {secondsRemaining > 0 ? <span className="text-[11px] text-zinc-500">({secondsRemaining})</span> : null}
              </>
            )}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
};

const ScheduleTimeline = ({ value, onChange, colorblindMode, onColorblindModeChange, outboundLateHoursAccepted, onOutboundLateHours }) => {
  const dragPreviewRef = useRef(null);
  const [snapMinutes, setSnapMinutes] = useState(15);
  const [drag, setDrag] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [notice, setNotice] = useState('');

  const schedule = scheduleIsValid(value) ? value : createDefaultSchedule();
  const timelineHours = schedule.timeline?.end - schedule.timeline?.start || 24;
  const activeLayerTypes = useMemo(() => getScheduleLayerTypes(colorblindMode), [colorblindMode]);
  const weeklyTotals = useMemo(() => {
    const totals = { business: 0, inbound: 0, outbound: 0 };
    days.forEach((day) => {
      const dayValue = schedule.days[day];
      if (!dayValue?.enabled) return;
      activeLayerTypes.forEach(({ id }) => {
        const layer = dayValue.layers[id];
        if (!layer?.enabled) return;
        totals[id] += Math.max(0, Number(layer.end) - Number(layer.start));
      });
    });
    return { coverage: totals.business, ...totals };
  }, [activeLayerTypes, schedule]);

  const updateSchedule = useCallback((updater) => {
    const nextSchedule = typeof updater === 'function' ? updater(schedule) : updater;
    onChange(cleanScheduleForStorage(nextSchedule));
  }, [onChange, schedule]);

  const updateLayer = useCallback((day, layerId, nextLayer) => {
    updateSchedule((current) => ({
      ...current,
      days: {
        ...current.days,
        [day]: {
          ...current.days[day],
          layers: { ...current.days[day].layers, [layerId]: nextLayer },
        },
      },
    }));
  }, [updateSchedule]);

  const toggleDay = useCallback((day) => {
    updateSchedule((current) => {
      const nextEnabled = !current.days[day].enabled;
      return {
        ...current,
        days: {
          ...current.days,
          [day]: {
            ...current.days[day],
            enabled: nextEnabled,
            layers: Object.fromEntries(scheduleLayerTypes.map(({ id }) => [
              id,
              { ...current.days[day].layers[id], enabled: nextEnabled },
            ])),
          },
        },
      };
    });
  }, [updateSchedule]);

  const toggleLayer = useCallback((day, layerId) => {
    updateSchedule((current) => {
      const nextLayers = {
        ...current.days[day].layers,
        [layerId]: {
          ...current.days[day].layers[layerId],
          enabled: !current.days[day].layers[layerId].enabled,
        },
      };
      return {
        ...current,
        days: {
          ...current.days,
          [day]: {
            ...current.days[day],
            enabled: Object.values(nextLayers).some((layer) => layer.enabled),
            layers: nextLayers,
          },
        },
      };
    });
  }, [updateSchedule]);

  const toggleAllLayer = useCallback((layerId) => {
    updateSchedule((current) => {
      const isCurrentlyEnabled = days.some((day) => current.days[day]?.layers?.[layerId]?.enabled);
      const nextDays = Object.fromEntries(days.map((day) => {
        const nextLayers = {
          ...current.days[day].layers,
          [layerId]: { ...current.days[day].layers[layerId], enabled: !isCurrentlyEnabled },
        };
        return [day, { ...current.days[day], enabled: Object.values(nextLayers).some((layer) => layer.enabled), layers: nextLayers }];
      }));
      return { ...current, days: nextDays };
    });
  }, [updateSchedule]);

  const handlePointerDown = (event, day, layerId, handle) => {
    const layer = schedule.days[day].layers[layerId];
    if (!schedule.days[day].enabled || !layer.enabled) return;
    event.preventDefault();
    dragPreviewRef.current = { day, layerId, layer };
    setDrag({ day, layerId, handle, startX: event.clientX, startValue: handle === 'left' ? layer.start : handle === 'right' ? layer.end : layer.start });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = useCallback((event) => {
    if (!drag) return;
    const track = document.querySelector(`[data-schedule-track="${drag.day}"]`);
    if (!track) return;
    const width = track.getBoundingClientRect().width;
    const delta = ((event.clientX - drag.startX) / width) * timelineHours;
    const snap = snapMinutes / 60;
    const layer = schedule.days[drag.day].layers[drag.layerId];
    const duration = layer.end - layer.start;
    let start = layer.start;
    let end = layer.end;
    if (drag.handle === 'left') start = Math.round((drag.startValue + delta) / snap) * snap;
    if (drag.handle === 'right') end = Math.round((drag.startValue + delta) / snap) * snap;
    if (drag.handle === 'center') {
      start = Math.round((drag.startValue + delta) / snap) * snap;
      end = start + duration;
    }
    start = Math.max(schedule.timeline.start, Math.min(start, schedule.timeline.end - snap));
    end = Math.max(start + snap, Math.min(end, schedule.timeline.end));
    if (drag.handle === 'center') {
      end = Math.min(schedule.timeline.end, start + duration);
      start = end - duration;
    }
    const nextLayer = { ...layer, start, end };
    dragPreviewRef.current = { day: drag.day, layerId: drag.layerId, layer: nextLayer };
    updateLayer(drag.day, drag.layerId, nextLayer);
  }, [drag, schedule, snapMinutes, timelineHours, updateLayer]);

  useEffect(() => {
    if (!drag) return undefined;
    const stop = () => {
      const preview = dragPreviewRef.current;
      if (
        preview?.layerId === 'outbound'
        && !outboundLateHoursAccepted
        && isOutboundLateHoursLayer(preview.layer)
      ) {
        onOutboundLateHours?.();
      }
      dragPreviewRef.current = null;
      setDrag(null);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stop);
    };
  }, [drag, handlePointerMove, onOutboundLateHours, outboundLateHoursAccepted]);

  const copyDay = (sourceDay) => {
    const source = schedule.days[sourceDay];
    updateSchedule((current) => ({
      ...current,
      days: Object.fromEntries(days.map((day) => [day, {
        ...current.days[day],
        layers: Object.fromEntries(activeLayerTypes.map(({ id }) => [id, { ...source.layers[id] }]))
      }])),
    }));
    setNotice(`${sourceDay} copied to all days`);
  };

  const exportSchedule = () => {
    const blob = new Blob([JSON.stringify(schedule, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nodemere-schedule.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const openImportModal = () => {
    setImportText('');
    setNotice('');
    setImportModalOpen(true);
  };

  const importSchedule = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!scheduleIsValid(parsed)) throw new Error('This file does not contain a complete schedule.');
      onChange(cleanScheduleForStorage(parsed));
      setImportModalOpen(false);
      setImportText('');
      setNotice('Schedule imported');
    } catch (error) {
      setNotice(error.message || 'Could not import that schedule.');
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-zinc-500"><Layers className="h-3.5 w-3.5" /> Layers:</span>
          {activeLayerTypes.map((layer) => (
            <button key={layer.id} type="button" onClick={() => toggleAllLayer(layer.id)} className={`flex items-center gap-1.5 text-[11px] font-medium transition ${days.some((day) => schedule.days[day]?.layers?.[layer.id]?.enabled) ? 'text-zinc-300' : 'text-zinc-700'}`}>
              <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${layer.gradient} ${days.some((day) => schedule.days[day]?.layers?.[layer.id]?.enabled) ? '' : 'opacity-30'}`} />{layer.label}
            </button>
          ))}
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span>Snap</span>
            <SnapDropdown value={snapMinutes} onChange={setSnapMinutes} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onColorblindModeChange(!colorblindMode)}
            className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              colorblindMode ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-white/[0.07] bg-white/[0.025] text-zinc-500 hover:border-white/[0.14] hover:text-white'
            }`}
            aria-label="Colorblind-friendly colors"
            title="Colorblind-friendly colors"
          >
            <Eye className="h-4 w-4" />
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_90deg,#0072b2,#009e73,#d55e00,#56b4e9,#0072b2)] ring-1 ring-black/30" />
          </button>
          <button type="button" onClick={openImportModal} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 text-[11px] font-medium text-zinc-500 transition hover:border-white/[0.14] hover:text-white"><FileText className="h-3.5 w-3.5" /> Import</button>
          <button type="button" onClick={exportSchedule} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 text-[11px] font-medium text-zinc-500 transition hover:border-white/[0.14] hover:text-white"><Download className="h-3.5 w-3.5" /> Export</button>
        </div>
      </div>
      <AnimatePresence>
        {importModalOpen ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#080808] p-5 shadow-2xl"
              initial={{ y: 18, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 18, scale: 0.98, opacity: 0 }}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Import schedule</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Paste the exported schedule text below.</p>
                </div>
                <button type="button" onClick={() => setImportModalOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label="Close import schedule">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                className="h-64 w-full resize-none rounded-xl border border-white/[0.08] bg-black/50 p-3 font-mono text-xs text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-white/[0.18]"
                placeholder=""
              />
              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setImportModalOpen(false)} className="h-9 rounded-lg border border-white/[0.07] px-3 text-xs font-semibold text-zinc-400 transition hover:border-white/[0.14] hover:text-white">Cancel</button>
                <button type="button" onClick={importSchedule} className="h-9 rounded-lg bg-white px-3 text-xs font-semibold text-black transition hover:bg-zinc-200">Import schedule</button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="space-y-4 rounded-[22px] border border-white/[0.06] bg-black/20 p-4 sm:p-5">

      <div className="flex pl-32 pr-12 text-[11px] font-mono text-zinc-600">
        <div className="relative h-5 flex-1 select-none">{[0, 4, 8, 12, 16, 20, 24].map((hour) => <span key={hour} className="absolute -translate-x-1/2" style={{ left: `${((hour - schedule.timeline.start) / timelineHours) * 100}%` }}>{formatScheduleTime(hour)}</span>)}</div>
      </div>

      <div className="space-y-1.5">
        {days.map((day) => {
          const dayValue = schedule.days[day];
          return (
            <div key={day} className={`group relative flex items-center rounded-xl border px-3 py-2 transition-all duration-200 ${dayValue.enabled ? 'border-white/[0.06] bg-white/[0.018] hover:bg-white/[0.035]' : 'border-transparent bg-black/20 opacity-50 hover:opacity-75'}`}>
              <div className="flex w-28 shrink-0 items-center gap-2.5">
                <button type="button" onClick={() => toggleDay(day)} className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors duration-200 ${dayValue.enabled ? 'bg-zinc-100/90 shadow-[0_0_10px_rgba(244,244,245,0.16)]' : 'bg-zinc-800'}`} aria-label={`Toggle all schedules for ${day}`}><span className={`h-3 w-3 rounded-full shadow-md transition-transform duration-200 ${dayValue.enabled ? 'translate-x-3 bg-zinc-900' : 'translate-x-0 bg-white'}`} /></button>
                <span className={`text-xs font-semibold uppercase tracking-wider ${dayValue.enabled ? 'text-zinc-200' : 'text-zinc-500'}`}>{day.slice(0, 3)}</span>
              </div>
              <div data-schedule-track={day} className="relative mx-2 flex h-14 min-w-0 flex-1 items-center">
                <div className="pointer-events-none absolute inset-0 flex justify-between opacity-10">{Array.from({ length: timelineHours + 1 }).map((_, index) => <span key={index} className="h-full w-px bg-white/40" />)}</div>
                <div className="relative flex w-full flex-col gap-1.5 py-1">
                  {activeLayerTypes.map((layerType) => {
                    const layer = dayValue.layers[layerType.id];
                    const left = Math.max(0, Math.min(100, ((layer.start - schedule.timeline.start) / timelineHours) * 100));
                    const width = Math.max(0, Math.min(100 - left, ((layer.end - layer.start) / timelineHours) * 100));
                    const barKey = `${day}-${layerType.id}`;
                    const isActiveBar = drag?.day === day && drag?.layerId === layerType.id;
                    const isHovered = hoveredBar === barKey;
                    const isDimmed = drag && !isActiveBar;
                    return (
                      <div key={layerType.id} className="group/bar relative h-2.5 w-full" onMouseEnter={() => setHoveredBar(barKey)} onMouseLeave={() => setHoveredBar(null)}>
                        <button type="button" onClick={() => toggleLayer(day, layerType.id)} aria-pressed={layer.enabled} aria-label={`${layer.enabled ? 'Disable' : 'Enable'} ${layerType.label} on ${day}`} title={`${layer.enabled ? 'Disable' : 'Enable'} ${layerType.label}`} className={`absolute inset-y-0 left-0 right-0 overflow-hidden rounded-full border text-left transition ${layer.enabled ? 'border-white/[0.05] bg-white/[0.05]' : 'border-white/[0.03] bg-white/[0.02] opacity-60 hover:opacity-100'}`} />
                        <div
                            className={`absolute inset-y-0 select-none rounded-full bg-gradient-to-r ${layerType.gradient} transition-all duration-75 ${layer.enabled ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer grayscale'} ${
                              isActiveBar ? 'z-20 scale-y-110 ring-2 ring-white/50' : 'z-10'
                            } ${isDimmed ? 'opacity-30' : layer.enabled ? 'opacity-100' : 'opacity-25'} ${isHovered && layer.enabled ? 'brightness-125 shadow-lg' : ''}`}
                            style={{ left: `${left}%`, width: `${width}%`, boxShadow: isActiveBar || (isHovered && layer.enabled) ? layerType.glow : 'none' }}
                            onClick={() => { if (!layer.enabled) toggleLayer(day, layerType.id); }}
                            onPointerDown={(event) => handlePointerDown(event, day, layerType.id, 'center')}
                          >
                            <button type="button" aria-label={`Move ${layerType.label} start`} onPointerDown={(event) => { event.stopPropagation(); handlePointerDown(event, day, layerType.id, 'left'); }} className="absolute left-0 top-1/2 z-30 flex h-4 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white opacity-0 shadow-md transition-all hover:scale-125 group-hover/bar:opacity-100">
                              <span className="h-2 w-0.5 rounded-full bg-zinc-600" />
                            </button>
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30">
                              <span className="h-0.5 w-4 rounded-full bg-white/60" />
                            </div>
                            <button type="button" aria-label={`Move ${layerType.label} end`} onPointerDown={(event) => { event.stopPropagation(); handlePointerDown(event, day, layerType.id, 'right'); }} className="absolute right-0 top-1/2 z-30 flex h-4 w-3 translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white opacity-0 shadow-md transition-all hover:scale-125 group-hover/bar:opacity-100">
                              <span className="h-2 w-0.5 rounded-full bg-zinc-600" />
                            </button>
                          </div>
                        {layer.enabled && (isHovered || isActiveBar) ? (
                          <div className="pointer-events-none absolute -top-7 z-30 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/[0.08] bg-[#111] px-2 py-0.5 font-mono text-[11px] text-zinc-100 shadow-2xl" style={{ left: `${Math.min(92, Math.max(8, left + (width / 2)))}%` }}>
                            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: layerType.color }} />
                            <span className="font-semibold text-white">{formatScheduleTime(layer.start)}</span>
                            <span className="px-1 text-zinc-500">-</span>
                            <span className="font-semibold text-white">{formatScheduleTime(layer.end)}</span>
                            <span className="ml-1.5 rounded bg-white/10 px-1 text-[10px] text-zinc-400">{formatScheduleDuration(layer.end - layer.start)}</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex w-10 shrink-0 justify-end opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => copyDay(day)} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label={`Copy ${day} schedule to all days`}><Copy className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          );
        })}
      </div>
        <div className="flex min-h-[48px] items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-4 text-[11px] text-zinc-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-zinc-400">Weekly Coverage: <strong className="ml-1 text-white">{formatWeeklyHours(weeklyTotals.coverage)}</strong></span>
            {activeLayerTypes.map((layer) => (
              <span key={layer.id} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: layer.color }} />
                <span>{layer.label.replace(' Hours', '')}: <strong className="ml-1 text-white">{formatWeeklyHours(weeklyTotals[layer.id])}</strong></span>
              </span>
            ))}
          </div>
        </div>
      </div>
      {notice ? <div className="px-1 text-right text-[10px] text-emerald-300">{notice}</div> : null}
    </div>
  );
};

const InfoModal = ({ eyebrow = 'Tips', title, intro, points = [], footer, onClose, zIndexClass = 'z-[220]', dense = false, maxWidthClass = 'max-w-[620px]' }) => (
  <motion.div
    className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm`}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onMouseDown={onClose}
  >
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className={`relative w-full ${maxWidthClass} overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#070707] shadow-[0_28px_90px_rgba(0,0,0,0.62)]`}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <ModalSpectrumLine variant="tips" />
      <div className="pointer-events-none absolute right-[-140px] top-[-180px] h-72 w-72 rounded-full bg-white/[0.035] blur-[72px]" />
      <div className="p-7 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="relative">
            <div className="mb-3 flex items-center gap-1.5">
              {String(eyebrow).trim().toLowerCase() === 'tips' ? <Lightbulb className="h-4 w-4 shrink-0 -translate-y-[5px] text-zinc-600" aria-hidden="true" /> : null}
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">{eyebrow}</p>
            </div>
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-white sm:text-2xl">{title}</h2>
            {intro ? (
              <p className="mt-3 max-w-[520px] text-sm leading-6 text-zinc-500">{intro}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-600 transition hover:text-white"
            aria-label={`Close ${title}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {points.length ? (
          <div className={`relative mt-7 text-sm text-zinc-400 ${dense ? 'space-y-1 leading-5' : 'space-y-4 leading-6'}`}>
            {points.map((point, index) => (
              <div key={point.title} className={`flex ${dense ? 'gap-2' : 'gap-3'}`}>
                <span
                  className={`${dense ? 'mt-2 h-1 w-1' : 'mt-2 h-1.5 w-1.5'} shrink-0 rounded-full`}
                  style={{ backgroundColor: `rgba(255,255,255,${Math.max(0.35, 1 - (index * 0.14))})` }}
                />
                <p><span className="font-semibold text-white">{point.title}</span> {point.body}</p>
              </div>
            ))}
          </div>
        ) : null}

        {footer ? (
          <div className="relative mt-7 border-t border-white/[0.06] pt-5">
            <p className="max-w-[520px] text-[13px] leading-6 text-zinc-500">{footer}</p>
          </div>
        ) : null}
      </div>
    </motion.div>
  </motion.div>
);

const ServiceModal = ({ initialService, industry, onClose, onSave }) => {
  const [serviceDetailsHelpOpen, setServiceDetailsHelpOpen] = useState(false);
  const [descriptionHelpOpen, setDescriptionHelpOpen] = useState(false);
  const [descriptionEditorOpen, setDescriptionEditorOpen] = useState(false);
  const [draft, setDraft] = useState({
    ...(initialService || blankService()),
    price_type: 'fixed',
    price_max: '',
    unit: initialService?.unit === 'per session' ? 'session' : initialService?.unit || 'session',
    is_active: true,
  });
  const setDraftValue = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));
  const exampleService = getIndustryExample(industry);
  const magicDescription = serviceDescriptionMagicTemplate(draft.name, industry);
  const magicDescriptionEnabled = draft.description === magicDescription;
  const toggleMagicDescription = () => {
    setDraft((prev) => {
      const nextMagicDescription = serviceDescriptionMagicTemplate(prev.name, industry);
      return {
        ...prev,
        description: prev.description === nextMagicDescription ? '' : nextMagicDescription,
      };
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-xl"
    >
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        className="w-full max-w-[720px] overflow-visible rounded-[30px] border border-white/[0.08] bg-[#070707] shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">
              {initialService ? 'Edit service' : 'Create service'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">Add a service customers can ask about or book.</p>
          </div>
          <button type="button" onClick={onClose} className="p-0 text-zinc-600 transition hover:text-white" aria-label="Close service modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="custom-scrollbar max-h-[calc(100vh-170px)] overflow-y-auto px-6 py-7 sm:px-8">
          <div className="space-y-6">
            <div className="border-b border-white/[0.05] pb-6">
              <div className="mb-1.5 flex items-baseline gap-1.5">
                <p className="text-[10px] font-bold uppercase leading-none tracking-[0.22em] text-zinc-600">Billing unit</p>
                <button
                  type="button"
                  onClick={() => setServiceDetailsHelpOpen(true)}
                  title="Help"
                  className="inline-flex h-3.5 w-3.5 shrink-0 translate-y-[1px] items-center justify-center text-zinc-600 transition hover:text-zinc-300"
                  aria-label="Service details help"
                >
                  <Lightbulb className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-5">
                <div className="custom-scrollbar flex min-w-0 items-center overflow-x-auto pb-1" aria-label="Billing unit">
                  {unitOptions.map((option, index) => {
                    const active = (draft.unit || '') === option.value;
                    return (
                      <div key={option.value || 'none'} className="flex shrink-0 items-center">
                        {index > 0 ? <span className="h-3 w-px bg-white/[0.10]" /> : null}
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setDraftValue('unit', option.value)}
                          className={`${index === 0 ? 'pr-3' : 'px-3'} bg-transparent text-[10px] font-semibold leading-[1.7] whitespace-nowrap transition ${
                            active ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <Field label="Service name">
                  <input type="text" value={draft.name} onChange={(e) => setDraftValue('name', e.target.value)} placeholder={`e.g., ${exampleService.serviceName}`} autoFocus className={fieldClass} />
                </Field>

                <Field
                  label={(
                    <span className="flex items-center gap-2">
                      <span>Description</span>
                      <button
                        type="button"
                        onClick={() => setDescriptionHelpOpen(true)}
                        title="Help"
                        className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-600 transition hover:text-zinc-300"
                        aria-label="Service description help"
                      >
                        <Lightbulb className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={toggleMagicDescription}
                        title={magicDescriptionEnabled ? 'Hide example' : 'Show example'}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${
                          magicDescriptionEnabled
                            ? 'bg-white/[0.05] text-white shadow-[0_0_6px_rgba(255,255,255,0.10)]'
                            : 'text-zinc-600 hover:text-zinc-300'
                        }`}
                        aria-pressed={magicDescriptionEnabled}
                        aria-label="Use suggested service description"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                >
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setDescriptionEditorOpen(true)}
                      className="absolute right-7 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-[#0b0b0b]/90 text-zinc-600 transition hover:border-white/[0.12] hover:text-zinc-300"
                      aria-label="Enlarge service description"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                    <textarea
                      value={draft.description}
                      onChange={(e) => setDraftValue('description', e.target.value)}
                      placeholder="Describe what this service includes and what customers should expect."
                      rows={5}
                      className={`${fieldClass} h-[168px] resize-none py-4 pr-16 leading-6`}
                    />
                  </div>
                </Field>

                <Field label="Price">
                  <input type="text" inputMode="decimal" value={draft.price_min} onChange={(e) => setDraftValue('price_min', formatCurrencyInput(e.target.value))} placeholder="e.g., 49.99" className={fieldClass} />
                </Field>
              </div>
            </div>

          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/[0.05] px-6 py-5">
          <button type="button" onClick={onClose} className="h-11 rounded-full px-8 text-sm font-normal text-zinc-500 transition hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={!draft.name.trim()}
            className="flex h-11 min-w-[170px] items-center justify-center gap-2 rounded-full bg-white px-8 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            <span>Save service</span>
          </button>
        </div>
      </motion.section>
      <AnimatePresence>
        {descriptionEditorOpen ? (
          <motion.div
            className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setDescriptionEditorOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-[760px] overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#070707] shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] px-6 py-5">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">Service description</p>
                  <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">Edit full description</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDescriptionEditorOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-600 transition hover:text-white"
                  aria-label="Close description editor"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6">
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraftValue('description', event.target.value)}
                  placeholder="Describe what this service includes and what customers should expect."
                  autoFocus
                  className={`${fieldClass} h-[420px] resize-none py-4 leading-6`}
                />
              </div>
              <div className="flex items-center justify-end border-t border-white/[0.05] px-6 py-5">
                <button
                  type="button"
                  onClick={() => setDescriptionEditorOpen(false)}
                  className="h-11 rounded-full bg-white px-8 text-sm font-bold text-black transition hover:bg-zinc-200"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {serviceDetailsHelpOpen ? (
          <InfoModal
            zIndexClass="z-[1300]"
            dense
            title="Billing units"
            intro="Use this to tell your receptionist how the service is normally priced or discussed when customers ask about cost."
            points={[
              {
                title: 'Session.',
                body: 'Each appointment or visit has its own price.',
              },
              {
                title: 'Hourly.',
                body: 'Price is based on the amount of time worked.',
              },
              {
                title: 'Weekly.',
                body: 'Price is charged per week.',
              },
              {
                title: 'Monthly.',
                body: 'Price is charged per month.',
              },
              {
                title: 'Yearly.',
                body: 'Price is charged per year.',
              },
            ]}
            onClose={() => setServiceDetailsHelpOpen(false)}
          />
        ) : null}

        {descriptionHelpOpen ? (
          <InfoModal
            zIndexClass="z-[1300]"
            title="Write a useful service description"
            intro="A good description helps your receptionist understand when this service fits, how to answer questions about it, and what next step to recommend."
            points={[
              {
                title: 'Focus on fit.',
                body: 'Explain what the service is for, when someone needs it, and what outcome they can expect.',
              },
              {
                title: 'Stay concise.',
                body: 'One clear paragraph is usually enough. Pricing and billing details live in their own fields.',
              },
              {
                title: 'Example:',
                body: exampleService.serviceDescription(exampleService.serviceName).split('\n\n')[0].replace('Service overview:\n', ''),
              },
            ]}
            footer="Keep it practical: what it is, when it applies, and anything else your receptionist should know about it."
            onClose={() => setDescriptionHelpOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
};

const Onboarding2Page = () => {
  const navigate = useNavigate();
  const { session, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [showFinalSplash, setShowFinalSplash] = useState(false);
  const [finalSaveStatus, setFinalSaveStatus] = useState('idle');
  const [splashFinished, setSplashFinished] = useState(false);
  const saveQueueRef = useRef(Promise.resolve());
  const hasLaunchedRef = useRef(false);
  const complete = false;
  const [submitError, setSubmitError] = useState('');
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [industryPickerOpen, setIndustryPickerOpen] = useState(false);
  const [industrySearch, setIndustrySearch] = useState('');
  const [scheduleHelpOpen, setScheduleHelpOpen] = useState(false);
  const [contextHelpOpen, setContextHelpOpen] = useState(false);
  const [policiesHelpOpen, setPoliciesHelpOpen] = useState(false);
  const [servicesHelpOpen, setServicesHelpOpen] = useState(false);
  const [lateHoursTermsOpen, setLateHoursTermsOpen] = useState(false);
  const [lateHoursTermsSaving, setLateHoursTermsSaving] = useState(false);
  const [localLateHoursTerms, setLocalLateHoursTerms] = useState(() => readStoredOutboundLateHoursTerms());
  const [scheduleColorblindMode, setScheduleColorblindMode] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [faqExampleIndex, setFaqExampleIndex] = useState(0);
  const businessBriefEditorRef = useRef(null);
  const [form, setForm] = useState({
    businessName: '',
    industry: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    hours: createDefaultSchedule(),
    about: '',
    policies: policiesTemplate,
    faq: faqTemplate,
    services: [],
  });

  useEffect(() => {
    setForm((prev) => {
      const currentExample = getIndustryExample(prev.industry || 'Home Services');
      const about = legacyNamedAboutExamples.includes(prev.about)
        ? currentExample.about
        : prev.about.startsWith(removedAboutIntro)
        ? currentExample.about
        : prev.about;
      const policies = prev.policies.startsWith(removedPoliciesIntro)
        ? prev.policies.slice(removedPoliciesIntro.length)
        : prev.policies;
      const faq = prev.faq.startsWith(removedFaqIntro)
        ? prev.faq.slice(removedFaqIntro.length)
        : prev.faq;
      if (about === prev.about && policies === prev.policies && faq === prev.faq) return prev;
      return { ...prev, about, policies, faq };
    });
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    axios.post(`${API_BASE_URL}/users/me/onboarding/prepare`, null, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch((error) => {
      console.error("Onboarding2Page.jsx:event_2277");
      setSubmitError('Could not prepare your setup. Please refresh and try again.');
    });
  }, [session?.access_token]);

  const progress = ((step + 1) / steps.length) * 100;
  const current = steps[step];
  const stepLabel = current.id.charAt(0).toUpperCase() + current.id.slice(1);
  const businessName = form.businessName.trim();
  const businessPossessive = possessiveName(businessName);
  const normalizedIndustrySearch = industrySearch.trim().toLowerCase();
  const filteredIndustryGroups = industryGroups
    .map((group) => ({
      ...group,
      industries: group.industries.filter((industry) => industry.toLowerCase().includes(normalizedIndustrySearch)),
    }))
    .filter((group) => group.industries.length > 0);
  const currentTitle = current.id === 'contact'
    ? 'Set business details'
    : current.title;
  const currentDescription = current.id === 'contact'
    ? `Add the details for ${businessName || 'your business'}. You can always update them later.`
    : current.id === 'operations'
    ? `Set when ${businessName || 'the business'} is open, when your receptionist should answer inbound calls, and when outbound calls can be made. Drag a bar to move a schedule, or drag either end to adjust its start and end time.`
    : current.id === 'context'
    ? `Write a practical business brief that helps the AI understand ${businessName || 'the company'}, how it operates, what makes it distinct, and why customers choose it.`
    : current.description;
  const businessBriefSections = useMemo(() => getBusinessBriefSections(form.industry), [form.industry]);
  const faqExamples = useMemo(() => getFaqExamples(form.industry || 'Home Services'), [form.industry]);
  const activeScheduleLayerTypes = useMemo(() => getScheduleLayerTypes(scheduleColorblindMode), [scheduleColorblindMode]);
  const outboundLateHoursAccepted = hasAcceptedOutboundLateHoursTerms(profile) || localLateHoursTerms?.accepted === true;
  const termsOfServiceForOnboarding = useMemo(() => {
    if (hasAcceptedOutboundLateHoursTerms(profile)) return profile.terms_of_service;
    if (!localLateHoursTerms?.accepted) return profile?.terms_of_service || {};
    return {
      ...(profile?.terms_of_service || {}),
      [OUTBOUND_LATE_HOURS_TERMS_KEY]: localLateHoursTerms,
    };
  }, [localLateHoursTerms, profile]);

  const update = (key, value) => {
    if (key === 'industry') setFaqExampleIndex(0);
    setForm((prev) => {
      if (key === 'about' || key === 'policies' || key === 'faq') return { ...prev, [key]: limitLongText(value) };
      if (key !== 'industry') return { ...prev, [key]: value };
      const example = getIndustryExample(value);
      const shouldReplaceAbout = allIndustryExampleValues('about').includes(prev.about) || legacyNamedAboutExamples.includes(prev.about);
      const shouldReplacePolicies = allIndustryExampleValues('policies').includes(prev.policies);
      const shouldReplaceFaq = allIndustryExampleValues('faq').includes(prev.faq);
      const nextBusinessBriefSections = getBusinessBriefSections(value);
      const nextServices = prev.services.map((service) => {
        if (!allServiceDescriptionExamples().includes(service.description)) return service;
        return {
          ...service,
          name: service.name || example.serviceName,
          description: example.serviceDescription(service.name || example.serviceName),
        };
      });
      return {
        ...prev,
        industry: value,
        about: shouldReplaceAbout ? example.about : refreshGeneratedBusinessBriefSections(prev.about, nextBusinessBriefSections),
        policies: shouldReplacePolicies ? '' : prev.policies,
        faq: shouldReplaceFaq ? '' : prev.faq,
        services: nextServices,
      };
    });
  };

  const toggleBusinessBriefSection = (section) => {
    const isActive = hasBusinessBriefSection(form.about, section);
    const currentSectionText = getBusinessBriefSectionText(form.about, section, allBusinessBriefSections());
    const isStaleGeneratedSection = isActive
      && isGeneratedBusinessBriefSection(currentSectionText, section)
      && currentSectionText !== section.template;
    const nextAbout = isStaleGeneratedSection
      ? replaceBusinessBriefSection(form.about, section, businessBriefSections)
      : isActive
      ? removeBusinessBriefSection(form.about, section, businessBriefSections)
      : [form.about.trim(), buildBusinessBriefSection(section)].filter(Boolean).join('\n\n');
    update('about', nextAbout);
    requestAnimationFrame(() => {
      const editor = businessBriefEditorRef.current;
      if (!editor) return;
      editor.scrollTo({ top: editor.scrollHeight, behavior: 'smooth' });
    });
  };

  const showFullBusinessBrief = () => {
    update('about', buildFullBusinessBrief(businessBriefSections));
  };

  const addFaqQuestion = () => {
    const block = 'Q: \nA: ';
    const currentFaq = form.faq.trimEnd();
    const nextFaq = currentFaq ? `${currentFaq}\n\n${block}` : block;
    update('faq', nextFaq);
  };

  const addFaqExample = () => {
    if (!faqExamples.length) return;
    const example = faqExamples[faqExampleIndex % faqExamples.length];
    const nextFaq = [form.faq.trim(), example].filter(Boolean).join('\n\n');
    update('faq', nextFaq);
    setFaqExampleIndex((currentIndex) => (currentIndex + 1) % faqExamples.length);
  };

  const removeService = (serviceId) => {
    setForm((prev) => ({ ...prev, services: prev.services.filter((service) => service.id !== serviceId) }));
  };

  const openCreateServiceModal = () => {
    setEditingService(null);
    setServiceModalOpen(true);
  };

  const openEditServiceModal = (service) => {
    setEditingService(service);
    setServiceModalOpen(true);
  };

  const saveService = (serviceDraft) => {
    const normalized = {
      ...serviceDraft,
      name: serviceDraft.name.trim(),
      description: serviceDraft.description.trim(),
      category: serviceDraft.category || 'General',
      price_type: 'fixed',
      unit: serviceDraft.unit === 'per session' ? 'session' : serviceDraft.unit || 'session',
      price_min: serviceDraft.price_min,
      price_max: '',
      is_active: serviceDraft.is_active !== false,
    };

    if (!normalized.name) return;

    setForm((prev) => {
      const exists = prev.services.some((service) => service.id === normalized.id);
      return {
        ...prev,
        services: exists
          ? prev.services.map((service) => (service.id === normalized.id ? normalized : service))
          : [...prev.services, normalized],
      };
    });
    setServiceModalOpen(false);
    setEditingService(null);
  };

  const canContinue = useMemo(() => {
    if (step === 0) return form.businessName.trim();
    if (step === 1) return isEmailComplete(form.email) && (form.email.trim() || form.phone.trim() || form.street.trim() || form.city.trim() || form.state.trim() || form.zip.trim());
    if (step === 3) return String(form.about || '').length < LONG_TEXT_LIMIT;
    if (step === 4) return String(form.policies || '').length < LONG_TEXT_LIMIT;
    return true;
  }, [form, step]);

  const normalizedServices = useMemo(() => (
    form.services
      .map((service) => {
        const priceMin = service.price_min === '' ? null : Number(service.price_min);
        const priceMax = service.price_max === '' ? null : Number(service.price_max);
        return {
          name: String(service.name || '').trim(),
          description: String(service.description || '').trim(),
          category: String(service.category || '').trim() || 'General',
          unit: String(service.unit || '').trim(),
          price_type: service.price_type || 'fixed',
          price_min: Number.isFinite(priceMin) ? priceMin : null,
          price_max: Number.isFinite(priceMax) ? priceMax : null,
          is_active: service.is_active !== false,
        };
      })
      .filter((service) => service.name)
  ), [form.services]);

  const servicesSummary = normalizedServices
    .map((service) => {
      const price = service.price_type === 'quote'
        ? 'Quote required'
        : service.price_type === 'free'
          ? 'Free'
        : service.price_type === 'range'
          ? `$${service.price_min || 0} - $${service.price_max || 0}${service.unit ? ` / ${service.unit}` : ''}`
          : service.price_min
            ? `$${service.price_min}${service.unit ? ` / ${service.unit}` : ''}`
            : 'Price not set';
      return `${service.name}\nPricing: ${price}\n${service.description}`.trim();
    })
    .join('\n\n');

  const buildOnboardingPayload = (markOnboarded = false) => ({
    business_name: form.businessName.trim(),
    industry: form.industry,
    sub_industry: null,
    business_email: form.email.trim() || null,
    business_phone: form.phone.trim() || null,
    business_street: form.street.trim() || null,
    business_city: form.city.trim() || null,
    business_state: form.state.trim() || null,
    business_zip: form.zip.trim() || null,
    business_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    about_company: [form.about.trim(), servicesSummary ? `Services:\n${servicesSummary}` : ''].filter(Boolean).join('\n\n'),
    policies: form.policies.trim(),
    faq: form.faq.trim(),
    business_hours: cleanScheduleForStorage(form.hours),
    appointment_settings: {},
    terms_of_service: termsOfServiceForOnboarding,
    services: normalizedServices,
    mark_onboarded: markOnboarded,
  });

  const saveCurrentStep = async (markOnboarded = false) => {
    if (!session?.access_token) {
      setSubmitError('Your session expired. Please sign in again to finish setup.');
      return false;
    }

    try {
      await axios.post(`${API_BASE_URL}/users/me/onboarding`, buildOnboardingPayload(markOnboarded), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      localStorage.removeItem('sonar-onboarding2-draft'); // Draft is already saved to the authorized backend.
      return true;
    } catch (error) {
      console.error("Onboarding2Page.jsx:event_2502");
      setSubmitError(error.response?.data?.detail || 'Could not save onboarding. Please try again.');
      return false;
    }
  };

  const queueSave = (markOnboarded = false) => {
    const savePromise = saveQueueRef.current
      .catch(() => {})
      .then(() => saveCurrentStep(markOnboarded));
    saveQueueRef.current = savePromise;
    return savePromise;
  };

  const handleNext = async () => {
    if (!canContinue) return;
    setSubmitError('');
    if (step === 2 && !outboundLateHoursAccepted && scheduleHasOutboundLateHours(form.hours)) {
      setLateHoursTermsOpen(true);
      return;
    }

    if (step < steps.length - 1) {
      setStep((prev) => prev + 1);
      void queueSave(step === 0);
      return;
    }

    setFinalSaveStatus('saving');
    setShowFinalSplash(true);
    void queueSave(true).then((saved) => {
      setFinalSaveStatus(saved ? 'ready' : 'error');
    });
  };

  const handleBack = () => {
    if (step > 0) setStep((prev) => prev - 1);
  };

  const handleSkip = async () => {
    setSubmitError('');
    if (step === 2 && !outboundLateHoursAccepted && scheduleHasOutboundLateHours(form.hours)) {
      setLateHoursTermsOpen(true);
      return;
    }

    if (step < steps.length - 1) {
      setStep((prev) => prev + 1);
      void queueSave(false);
    } else {
      setFinalSaveStatus('saving');
      setShowFinalSplash(true);
      void queueSave(false).then((saved) => {
        setFinalSaveStatus(saved ? 'ready' : 'error');
      });
    }
  };

  const finishFinalSplash = useCallback(() => {
    setSplashFinished(true);
  }, []);

  useEffect(() => {
    if (!showFinalSplash || !splashFinished || finalSaveStatus !== 'ready' || hasLaunchedRef.current) return;
    hasLaunchedRef.current = true;
    let isCurrent = true;
    void Promise.resolve(refreshProfile?.()).then(() => {
      if (isCurrent) navigate('/dashboard/receptionists', { replace: true });
    });
    return () => {
      isCurrent = false;
    };
  }, [finalSaveStatus, navigate, refreshProfile, showFinalSplash, splashFinished]);

  useEffect(() => {
    if (showFinalSplash && finalSaveStatus === 'error') {
      setShowFinalSplash(false);
      setSplashFinished(false);
    }
  }, [finalSaveStatus, showFinalSplash]);

  const handleLaunch = () => {
    navigate('/dashboard/receptionists');
  };

  const acceptOutboundLateHoursTerms = async () => {
    setLateHoursTermsSaving(true);
    const acceptedTerms = {
      accepted: true,
      accepted_at: new Date().toISOString(),
      version: 1,
    };
    try {
      localStorage.setItem(OUTBOUND_LATE_HOURS_TERMS_STORAGE_KEY, JSON.stringify(acceptedTerms));
      setLocalLateHoursTerms(acceptedTerms);
      setLateHoursTermsOpen(false);
    } catch (error) {
      console.error("Onboarding2Page.jsx:event_2599");
      setSubmitError('Could not save that acknowledgment. Please try again.');
    } finally {
      setLateHoursTermsSaving(false);
    }
  };

  return (
    <div className="onboarding-setup min-h-screen bg-black text-white antialiased selection:bg-zinc-800 [color-scheme:dark]">
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        textarea:-webkit-autofill,
        textarea:-webkit-autofill:hover,
        textarea:-webkit-autofill:focus {
          -webkit-text-fill-color: #f5f5f5;
          -webkit-box-shadow: 0 0 0px 1000px #111 inset;
          transition: background-color 9999s ease-in-out 0s;
          caret-color: #f5f5f5;
        }

        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(1) opacity(0.55);
        }

        .onboarding-setup input,
        .onboarding-setup textarea,
        .onboarding-setup input:focus,
        .onboarding-setup input:focus-visible,
        .onboarding-setup textarea:focus,
        .onboarding-setup textarea:focus-visible {
          outline: none !important;
          outline-width: 0 !important;
          outline-style: none !important;
          box-shadow: none !important;
        }

        @keyframes outbound-notice-spectrum-run {
          from {
            background-position: 0% center;
          }
          to {
            background-position: 200% center;
          }
        }

        .outbound-notice-gradient {
          background-image: linear-gradient(90deg, var(--brandGradientStart), var(--brandGradientEnd), var(--brandGradientStart));
          background-size: 200% 100%;
          background-position: 0% center;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: outbound-notice-spectrum-run 1.2s ease-out 1;
        }

        .business-brief-placeholder-highlight {
          color: #8e8e98;
        }

        .business-brief-placeholder-edited {
          color: #fff;
        }

      `}</style>

      <div className="mx-auto flex min-h-screen w-full items-center justify-center px-5 py-3 sm:px-8 lg:px-10">
        <section className={showFinalSplash
          ? 'relative w-full max-w-none bg-transparent shadow-none'
          : `relative max-h-[calc(100vh-20px)] w-full ${step === 2 ? 'max-w-[1120px]' : 'max-w-[960px]'} overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/95 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl`}>
          <div className="pointer-events-none absolute left-1/2 top-[-260px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/[0.035] blur-[90px]" />

          <main className="relative flex max-h-[calc(100vh-20px)] min-h-[740px] flex-col overflow-auto p-6 sm:p-8">
            {!showFinalSplash ? (
              <div className="mb-6 flex items-center justify-between gap-5">
                <div className="flex h-4 items-center gap-3">
                  <p className="shrink-0 text-[13px] font-normal leading-4 text-zinc-300">
                    {stepLabel} · {step + 1} of {steps.length}
                  </p>
                  <div className="h-1 w-[190px] shrink-0 translate-y-0 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full brand-gradient transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                {step > 0 && step < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="shrink-0 text-[13px] font-normal text-zinc-600 transition hover:text-zinc-300"
                  >
                    Skip for now
                  </button>
                ) : <div className="h-4 w-[78px]" />}
              </div>
            ) : null}

            <div className="flex flex-1 items-stretch py-0">
              <div className="flex w-full">
                {showFinalSplash ? (
                  <SplashScreenAlternate label="Workspace" onAnimationEnd={finishFinalSplash} />
                ) : complete ? (
                  <div className="mx-auto w-full max-w-3xl space-y-8">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                      <Check className="h-6 w-6" />
                    </div>

                    <div>
                      <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                        {form.businessName || 'Your workspace'} is ready.
                      </h1>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
                        You now have a cleaner starting point for Nodemere, with your business basics, call hours, appointment defaults, and receptionist context captured.
                      </p>
                    </div>

                    <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.035] p-5">
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-5">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-bold text-black">
                            {(form.businessName || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-white">{form.businessName || 'Nodemere Workspace'}</div>
                            <div className="text-xs text-zinc-600">{form.industry || 'Business'} setup saved</div>
                          </div>
                        </div>
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                          Active
                        </span>
                      </div>

                      <div className="grid gap-4 pt-5 text-xs sm:grid-cols-2">
                        <div>
                          <span className="mb-1 block text-zinc-600">Contact</span>
                          <span className="font-medium text-zinc-300">{form.phone || form.email || 'To be added'}</span>
                        </div>
                        <div>
                          <span className="mb-1 block text-zinc-600">Scheduling</span>
                          <span className="font-medium text-zinc-300">Custom schedule configured</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLaunch}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 active:scale-[0.98]"
                    >
                      <span>Open Dashboard</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={current.id}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -18 }}
                      transition={{ duration: 0.18 }}
                      className="mx-auto flex min-h-[620px] w-full flex-col"
                    >
                      <div className="mb-6">
                        <div className="flex items-start gap-2.5">
                          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{currentTitle}</h1>
                          {step === 2 ? (
                            <button
                              type="button"
                              onClick={() => setScheduleHelpOpen(true)}
                              className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center text-zinc-600 transition hover:text-zinc-300"
                              aria-label="Schedule help"
                            >
                              <Lightbulb className="h-4 w-4" />
                            </button>
                          ) : null}
                          {step === 3 ? (
                            <button
                              type="button"
                              onClick={() => setContextHelpOpen(true)}
                              className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center text-zinc-600 transition hover:text-zinc-300"
                              aria-label="Context help"
                            >
                              <Lightbulb className="h-4 w-4" />
                            </button>
                          ) : null}
                          {step === 4 ? (
                            <button
                              type="button"
                              onClick={() => setPoliciesHelpOpen(true)}
                              className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center text-zinc-600 transition hover:text-zinc-300"
                              aria-label="Policies help"
                            >
                              <Lightbulb className="h-4 w-4" />
                            </button>
                          ) : null}
                          {step === 6 ? (
                            <button
                              type="button"
                              onClick={() => setServicesHelpOpen(true)}
                              className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center text-zinc-600 transition hover:text-zinc-300"
                              aria-label="Services help"
                            >
                              <Lightbulb className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500 sm:text-base">{currentDescription}</p>
                      </div>

                      <div className="flex-1">
                        {step === 0 ? (
                          <div className="space-y-6">
                            <Field label="Business name" hint="">
                              <div className="relative">
                                <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                                <input
                                  type="text"
                                  value={form.businessName}
                                  onChange={(e) => update('businessName', formatBusinessNameInput(e.target.value))}
                                  placeholder="e.g., Your business name"
                                  autoFocus
                                  className={`${fieldClass} pl-12`}
                                />
                              </div>
                            </Field>

                            <Field label="Industry" hint="Choose the closest fit. This helps shape smarter defaults.">
                              <div className="relative">
                                <div className={`relative flex h-12 items-center rounded-2xl border bg-white/[0.035] transition ${industryPickerOpen ? 'border-white/[0.18]' : 'border-white/[0.08]'}`}>
                                  <Search className="pointer-events-none absolute left-4 h-4 w-4 text-zinc-600" />
                                  <input
                                    type="text"
                                    value={industryPickerOpen ? industrySearch : form.industry}
                                    onFocus={() => {
                                      setIndustryPickerOpen(true);
                                      setIndustrySearch('');
                                    }}
                                    onBlur={() => setTimeout(() => setIndustryPickerOpen(false), 120)}
                                    onChange={(e) => {
                                      setIndustryPickerOpen(true);
                                      setIndustrySearch(e.target.value);
                                    }}
                                    placeholder="Search industries"
                                    className="h-full w-full bg-transparent pl-11 pr-12 text-sm font-medium text-white outline-none placeholder:text-zinc-600"
                                    aria-label="Search industries"
                                  />
                                  <ChevronDown className={`pointer-events-none absolute right-4 h-4 w-4 text-zinc-600 transition-transform ${industryPickerOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {industryPickerOpen ? (
                                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-[310px] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#111111] p-2 shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
                                    {filteredIndustryGroups.length ? filteredIndustryGroups.map((group) => (
                                      <div key={group.label} className="px-1 pb-2 last:pb-1">
                                        <p className="px-2 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">{group.label}</p>
                                        <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                                          {group.industries.map((industry) => (
                                            <button
                                              key={industry}
                                              type="button"
                                              onClick={() => {
                                                update('industry', industry);
                                                setIndustryPickerOpen(false);
                                                setIndustrySearch('');
                                              }}
                                              className={`flex min-h-9 items-center justify-between rounded-xl px-3 text-left text-sm transition ${form.industry === industry ? 'bg-white/[0.1] font-semibold text-white' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'}`}
                                            >
                                              <span>{industry}</span>
                                              {form.industry === industry ? <Check className="h-3.5 w-3.5 text-zinc-300" /> : null}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )) : (
                                      <p className="px-3 py-8 text-center text-sm text-zinc-600">No industries found</p>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </Field>
                          </div>
                        ) : null}

                        {step === 1 ? (
                        <div className="grid gap-5 sm:grid-cols-2">
                          <Field label="Business email">
                            <div className="relative">
                              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value.trim())} placeholder="hello@business.com" autoFocus className={`${fieldClass} pl-12 ${form.email && !isEmailComplete(form.email) ? 'border-rose-400/40' : ''}`} />
                            </div>
                          </Field>

                          <Field label="Phone number">
                            <div className="relative">
                              <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                              <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => update('phone', formatPhone(e.target.value))} placeholder="(555) 000-0000" className={`${fieldClass} pl-12`} />
                            </div>
                          </Field>

                          <Field label="Street address">
                            <div className="relative">
                              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                              <input type="text" value={form.street} onChange={(e) => update('street', e.target.value)} placeholder="123 Main Street" className={`${fieldClass} pl-12`} />
                            </div>
                          </Field>

                          <Field label="City">
                            <input type="text" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Portland" className={fieldClass} />
                          </Field>

                          <Field label="State">
                            <input type="text" value={form.state} onChange={(e) => update('state', formatState(e.target.value))} placeholder="ME" className={fieldClass} />
                          </Field>

                          <Field label="ZIP code">
                            <input type="text" inputMode="numeric" value={form.zip} onChange={(e) => update('zip', formatZip(e.target.value))} placeholder="04101" className={fieldClass} />
                          </Field>
                        </div>
                        ) : null}

                        {step === 2 ? (
                          <ScheduleTimeline
                            value={form.hours}
                            onChange={(hours) => update('hours', hours)}
                            colorblindMode={scheduleColorblindMode}
                            onColorblindModeChange={setScheduleColorblindMode}
                            outboundLateHoursAccepted={outboundLateHoursAccepted}
                            onOutboundLateHours={() => setLateHoursTermsOpen(true)}
                          />
                        ) : null}

                        {step === 3 ? (
                        <div className="space-y-3">
                          <div className="custom-scrollbar flex min-w-0 items-center overflow-x-auto pb-1" aria-label="Business brief sections">
                            <button
                              type="button"
                              aria-pressed={businessBriefSections.every((section) => hasBusinessBriefSection(form.about, section))}
                              onClick={showFullBusinessBrief}
                              className={`shrink-0 bg-transparent pr-3 text-[10px] font-semibold leading-[1.7] whitespace-nowrap transition ${businessBriefSections.every((section) => hasBusinessBriefSection(form.about, section))
                                ? 'text-white'
                                : 'text-zinc-500 hover:text-zinc-200'}`}
                            >
                              All
                            </button>
                            {businessBriefSections.map((section) => {
                              const active = hasBusinessBriefSection(form.about, section);
                              return (
                                <div key={section.id} className="flex shrink-0 items-center">
                                  <span className="h-3 w-px bg-white/[0.10]" />
                                  <button
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => toggleBusinessBriefSection(section)}
                                    className={`bg-transparent px-3 text-[10px] font-semibold leading-[1.7] whitespace-nowrap transition ${active
                                      ? 'text-white'
                                      : 'text-zinc-500 hover:text-zinc-200'}`}
                                  >
                                    {section.label}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <div className="relative">
                            <EditableBusinessBrief
                              editorRef={businessBriefEditorRef}
                              value={form.about}
                              onChange={(value) => update('about', value)}
                              maxLength={LONG_TEXT_LIMIT}
                            />
                            <CharacterLimitNotice value={form.about} />
                          </div>
                        </div>
                        ) : null}

                        {step === 4 ? (
                        <div className="relative">
                          <textarea
                            value={form.policies}
                            onChange={(e) => update('policies', e.target.value)}
                            placeholder={form.industry ? getIndustryExample(form.industry).policies : policiesPlaceholder}
                            maxLength={LONG_TEXT_LIMIT}
                            rows={9}
                            autoFocus
                            className={`${fieldClass} h-[499px] resize-none py-4 leading-6`}
                          />
                          <CharacterLimitNotice value={form.policies} />
                        </div>
                        ) : null}

                        {step === 5 ? (
                        <div className="space-y-3">
                          <div className="custom-scrollbar flex min-w-0 items-center overflow-x-auto pb-1" aria-label="Frequently asked questions actions">
                            <button
                              type="button"
                              onClick={addFaqQuestion}
                              disabled={form.faq.length >= LONG_TEXT_LIMIT}
                              className="shrink-0 bg-transparent pr-3 text-[10px] font-semibold leading-[1.7] whitespace-nowrap text-zinc-500 transition hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
                            >
                              Add new
                            </button>
                            <span className="h-3 w-px bg-white/[0.10]" />
                            <button
                              type="button"
                              onClick={addFaqExample}
                              disabled={!faqExamples.length || form.faq.length >= LONG_TEXT_LIMIT}
                              className="shrink-0 bg-transparent px-3 text-[10px] font-semibold leading-[1.7] whitespace-nowrap text-zinc-500 transition hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
                            >
                              Add example
                            </button>
                          </div>
                          <div className="relative">
                            <textarea
                              value={form.faq}
                              onChange={(e) => update('faq', e.target.value)}
                              placeholder={form.industry ? getIndustryExample(form.industry).faq : faqPlaceholder}
                              maxLength={LONG_TEXT_LIMIT}
                              rows={9}
                              autoFocus
                              className={`${fieldClass} h-[499px] resize-none py-4 leading-6`}
                            />
                            <CharacterLimitNotice value={form.faq} />
                          </div>
                        </div>
                        ) : null}

                        {step === 6 ? (
                        <div className="space-y-5">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-[12px] font-medium text-zinc-600">
                              {form.services.length} service{form.services.length === 1 ? '' : 's'} configured
                            </p>
                            <button
                              type="button"
                              onClick={openCreateServiceModal}
                              className="flex h-10 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-black transition hover:bg-zinc-200"
                            >
                              <span>Create service</span>
                            </button>
                          </div>

                          {form.services.length === 0 ? (
                            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/[0.08] bg-black/20 p-7 text-center">
                              <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">Add your first service</h3>
                              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
                                Add the services your business offers and the details your receptionist should know. You can always add or update services later.
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-hidden rounded-[22px] border border-white/[0.05] bg-black/10">
                              <div className="grid grid-cols-[minmax(0,1fr)_130px_72px] items-center gap-5 border-b border-white/[0.04] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-700 max-sm:hidden">
                                <div>Service</div>
                                <div>Price</div>
                                <div className="text-right">Actions</div>
                              </div>
                              <div className="custom-scrollbar max-h-[228px] divide-y divide-white/[0.035] overflow-y-auto">
                                {form.services.map((service) => (
                                  <div key={service.id} className="grid grid-cols-[minmax(0,1fr)_130px_72px] items-center gap-5 px-5 py-2.5 transition hover:bg-white/[0.018] max-sm:grid-cols-[minmax(0,1fr)_64px] max-sm:gap-3">
                                    <div className="flex min-w-0 items-center gap-3 leading-none">
                                      <span className="flex shrink-0 items-center truncate text-sm font-medium leading-none text-zinc-100">{service.name || 'Untitled service'}</span>
                                      {service.description ? (
                                        <span className="flex min-w-0 items-center truncate text-[11px] leading-none text-zinc-700">{service.description}</span>
                                      ) : null}
                                    </div>
                                    <div className="truncate text-xs text-zinc-500 max-sm:hidden">
                                      {formatServicePrice(service)}
                                    </div>
                                    <div className="flex items-center justify-end gap-1">
                                      <button type="button" onClick={() => openEditServiceModal(service)} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-700 transition hover:text-zinc-300" aria-label="Edit service">
                                        <Edit3 className="h-3.5 w-3.5" />
                                      </button>
                                      <button type="button" onClick={() => removeService(service.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-800 transition hover:text-rose-400" aria-label="Remove service">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        ) : null}

                        {submitError ? (
                          <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[12px] font-medium text-rose-300">
                            {submitError}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-auto flex flex-col items-center gap-3 pt-8">
                        <button
                          type="button"
                          onClick={handleNext}
                          disabled={!canContinue}
                          className="flex h-12 w-full max-w-[320px] items-center justify-center gap-2 rounded-full bg-white px-10 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <span>{step === steps.length - 1 ? 'Complete Setup' : 'Continue'}</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={handleBack}
                          disabled={step === 0}
                          className="flex h-11 w-full max-w-[320px] items-center justify-center gap-1 rounded-full px-10 text-sm font-normal text-zinc-500 transition hover:text-white disabled:pointer-events-none disabled:opacity-0"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span>Back</span>
                        </button>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>

          </main>
        </section>
      </div>

      <AnimatePresence>
        {lateHoursTermsOpen ? (
          <LateHoursTermsModal
            isSaving={lateHoursTermsSaving}
            onAccept={acceptOutboundLateHoursTerms}
            onClose={() => setLateHoursTermsOpen(false)}
          />
        ) : null}

        {serviceModalOpen ? (
          <ServiceModal
            industry={form.industry}
            initialService={editingService}
            onClose={() => {
              setServiceModalOpen(false);
              setEditingService(null);
            }}
            onSave={saveService}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {scheduleHelpOpen ? (
          <InfoModal
            maxWidthClass="max-w-[530px]"
            title="Scheduling help"
            intro="Adjust each schedule to match how your business operates and when you want your receptionist available. You can fine-tune these hours now and change them anytime as your needs change."
            points={activeScheduleLayerTypes.map((layer) => ({
              title: `${layer.label}.`,
              body: layer.id === 'business'
                ? 'Set when the business is generally open.'
                : layer.id === 'inbound'
                  ? 'Set when the receptionist should answer incoming calls.'
                  : 'Set when the receptionist can place follow-up or return calls.',
            }))}
            footer="Click a schedule track to enable or disable only that schedule for a day. Drag an entire colored bar to move a schedule, or drag either end to adjust its start and end time."
            onClose={() => setScheduleHelpOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {contextHelpOpen ? (
          <InfoModal
            title="Build a strong business brief"
            intro="Give your AI receptionist a clear understanding of the company, including its background, how it developed, what it is known for, where it operates, and what makes it distinct, so it can respond to customers with more confidence."
            points={[
              {
                title: 'Use real business details.',
                body: 'Include relevant information such as the founder, start year, early work, location history, community involvement, operating model, specialties, and current scale.',
              },
              {
                title: 'Keep it factual and informative.',
                body: 'Focus on useful company context rather than promotional language, sentiment, or generic descriptions.',
              },
              {
                title: 'Company-focused.',
                body: 'Detailed services, FAQs, and policies will be covered in the next section. Here, focus on the company itself and the details that define it.',
              },
            ]}
            footer="Your AI receptionist should come away knowing meaningful facts about this company that would not automatically be true of a typical competitor."
            onClose={() => setContextHelpOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {policiesHelpOpen ? (
          <InfoModal
            title="How policies work"
            intro="Policies are company-specific rules, restrictions, requirements, and operating boundaries that the AI could not reasonably know or infer on its own. They define how this particular business chooses to operate and may differ significantly from other businesses in the same industry."
            points={[
              {
                title: 'Use real operating rules.',
                body: 'Policies can cover service limitations, scheduling requirements, geographic restrictions, minimum requirements, qualification rules, pricing boundaries, approval requirements, exceptions, and other internal business rules.',
              },
              {
                title: 'Keep them company-specific.',
                body: 'A good policy should be something another legitimate business in the same industry could reasonably handle differently or even opposite.',
              },
              {
                title: 'Think like you are training a receptionist.',
                body: 'Include the important rules and guidelines they should follow when helping customers.',
              },
            ]}
            footer="Could another legitimate business in the same industry reasonably have a different or opposite policy? If not, it is probably a general rule or industry standard rather than a company policy."
            onClose={() => setPoliciesHelpOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {servicesHelpOpen ? (
          <InfoModal
            title="Adding services"
            intro="Use this section to list the specific services customers can ask about or book, along with the practical details your receptionist needs to explain each one accurately."
            points={[
              {
                title: 'Name services clearly.',
                body: 'Use the words customers would naturally use when asking for the service, appointment, consultation, visit, project, or product-related help.',
              },
              {
                title: 'Explain what each service includes.',
                body: 'Add the important details a receptionist would need to describe the service accurately, answer basic questions, and guide the customer to the right next step.',
              },
              {
                title: 'Include practical recommendations.',
                body: 'Mention when a service is usually recommended, who it is best suited for, and what information should be collected before booking or routing the request.',
              },
            ]}
            footer="A strong service entry should make it clear what the service is, who it is for, when to recommend it, and what the customer should do next."
            onClose={() => setServicesHelpOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default Onboarding2Page;

