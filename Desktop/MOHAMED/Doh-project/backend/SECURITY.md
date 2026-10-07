# Security and compliance baseline

This is an engineering baseline, not a certification or legal opinion. TILA and FCRA are United States laws; AML obligations, privacy laws, disclosures, retention periods, and reporting duties depend on the countries and products in which the service operates. Obtain jurisdiction-specific legal and security review before handling real applications.

## Production readiness status

**NOT PRODUCTION-READY.** The backend build, runtime dependency audit, and missing-OIDC fail-closed check have passed. Docker/TLS overlay testing has not been run, internal mTLS is not configured, and jurisdiction-specific legal/compliance review is outstanding. Do not represent any of these pending items as verified.

## Implemented in this scaffold

- Non-health backend routes deny unauthenticated requests by default. Access tokens must be signed JWTs whose issuer, audience, expiry, subject, and signing key are verified against the configured OIDC issuer's JWKS.
- Non-health requests also require an MFA method claim (`amr`) matching `OIDC_MFA_AMR_VALUES`. The default accepts `mfa`, `otp`, or `webauthn`; configure these values to match the identity provider's verified claims.
- `src/auth.ts` exports scope-check helpers. Every future handler must check the scopes required for its operation and derive the applicant identity from the verified token, not from request-body fields.
- Fastify applies Helmet security headers, a body-size limit, no-store response headers, redacted sensitive log fields, and a per-instance rate limit. Kong also rate-limits requests.
- S3 upload policies require SSE-KMS and restrict content type and size. Encrypted JSON settings use envelope encryption with AES-256-GCM and AWS KMS.

OAuth authorization, account recovery, MFA enrollment, and WebAuthn/passkey enrollment belong to a configured identity provider. This service verifies access tokens; it does not collect passwords or biometric data. Biometrics must remain on the user's device and be represented only by a trusted identity-provider authentication claim.

## Required production controls

- The `docker-compose.production.yml` overlay pins public Kong ingress to TLS 1.3 and refuses to render unless real certificate/key paths and provider URLs are supplied. Launch with `docker compose --env-file production.env -f docker-compose.yml -f docker-compose.production.yml up --build` after replacing every example value through a secret manager. Never use `production.env.example` values as credentials.
- Production service startup now fails closed unless the broker uses AMQPS; loan services use PostgreSQL `sslmode=verify-full`, TLS Redis, and configured S3/KMS keys; user services use TLS Redis; and compliance services use TLS MongoDB. Public TLS termination does not provide service-to-service mTLS. Add an approved service mesh or configure and test mutual TLS for every internal hop before production traffic.
- The local Compose stack uses HTTP and development-only passwords and must not be exposed to the internet.
- Use production-managed PostgreSQL, MongoDB, and Redis with encryption at rest, TLS in transit, private networking, least-privilege credentials, backups, key rotation, and tested recovery. Local Docker volumes are not encrypted by this project.
- Use a distributed gateway rate-limit policy for multiple Kong instances. Local in-memory rate limiting is not an abuse-control system by itself.
- Configure identity-provider MFA policies, short-lived tokens, key rotation, account lockout/recovery, consent and account deletion workflows, and monitoring for anomalous access.
- Keep uploaded documents private. Configure S3 Block Public Access, a bucket policy requiring the intended KMS key, narrowly scoped IAM permissions, malware/content scanning, retention/deletion policies, and audit monitoring. Verify actual file signatures after upload; browser-supplied MIME types are not trustworthy.
- Store secrets in a managed secret store, never in source control or local Compose defaults. Do not log tokens, identity attributes, document content, or unredacted request bodies.

## Verification gate

Run these steps from PowerShell on the Windows deployment workstation. Docker Desktop must be installed and running. If either version command fails, stop and mark Docker/TLS **NOT VERIFIED**; do not skip the check.

```powershell
docker --version
docker compose version
Set-Location "C:\Users\EHK STUDENT 004\Desktop\MOHAMED\Doh-project\backend"
npm run build
npm audit --omit=dev
```

Create the ignored `production.env` from `production.env.example` in a secure manner. Replace every example value with deployment-specific secrets, real OIDC settings, managed database/broker endpoints, AWS KMS/S3 settings, and valid TLS certificate paths. Never commit this file or use example credentials. Validate the merged production configuration before starting anything:

```powershell
docker compose --env-file production.env -f docker-compose.yml -f docker-compose.production.yml config
```

Only continue after the configuration renders successfully and the deployment owner confirms the Compose stack targets the intended test environment. Start the TLS profile:

```powershell
docker compose --env-file production.env -f docker-compose.yml -f docker-compose.production.yml up --build
```

In a second PowerShell window, verify the health route negotiates TLS 1.3 and the certificate is valid for the test hostname. Use the hostname on the certificate instead of `localhost` where required; do not use `-k`/`--insecure` for a passing verification:

```powershell
curl.exe -v --tlsv1.3 --tls-max 1.3 https://your-test-host/api/v1/loan/health
```

Also verify each service's `/ready` route through Kong, review certificate issuer/subject/expiry and TLS protocol, and confirm an unsupported TLS version is rejected. Capture the command output and environment/version used. A successful HTTP response without verified certificate and negotiated TLS details is not a passing TLS test.

After edge TLS passes, configure and test service-to-service mTLS for every internal hop using the selected service mesh or equivalent certificate system. The current overlay does not configure mTLS. Then complete penetration/security testing and the jurisdiction-specific review below. Re-run the build, dependency audit, OIDC fail-closed test, Compose validation, TLS tests, mTLS tests, and legal review after the final configuration changes.

| Gate | Status |
| --- | --- |
| Backend build and runtime dependency audit | Passed in the development environment |
| OIDC production startup fails closed when configuration is missing | Passed |
| Docker Compose production/TLS overlay | Not run; Docker unavailable in the previous check |
| TLS 1.3 certificate and protocol verification | Not run |
| Internal service-to-service mTLS | Not configured |
| Security testing | Pending deployment-specific test environment |
| Jurisdiction-specific legal/compliance review | Pending |
| Production readiness | **Blocked** until every gate is evidenced and reviewed |

## Regulatory work that remains

- **TILA (United States):** determine applicable product coverage; calculate and disclose APR, finance charges, payment schedule, and required terms at the correct time; test rounding and fee treatment with qualified counsel.
- **FCRA (United States):** establish permissible purpose and required authorizations for consumer reports, vendor controls, accuracy/dispute workflows, retention, and adverse-action notices where applicable.
- **AML/KYC:** select jurisdiction-specific customer due diligence, identity and sanctions screening, transaction monitoring, escalation/reporting, recordkeeping, and independent audit procedures. No screening or suspicious-activity reporting is implemented here.
- **GDPR:** identify roles and lawful bases; implement notices, minimization, data-subject access/correction/deletion workflows, retention limits, processor agreements, transfer safeguards, breach response, and any required DPIA.
- **CCPA/CPRA:** implement applicable notices, access/correction/deletion and opt-out requests, sensitive-data limits, service-provider contracts, and Global Privacy Control handling.

No route currently originates or stores loan applications through these adapters. Do not treat these controls as proof of TILA, FCRA, AML, GDPR, or CCPA compliance.