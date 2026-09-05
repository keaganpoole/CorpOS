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
