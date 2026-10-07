import type { SafaricomEligibilityResult } from './providers.js';

export type LoanStage =
  | 'draft'
  | 'identity_pending'
  | 'risk_pending'
  | 'manual_review'
  | 'disbursement_pending'
  | 'repayment_active'
  | 'declined';

export type LoanWorkflowEvent =
  | 'application_submitted'
  | 'safaricom_eligibility_verified'
  | 'identity_needs_review'
  | 'risk_assessed'
  | 'admin_approved'
  | 'admin_declined'
  | 'disbursement_succeeded';

const transitions: Record<LoanStage, Partial<Record<LoanWorkflowEvent, LoanStage>>> = {
  draft: { application_submitted: 'identity_pending' },
  identity_pending: {
    safaricom_eligibility_verified: 'risk_pending',
    identity_needs_review: 'manual_review',
  },
  risk_pending: { risk_assessed: 'manual_review' },
  manual_review: {
    admin_approved: 'disbursement_pending',
    admin_declined: 'declined',
  },
  disbursement_pending: { disbursement_succeeded: 'repayment_active' },
  repayment_active: {},
  declined: {},
};

export function eligibilityWorkflowEvent(result: SafaricomEligibilityResult): LoanWorkflowEvent {
  if (
    result.lineOwnership === 'verified'
    && result.currentNetwork === 'safaricom'
    && result.identityContactMatch === 'match'
  ) {
    return 'safaricom_eligibility_verified';
  }
  return 'identity_needs_review';
}

export function nextLoanStage(stage: LoanStage, event: LoanWorkflowEvent): LoanStage {
  const next = transitions[stage][event];
  if (!next) throw new Error(`Invalid loan workflow transition: ${stage} + ${event}`);
  return next;
}