# Nodemere healthcare-readiness checklist

Reviewed: September 4, 2026. Decision: **NO-GO for real PHI today; synthetic development and demonstrations may continue.**

This is a launch-gate checklist, not a certification, legal opinion, signed BAA, or authorization to deploy. No plans, agreements, provider settings, application code, database policies, or keys were changed during this review. Public vendor requirements were checked against official sources. Read-only ElevenLabs configuration requests and local configuration classification supplied the current observations below; secrets, prompts, email addresses, and customer records are omitted.

## 1. What is already proven

The [development acceptance report](security-phases5-7-development-acceptance.md) records Phases 5, 6, and 7 passing **locally**, including real development Supabase services. This review read that evidence; it did not rerun those tests or turn local acceptance into production sign-off.

| Area | Evidence and boundary |
| --- | --- |
| Phases 1–2 | Existing authentication, tenant/RLS, server-owned integration/payment routing and internal-tool protections remain the baseline. No billing-test-mode authentication bypass should be restored. |
| Phases 3–4 | Provisionally accepted by the owner. Native TOTP/AAL2, authorization, protected file access and data-minimization tests passed. Interactive Google OAuth and invitation delivery remain separate checks. |
| Phase 5 | Metadata-only, actor-attributed application audit; transactional change audit; native Supabase Auth audit persistence; ordinary clients cannot mutate audit records. This is not independent protection against a privileged database administrator. |
| Phase 6 | Server-side envelope encryption, scoped decryption, missing-key/tamper rejection, KEK rewrapping, DEK rotation, encrypted document/recording migration and playback tested. Keys are independent of passwords/PINs. Coverage is deliberately bounded below. |
| Phase 7 | Disabled-by-default bounded retention, legal holds, tenant separation, encrypted synthetic backup and restoration tested. Local Windows-account-bound recovery is not off-server production disaster recovery. |
| Recorded totals | 68 completed live-development checks; 235 regression tests; 46 grouped SQL assertions; 26-resource tenant fixture; 12 live catalog assertions; four dump/restore checks. These are distinct test groupings, not a newly executed grand total. |

Sources: [Phase 1](security-phase1.md), [Phases 2–4](security-phases2-4.md), [Phases 5–7 implementation](security-phases5-7.md), [local activation/acceptance](security-phases5-7-development-acceptance.md), [earlier provider acceptance limits](security-acceptance-gaps-2026-09-04.md). Earlier documents' statements that later phases were not started are historical; the development acceptance report and subsequent user approval supersede those sequencing statements, not the missing evidence itself.

### Encryption and retention limits must remain visible

Envelope coverage in `backend/protected_data.py` and the file services:

- `call_logs`: transcript text/JSON, call report, analysis results, conversation initiation data.
- `flow_executions`: flow context, pause data, trigger event.
- `integrations`: credentials, including access/refresh tokens.
- Private document bytes in `caller-documents` and recording bytes in `call_recordings`.

People demographics/notes/custom fields, appointment notes/custom fields, call-list summaries/search fields, document metadata, scenario definitions and other unmapped fields are **not application-envelope-encrypted**. They still depend on authorization, audit controls, TLS and platform encryption at rest. Existing historical plaintext rows/files have not all been migrated. Evaluate this explicitly in the risk assessment; it does not automatically justify encrypted search or a rewrite. Do not advertise “all PHI is application-encrypted.”

Current retention cleans eligible transient workflow/call payloads; it does **not** provide comprehensive lifecycle deletion of canonical clinical records, documents, transcripts or recordings. No live retention policy was left enabled. Choose the necessary policy and a controlled procedure before promising deletion timelines.

## 2. Final go/no-go gates

All applicable gates must have evidence attached before a doctor-office PHI pilot. “Unknown” is not “passed.” An optional feature may be excluded from the pilot instead of being rebuilt, but exclusion must actually prevent its use in that healthcare workflow, not merely hide its UI.

| ID / status | Required closure | Timing | Responsible party |
| --- | --- | --- | --- |
| G1 — BLOCKED | Execute customer and relevant subcontractor BAAs; confirm eligible accounts, services, regions and subprocessors; record the scope of each agreement. Update/approve Nodemere's healthcare terms and notices consistently. | Can begin now; before any PHI | Keagan + qualified legal/privacy reviewer + vendors |
| G2 — BLOCKED | Establish ElevenLabs HIPAA/ZRM configuration and an eligible model route; restrict Twilio to covered accounts/features/geographies; prove the complete call/webhook/human-transfer flow under those settings. | Vendor preparation now; final endpoint check at deployment | Keagan/vendor contacts + engineering |
| G3 — BLOCKED for PHI email/inbox use | Replace the consumer system sender for PHI-bearing delivery with a covered organizational service, or keep that delivery out of the pilot. Approve each connected business mailbox; minimize content and address Google scope verification. | Can close before deployment | Keagan + engineering + mailbox administrators |
| G4 — OPEN acceptance | Close Google OAuth→MFA and actual invitation receipt/acceptance. Prove the application payment/webhook flow if included; close telephony acceptance in G2. Keep unverified optional paths disabled. | Mostly possible now using synthetic data; repeat domain-dependent pieces when hosted | Engineering + controlled test participant |
| G5 — BLOCKED until launch setup | Production secrets, enforced controls, covered hosting, independent key recovery, automated DB **and object** backups, failure alerts, isolated restore and hosted acceptance. | Production-only final validation | Engineering + designated recovery custodian |
| G6 — OPEN operational/legal evidence | Approve a written risk assessment, minimum policies, retention/holds, access review, incident/continuity response and workforce training; define actual customer use and support boundaries. | Can close now; confirm effective controls at launch | Keagan/security lead + professional reviewer + pilot office |
| G7 — OPEN targeted release review | Resolve the narrowly identified external-asset/legacy-route exposure decisions; verify the exact release's dependencies, sessions, secrets, logging and clinical-data boundaries. No broad refactor required. | Before PHI; final network/build check at deployment | Engineering |

## 3. Vendor and data-processor requirements

Public documentation establishes eligibility requirements, **not** that Nodemere has a signed agreement or an enabled account. Except for the specific live observations, commercial and contractual status remains unverified. Keep an evidence register with vendor, account/project, covered product, region, BAA effective date, subprocessor list, required settings, evidence location, owner and review date. Do not put keys or patient examples in that register or vendor support tickets.

### Supabase — core PHI processor

Receives workforce identities, business/customer/appointment data, encrypted and non-envelope-covered columns, private files, audit events and Realtime changes. A signed BAA plus the HIPAA add-on is required. Configure the actual PHI project as High Compliance and satisfy its checks: PITR (at least Small compute), SSL enforcement, network restrictions and Postgres connection logging. Preserve RLS/private Storage independently. [Supabase HIPAA configuration](https://supabase.com/docs/guides/platform/hipaa-projects), [shared responsibilities](https://supabase.com/docs/guides/security/hipaa-compliance).

**Acceptance evidence needed:** agreement/account scope, High Compliance settings and resolved relevant Security Advisor findings. Neither passing `verify_phases2_4.sql` nor the development project's successful tests proves those commercial/configuration requirements. Supabase database backups do not include Storage object bytes; retain a separate object backup process. [Supabase backups](https://supabase.com/docs/guides/platform/backups).

### ElevenLabs — core audio/AI processor; confirmed configuration blocker

Receives live audio, prompts/context, tool inputs/results, extracted data, transcripts and generated speech. Its documented HIPAA route requires Enterprise, an executed BAA, ZRM and permitted model routing. Preconfigured eligible options are restricted; using another provider through Custom LLM requires a direct provider BAA, customer API credentials and ElevenLabs enablement. [ElevenLabs HIPAA requirements](https://elevenlabs.io/docs/eleven-agents/legal/hipaa).

Read-only GETs of the two configured development agents both returned HTTP 200:

| Safe setting | Inbound | Outbound |
| --- | --- | --- |
| Model | `gpt-5.1` | `gpt-5.1` |
| `zero_retention_mode` | `false` | `false` |
| `record_voice` | `true` | `true` |
| `retention_days` | `-1` | `-1` |
| `apply_to_existing_conversations` | `false` | `false` |

These are development settings, **not healthcare-cleared settings**. The current `gpt-5.1` route is not on the published preconfigured HIPAA list. Confirm the selected route with ElevenLabs; do not silently switch models or assume an OpenAI subscription covers this chain.

ZRM does not preserve provider-side transcripts/recordings for later retrieval. Use post-call webhooks for needed data; the existing `persist_elevenlabs_event` and `upload_call_recording` paths can be reused. Test delivery, failed delivery, duplicates/order, tenant binding, encryption and authorized playback under the actual healthcare configuration. [Per-agent ZRM](https://elevenlabs.io/docs/eleven-agents/customization/privacy/zrm), [webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks).

Keep PHI out of playground/UI tests, support tickets, voice-cloning samples and reusable knowledge-base uploads unless specifically covered: API ZRM is not blanket coverage for these surfaces. Use generic business information and licensed/consented non-patient voice assets. [ZRM scope and exclusions](https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode).

### Twilio — core telephony processor

Receives phone numbers, call routing/metadata, live media and possibly recordings. HIPAA Accounts require Security or Enterprise Edition, a BAA, and designation of the relevant accounts/subaccounts. Match the exact Voice/Media Streams/recording features against the eligible list. [Twilio HIPAA Accounts](https://www.twilio.com/docs/iam/twilio-editions/hippa), [eligible services](https://www.twilio.com/content/dam/twilio-com/global/en/other/hipaa/pdf/HIPAA-Eligible-Services.pdf).

The June 30, 2026 architecture guide limits HIPAA-eligible Voice traffic to/from US area codes and requires HTTP authentication for recording media if used. Follow HTTPS, media transport and SIP TLS/SRTP requirements where applicable. A private Supabase copy does not secure a separate Twilio recording. Confirm account designation, geographic routing, media access and recording settings; current account eligibility was not verified. [Twilio architecture guide](https://www.twilio.com/content/dam/twilio-com/global/en/other/hipaa/pdf/Architecting-for-HIPAA.pdf).

### Google Workspace / Gmail — active sender and optional connected inbox

System secure-link/invitation delivery uses Gmail (`backend/email_delivery_service.py`); connected Gmail can read and send message bodies (`backend/main.py`). The local system sender is configured on a **consumer Gmail domain**, verified without exposing the address. OAuth success is not proof of healthcare coverage.

For PHI-bearing organizational mail, use eligible Workspace functionality with its BAA and appropriate configuration; Gmail is included, but Google's BAA does not automatically cover Nodemere or other third-party apps. Keep messages generic, verify recipients and avoid clinical subjects/attachments. Even an appointment or upload notification can reveal a care relationship. [Google's HIPAA guidance](https://knowledge.workspace.google.com/admin/compliance/hipaa-compliance-with-google-workspace-and-cloud-identity).

Nodemere requests `gmail.readonly` as well as `gmail.send`. Google classifies readonly as restricted; server handling of restricted-scope data brings verification/security-assessment requirements, subject to applicable exceptions. Document approval or a valid exception before external inbox rollout. If inbox reading is unnecessary for the pilot, exclude it rather than expand scope. This is separate from Google sign-in. [Gmail scope requirements](https://developers.google.com/workspace/gmail/api/auth/scopes).

### Microsoft 365 / Outlook — optional, not locally credential-configured

Code supports Graph mailbox reads/sends. Local client credentials were absent; no claim about every customer's connection is made. Require an eligible organizational Microsoft 365/Exchange Online service, applicable BAA/DPA and limited permissions before PHI use; a consumer Outlook account or successful OAuth consent is not evidence of that scope. Microsoft's published in-scope services include Exchange Online; its BAA is available through the Online Services DPA. Keep the integration off the healthcare path until evidence exists. [Microsoft HIPAA scope](https://learn.microsoft.com/en-us/compliance/regulatory/offering-hipaa-hitech).

### Stripe — billing processor, not a clinical store

Receives Nodemere subscription details and, for connected patient payments, necessary contact/payment data and identifiers. Retain generic descriptions and metadata; no diagnosis, procedure narrative, transcript or clinical attachment. Stripe warns against sensitive metadata; opaque references are not a legal guarantee of de-identification. [Stripe metadata](https://docs.stripe.com/metadata).

The official materials checked did **not** establish a generally available Stripe BAA covering Nodemere's exact Connect/Checkout/Billing workflow. Obtain product-specific confirmation and legal review of any payment-processing exception instead of asserting that all Stripe activity is exempt or covered. Stripe Identity explicitly excludes PHI use, but Nodemere does not need Identity/patient verification. [Stripe Identity limits](https://docs.stripe.com/identity/use-cases).

Simplest initial scope: bill the office for Nodemere; exclude patient payment collection until its boundaries and application-level acceptance are approved. Preserve secure local billing test mode.

### Hosting — Render is a repository option, not a deployment requirement now

`render.yaml` describes backend/static-site deployment, not proof of an active healthcare environment. If selected, Render currently requires Scale or Enterprise, a signed BAA and a HIPAA-enabled workspace. PHI workloads must run in that workspace on supported resources. PHI is prohibited in service logs, build artifacts and public static assets even there. Public frontend code/assets are distinct from patient records. Enablement is irreversible and can redeploy existing services: plan deliberately; no account change was made. [Render HIPAA requirements](https://render.com/docs/hipaa-compliance).

An alternative host is acceptable if its actual service, contract and safeguards are suitable. Do not buy Render merely to complete development validation.

### LLM subprocessors / direct OpenAI — distinguish actual paths

No active direct OpenAI API invocation was found in the inspected backend; configuration/dependency placeholders exist and the local direct API key is absent. **OpenAI nevertheless appears in the active agent model route above.** For ElevenLabs-managed models, verify its covered subprocessor chain. If choosing a direct Custom LLM route, obtain the provider-specific agreement and configure eligible endpoints/retention; “not used for training” alone is insufficient.

OpenAI's official API data controls distinguish abuse logs from application state and have endpoint-specific retention limitations. Web Search is explicitly not HIPAA eligible under a BAA. Do not add web search, persistent assistants/files, or external tools to PHI workflows without separate review. [Official OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

### Backups, email infrastructure and auxiliary services

| Service/path | Present or possible exposure | Simplest launch treatment |
| --- | --- | --- |
| Independent backup destination | Ciphertext, Storage bytes, key registry, audit history; key recovery separate | Choose covered storage and appropriate agreement, access controls, retention, failure alerts and tested recovery. Encryption alone does not remove a cloud storage provider's BA obligations. [HHS cloud guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html). |
| Supabase Auth mail/custom SMTP | Workforce identity, invitation/recovery links | Document the actual sender/service and delivery limits. Keep auth messages free of PHI; verify receipt, expiration and identity-bound acceptance. Do not infer SMTP coverage from the database BAA. |
| ngrok development tunnel | Can terminate/inspect tool and webhook traffic | Synthetic data only. Exclude this development tunnel from real PHI routing; no need to buy a healthcare tunnel for launch. If retained for PHI, separately approve its service/contract/logging scope first. |
| Google Fonts, cdnjs/Cloudflare, external images/video | `index.html`, CSS and dashboard assets generate third-party browser requests; URLs/referrers/IPs may leave the browser | Prefer bundling required fonts/icons and excluding external embeds from PHI screens. Do not put patient identifiers in asset URLs. Public assets are not automatically PHI, and no PHI disclosure was proven by static inspection alone. |
| Cloudflare reverse proxy, if later used | Would process application requests, unlike merely fetching a public stylesheet | Review exact services/BAA before proxying PHI. Cloudflare states BAAs are Enterprise-only; public CDN use is not evidence of an agreement. [Cloudflare privacy FAQ](https://www.cloudflare.com/trust-hub/us-privacy-compliance/). |
| Legacy `ip-api.com` geolocation | `/track-visitor` contains an HTTP IP lookup; current frontend `trackVisitor` is a no-network stub | Do not activate for healthcare traffic. Disable/retire the unnecessary backend route or explicitly restrict it to an approved non-PHI surface before launch. Not evidence that patient data has already been sent. |
| RapidAPI marketplace lookup / remote placeholders / old Supabase asset projects | Legacy/demo/marketing code, not established as PHI processors | Keep outside healthcare workflows; inventory remaining browser network destinations on the exact pilot screens. No new vendor contract required for a feature genuinely excluded. |
| Analytics, error monitoring, support and CI | No dedicated Sentry/PostHog/Mixpanel SDK found in inspected app dependencies/source; future integrations could capture payloads | Do not enable session replay or attach production payloads/screenshots to support, coding tools or CI. Approve any new PHI processor first; use scrubbed operational metrics. Absence of an SDK is not proof of absent host/network logging. |

## 4. Checks that can be completed before deployment

### A. Product acceptance and narrow release hardening — engineering

- [ ] Fresh Google OAuth sign-in → MFA requirement/enrollment/challenge → AAL2 → application access; reload/refresh/logout; no OAuth bypass. Controlled account, synthetic data.
- [ ] Actual invitation email received and accepted by the intended identity; wrong email, expiry/reuse and self-promotion rejected. Confirm removed membership loses API/direct-data access. Prior automated tests need not be rebuilt.
- [ ] Keep the historical MFA issue accurately recorded: native `mfa_ip_address_mismatch` was observed, and an application error-classification defect was fixed. The exact original backend 401 cause was not captured. Investigate if reproduced; do not disable IP binding or block unrelated development merely because historical proof is incomplete.
- [ ] Controlled Twilio→ElevenLabs→signed tool/webhook→Nodemere→Supabase call under the proposed healthcare configuration. Prove appointment action, scoped context, human transfer, disconnect/failure handling, reporting and recording policy. Do not treat API reachability as a completed call.
- [ ] If payments are enabled, test **Nodemere** checkout/payment or subscription change → real sandbox event delivery → correct tenant/account update → duplicate/retry rejection → refund/cancellation as applicable. Prior Stripe PaymentIntent/refund/Checkout checks were provider-only, not application webhook acceptance.
- [ ] Confirm healthcare businesses require MFA for every active workforce member and privileged administrators use MFA. Set an appropriate inactive-session/re-authentication policy; test refresh, shared-workstation logout and supported recovery. Do not assume enrollment support means every business policy is enabled.
- [ ] Inspect dependencies in the exact release, lock reproducible backend versions (current backend requirements are unpinned), triage reachable high/critical advisories, verify secret-free frontend/build and log redaction. No fresh dependency-vulnerability scan was performed in this documentation review.
- [ ] Resolve the auxiliary-network decisions above and verify actual browser requests/referrers on PHI screens. Do not equate ordinary public-page IP traffic with a proven PHI disclosure.
- [ ] Review free-text customer/appointment notes, prompts, scenario variables and email templates against the field coverage map. Minimize clinical content; explicitly accept/document the protection model or make targeted changes where an identified risk warrants it.

### B. Small operational/documentation package — owner and reviewer

HHS requires risk analysis/management, a security official, workforce safeguards and training, incident procedures, contingency planning, access/activity review and maintained documentation. Controls should be proportionate to actual risks and resources. The currently effective rule must be distinguished from proposed amendments. [HHS Security Rule summary](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html).

Use a short maintained package, not an enterprise compliance platform:

- [ ] Name the security/privacy contact and backup decision-maker; keep office/vendor incident contacts reachable.
- [ ] Sign off a risk register covering actual PHI flows, threat/impact, existing safeguards, remaining mitigation, owner and review date. Include partial envelope coverage, outages, provider retention and stolen workforce/admin sessions.
- [ ] Establish access approval/removal, periodic membership/admin review, staff confidentiality/training, workstation locking, disk encryption, patching and safe support handling. Avoid shared owner accounts.
- [ ] Define who checks audit/security events, how often and how suspicious access is escalated. Separate a protected audit copy from application control where practical; test alert delivery. A table no one reviews is not the complete operating process.
- [ ] Write and rehearse a short incident/continuity runbook: contain, preserve evidence, revoke access/keys, assess scope, contact offices, meet reviewed notification deadlines, recover and document. Maintain a human receptionist fallback during outages; never duplicate queued calls/charges while restoring.
- [ ] Approve retention by category: canonical records/files, transcripts/recordings, transient payloads, audit/security documentation, backups and provider copies. Define hold authority, offboarding/export, verified deletion and backup expiry handling. Provide controlled manual procedures where automation is absent; do not promise unsupported SLAs.
- [ ] Preserve required HIPAA policies/assessments and related documentation for six years from creation or last effective date, whichever is later. That is **not** a blanket six-year retention mandate for every audio file, medical record or debug log. Medical-record periods depend on other applicable law and customer obligations. [HHS documentation rule](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html), [medical-record retention clarification](https://www.hhs.gov/hipaa/for-professionals/faq/580/does-hipaa-require-covered-entities-to-keep-medical-records-for-any-period/index.html).
- [ ] Have a qualified reviewer resolve customer BAAs, permitted uses/disclosures, incident-notification terms, data return/deletion, patient-rights assistance, recording/AI disclosure and applicable state/special-category rules. No contract was drafted or signed here.

### C. Pilot office boundaries — owner and office

- [ ] Approve administrative receptionist use only: minimum scheduling/contact data, generic office answers, approved reminders and human handoff. A scheduling-only call can still contain PHI; it does not bypass vendor requirements.
- [ ] Configure and test human transfer for sensitive identity-dependent requests. No patient OTP, DOB verification, portal, custom MFA or automated release of clinical records. Treat caller ID and volunteered identifiers as insufficient proof of identity.
- [ ] Approve transfer destinations, hours, fallback and emergency messaging. Exclude diagnosis, clinical triage and emergency dispatch; have the office review call recording consent, AI disclosure and outbound-contact requirements.
- [ ] Begin with one controlled office/workflow and minimum enabled integrations. Do not market the first pilot as support for every specialty or regulated data category.
- [ ] Reconcile existing legal copy before approval: `src/legal/legalDocuments.js` currently restricts healthcare/PHI without written approval and required controls/addenda (Terms, AUP, DPA and subprocessor notice). Preserve the restriction until the healthcare approval is real; do not merely remove it to make onboarding appear ready.

## 5. What genuinely waits for production

The implementation-level checklist remains [production-launch-checklist.md](production-launch-checklist.md). Planning, vendor negotiations, policy work and synthetic acceptance do **not** need to wait. Final evidence for the following does:

- [ ] **Actual production account/service eligibility:** covered host/project/workspace, region, network controls, PITR and relevant vendor safeguards. Never route real PHI through the current development project merely because its migrations pass.
- [ ] **Actual deployment secrets:** independent production KEKs, internal-tool/webhook credentials and restricted service-role access; enforced auditing/encryption; no secrets in frontend/build/logs. Keep development keys separate. `render.yaml` alone is not the complete security secret inventory.
- [ ] **Independent production recovery:** protected off-server key copies and complete DB/object backups, automation, retention/versioning, failed-backup notifications and a restore from another machine/account. Verify ciphertext, wrapped-key history, file contents and tenant access; measure recovery time and acceptable data-loss window. Current DPAPI recovery cannot prove loss-of-machine/account recovery.
- [ ] **Real domain/host boundaries:** TLS, origins/CORS, OAuth redirect allowlists, email links, authenticated private files, browser cache/referrer behavior, reverse-proxy logging and signed provider callbacks on the final URLs.
- [ ] **Deployed acceptance and normal workers:** test tenancy/roles/MFA/audit/key failures, provider credential refresh, webhook delivery/retry and scheduler resume using synthetic data. Earlier local HTTP tests ran with lifecycle workers off. Establish rollback compatible with already encrypted data; never roll back to software that cannot decrypt it.
- [ ] **Historical-data decision:** inventory any imported historical data; preview and verify necessary encryption migration and cleanup before PHI import or policy activation. Include original file copies, superseded ciphertext and backup versions; do not delete held records or retire needed keys.

## 6. Minimal next move and approval record

1. Resolve **vendor feasibility first**: ElevenLabs Enterprise/ZRM + chosen model, Twilio HIPAA account, Supabase HIPAA project requirements, and a covered system mail route. Request written product/account scope, not merely a marketing assurance. No purchase or signature is authorized by this checklist.
2. Close the interactive and end-to-end synthetic checks using existing code. Keep optional patient payments/inbox access out of the initial pilot if they would delay safe launch.
3. Complete the short policy/contract package and narrow release fixes. Then, when deployment is explicitly authorized, execute the production checklist and attach the evidence.
4. Before the first PHI call, record: release/commit, environment, office, approved features/vendors, closed gate IDs, accepted residual risks, incident contact, reviewer and approval date. Unresolved mandatory gates mean **no real PHI**.

Do not add a custom KMS service, enterprise SIEM, encrypted-search subsystem, patient identity platform, SOC 2/HITRUST certification project or large redesign merely to complete this checklist. Vendor-required paid tiers are commercial eligibility constraints, not evidence that Nodemere needs enterprise software architecture.

**Final status:** checklist and public vendor-requirement review complete; Phase 8 operational/vendor readiness remains open. Phases 5–7 retain their documented local PASS status. Real doctor-office PHI onboarding is not yet signed off.
