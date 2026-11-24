-- ============================================================
-- Ashro Living / Bhagwati PG Group — Supabase PostgreSQL Schema
-- Run this in your Supabase Project -> SQL Editor -> Click 'Run'
-- ============================================================

-- Clean existing tables if resetting
DROP TABLE IF EXISTS kyc_records CASCADE;
DROP TABLE IF EXISTS inquiries CASCADE;
DROP TABLE IF EXISTS notices CASCADE;
DROP TABLE IF EXISTS meal_preferences CASCADE;
DROP TABLE IF EXISTS meal_menu CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS visits CASCADE;
DROP TABLE IF EXISTS beds CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS properties CASCADE;

-- 1. Properties (Branches in Amdavad)
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    city TEXT NOT NULL,
    area TEXT NOT NULL,
    full_address TEXT NOT NULL,
    gender_type TEXT DEFAULT 'Unisex',
    total_rooms INTEGER DEFAULT 0,
    hero_image TEXT,
    description TEXT,
    amenities TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Rooms (Suites & inventory)
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    room_type TEXT NOT NULL,
    sharing_count INTEGER DEFAULT 1,
    tag TEXT,
    price_monthly NUMERIC(10, 2) NOT NULL,
    security_deposit NUMERIC(10, 2) NOT NULL,
    size_sqft INTEGER DEFAULT 180,
    furnishing TEXT DEFAULT 'Fully Furnished',
    washroom_type TEXT DEFAULT 'Attached',
    balcony INTEGER DEFAULT 0,
    air_conditioned INTEGER DEFAULT 1,
    cover_image TEXT NOT NULL,
    gallery TEXT,
    description TEXT,
    features TEXT,
    status TEXT DEFAULT 'Available',
    available_beds INTEGER DEFAULT 1,
    total_beds INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Individual Beds
CREATE TABLE beds (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    bed_number TEXT NOT NULL,
    status TEXT DEFAULT 'Available',
    current_tenant_id INTEGER NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Users (Admin and Residents)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL DEFAULT 'password123',
    phone TEXT NOT NULL,
    role TEXT DEFAULT 'resident',
    kyc_status TEXT DEFAULT 'Verified',
    emergency_contact TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. PG Visits
CREATE TABLE visits (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    visit_date TEXT NOT NULL,
    visit_time TEXT NOT NULL,
    tour_type TEXT DEFAULT 'In-Person',
    notes TEXT,
    status TEXT DEFAULT 'Scheduled',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bookings (Lease Agreements)
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    booking_reference TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    guest_name TEXT NOT NULL,
    guest_email TEXT NOT NULL,
    guest_phone TEXT NOT NULL,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    bed_id INTEGER REFERENCES beds(id) ON DELETE SET NULL,
    move_in_date TEXT NOT NULL,
    tenure_months INTEGER DEFAULT 6,
    monthly_rent NUMERIC(10, 2) NOT NULL,
    security_deposit NUMERIC(10, 2) NOT NULL,
    token_amount_paid NUMERIC(10, 2) DEFAULT 0.0,
    discount_applied NUMERIC(10, 2) DEFAULT 0.0,
    meal_plan_included INTEGER DEFAULT 1,
    special_requests TEXT,
    status TEXT DEFAULT 'Confirmed',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Invoices & Receipts
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    due_date TEXT NOT NULL,
    paid_date TEXT NULL,
    payment_method TEXT NULL,
    status TEXT DEFAULT 'Pending',
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tickets (Maintenance & Service Desk)
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    ticket_number TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Open',
    assigned_to TEXT,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Weekly Food Menu
CREATE TABLE meal_menu (
    id SERIAL PRIMARY KEY,
    day_of_week TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    menu_items TEXT NOT NULL,
    calories INTEGER DEFAULT 450,
    dietary_tags TEXT DEFAULT 'Vegetarian',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. Resident Dinner Opt-in/out Preferences
CREATE TABLE meal_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL DEFAULT 'Dinner',
    status TEXT NOT NULL DEFAULT 'Opted-In',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, date, meal_type)
);

-- 11. Bulletins & Community Notices
CREATE TABLE notices (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    content TEXT NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. Contact Form Inquiries
CREATE TABLE inquiries (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'New',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. Digital Tenant KYC Identity
CREATE TABLE kyc_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    id_type TEXT NOT NULL DEFAULT 'Aadhaar Card',
    id_number TEXT,
    id_front_image TEXT,
    id_back_image TEXT,
    occupation_type TEXT DEFAULT 'Working Professional',
    institution_name TEXT,
    work_id_image TEXT,
    permanent_address TEXT,
    city TEXT,
    state TEXT DEFAULT 'Gujarat',
    pincode TEXT,
    emergency_name TEXT,
    emergency_phone TEXT,
    emergency_relation TEXT DEFAULT 'Parent',
    status TEXT DEFAULT 'Under Review',
    rejection_reason TEXT,
    verified_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX idx_rooms_property ON rooms(property_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_tickets_user ON tickets(user_id);
CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_kyc_user ON kyc_records(user_id);
CREATE INDEX idx_kyc_status ON kyc_records(status);

-- ============================================================
-- Done! Supabase tables are ready for permanent storage.
-- ============================================================
