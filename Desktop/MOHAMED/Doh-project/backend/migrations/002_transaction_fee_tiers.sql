CREATE TABLE IF NOT EXISTS transaction_fee_tiers (
    fee_tier_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    min_amount_kes INTEGER NOT NULL CHECK (min_amount_kes >= 0),
    max_amount_kes INTEGER NOT NULL CHECK (max_amount_kes >= min_amount_kes),
    fee_kes INTEGER NOT NULL CHECK (fee_kes >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (min_amount_kes),
    EXCLUDE USING gist (int4range(min_amount_kes, max_amount_kes, '[]') WITH &&)
);

INSERT INTO transaction_fee_tiers (min_amount_kes, max_amount_kes, fee_kes)
VALUES
    (500, 800, 29),
    (801, 1101, 31),
    (1102, 5000, 33),
    (5001, 11999, 50),
    (12000, 30000, 80)
ON CONFLICT (min_amount_kes) DO UPDATE
SET max_amount_kes = EXCLUDED.max_amount_kes,
    fee_kes = EXCLUDED.fee_kes;