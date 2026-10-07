export const services = {
  'loan-service': 'Application intake and loan lifecycle',
  'risk-service': 'Risk assessment and credit scoring',
  'user-service': 'Authentication and identity verification',
  'payment-service': 'Disbursement and repayment integrations',
  'notification-service': 'Email, SMS, and push delivery',
  'compliance-service': 'Audit records and regulatory reporting',
} as const;

export type ServiceName = keyof typeof services;

export function isServiceName(value: string): value is ServiceName {
  return Object.hasOwn(services, value);
}