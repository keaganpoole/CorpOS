# Nodemere U.S. Launch Compliance Operations

This is the operating checklist for Nodemere LLC's general U.S. business launch. It is not customer-facing and does not replace advice from counsel.

## Approved launch scope

- General U.S. business administration and customer service.
- Inbound AI receptionist calls, scheduling, operational follow-up, connected-account payments, and customer-requested document uploads.
- No telemarketing, marketing, political, fundraising, debt-collection, lead-generation, or SMS messaging at launch.
- Do not approve healthcare/PHI, financial/lending/credit, legal, insurance decisions, education records, government, emergency, employment, biometric, or other regulated/high-impact uses without counsel and required addenda.

## Required production configuration

- Apply `sql/2026_08_11_launch_privacy_security.sql` in Supabase before deploy.
- Set `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `NODEMERE_INTERNAL_TOOL_SECRET`, `ELEVENLABS_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`, `TWILIO_AUTH_TOKEN`, `TWILIO_VOICE_WEBHOOK_URL`, `FRONTEND_BASE_URL`, and `CORS_ORIGINS` in production. Do not use an anon key as the backend database key.
- Configure each ElevenLabs server tool with `x-nodemere-internal-secret`; confirm the provider permits the dynamic first-message override used for the AI/recording notice.
- Configure Twilio's voice and caller-ID callbacks to the exact HTTPS URLs in the corresponding environment variables. Confirm signature validation succeeds on a test call.
- Configure Stripe Connect for direct charges on the customer's connected account. Do not add `application_fee_amount` until a fee rate and customer disclosure are approved.
- Make `www.nodemere.ai` the canonical domain and redirect the other approved domain to it. Set the same production URL in Supabase OAuth redirect settings and all provider callback settings.

## Communication controls

- Before an outbound AI call, enter a true consent record: consent flag, source, timestamp, scope, and any applicable evidence reference. Nodemere will block a call without those fields or when Do Not Call is set.
- Configure and test the outbound opening: business identity, AI identity, call purpose, recording/transcription notice, and a reasonable opportunity to decline or reach a person.
- Configure and test the inbound opening before accepting live calls. If recording cannot be paused or disabled when a caller does not consent where required, do not deploy recording to that workflow or jurisdiction until counsel approves the design.
- Train support to immediately honor call/text opt-outs, record the request, and set the relevant Do Not Call or Do Not Text flag.
- Keep consent and opt-out evidence for at least five years unless counsel specifies a longer period. Preserve it through ordinary deletion requests when needed for legal claims or compliance.

## Recommended retention baseline

Apply the shortest period consistent with the business purpose, a customer contract, and applicable law. Until a configurable retention system exists, use these operational targets and document any exception:

| Data | Target |
| --- | --- |
| Raw call audio | 30 days |
| Transcripts, summaries, and call metadata | 12 months |
| Secure document uploads | 30 days after the workflow completes |
| CRM records and appointments | Customer subscription term, then 30 days for export/deletion processing |
| Security and access logs | 12 months |
| Consent, opt-out, payment, and dispute evidence | At least 5 years |
| Backups | 35-day rotation; deletion propagates when the backup expires |

## Privacy and security operations

- Use Nodemere customer data only to provide, secure, support, troubleshoot, and improve the Service. Do not use identifiable recordings, transcripts, documents, or voice data for generalized model training without a new, explicit customer choice and counsel review.
- Route access, correction, deletion, and privacy questions to support@nodemere.ai. Verify the requester's identity and authority; log the request, decision, and completion date.
- Maintain an incident register. Escalate any suspected unauthorized access, disclosure, or loss immediately; preserve evidence, contain access, assess affected data and jurisdictions, and involve counsel before notices are sent.
- Review every vendor's current data-processing/security terms before enabling it. Keep a signed DPA or equivalent where the vendor offers one, and retain the completed vendor review.
- Review user permissions quarterly. Revoke former staff and customer access promptly. Use unique administrator accounts and multifactor authentication where each provider supports it.

## Contract and payment operations

- Keep the current public Terms, Privacy Policy, Acceptable Use Policy, AI/Recording Notice, DPA, Cookie Notice, and Subprocessor Notice published from the production domain.
- Keep a versioned acceptance record for every account. Re-prompt users for a material legal change before continued dashboard use.
- For Stripe Connect direct charges, the connected business is merchant of record and handles fulfillment, refunds, chargebacks, taxes, and payment disputes. Nodemere does not take a transaction fee at launch.
- Do not collect payment-card information in prompts, notes, documents, call recordings, or CRM fields. Use Stripe-hosted payment collection only.

## Review cadence

- Monthly: provider status, webhook authentication, failed calls, complaint/opt-out reports, and access review exceptions.
- Quarterly: subprocessor list, privacy notices, incident drill, retention exceptions, and restricted-use enforcement.
- Before any feature launch or international expansion: legal/product/security review and an update to public disclosures, contracts, consent flows, and vendor terms as needed.
