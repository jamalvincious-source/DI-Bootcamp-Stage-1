# Backend foundation

This folder contains a local microservice foundation for Ondoa Shida. Kong is the edge gateway, RabbitMQ provides a durable topic exchange, and each domain service runs as an independent container from the same small TypeScript service image.

## Services

| Service | Responsibility |
| --- | --- |
| `loan-service` | Application intake and loan lifecycle |
| `risk-service` | Risk assessment and credit scoring |
| `user-service` | Authentication and identity verification |
| `payment-service` | Disbursement and repayment integrations |
| `notification-service` | Email, SMS, and push delivery |
| `compliance-service` | Audit records and regulatory reporting |

## Run locally

Requires Node.js 24+ and Docker Compose. From this directory:

```powershell
npm install
npm run build
docker compose up --build
```

Kong listens at `http://127.0.0.1:8000`; RabbitMQ management is at `http://127.0.0.1:15672`. PostgreSQL, MongoDB, and Redis are published on loopback for local development. All compose credentials are disposable development values; never use them with real applicant data.

Gateway health routes include `GET /api/v1/loan/health`, `GET /api/v1/risk/health`, and corresponding `/users/health`, `/payments/health`, `/notifications/health`, and `/compliance/health` routes. Replace `health` with `ready` to include the broker connection check.

## Event contract

Services share the durable `ondoa.events.v1` topic exchange. `src/events.ts` defines persistent, confirm-published envelopes with an event ID, event type, schema version, timestamp, and correlation ID. Domain events should contain identifiers and necessary state changes, not identity documents, credentials, or raw KYC data. Add an outbox backed by the chosen database before publishing business events in production.

## Integrations and workflow

`src/integrations/providers.ts` defines provider-neutral contracts for credit bureaus, identity/KYC, risk scoring, payment gateways, SMS/notifications, and regulatory reporting. `src/integrations/application-notifications.ts` prepares idempotent SMS notifications for new applications at `+254118237749` and for applicant decisions. Approval text says disbursement is processing without promising a specific delivery time; non-approval text says the applicant may try again later. Messages exclude identity numbers and income details. No SMS vendor, SDK, credentials, or application submission endpoint is connected, so messages are not actually sent yet.

Connect the helpers to persisted application-submitted and admin-decision events only after selecting an authorized SMS provider. Keep delivery retry-safe with the event idempotency key, record provider delivery status, and use the authenticated admin dashboard rather than SMS for sensitive application details. Approval notification must not be sent until a human decision is persisted; payment completion should have its own later notification.

`src/integrations/loan-workflow.ts` is a tested event-driven state transition foundation: submitted applications require provider-attested OTP line ownership on Safaricom and a match between the Kenyan identity and registered contact before risk assessment. Mismatches, other networks, and inconclusive results go to manual review, not automatic rejection. Passing these checks still proceeds only to risk assessment and then human review; it never auto-approves a loan. No telecom, identity registry, OTP, or KYC provider is connected. Do not infer carrier from a phone-number prefix. Connect transitions to durable storage and the RabbitMQ outbox before using them in a service.

GitHub Actions in `.github/workflows/ci.yml` builds and tests both projects and audits dependencies on pushes to `main` and pull requests. Terraform, EKS, monitoring, autoscaling, and disaster-recovery provisioning are not included in the safe foundation.

## Data layer

- PostgreSQL stores loan applications, installment schedules, and an event-outbox table. `migrations/001_loan_records.sql` is applied when the local database volume is first created; `src/data/postgres.ts` writes an application and its schedule in one transaction using integer minor currency units.
- `migrations/002_transaction_fee_tiers.sql` defines KES transaction fees: KSh 500–800 costs 29; 801–1,101 costs 31; 1,102–5,000 costs 33; 5,001–11,999 costs 50; and 12,000–30,000 costs 80. PostgreSQL rejects overlapping tiers, and `getTransactionFee` looks up a whole-KSh transaction amount.
- MongoDB stores activity records with allowlisted metadata. Do not put names, contact details, identity numbers, document contents, or secrets in activity records.
- Redis provides short-lived calculation caching and hashed session-token keys. Production connections require TLS; use short session TTLs and keep session values minimal.
- `src/data/documents.ts` creates short-lived S3 POST policies that require SSE-KMS, an exact content type, and a bounded size. Set `AWS_REGION`, `AWS_S3_BUCKET`, and `AWS_S3_KMS_KEY_ID`; grant the service only the required bucket and key permissions. Configure S3 Block Public Access and a bucket policy that denies uploads without the required KMS key. Scan and verify every uploaded file before use; browser-provided MIME types are not trustworthy.
- `src/data/encrypted-config.ts` uses AWS KMS envelope encryption with AES-256-GCM for small JSON settings. Set `AWS_CONFIG_KMS_KEY_ID`; store only the encrypted envelope, and grant decrypt access only to the service that needs it.

The local Compose stack does not emulate AWS. Readiness checks cover the broker and each service's assigned database/cache, but do not verify AWS credentials or bucket/key policies.

## Security and compliance

See [SECURITY.md](SECURITY.md) for the OAuth/OIDC, MFA, transport encryption, privacy, and jurisdiction-specific compliance boundaries. In production, configure `OIDC_ISSUER`, `OIDC_AUDIENCE`, and an HTTPS `OIDC_JWKS_URL`. The development Compose environment intentionally runs over local HTTP; production requires TLS 1.3 at the public gateway and authenticated, encrypted service-to-service transport.

## Not production-ready

Only health and readiness routes are exposed; the data adapters are not yet connected to application intake endpoints. Loan underwriting, identity verification, payment execution, notification delivery, and regulatory reporting are intentionally not implemented. Before exposing those operations, configure an identity provider, KYC/AML and credit-data providers, payment rails, notification vendors, and jurisdiction-specific compliance controls. Local database credentials and the HTTP-only gateway are for development only. Do not send real applicant data to this scaffold.