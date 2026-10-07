const creditBureauTimeoutMs = 5000;
const creditBureauMaxRetries = 2;
const circuitBreakerFailureThreshold = 5;
const circuitBreakerCooldownMs = 30_000;
let consecutiveCreditBureauFailures = 0;
let circuitOpenedAt = 0;

export class LoanApplicationValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "LoanApplicationValidationError";
  }
}

function validateApplication(app) {
  if (!app || typeof app !== "object") {
    throw new LoanApplicationValidationError("Application must be an object");
  }
  if (typeof app.nationalId !== "string" || !/^\d{8}$/.test(app.nationalId)) {
    throw new LoanApplicationValidationError("Invalid Kenyan ID format");
  }
  if (typeof app.consentReference !== "string" || !app.consentReference.trim()) {
    throw new LoanApplicationValidationError("Credit bureau consent is required");
  }
  if (!Number.isSafeInteger(app.age) || app.age < 18) {
    throw new LoanApplicationValidationError("Applicant must be at least 18");
  }
  if (!Number.isFinite(app.income) || app.income < 0) {
    throw new LoanApplicationValidationError("Income must be a non-negative number");
  }
  if (!Number.isFinite(app.requestedAmount) || app.requestedAmount <= 0) {
    throw new LoanApplicationValidationError("Requested amount must be a positive number");
  }
}

function computeIncomeScore(income, amount) {
  const ratio = income / amount;
  if (ratio >= 3) return 20;
  if (ratio >= 1.5) return 10;
  if (ratio >= 1) return 5;
  return 0;
}

function computeAgeScore(age) {
  if (age >= 30 && age <= 60) return 10;
  if (age >= 25 && age < 30) return 5;
  return 0;
}

function getCreditBureauConfig() {
  if (typeof process === "undefined" || !process.env) {
    throw new Error("Credit bureau integration is available on the server only");
  }

  const apiUrl = process.env.CREDIT_BUREAU_API_URL;
  const apiKey = process.env.CREDIT_BUREAU_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error("Credit bureau integration is not configured");
  }

  let url;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new Error("CREDIT_BUREAU_API_URL must be a valid HTTPS URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("CREDIT_BUREAU_API_URL must use HTTPS");
  }

  return { url, apiKey };
}

function ensureCreditBureauCircuitClosed() {
  if (consecutiveCreditBureauFailures < circuitBreakerFailureThreshold) return;

  if (Date.now() - circuitOpenedAt < circuitBreakerCooldownMs) {
    throw new Error("Credit bureau service is temporarily unavailable");
  }

  consecutiveCreditBureauFailures = 0;
  circuitOpenedAt = 0;
}

function recordCreditBureauFailure() {
  consecutiveCreditBureauFailures += 1;
  if (consecutiveCreditBureauFailures >= circuitBreakerFailureThreshold) {
    circuitOpenedAt = Date.now();
  }
}

async function fetchCreditBureauReport(nationalId, consentReference) {
  const { url, apiKey } = getCreditBureauConfig();
  ensureCreditBureauCircuitClosed();

  for (let attempt = 0; attempt <= creditBureauMaxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ nationalId, consentReference }),
        signal: AbortSignal.timeout(creditBureauTimeoutMs),
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable) {
          throw new Error(`Retryable credit bureau HTTP status ${response.status}`);
        }
        throw new Error(`Credit bureau request failed with HTTP status ${response.status}`);
      }

      let report;
      try {
        report = await response.json();
      } catch {
        throw new Error("Credit bureau returned invalid JSON");
      }
      if (
        !report
        || typeof report !== "object"
        || !Number.isFinite(report.score)
        || report.score < 0
        || report.score > 100
        || typeof report.providerReference !== "string"
        || !report.providerReference.trim()
      ) {
        throw new Error("Credit bureau returned an invalid report");
      }

      consecutiveCreditBureauFailures = 0;
      circuitOpenedAt = 0;
      return { score: report.score, providerReference: report.providerReference };
    } catch (error) {
      const retryable = error instanceof TypeError
        || error instanceof Error && (
          error.name === "TimeoutError"
          || error.message.startsWith("Retryable credit bureau HTTP status")
        );

      if (!retryable || attempt === creditBureauMaxRetries) {
        recordCreditBureauFailure();
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 200 * (2 ** attempt)));
    }
  }

  throw new Error("Credit bureau request failed");
}

export async function processLoanApplication(app) {
  validateApplication(app);

  const creditReport = await fetchCreditBureauReport(app.nationalId, app.consentReference);
  let score = 50;
  score += computeIncomeScore(app.income, app.requestedAmount);
  score += computeAgeScore(app.age);
  score += Math.round((creditReport.score / 100) * 30);

  if (!app.email) score -= 5;
  if (!app.name || !app.lastname) score -= 10;
  score = Math.max(0, Math.min(100, score));

  return {
    status: "ManualReview",
    score,
    reason: "Score is advisory only; a human review is required for every application",
    creditBureauReference: creditReport.providerReference,
  };
}
