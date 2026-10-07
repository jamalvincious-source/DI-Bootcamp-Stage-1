import type { ProviderContext, SmsProvider } from './providers.js';

export const superAdminPhoneE164 = '+254118237749';

type ApplicationSmsContext = ProviderContext & {
  applicationReference: string;
};

function validateApplicationReference(reference: string) {
  if (!/^[A-Z0-9-]{1,40}$/i.test(reference)) {
    throw new Error('Application reference contains unsupported characters');
  }
}

export async function notifySuperAdminOfApplication(
  sms: SmsProvider,
  input: ApplicationSmsContext,
) {
  validateApplicationReference(input.applicationReference);
  return sms.sendSms({
    toE164: superAdminPhoneE164,
    message: `New loan application ${input.applicationReference} is ready for review. Open the secure admin dashboard.`,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function notifyApplicantOfLoanDecision(
  sms: SmsProvider,
  input: ApplicationSmsContext & {
    applicantPhoneE164: string;
    decision: 'approved' | 'not_approved';
  },
) {
  validateApplicationReference(input.applicationReference);
  if (!/^\+254[17]\d{8}$/.test(input.applicantPhoneE164)) {
    throw new Error('Applicant notification number must be a valid Kenyan mobile number');
  }

  const message = input.decision === 'approved'
    ? `Your loan application ${input.applicationReference} was approved. Disbursement is being processed. Timing depends on the payment provider; we will update you when it completes.`
    : `Your loan application ${input.applicationReference} was not approved at this time. You may try again later. Contact support if you need information about the decision.`;

  return sms.sendSms({
    toE164: input.applicantPhoneE164,
    message,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
  });
}