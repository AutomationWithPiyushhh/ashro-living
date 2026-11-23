import sqlite3
import json
import base64
from contextlib import contextmanager
from backend.config import DB_PATH, DATA_DIR

DATA_DIR.mkdir(parents=True, exist_ok=True)

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    room_type TEXT NOT NULL,
    sharing_count INTEGER DEFAULT 1,
    tag TEXT,
    price_monthly REAL NOT NULL,
    security_deposit REAL NOT NULL,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS beds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    bed_number TEXT NOT NULL,
    status TEXT DEFAULT 'Available',
    current_tenant_id INTEGER NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL DEFAULT 'password123',
    phone TEXT NOT NULL,
    role TEXT DEFAULT 'resident',
    kyc_status TEXT DEFAULT 'Verified',
    emergency_contact TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    property_id INTEGER,
    room_id INTEGER NULL,
    visit_date TEXT NOT NULL,
    visit_time TEXT NOT NULL,
    tour_type TEXT DEFAULT 'In-Person',
    notes TEXT,
    status TEXT DEFAULT 'Scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE SET NULL,
    FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_reference TEXT UNIQUE NOT NULL,
    user_id INTEGER,
    guest_name TEXT NOT NULL,
    guest_email TEXT NOT NULL,
    guest_phone TEXT NOT NULL,
    property_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    bed_id INTEGER NULL,
    move_in_date TEXT NOT NULL,
    tenure_months INTEGER DEFAULT 6,
    monthly_rent REAL NOT NULL,
    security_deposit REAL NOT NULL,
    token_amount_paid REAL DEFAULT 0.0,
    discount_applied REAL DEFAULT 0.0,
    meal_plan_included INTEGER DEFAULT 1,
    special_requests TEXT,
    status TEXT DEFAULT 'Confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (property_id) REFERENCES properties (id),
    FOREIGN KEY (room_id) REFERENCES rooms (id),
    FOREIGN KEY (bed_id) REFERENCES beds (id)
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    booking_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    due_date TEXT NOT NULL,
    paid_date TEXT NULL,
    payment_method TEXT,
    status TEXT DEFAULT 'Paid',
    receipt_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'In Progress',
    assigned_to TEXT DEFAULT 'Facility Team',
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meal_menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    menu_items TEXT NOT NULL,
    calories INTEGER DEFAULT 450,
    dietary_tags TEXT
);

CREATE TABLE IF NOT EXISTS meal_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    status TEXT DEFAULT 'Opted-In',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, date, meal_type)
);

CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    content TEXT NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'New',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kyc_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
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
    verified_at TIMESTAMP,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rooms_property ON rooms(property_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_user ON kyc_records(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_records(status);
"""

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def sanitize_legacy_svg_records(conn):
    """
    Safely migrates legacy unencoded SVG data strings into clean base64 data URLs
    so they cannot terminate HTML attributes or break image previewing.
    """
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, id_front_image, id_back_image, work_id_image FROM kyc_records;")
        rows = cursor.fetchall()
        for row in rows:
            updates = {}
            for col in ['id_front_image', 'id_back_image', 'work_id_image']:
                val = row[col]
                if val and val.startswith("data:image/svg+xml;utf8,"):
                    raw_svg = val[len("data:image/svg+xml;utf8,"):]
                    b64 = "data:image/svg+xml;base64," + base64.b64encode(raw_svg.encode("utf-8")).decode("utf-8")
                    updates[col] = b64
            if updates:
                set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
                params = list(updates.values()) + [row['id']]
                cursor.execute(f"UPDATE kyc_records SET {set_clause} WHERE id = ?;", params)
    except Exception as e:
        # Table might not exist yet during fresh install
        pass

def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA_SQL)
        sanitize_legacy_svg_records(conn)
    print("Database initialized successfully at", DB_PATH)

if __name__ == "__main__":
    init_db()
