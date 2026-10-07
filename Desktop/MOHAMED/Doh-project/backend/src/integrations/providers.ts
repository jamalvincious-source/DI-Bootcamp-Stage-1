export type ProviderContext = {
  correlationId: string;
  idempotencyKey: string;
};

export type CreditReportSummary = {
  providerReference: string;
  retrievedAt: string;
  score?: number;
  riskIndicators: string[];
};

export interface CreditBureauProvider {
  retrieveReport(input: {
    applicantReference: string;
    consentReference: string;
  } & ProviderContext): Promise<CreditReportSummary>;
}

export type IdentityResult = {
  providerReference: string;
  decision: 'clear' | 'review' | 'blocked';
  reasonCodes: string[];
};

export interface IdentityVerificationProvider {
  verify(input: {
    applicantReference: string;
    documentObjectKeys: string[];
    consentReference: string;
  } & ProviderContext): Promise<IdentityResult>;
}

export type SafaricomEligibilityResult = {
  providerReference: string;
  lineOwnership: 'verified' | 'not_verified' | 'unknown';
  currentNetwork: 'safaricom' | 'other' | 'unknown';
  identityContactMatch: 'match' | 'no_match' | 'unknown';
};

export interface SafaricomEligibilityProvider {
  verifyEligibility(input: {
    applicantReference: string;
    registeredIdentityReference: string;
    phoneE164: string;
    consentReference: string;
  } & ProviderContext): Promise<SafaricomEligibilityResult>;
}

export type RiskAssessment = {
  score: number;
  recommendation: 'approve' | 'refer' | 'decline';
  reasonCodes: string[];
  modelVersion: string;
};

export interface RiskScoringProvider {
  assess(input: {
    applicationReference: string;
    amountMinor: bigint;
    currency: string;
    termMonths: number;
    report: CreditReportSummary;
  } & ProviderContext): Promise<RiskAssessment>;
}

export interface PaymentGatewayProvider {
  disburse(input: {
    applicationReference: string;
    beneficiaryToken: string;
    amountMinor: bigint;
    currency: string;
  } & ProviderContext): Promise<{ providerReference: string; status: 'accepted' | 'pending' }>;
  collectRepayment(input: {
    applicationReference: string;
    paymentToken: string;
    amountMinor: bigint;
    currency: string;
  } & ProviderContext): Promise<{ providerReference: string; status: 'accepted' | 'pending' }>;
}

export interface NotificationProvider {
  send(input: {
    applicantReference: string;
    template: 'application-received' | 'identity-review' | 'loan-decision' | 'repayment-reminder';
    locale: string;
  } & ProviderContext): Promise<{ providerReference: string }>;
}

export interface SmsProvider {
  sendSms(input: {
    toE164: string;
    message: string;
  } & ProviderContext): Promise<{ providerReference: string; status: 'accepted' | 'pending' }>;
}

export interface RegulatoryReportingProvider {
  submit(input: {
    reportType: string;
    applicationReference: string;
    eventReference: string;
    jurisdiction: string;
  } & ProviderContext): Promise<{ providerReference: string; status: 'accepted' | 'pending' }>;
}

export type IntegrationProviders = {
  creditBureau: CreditBureauProvider;
  identityVerification: IdentityVerificationProvider;
  safaricomEligibility: SafaricomEligibilityProvider;
  riskScoring: RiskScoringProvider;
  payments: PaymentGatewayProvider;
  notifications: NotificationProvider;
  sms: SmsProvider;
  regulatoryReporting: RegulatoryReportingProvider;
};