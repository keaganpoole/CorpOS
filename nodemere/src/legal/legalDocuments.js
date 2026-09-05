export const LEGAL_EFFECTIVE_DATE = 'September 4, 2026';

export const LEGAL_ACCEPTANCE_KEY = 'nodemere_legal_acceptance_v2026_09_04';

export const LEGAL_ACCEPTANCE_VERSION = '2026-09-04';

export const hasCurrentLegalAcceptance = (profile) => (
  profile?.terms_of_service?.[LEGAL_ACCEPTANCE_KEY]?.accepted === true
  && profile?.terms_of_service?.[LEGAL_ACCEPTANCE_KEY]?.version === LEGAL_ACCEPTANCE_VERSION
);

export const LEGAL_DOCUMENTS = {
  terms: {
    title: 'Terms of Service',
    description: 'The agreement governing use of Nodemere by U.S. business customers.',
    content: `# Terms of Service

**Effective date: ${LEGAL_EFFECTIVE_DATE}**

These Terms of Service (the **Terms**) are a legally binding agreement between **Nodemere LLC**, a Maine limited liability company (**Nodemere**, **we**, **us**, or **our**), and the business, organization, or other legal entity accepting these Terms (**Customer**, **you**, or **your**). They govern access to and use of the Nodemere website, AI receptionist, calling, workflow, CRM, document, payment-integration, and related services (collectively, the **Service**).

By creating an account, clicking acceptance, connecting an integration, or using the Service, you represent that you are at least 18 years old and authorized to bind Customer. If you do not have that authority or do not agree, do not use the Service.

## 1. Business service and account responsibility

The Service is offered for U.S. business use. You must provide accurate account information, safeguard credentials, and promptly notify us of suspected unauthorized access. You are responsible for your users, your business settings, your Customer Data, and activity performed through your account. Do not share credentials.

You receive a limited, non-exclusive, non-transferable, revocable right to use the Service during a paid or authorized subscription term, subject to these Terms and the [Acceptable Use Policy](/acceptable-use-policy). Nodemere and its licensors retain all rights not expressly granted.

## 2. Customer Data and privacy

**Customer Data** means information you or your callers, contacts, employees, and integrations submit to or make available through the Service, including contact details, call audio, transcripts, documents, messages, prompts, calendar data, and payment-related metadata. You retain your rights in Customer Data. You authorize Nodemere to process Customer Data solely to provide, secure, support, troubleshoot, and improve the Service as described in these Terms, the [Privacy Policy](/privacy-policy), and, where applicable, the [Data Processing Addendum](/data-processing-addendum).

Nodemere does **not** use identifiable Customer Data, call recordings, transcripts, uploaded documents, or voice data to train generalized AI models by default. We may use aggregated or de-identified information to operate, secure, analyze, and improve the Service, provided it is not reasonably linkable to an identified person or Customer.

You represent that you have all rights, notices, permissions, and lawful bases needed to provide Customer Data to us and direct its processing. Standard Nodemere plans are approved for ordinary front-desk and business-administration workflows. They are not approved for automated handling of sensitive, confidential, regulated, protected, or account-specific information, or for workflows requiring identity verification, professional judgment, or access to protected records. Configure those requests to be handled by an authorized person. Broader use requires Nodemere's prior written approval and any required agreements or configuration.

## 3. AI, calls, recordings, and communications

The Service can use AI to answer or place calls, generate speech, transcribe and summarize conversations, send workflow-driven communications, and take actions from configured instructions. AI output may be inaccurate, incomplete, unsuitable, or unavailable. You must review and control your configurations and must not rely on the Service for emergency response, professional advice, or decisions with legal or similarly significant effects on a person.

You are solely responsible for each call, text, message, script, recipient list, recording, transcription, and workflow initiated for your business. Before enabling or using any such feature, you must:

- give legally sufficient notice that an AI system is participating where required or appropriate;
- obtain every required consent for calls, texts, recordings, transcriptions, payment requests, and automated or artificial-voice communications;
- honor do-not-call, opt-out, revocation, quiet-hour, caller-identification, and similar requirements;
- keep reliable evidence of consent and opt-outs; and
- comply with the TCPA, Telemarketing Sales Rule, CAN-SPAM Act, state call-recording and privacy laws, carrier rules, and all other applicable laws.

At launch, Nodemere does **not** authorize use of the Service for telemarketing, political messaging, debt collection, or marketing calls or texts. Availability of an outbound feature or a plan entitlement does not grant permission for those uses. Operational, transactional, and customer-service calls may be used only for contacts for whom you have documented, legally sufficient permission and only in accordance with applicable law. The [AI, Call Recording, and Communications Notice](/communications-notice) provides the current product disclosure and required opening language.

## 4. Payments and Connected Payment Providers

Where you connect a supported payment provider account, payments are processed through your connected account. Unless we separately agree in writing, **you are the merchant of record** for your goods or services and are responsible for the sale, fulfillment, customer support, refunds, chargebacks, payment disputes, taxes, receipts, disclosures, and compliance obligations relating to those transactions. Nodemere does not hold your sales proceeds and is not responsible for your customers' payment disputes or refunds.

Your relationship with the connected payment provider is governed by that provider's agreements and policies. The provider may assess processing fees, currency-conversion fees, reserves, negative balances, payout fees, dispute fees, or other amounts under its terms. If you connect Stripe, Stripe's agreements and policies also apply. Nodemere is not a payment processor and does not control a third-party provider's approval, settlement, reserves, holds, fees, or account decisions.

For eligible sales successfully generated through an AI receptionist and processed through a supported connected payment provider, Nodemere may charge a **1% platform fee**. An eligible sale is a transaction for the Customer's goods or services that is attributable to an AI receptionist interaction and successfully processed through the connected payment provider. The platform fee is calculated only on the eligible transaction amount, excluding separately stated taxes and tips. Refunded amounts and amounts subject to a payment dispute are excluded from the platform-fee calculation; if a fee was collected before a refund or dispute was recorded, Nodemere may reverse or credit the corresponding fee against a future amount due where reasonably practicable.

The platform fee is separate from all connected payment-provider fees and other third-party charges. Unless an order form or applicable pricing page states otherwise, the Customer authorizes Nodemere to collect the platform fee using the method disclosed for the applicable payment flow, which may include deduction from applicable transaction proceeds where supported, invoicing the Customer, or charging an authorized payment method associated with the Customer's account. The Customer remains responsible for maintaining valid payment information and paying all amounts when due.

The Customer is solely responsible for accurately configuring its services, prices, taxes, discounts, deposits, cancellation policies, refunds, and other sale terms; obtaining any required customer authorization; delivering the goods or services; issuing receipts and legally required disclosures; and resolving customer complaints, refunds, chargebacks, and disputes. The Customer must not use payment features for unlawful, deceptive, unauthorized, or prohibited transactions. Nodemere may withhold, suspend, or disable payment functionality for suspected fraud, unlawful activity, provider restrictions, unpaid fees, security concerns, or breach of these Terms.

Nodemere may change the platform-fee rate, eligibility rules, calculation method, collection method, or supported providers by updating the applicable pricing page, order form, or feature-specific notice. A material change will apply prospectively after reasonable notice, unless a different effective date is required by law or agreed in writing. Continued use of the payment features after the effective date constitutes acceptance of the updated fee terms.

## 5. Fees, subscriptions, and cancellation

You will pay applicable subscription and usage fees shown at purchase or in an order form. Subscriptions renew unless canceled before the next billing date. You may manage an available subscription through the Stripe billing portal or contact support@nodemere.ai. Fees are non-refundable except where required by law or expressly agreed in writing. You are responsible for taxes other than taxes based on Nodemere's net income.

## 6. Restricted uses

You must comply with the [Acceptable Use Policy](/acceptable-use-policy). Without Nodemere's prior written approval and any required addendum, you may not use standard-plan automation for restricted workflows involving sensitive, confidential, regulated, protected, or account-specific information; identity-dependent requests; professional judgment; or access to protected records. This restriction is based on the data and workflow, not the Customer's industry. You may not use the Service to deceive, impersonate, discriminate, harass, surveil unlawfully, infringe rights, send spam, evade consent requirements, or create a voice clone without the voice owner's documented authorization.

## 7. Confidentiality

Each party may receive the other party's non-public information. The receiving party will use it only to perform under these Terms and protect it using reasonable care. This obligation does not apply to information that is public without breach, independently developed, rightfully received without confidentiality duty, or required to be disclosed by law after legally permitted notice.

## 8. Third-party services

The Service may interoperate with third-party services, including Stripe, Twilio, ElevenLabs, Supabase, Google, and Microsoft. Your use of those services is governed by their terms and privacy notices. Nodemere is not responsible for third-party services or changes to them.

## 9. Suspension and termination

We may suspend or terminate access if we reasonably believe there is a security risk, legal violation, payment default, prohibited use, or material breach. You may stop using the Service at any time. On termination, your right to use the Service ends; Customer Data handling is described in the Privacy Policy and DPA, subject to legal retention needs.

## 10. Disclaimers

THE SERVICE IS PROVIDED **AS IS** AND **AS AVAILABLE**. TO THE MAXIMUM EXTENT PERMITTED BY LAW, NODEMERE DISCLAIMS ALL IMPLIED WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, AND UNINTERRUPTED OR ERROR-FREE OPERATION. NODEMERE DOES NOT PROVIDE LEGAL, MEDICAL, FINANCIAL, TAX, OR OTHER PROFESSIONAL ADVICE, AND DOES NOT GUARANTEE THAT YOUR USE WILL COMPLY WITH EVERY LAW OR INDUSTRY REQUIREMENT.

## 11. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, NODEMERE'S TOTAL LIABILITY ARISING OUT OF OR RELATING TO THE SERVICE OR THESE TERMS WILL NOT EXCEED THE FEES CUSTOMER PAID TO NODEMERE FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO LIABILITY. NODEMERE WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR LOST PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS INTERRUPTION.

## 12. Indemnification

You will defend, indemnify, and hold harmless Nodemere and its officers, directors, employees, and agents from claims, losses, liabilities, damages, and expenses arising from Customer Data, your use of the Service, your communications or payment activity, your violation of law or these Terms, or your products or services.

## 13. General terms

These Terms and the policies they incorporate are the entire agreement regarding the Service, unless a signed order form or enterprise agreement says otherwise. We may update these Terms prospectively by posting a revised version and providing notice where required; continued use after the effective date constitutes acceptance. These Terms are governed by Maine law, excluding conflict-of-law rules. Exclusive venue for any permitted court action is the state or federal courts located in Maine. If a provision is unenforceable, the remaining provisions remain effective. You may not assign these Terms without our consent; Nodemere may assign them in connection with a merger, acquisition, or sale of assets.

## 14. Contact

Questions, notices, and legal requests: **support@nodemere.ai**.`
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How Nodemere collects, uses, discloses, and protects personal information.',
    content: `# Privacy Policy

**Effective date: ${LEGAL_EFFECTIVE_DATE}**

Nodemere LLC (**Nodemere**, **we**, **us**, or **our**) provides AI receptionist and workflow software for U.S. businesses. This Privacy Policy explains how we process personal information on nodemere.ai, nodemere.io, and our Service.

## 1. Information we process

Depending on how the Service is used, we process:

- account and business information, such as name, business name, email, phone number, address, plan, and login records;
- contact and CRM data supplied by Customers, such as names, phone numbers, email addresses, appointment details, notes, consent status, and communications preferences;
- call and communication data, including numbers, call metadata, recordings, transcripts, summaries, AI-generated content, and messages;
- uploaded documents and verification information submitted through a Customer's workflow;
- voice-cloning information, including submitted voice samples, consent records, generated voice configuration, and related technical data, where the feature is used;
- payment-integration information, such as connected-account identifiers, customer and transaction identifiers, amounts, statuses, invoices, and refunds. Card numbers are processed by Stripe, not stored by Nodemere;
- integration data from services you connect, such as calendars and email accounts, to the extent you authorize access; and
- device, log, and website information, such as IP address, browser, timestamps, pages or features used, error information, and limited cookie preferences.

We collect information directly from you, from people who communicate with a Customer using the Service, automatically from the Service, and from integrations you authorize.

## 2. How we use information

We use personal information to provide and administer the Service; authenticate users; configure AI receptionists and workflows; process connected-account payment instructions; provide support; secure, debug, and prevent fraud or abuse; analyze service performance; comply with law; and enforce our agreements.

We do **not** use identifiable Customer Data, recordings, transcripts, uploaded documents, or voice data to train generalized AI models by default. We may use aggregated or de-identified information that is not reasonably linkable to an individual or Customer to improve reliability, security, and product performance.

## 3. How we disclose information

We disclose information only as needed to provide the Service, including with service providers and integrations selected by you. Depending on enabled features, these may include cloud hosting and database providers, telephony and messaging providers, AI and voice providers, payment processors, email and calendar providers, customer support providers, and professional advisers. We may also disclose information when required by law, to protect rights and safety, or in connection with a merger, financing, acquisition, or sale of assets.

We do not sell personal information or share it for cross-context behavioral advertising as those terms are defined by applicable U.S. privacy laws.

## 4. Calls, recordings, and Customer responsibility

Customers decide whether to enable calling, recording, transcription, and workflow features. A Customer is responsible for providing applicable notices and obtaining any required consent from its callers, contacts, employees, and representatives. If you call or communicate with a business using Nodemere, that business is generally the party directing the communication and should be your first contact for questions about it. Nodemere may assist its Customers in responding to applicable requests.

## 5. Retention

We retain information for as long as reasonably necessary to provide the Service, meet legal, accounting, security, dispute-resolution, and enforcement needs, and then delete or de-identify it. Retention can differ by data type and feature. We honor valid deletion requests subject to legal obligations, fraud-prevention needs, backup cycles, and data we must keep to document consent, transactions, or disputes. For a current account-data request, email support@nodemere.ai.

## 6. Security

We use administrative, technical, and organizational measures designed to protect personal information. No system is completely secure, and you should use unique credentials and protect your account. If we determine that a security incident requires notice, we will provide it as required by applicable law.

## 7. Your rights and choices

Depending on where you live and the nature of the information, you may have rights to request access, correction, deletion, portability, or information about our processing. You may also opt out of non-essential marketing from Nodemere by using the unsubscribe link or contacting us. To make a privacy request, email **support@nodemere.ai** with the subject line **Privacy Request**. We may need to verify your identity and authority. Authorized agents may submit requests where applicable.

California residents may have rights under the California Consumer Privacy Act, as amended. Nodemere does not sell or share personal information for cross-context behavioral advertising and therefore does not provide a separate sale/share opt-out at this time. We will not discriminate against a person for exercising applicable privacy rights.

## 8. Cookies

We use essential browser storage and limited functional cookies, including a source-preference cookie when you arrive through a designated campaign link. These support navigation and service configuration. We do not currently operate third-party advertising cookies on the public site. See the [Cookie Notice](/cookie-notice).

## 9. Children and international use

The Service is not directed to children under 18, and Customers may not knowingly use it to collect information from children without legal authorization. The Service is intended for U.S. use. If information is processed outside the United States by an authorized provider, we will use appropriate contractual and organizational safeguards where required.

## 10. Changes and contact

We may update this Policy to reflect changes in law, the Service, or our practices. We will post the revised version and update its effective date. Questions or privacy requests: **support@nodemere.ai**.`
  },
  acceptableUse: {
    title: 'Acceptable Use Policy',
    description: 'Launch restrictions and customer responsibilities for Nodemere.',
    content: `# Acceptable Use Policy

**Effective date: ${LEGAL_EFFECTIVE_DATE}**

This Acceptable Use Policy is part of the [Terms of Service](/terms). It applies to every Nodemere account, user, AI receptionist, workflow, communication, document, and integration.

## Allowed launch use

Nodemere standard plans are currently approved for ordinary U.S. business administration and customer-service use, such as answering inbound calls, general business questions, routine scheduling where permitted and where restricted information is not involved, status updates, appointment reminders, customer-requested follow-up, CRM updates, and sending secure document links. Use must remain within the Customer's lawful business purpose and documented instructions.

## You may not use Nodemere to

- violate law, third-party rights, carrier rules, or a person's privacy, publicity, or intellectual-property rights;
- deceive, impersonate a real person, generate misleading caller ID, misrepresent an AI as human, or make fraudulent payment, identity, or account requests;
- initiate telemarketing, marketing, political, fundraising, debt-collection, or lead-generation calls or texts at launch, including calls to numbers obtained from purchased or scraped lists;
- call or text a person without the notice, consent, opt-out handling, time-of-day controls, and proof of consent required by law; or fail to honor a do-not-call or other revocation request immediately;
- record, transcribe, monitor, or analyze a communication without all required notice and consent;
- submit another person's voice, likeness, recording, biometric information, or personal data without documented authority; or use a synthetic voice for deceptive impersonation;
- process payment credentials through the Service other than Stripe-hosted payment components and approved flows; or use payment features without clear sale terms and customer authorization;
- use the Service for emergency dispatch, 911, medical triage, suicide or crisis response, or any situation in which an error or delay could create a risk of death, bodily injury, or serious harm;
- use standard-plan automation to collect, disclose, retrieve, change, or decide based on sensitive, confidential, regulated, protected, or account-specific information, or to handle identity-dependent requests; route those requests to an authorized person unless Nodemere has separately approved the workflow in writing and all required agreements and controls are in place;
- make or assist with decisions about employment, housing, insurance, credit, education, healthcare, legal rights, benefits, or other high-impact matters;
- upload malware, exploit vulnerabilities, bypass access controls, probe systems, resell unauthorized access, or interfere with the Service; or
- use the Service to harass, threaten, discriminate against, exploit, or unlawfully surveil any person.

## Customer controls and proof

Before enabling automated communication, you must verify recipient data, maintain consent and opt-out evidence, use clear caller identification, test configurations, and monitor outcomes. Consent flags in Nodemere are evidence-management aids, not a substitute for obtaining legally valid consent. You must not mark a contact as consented unless you have the required proof.

Nodemere may investigate suspected misuse and suspend or remove content, workflows, voices, integrations, or accounts that create legal, security, safety, or reputational risk. We may report unlawful activity when appropriate.`
  },
  communications: {
    title: 'AI, Call Recording & Communications Notice',
    description: 'Important notice for customers, callers, and recipients of Nodemere-enabled communications.',
    content: `# AI, Call Recording & Communications Notice

**Effective date: ${LEGAL_EFFECTIVE_DATE}**

Nodemere provides software that businesses may configure to answer or place calls, use an AI-generated voice, transcribe and summarize conversations, send workflow-driven messages, and create secure document links. Nodemere itself is not the seller or service provider that a caller is contacting.

## Notice for callers and recipients

When a business uses Nodemere, you may interact with an **AI assistant rather than a human**. Subject to that business's configuration and applicable law, your call or communication may be monitored, recorded, transcribed, summarized, and used to provide the requested service, maintain business records, improve workflow quality, and protect security. If you do not consent where consent is required, tell the assistant or business representative and end the communication.

For questions about a specific call, message, payment, appointment, or business service, contact the business that contacted you. For a Nodemere privacy request, email support@nodemere.ai.

## Required Customer opening for outbound AI calls

Before making an outbound AI call, Customers must configure and preserve a clear opening that identifies the business, identifies the assistant as AI, states the purpose, and gives the recording/transcription notice when enabled. A compliant baseline is:

> “Hello, this is [assistant name], an AI assistant calling on behalf of [business name] about [specific service purpose]. This call may be recorded and transcribed. Is now an okay time to talk?”

Customers must adapt this opening for the applicable jurisdiction and use case, obtain any necessary consent before recording or continuing, and offer a reasonable route to a human or the business where appropriate. The opening is not a substitute for prior consent required for an automated, artificial-voice, prerecorded, marketing, or text communication.

## No telemarketing at launch

Nodemere does not authorize telemarketing, marketing, political, fundraising, or debt-collection calls or texts at launch. Customers may use only approved operational, transactional, and customer-service communications to contacts for whom they have documented lawful permission. An AI voice is treated as an artificial or prerecorded voice for U.S. TCPA purposes; customers must obtain the type of consent required for the call and comply with applicable federal, state, and carrier rules.

## Emergency and regulated use

Do not use Nodemere for 911, emergency dispatch, medical triage, crisis response, or any decision where an AI error could cause serious harm. Standard-plan automation is not authorized for restricted workflows involving sensitive, confidential, regulated, protected, or account-specific information, or identity-dependent requests, without Nodemere's prior written approval and the required agreements and controls.`
  },
  dpa: {
    title: 'Data Processing Addendum',
    description: 'Default U.S. business-to-business data-processing terms for Customers.',
    content: `# Data Processing Addendum

**Effective date: ${LEGAL_EFFECTIVE_DATE}**

This Data Processing Addendum (**DPA**) supplements the [Terms of Service](/terms) between Nodemere LLC (**Processor**) and the Customer accepting the Terms (**Controller**). It applies only when Processor processes Personal Data on Controller's behalf and to the extent required by applicable U.S. privacy law.

## 1. Roles and instructions

Controller determines the purposes and means of processing Customer Personal Data. Processor processes Customer Personal Data only on Controller's documented instructions, including the Terms, this DPA, and configurations made through the Service, unless applicable law requires otherwise. Controller is responsible for the lawfulness of its instructions, notices, consents, and collection and use of Customer Personal Data.

## 2. Processing details

**Subject matter and duration:** provision of the Service during the subscription term and a limited period afterward for deletion, security, backup, dispute-resolution, and legal needs.

**Nature and purpose:** hosting, storing, transmitting, organizing, retrieving, analyzing, transcribing, summarizing, securing, supporting, and otherwise processing Customer Personal Data to provide the Service and prevent abuse.

**Data subjects:** Controller's users, employees, customers, prospects, callers, message recipients, suppliers, and other persons whose information Controller submits or receives through the Service.

**Data categories:** account data, business and contact data, communications and call data, recordings, transcripts, documents, integration data, technical/log data, and payment-related identifiers and metadata. Customers may not submit special categories, regulated data, or protected health information unless expressly approved in writing.

## 3. Processor commitments

Processor will use reasonable technical and organizational measures appropriate to the risk; limit access to personnel and subprocessors with a need to know who are bound by confidentiality obligations; assist Controller with reasonable requests relating to rights requests, security incidents, and assessments to the extent required by law; and notify Controller without undue delay after confirming a Security Incident affecting Customer Personal Data.

## 4. Subprocessors

Controller authorizes Processor to use subprocessors to provide the Service. Current categories and feature-dependent providers are identified in the [Subprocessor Notice](/subprocessors). Processor will impose written data-protection obligations on subprocessors that are materially consistent with this DPA. Controller may object to a new subprocessor on reasonable data-protection grounds by contacting support@nodemere.ai; the parties will work in good faith on a reasonable solution, which may include discontinuing the affected feature.

## 5. Data subject requests and deletion

If Processor receives a request concerning Customer Personal Data, it will direct the requester to Controller where appropriate and assist Controller using the Service's available controls and reasonable support process. At the end of the Services, Processor will delete or return Customer Personal Data on Controller's documented request, unless retention is required by law, necessary for security or dispute resolution, or retained in backups until their normal rotation.

## 6. Security incident cooperation

Processor will investigate a confirmed Security Incident, take reasonable steps to contain and remediate it, and provide information reasonably available to help Controller meet its own notification obligations. Processor's notification is not an admission of fault or that a breach requiring notice occurred.

## 7. Audits and precedence

On reasonable written request no more than once per year, Processor will provide information reasonably necessary to demonstrate compliance with this DPA, subject to confidentiality and security restrictions. If this DPA conflicts with the Terms on processing of Customer Personal Data, this DPA controls. This DPA ends when Processor no longer processes Customer Personal Data, except provisions that by their nature survive.

This DPA is designed for Nodemere's general U.S. business launch. HIPAA, GLBA, FERPA, government, PCI, and international transfer requirements require separate review and, where applicable, a signed addendum before use.`
  },
  subprocessors: {
    title: 'Subprocessor Notice',
    description: 'Feature-dependent providers that may process Customer Data for Nodemere.',
    content: `# Subprocessor Notice

**Effective date: ${LEGAL_EFFECTIVE_DATE}**

Nodemere uses service providers to operate the Service. The providers that process Customer Data depend on the features a Customer enables. This notice describes the current categories of providers; Customers should also review the applicable provider terms before connecting an account.

- **Supabase:** database, authentication, and private storage; may process account, CRM, call-log, document, and application data.
- **Render:** application hosting and deployment; may process service and technical data handled by the hosted application.
- **Twilio:** phone numbers, call routing, caller ID, and telephony; may process communication metadata and call data.
- **ElevenLabs:** conversational AI, speech generation, and call processing; may process call audio, transcripts, AI instructions, voice configuration, and related metadata.
- **OpenAI:** AI services where enabled by Nodemere; may process prompts and limited service data supplied to that feature.
- **Stripe:** subscription billing and Customer-connected payment accounts; may process billing, connected-account, payment, invoice, refund, and transaction identifiers.
- **Google:** Customer-authorized Gmail and calendar integrations; may process authorized email and calendar data.
- **Microsoft:** Customer-authorized Outlook and calendar integrations; may process authorized email and calendar data.
- **Cloudflare CDN:** delivery of public website assets; may process technical request data, such as IP address and browser information.

Nodemere may add, replace, or remove subprocessors as the Service changes. We will maintain this notice and, where required by contract or law, provide advance notice of material changes. Questions or objections under the DPA: **support@nodemere.ai**.

Nodemere standard plans do not authorize restricted automated workflows involving sensitive, confidential, regulated, protected, or account-specific information. A provider appearing in this notice does not mean that provider has signed a business associate agreement, financial-services addendum, government agreement, or other industry-specific agreement required for a separately approved use case.`
  },
  cookies: {
    title: 'Cookie Notice',
    description: 'The limited browser storage and cookies used by Nodemere.',
    content: `# Cookie Notice

**Effective date: ${LEGAL_EFFECTIVE_DATE}**

Nodemere uses limited browser storage and cookies to operate the website and remember basic preferences. This notice supplements the [Privacy Policy](/privacy-policy).

## Cookies and storage we use

- **Essential session and security storage.** Our authentication and application providers use browser storage or cookies needed to sign in, keep a session active, protect the Service, and remember basic interface settings.
- **Source-preference cookie.** When a visitor arrives using a designated campaign source, Nodemere may store a first-party source cookie for up to 30 days to preserve the selected site or pricing experience.
- **Local interface preferences.** The application may store non-sensitive interface settings locally in the browser, such as dashboard layout, display, or acknowledgment preferences.

We do not currently operate third-party advertising cookies or sell or share personal information for cross-context behavioral advertising. If we introduce non-essential analytics or advertising technologies, we will update this notice and provide choices required by applicable law.

You can control or delete cookies through your browser settings. Blocking essential cookies or storage may prevent the Service from working correctly. For questions, email support@nodemere.ai.`
  },
};

export const LEGAL_NAVIGATION = [
  { to: '/terms', label: 'Terms' },
  { to: '/privacy-policy', label: 'Privacy' },
  { to: '/acceptable-use-policy', label: 'Acceptable Use' },
  { to: '/communications-notice', label: 'AI & Recording Notice' },
  { to: '/data-processing-addendum', label: 'DPA' },
  { to: '/subprocessors', label: 'Subprocessors' },
  { to: '/cookie-notice', label: 'Cookies' },
];
