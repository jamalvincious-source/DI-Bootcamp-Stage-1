CREATE TABLE IF NOT EXISTS loan_applications (
    application_id UUID PRIMARY KEY,
    applicant_user_id UUID NOT NULL,
    principal_minor BIGINT NOT NULL CHECK (principal_minor > 0),
    currency CHAR(3) NOT NULL DEFAULT 'KES',
    term_months SMALLINT NOT NULL CHECK (term_months BETWEEN 1 AND 360),
    apr_basis_points INTEGER NOT NULL CHECK (apr_basis_points BETWEEN 0 AND 10000),
    status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'declined', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loan_applications_user_created_idx
    ON loan_applications (applicant_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS repayment_schedule (
    schedule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES loan_applications(application_id) ON DELETE CASCADE,
    installment_number SMALLINT NOT NULL CHECK (installment_number > 0),
    due_date DATE NOT NULL,
    principal_minor BIGINT NOT NULL CHECK (principal_minor >= 0),
    interest_minor BIGINT NOT NULL CHECK (interest_minor >= 0),
    payment_minor BIGINT GENERATED ALWAYS AS (principal_minor + interest_minor) STORED,
    balance_minor BIGINT NOT NULL CHECK (balance_minor >= 0),
    UNIQUE (application_id, installment_number)
);

CREATE TABLE IF NOT EXISTS event_outbox (
    event_id UUID PRIMARY KEY,
    aggregate_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    schema_version SMALLINT NOT NULL DEFAULT 1,
    correlation_id UUID NOT NULL,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS event_outbox_unpublished_idx
    ON event_outbox (occurred_at) WHERE published_at IS NULL;