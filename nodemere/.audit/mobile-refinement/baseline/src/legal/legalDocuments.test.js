import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LEGAL_ACCEPTANCE_KEY, LEGAL_ACCEPTANCE_VERSION, LEGAL_DOCUMENTS } from './legalDocuments.js';

const read = (file) => fs.readFileSync(file, 'utf8');

test('public legal documents define restricted automation by workflow and data type', () => {
  const terms = LEGAL_DOCUMENTS.terms.content;
  const acceptableUse = LEGAL_DOCUMENTS.acceptableUse.content;
  assert.match(terms, /sensitive, confidential, regulated, protected, or account-specific information/);
  assert.match(terms, /This restriction is based on the data and workflow, not the Customer's industry/);
  assert.match(acceptableUse, /routine scheduling where permitted and where restricted information is not involved/i);
  assert.match(acceptableUse, /route those requests to an authorized person/);
  assert.match(LEGAL_DOCUMENTS.dpa.content, /HIPAA, GLBA, FERPA/);
});

test('frontend and backend require the same current legal acceptance version', () => {
  const backend = read('backend/main.py');
  assert.match(backend, new RegExp(`NODEMERE_LEGAL_ACCEPTANCE_KEY = "${LEGAL_ACCEPTANCE_KEY}"`));
  assert.match(backend, new RegExp(`NODEMERE_LEGAL_ACCEPTANCE_VERSION = "${LEGAL_ACCEPTANCE_VERSION}"`));
  assert.doesNotMatch(backend, /is_restricted_launch_industry|RESTRICTED_LAUNCH_INDUSTRY_TERMS/);
});

test('visitor analytics disclosures match the implemented optional dataset', () => {
  const privacy = LEGAL_DOCUMENTS.privacy.content;
  const cookies = LEGAL_DOCUMENTS.cookies.content;
  const terms = LEGAL_DOCUMENTS.terms.content;
  for (const phrase of [
    'persistent first-party visitor identifier', 'fingerprint-derived identifier', 'browser name and version',
    'operating system and version', 'screen and viewport dimensions', 'referring-site origin',
    'UTM campaign fields', 'visible and focused engagement time', 'scroll milestones and depth',
    'homepage-section reach', 'account or paid-subscription conversion events',
  ]) assert.match(privacy, new RegExp(phrase, 'i'), phrase);
  assert.match(privacy, /not necessarily anonymous/i);
  assert.match(privacy, /does not persist IP addresses, ASN or ISP data, or IP-derived location/i);
  assert.match(privacy, /understand public-site use.*measure marketing attribution.*understand signup and subscription conversion/is);
  assert.match(cookies, /categories are \*\*Necessary\*\* and \*\*Analytics \/ performance\*\*/);
  assert.match(cookies, /fingerprint-derived identifier.*This identifier is not a cookie/is);
  assert.match(cookies, /Reject Non-Essential.*prevents the optional analytics module from loading/is);
  assert.match(cookies, /does not record form values, arbitrary keystrokes, passwords, authentication tokens, payment-card data/i);
  assert.match(terms, /public-site visitor's optional analytics consent/i);
  assert.match(terms, /Privacy Policy.*Cookie Notice/is);
});

test('cookie banner exposes persistent choices and accurate category labels', () => {
  const banner = read('src/components/CookieNotice.jsx');
  const consent = read('src/lib/visitorConsent.js');
  const tracking = read('src/components/VisitorTracking.jsx');
  for (const label of ['Accept All', 'Reject Non-Essential', 'Manage Preferences', 'Save Preferences', 'Cookie preferences']) {
    assert.match(banner, new RegExp(label));
  }
  assert.match(banner, /Analytics \/ performance/);
  assert.match(banner, /fingerprint-derived identification/);
  assert.match(consent, /localStorage/);
  assert.match(consent, /CONSENT_CHANGED/);
  assert.match(tracking, /import\('\.\.\/lib\/visitorEngine\.js'\)/);
  assert.match(tracking, /if \(!consent\.analytics \|\| !eligible\)/);
});

test('OAuth sign-up records legal acceptance after the provider redirects back', () => {
  const source = read('src/pages/AuthPage.jsx');
  assert.match(source, /OAUTH_LEGAL_ACCEPTANCE_STORAGE_KEY/);
  assert.match(source, /\/users\/me\/legal-acceptance/);
  assert.match(source, /redirectTo: FRONTEND_PUBLIC_URL \+ \(isSignUp \? '\/auth' : '\/onboarding'\)/);
});

test('Essentials and onboarding templates describe the restricted workflow boundary', () => {
  const pricing = read('src/pages/PricingPage.jsx');
  const onboarding = read('src/pages/Onboarding2Page.jsx');
  const knowledge = read('src/data/onboardingKnowledgeTemplates.js');
  assert.match(pricing, /Routine scheduling where permitted and where restricted information is not involved/);
  assert.match(pricing, /scope_note/);
  for (const source of [onboarding, knowledge]) {
    assert.match(source, /route sensitive, regulated, confidential, or identity-dependent requests to an authorized team member/i);
    assert.doesNotMatch(source, /We require client identity verification for sensitive matters/);
  }
});
