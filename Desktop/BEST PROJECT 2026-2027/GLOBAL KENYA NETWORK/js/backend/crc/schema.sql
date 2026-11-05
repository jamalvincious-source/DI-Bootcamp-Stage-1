```sql
-- =====================================================
-- GLOBAL NETWORK KENYA
-- PostgreSQL DATABASE SCHEMA
-- =====================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(30) UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'customer'
        CHECK (role IN ('super_admin', 'admin', 'advertiser', 'customer')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. BUSINESS CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. BUSINESSES
CREATE TABLE IF NOT EXISTS businesses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    business_name VARCHAR(200) NOT NULL,
    description TEXT,
    email VARCHAR(255),
    phone VARCHAR(30),
    website TEXT,
    location VARCHAR(255),
    county VARCHAR(100),
    logo_url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. ADVERTISING PACKAGES
CREATE TABLE IF NOT EXISTS packages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    package_name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. ADVERTISEMENTS
CREATE TABLE IF NOT EXISTS adverts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    package_id BIGINT REFERENCES packages(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    destination_url TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'paused', 'expired')),
    views BIGINT NOT NULL DEFAULT 0 CHECK (views >= 0),
    clicks BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date)
);

-- 6. CUSTOMER INQUIRIES
CREATE TABLE IF NOT EXISTS inquiries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    advert_id BIGINT REFERENCES adverts(id) ON DELETE SET NULL,
    customer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(30),
    subject VARCHAR(200),
    message TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'resolved', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    advert_id BIGINT REFERENCES adverts(id) ON DELETE SET NULL,
    package_id BIGINT REFERENCES packages(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'KES',
    payment_method VARCHAR(50),
    transaction_reference VARCHAR(150) UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. BUSINESS REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (business_id, customer_id)
);

-- 9. ADMIN ACTIVITY LOG
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(150) NOT NULL,
    entity_type VARCHAR(100),
    entity_id BIGINT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR BETTER DATABASE PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);

CREATE INDEX IF NOT EXISTS idx_businesses_owner
ON businesses(owner_id);

CREATE INDEX IF NOT EXISTS idx_businesses_category
ON businesses(category_id);

CREATE INDEX IF NOT EXISTS idx_businesses_status
ON businesses(status);

CREATE INDEX IF NOT EXISTS idx_adverts_business
ON adverts(business_id);

CREATE INDEX IF NOT EXISTS idx_adverts_status
ON adverts(status);

CREATE INDEX IF NOT EXISTS idx_inquiries_business
ON inquiries(business_id);

CREATE INDEX IF NOT EXISTS idx_payments_user
ON payments(user_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
ON payments(status);

CREATE INDEX IF NOT EXISTS idx_reviews_business
ON reviews(business_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
ON audit_logs(user_id);

-- =====================================================
-- AUTOMATIC UPDATED_AT FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS businesses_updated_at ON businesses;
CREATE TRIGGER businesses_updated_at
BEFORE UPDATE ON businesses
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS adverts_updated_at ON adverts;
CREATE TRIGGER adverts_updated_at
BEFORE UPDATE ON adverts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- DEFAULT BUSINESS CATEGORIES
-- =====================================================

INSERT INTO categories (name, description)
VALUES
('Real Estate', 'Houses, land and commercial property'),
('Automobiles', 'Cars, motorcycles and vehicle services'),
('Education', 'Schools, colleges and training institutions'),
('Technology', 'Software, computers and technology services'),
('Fashion', 'Clothing, shoes and accessories'),
('Food and Restaurants', 'Restaurants, catering and food products'),
('Health and Wellness', 'Health and wellness services'),
('Travel and Tourism', 'Hotels, tours and travel services'),
('Professional Services', 'Legal, accounting and consultancy services'),
('Shopping and Retail', 'Shops and online stores')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- DEFAULT ADVERTISING PACKAGES
-- Prices are example amounts in Kenyan shillings.
-- =====================================================

INSERT INTO packages
(package_name, description, price, duration_days, features)
VALUES
(
    'Basic',
    'Basic business advertising package',
    1000,
    7,
    '["Business listing", "Basic visibility"]'::jsonb
),
(
    'Standard',
    'Enhanced business advertising package',
    3000,
    30,
    '["Business listing", "Featured advert", "Contact information"]'::jsonb
),
(
    'Premium',
    'Premium advertising package',
    7000,
    30,
    '["Featured placement", "Business listing", "Enhanced visibility", "Performance statistics"]'::jsonb
)
ON CONFLICT (package_name) DO NOTHING;

-- =====================================================
-- DATABASE CHECK
-- =====================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```