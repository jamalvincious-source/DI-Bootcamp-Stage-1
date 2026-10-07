import assert from 'node:assert/strict';
import test from 'node:test';
import {
  notifyApplicantOfLoanDecision,
  notifySuperAdminOfApplication,
  superAdminPhoneE164,
} from './application-notifications.js';
import { eligibilityWorkflowEvent, nextLoanStage } from './loan-workflow.js';
import type { SmsProvider } from './providers.js';

function createSmsRecorder() {
  const sent: Array<{ toE164: string; message: string; idempotencyKey: string }> = [];
  const provider: SmsProvider = {
    async sendSms(input) {
      sent.push(input);
      return { providerReference: 'test-message', status: 'accepted' };
    },
  };
  return { provider, sent };
}

test('application follows identity, risk, human review, then disbursement', () => {
  let stage = nextLoanStage('draft', 'application_submitted');
  assert.equal(stage, 'identity_pending');
  stage = nextLoanStage(stage, 'safaricom_eligibility_verified');
  assert.equal(stage, 'risk_pending');
  stage = nextLoanStage(stage, 'risk_assessed');
  assert.equal(stage, 'manual_review');
  stage = nextLoanStage(stage, 'admin_approved');
  assert.equal(stage, 'disbursement_pending');
  stage = nextLoanStage(stage, 'disbursement_succeeded');
  assert.equal(stage, 'repayment_active');
});

test('identity exceptions pause for human review', () => {
  const stage = nextLoanStage('identity_pending', 'identity_needs_review');
  assert.equal(stage, 'manual_review');
});

test('risk assessment cannot directly approve or decline a loan', () => {
  assert.equal(nextLoanStage('risk_pending', 'risk_assessed'), 'manual_review');
  assert.throws(() => nextLoanStage('risk_pending', 'admin_approved'), /Invalid loan workflow transition/);
});

test('a declined application cannot be disbursed', () => {
  const stage = nextLoanStage('manual_review', 'admin_declined');
  assert.equal(stage, 'declined');
  assert.throws(() => nextLoanStage(stage, 'admin_approved'), /Invalid loan workflow transition/);
});

test('only verified Safaricom line ownership and ID/contact match pass eligibility', () => {
  const verified = {
    providerReference: 'provider-ref',
    lineOwnership: 'verified' as const,
    currentNetwork: 'safaricom' as const,
    identityContactMatch: 'match' as const,
  };
  const mismatch = { ...verified, identityContactMatch: 'no_match' as const };
  const otherNetwork = { ...verified, currentNetwork: 'other' as const };
  const unknown = { ...verified, currentNetwork: 'unknown' as const };

  assert.equal(eligibilityWorkflowEvent(verified), 'safaricom_eligibility_verified');
  assert.equal(eligibilityWorkflowEvent(mismatch), 'identity_needs_review');
  assert.equal(eligibilityWorkflowEvent(otherNetwork), 'identity_needs_review');
  assert.equal(eligibilityWorkflowEvent(unknown), 'identity_needs_review');
});

test('passing eligibility still requires risk assessment and human approval', () => {
  const verifiedEvent = eligibilityWorkflowEvent({
    providerReference: 'provider-ref',
    lineOwnership: 'verified',
    currentNetwork: 'safaricom',
    identityContactMatch: 'match',
  });
  const stage = nextLoanStage('identity_pending', verifiedEvent);

  assert.equal(stage, 'risk_pending');
  assert.throws(() => nextLoanStage(stage, 'admin_approved'), /Invalid loan workflow transition/);
  assert.equal(nextLoanStage(stage, 'risk_assessed'), 'manual_review');
});

test('new application SMS goes to the configured super-admin number without applicant PII', async () => {
  const sms = createSmsRecorder();
  await notifySuperAdminOfApplication(sms.provider, {
    applicationReference: 'LN-24081',
    correlationId: 'correlation-1',
    idempotencyKey: 'application-submitted-LN-24081',
  });

  assert.equal(superAdminPhoneE164, '+254118237749');
  assert.equal(sms.sent.length, 1);
  assert.equal(sms.sent[0].toE164, '+254118237749');
  assert.match(sms.sent[0].message, /LN-24081.*ready for review/);
  assert.doesNotMatch(sms.sent[0].message, /national id|phone|income/i);
});

test('approved decision SMS reports processing without promising delivery time', async () => {
  const sms = createSmsRecorder();
  await notifyApplicantOfLoanDecision(sms.provider, {
    applicationReference: 'LN-24081',
    applicantPhoneE164: '+254712345678',
    decision: 'approved',
    correlationId: 'correlation-2',
    idempotencyKey: 'admin-decision-LN-24081',
  });

  assert.equal(sms.sent[0].toE164, '+254712345678');
  assert.match(sms.sent[0].message, /approved.*being processed/i);
  assert.match(sms.sent[0].message, /payment provider/i);
});

test('not-approved SMS allows retry and rejects invalid destinations', async () => {
  const sms = createSmsRecorder();
  await notifyApplicantOfLoanDecision(sms.provider, {
    applicationReference: 'LN-24082',
    applicantPhoneE164: '+254112345678',
    decision: 'not_approved',
    correlationId: 'correlation-3',
    idempotencyKey: 'admin-decision-LN-24082',
  });

  assert.match(sms.sent[0].message, /not approved at this time/i);
  assert.match(sms.sent[0].message, /try again later/i);
  await assert.rejects(
    notifyApplicantOfLoanDecision(sms.provider, {
      applicationReference: 'LN-24083',
      applicantPhoneE164: '+15551234567',
      decision: 'not_approved',
      correlationId: 'correlation-4',
      idempotencyKey: 'admin-decision-LN-24083',
    }),
    /valid Kenyan mobile number/,
  );
});