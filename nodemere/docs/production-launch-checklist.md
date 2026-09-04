# Production launch checklist — Phases 5–7

Development activation is complete. These are deployment-dependent tasks, not
requirements for continuing local development. Do not deploy or purchase anything
merely to tick this list.

- [ ] **Production secrets:** generate separate production KEKs in the hosting
  secret store; never reuse development keys. Enable enforced auditing and
  encrypt-new there. Verify the built frontend receives no server secrets.
- [ ] **Independent key recovery:** place protected recovery copies outside the
  application host, document custodians, and prove recovery from another
  machine/account. The current Windows-user-bound DPAPI copy is a development
  demonstration, not a production disaster-recovery solution.
- [ ] **Production backups and monitoring:** configure automated protected
  database **and Storage object** backups, retention/versioning and failure
  alerts, with key versions kept independently. Choose the actual audit archive
  destination and access/retention settings. Restore the deployed system into
  an isolated environment; measure recovery time and data-loss window.
- [ ] **Coordinated deployment:** roll out matching frontend, backend and
  migrations; verify HTTPS, origins, production OAuth callbacks and signed
  provider webhooks. Confirm production MFA policy, private Storage, RLS,
  Realtime and audit access against the actual hosted services.
- [ ] **Hosted acceptance and historical data:** rerun tenant isolation,
  audit/encryption/outage/recovery tests on the deployed configuration. Verify
  provider credential refresh and scheduled-workflow resume without duplicate
  charges/calls/messages. Preview any historical encryption migration and
  approved retention policy before applying it; keep holds effective.

Vendor/BAA/legal/operational assessment is Phase 8 and remains separate. It need
not wait for deployment. This checklist is not a HIPAA certification claim.
