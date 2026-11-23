import json
import sqlite3
import random
import string
from datetime import datetime
from backend.db import get_db

def dict_from_row(row):
    if row is None:
        return None
    d = dict(row)
    for json_field in ['amenities', 'features', 'gallery']:
        if json_field in d and d[json_field]:
            try:
                d[json_field] = json.loads(d[json_field])
            except Exception:
                pass
    return d

def rows_to_list(rows):
    return [dict_from_row(r) for r in rows]

# ================= Users & Authentication =================
def authenticate_user(email, password):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, email, role, phone, kyc_status, avatar_url
            FROM users
            WHERE lower(email) = lower(?) AND password = ?;
        """, (email.strip(), password))
        row = cursor.fetchone()
        return dict_from_row(row) if row else None

def get_user_by_id(user_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email, role, phone, kyc_status, avatar_url FROM users WHERE id = ?;", (user_id,))
        row = cursor.fetchone()
        return dict_from_row(row) if row else None

def create_user(name, email, password, phone="", role="resident"):
    email = email.strip().lower()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE lower(email) = ?;", (email,))
        if cursor.fetchone():
            raise ValueError("An account with this email address already exists. Please sign in.")

        default_avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
        cursor.execute("""
            INSERT INTO users (name, email, password, phone, role, kyc_status, avatar_url)
            VALUES (?, ?, ?, ?, ?, 'Pending', ?);
        """, (name.strip(), email, password, phone.strip(), role, default_avatar))
        user_id = cursor.lastrowid
        conn.commit()
        return get_user_by_id(user_id)

# ================= Properties =================
def get_all_properties(status=None):
    with get_db() as conn:
        cursor = conn.cursor()
        if status:
            cursor.execute("SELECT * FROM properties WHERE status = ? ORDER BY id ASC;", (status,))
        else:
            cursor.execute("SELECT * FROM properties ORDER BY CASE status WHEN 'Active' THEN 1 ELSE 2 END, id ASC;")
        return rows_to_list(cursor.fetchall())

def get_property_by_id(property_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM properties WHERE id = ?;", (property_id,))
        return dict_from_row(cursor.fetchone())

# ================= Rooms & Inventory =================
def get_rooms(property_id=None, room_type=None, max_price=None, search=None, status=None):
    query = """
        SELECT r.*, p.name as property_name, p.area as property_area, p.city as property_city
        FROM rooms r
        JOIN properties p ON r.property_id = p.id
        WHERE 1=1
    """
    params = []

    if property_id:
        query += " AND r.property_id = ?"
        params.append(property_id)
    if room_type and room_type != 'all':
        query += " AND r.room_type = ?"
        params.append(room_type)
    if max_price:
        query += " AND r.price_monthly <= ?"
        params.append(float(max_price))
    if status:
        query += " AND r.status = ?"
        params.append(status)
    if search:
        query += " AND (r.name LIKE ? OR p.area LIKE ? OR p.city LIKE ? OR r.description LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term, term])

    query += " ORDER BY r.price_monthly ASC;"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return rows_to_list(cursor.fetchall())

def get_room_by_id(room_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.*, p.name as property_name, p.area as property_area, p.city as property_city, p.full_address
            FROM rooms r
            JOIN properties p ON r.property_id = p.id
            WHERE r.id = ?;
        """, (room_id,))
        room = dict_from_row(cursor.fetchone())
        if room:
            cursor.execute("SELECT * FROM beds WHERE room_id = ? ORDER BY bed_number ASC;", (room_id,))
            room['beds'] = rows_to_list(cursor.fetchall())
        return room

def create_room(data):
    features_json = json.dumps(data.get('features', []))
    gallery_json = json.dumps(data.get('gallery', []))
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO rooms (
                property_id, name, room_type, sharing_count, tag, price_monthly, security_deposit,
                size_sqft, furnishing, washroom_type, balcony, air_conditioned, cover_image,
                gallery, description, features, status, available_beds, total_beds
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            data['property_id'], data['name'], data['room_type'],
            int(data.get('sharing_count', 1)), data.get('tag', 'Comfort Living'),
            float(data['price_monthly']), float(data.get('security_deposit', data['price_monthly'])),
            int(data.get('size_sqft', 180)), data.get('furnishing', 'Fully Furnished'),
            data.get('washroom_type', 'Attached'), 1 if data.get('balcony') else 0,
            1 if data.get('air_conditioned', True) else 0, data['cover_image'],
            gallery_json, data.get('description', ''), features_json,
            data.get('status', 'Available'), int(data.get('available_beds', 1)),
            int(data.get('total_beds', 1))
        ))
        room_id = cursor.lastrowid
        # Also create initial bed
        cursor.execute("""
            INSERT INTO beds (room_id, bed_number, status)
            VALUES (?, ?, 'Available');
        """, (room_id, f"Bed-{room_id}-A"))
        return get_room_by_id(room_id)

def update_room(room_id, data):
    fields = []
    params = []
    allowed = ['name', 'price_monthly', 'security_deposit', 'status', 'available_beds', 'tag', 'description']
    for k in allowed:
        if k in data:
            fields.append(f"{k} = ?")
            params.append(data[k])
    if 'features' in data:
        fields.append("features = ?")
        params.append(json.dumps(data['features']))
    if 'gallery' in data:
        fields.append("gallery = ?")
        params.append(json.dumps(data['gallery']))

    if not fields:
        return get_room_by_id(room_id)

    params.append(room_id)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"UPDATE rooms SET {', '.join(fields)} WHERE id = ?;", params)
    return get_room_by_id(room_id)

# ================= Visits =================
def create_visit(data):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO visits (name, email, phone, property_id, room_id, visit_date, visit_time, tour_type, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled');
        """, (
            data['name'], data['email'], data['phone'],
            data.get('property_id'), data.get('room_id'),
            data['visit_date'], data.get('visit_time', '11:00 AM'),
            data.get('tour_type', 'In-Person'), data.get('notes', '')
        ))
        visit_id = cursor.lastrowid
        cursor.execute("""
            SELECT v.*, p.name as property_name, r.name as room_name
            FROM visits v
            LEFT JOIN properties p ON v.property_id = p.id
            LEFT JOIN rooms r ON v.room_id = r.id
            WHERE v.id = ?;
        """, (visit_id,))
        return dict_from_row(cursor.fetchone())

def get_all_visits():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT v.*, p.name as property_name, r.name as room_name
            FROM visits v
            LEFT JOIN properties p ON v.property_id = p.id
            LEFT JOIN rooms r ON v.room_id = r.id
            ORDER BY v.visit_date ASC, v.visit_time ASC;
        """)
        return rows_to_list(cursor.fetchall())

def update_visit_status(visit_id, status):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE visits SET status = ? WHERE id = ?;", (status, visit_id))
        cursor.execute("SELECT * FROM visits WHERE id = ?;", (visit_id,))
        return dict_from_row(cursor.fetchone())

# ================= Bookings & Reservations =================
def generate_booking_ref():
    chars = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"ASHRO-{datetime.now().year}-{chars}"

def create_booking(data):
    ref = generate_booking_ref()
    user_id = data.get('user_id', 1) # Default demo resident if not provided
    room = get_room_by_id(data['room_id'])
    if not room:
        raise ValueError("Room not found")

    monthly_rent = float(data.get('monthly_rent', room['price_monthly']))
    deposit = float(data.get('security_deposit', room['security_deposit']))
    token_paid = float(data.get('token_amount_paid', 2000.0))
    discount = float(data.get('discount_applied', 0.0))

    with get_db() as conn:
        cursor = conn.cursor()

        # Find first available bed
        cursor.execute("SELECT id FROM beds WHERE room_id = ? AND status = 'Available' LIMIT 1;", (room['id'],))
        bed_row = cursor.fetchone()
        bed_id = bed_row['id'] if bed_row else None

        cursor.execute("""
            INSERT INTO bookings (
                booking_reference, user_id, guest_name, guest_email, guest_phone,
                property_id, room_id, bed_id, move_in_date, tenure_months,
                monthly_rent, security_deposit, token_amount_paid, discount_applied,
                meal_plan_included, special_requests, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed');
        """, (
            ref, user_id, data['guest_name'], data['guest_email'], data['guest_phone'],
            room['property_id'], room['id'], bed_id, data['move_in_date'],
            int(data.get('tenure_months', 6)), monthly_rent, deposit, token_paid,
            discount, 1 if data.get('meal_plan_included', True) else 0,
            data.get('special_requests', '')
        ))
        booking_id = cursor.lastrowid

        # Create token fee invoice
        inv_ref = f"INV-{datetime.now().year}-{random.randint(1000, 9999)}"
        cursor.execute("""
            INSERT INTO invoices (invoice_number, booking_id, user_id, title, amount, due_date, paid_date, payment_method, status)
            VALUES (?, ?, ?, 'Token Advance Booking Deposit', ?, ?, ?, 'Instant Online Payment', 'Paid');
        """, (inv_ref, booking_id, user_id, token_paid, data['move_in_date'], datetime.now().strftime("%Y-%m-%d")))

        # If bed allocated, mark occupied
        if bed_id:
            cursor.execute("UPDATE beds SET status = 'Occupied', current_tenant_id = ? WHERE id = ?;", (user_id, bed_id))

        cursor.execute("""
            SELECT b.*, r.name as room_name, p.name as property_name, p.full_address
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN properties p ON b.property_id = p.id
            WHERE b.id = ?;
        """, (booking_id,))
        return dict_from_row(cursor.fetchone())

def get_bookings(user_id=None):
    query = """
        SELECT b.*, r.name as room_name, r.cover_image as room_image, r.room_type,
               p.name as property_name, p.full_address as property_address, p.area as property_area
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        JOIN properties p ON b.property_id = p.id
    """
    params = []
    if user_id:
        query += " WHERE b.user_id = ?"
        params.append(user_id)
    query += " ORDER BY b.id DESC;"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return rows_to_list(cursor.fetchall())

# ================= Invoices & Payments =================
def get_user_invoices(user_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT i.*, b.booking_reference
            FROM invoices i
            JOIN bookings b ON i.booking_id = b.id
            WHERE i.user_id = ?
            ORDER BY i.due_date DESC;
        """, (user_id,))
        return rows_to_list(cursor.fetchall())

def pay_invoice(invoice_id, payment_method="Online UPI"):
    with get_db() as conn:
        cursor = conn.cursor()
        today = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("""
            UPDATE invoices
            SET status = 'Paid', paid_date = ?, payment_method = ?
            WHERE id = ?;
        """, (today, payment_method, invoice_id))
        cursor.execute("SELECT * FROM invoices WHERE id = ?;", (invoice_id,))
        return dict_from_row(cursor.fetchone())

# ================= Tickets =================
def create_ticket(data):
    ticket_num = f"TCK-{random.randint(1100, 9999)}"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO tickets (ticket_number, user_id, room_id, category, title, description, priority, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Open');
        """, (
            ticket_num, data['user_id'], data['room_id'],
            data['category'], data['title'], data['description'],
            data.get('priority', 'Medium')
        ))
        t_id = cursor.lastrowid
        cursor.execute("SELECT * FROM tickets WHERE id = ?;", (t_id,))
        return dict_from_row(cursor.fetchone())

def get_user_tickets(user_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT t.*, r.name as room_name
            FROM tickets t
            JOIN rooms r ON t.room_id = r.id
            WHERE t.user_id = ?
            ORDER BY t.created_at DESC;
        """, (user_id,))
        return rows_to_list(cursor.fetchall())

def get_all_tickets():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT t.*, u.name as user_name, u.phone as user_phone, r.name as room_name
            FROM tickets t
            JOIN users u ON t.user_id = u.id
            JOIN rooms r ON t.room_id = r.id
            ORDER BY
                CASE t.status
                    WHEN 'Open' THEN 1
                    WHEN 'In Progress' THEN 2
                    WHEN 'Resolved' THEN 3
                    ELSE 4
                END,
                t.created_at DESC;
        """)
        return rows_to_list(cursor.fetchall())

def update_ticket_status(ticket_id, status, assigned_to=None, resolution_notes=None):
    with get_db() as conn:
        cursor = conn.cursor()
        fields = ["status = ?"]
        params = [status]
        if assigned_to:
            fields.append("assigned_to = ?")
            params.append(assigned_to)
        if resolution_notes:
            fields.append("resolution_notes = ?")
            params.append(resolution_notes)
        if status == 'Resolved':
            fields.append("resolved_at = CURRENT_TIMESTAMP")

        params.append(ticket_id)
        cursor.execute(f"UPDATE tickets SET {', '.join(fields)} WHERE id = ?;", params)
        cursor.execute("SELECT * FROM tickets WHERE id = ?;", (ticket_id,))
        return dict_from_row(cursor.fetchone())

# ================= Meals =================
def get_weekly_meals():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM meal_menu ORDER BY id ASC;")
        return rows_to_list(cursor.fetchall())

def get_user_meal_preferences(user_id, date_str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM meal_preferences
            WHERE user_id = ? AND date = ?;
        """, (user_id, date_str))
        return rows_to_list(cursor.fetchall())

def set_meal_preference(user_id, date_str, meal_type, status):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO meal_preferences (user_id, date, meal_type, status)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, date, meal_type) DO UPDATE SET status = excluded.status;
        """, (user_id, date_str, meal_type, status))
        cursor.execute("""
            SELECT * FROM meal_preferences WHERE user_id = ? AND date = ? AND meal_type = ?;
        """, (user_id, date_str, meal_type))
        return dict_from_row(cursor.fetchone())

# ================= Notices & Inquiries =================
def get_notices():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM notices ORDER BY is_pinned DESC, created_at DESC;")
        return rows_to_list(cursor.fetchall())

def create_inquiry(data):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO inquiries (name, email, phone, subject, message)
            VALUES (?, ?, ?, ?, ?);
        """, (data['name'], data['email'], data['phone'], data['subject'], data['message']))
        inquiry_id = cursor.lastrowid
        cursor.execute("SELECT * FROM inquiries WHERE id = ?;", (inquiry_id,))
        return dict_from_row(cursor.fetchone())

# ================= Admin Stats =================
def get_admin_dashboard_stats():
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) as total_properties FROM properties;")
        total_properties = cursor.fetchone()['total_properties']

        cursor.execute("SELECT COUNT(*) as total_rooms, SUM(total_beds) as total_beds, SUM(available_beds) as available_beds FROM rooms;")
        room_stats = cursor.fetchone()
        total_rooms = room_stats['total_rooms']
        total_beds = room_stats['total_beds'] or 0
        available_beds = room_stats['available_beds'] or 0
        occupied_beds = total_beds - available_beds
        occupancy_rate = round((occupied_beds / total_beds * 100), 1) if total_beds > 0 else 0

        cursor.execute("SELECT COUNT(*) as active_residents FROM users WHERE role = 'resident';")
        active_residents = cursor.fetchone()['active_residents']

        cursor.execute("SELECT SUM(amount) as revenue FROM invoices WHERE status = 'Paid';")
        revenue_collected = cursor.fetchone()['revenue'] or 0.0

        cursor.execute("SELECT SUM(amount) as pending FROM invoices WHERE status = 'Pending';")
        pending_rent = cursor.fetchone()['pending'] or 0.0

        cursor.execute("SELECT COUNT(*) as open_tickets FROM tickets WHERE status != 'Resolved';")
        open_tickets = cursor.fetchone()['open_tickets']

        cursor.execute("SELECT COUNT(*) as upcoming_visits FROM visits WHERE status = 'Scheduled';")
        upcoming_visits = cursor.fetchone()['upcoming_visits']

        cursor.execute("SELECT COUNT(*) as pending_kyc FROM kyc_records WHERE status = 'Under Review';")
        pending_kyc = cursor.fetchone()['pending_kyc']

        cursor.execute("SELECT * FROM bookings ORDER BY created_at DESC LIMIT 5;")
        recent_bookings = rows_to_list(cursor.fetchall())

        return {
            "total_properties": total_properties,
            "total_rooms": total_rooms,
            "total_beds": total_beds,
            "occupied_beds": occupied_beds,
            "available_beds": available_beds,
            "occupancy_rate": occupancy_rate,
            "active_residents": active_residents,
            "revenue_collected": revenue_collected,
            "pending_rent": pending_rent,
            "open_tickets": open_tickets,
            "upcoming_visits": upcoming_visits,
            "pending_kyc": pending_kyc,
            "recent_bookings": recent_bookings
        }

# ================= KYC Records =================
def get_user_kyc(user_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT k.*, u.name as user_name, u.email as user_email, u.phone as user_phone, u.avatar_url,
                   b.booking_reference, r.name as room_name, p.name as property_name
            FROM users u
            LEFT JOIN kyc_records k ON u.id = k.user_id
            LEFT JOIN bookings b ON u.id = b.user_id AND b.status = 'Confirmed'
            LEFT JOIN rooms r ON b.room_id = r.id
            LEFT JOIN properties p ON b.property_id = p.id
            WHERE u.id = ?;
        """, (user_id,))
        row = cursor.fetchone()
        if not row:
            return None
        d = dict_from_row(row)
        if not d.get("id"):
            return {
                "user_id": user_id,
                "user_name": d.get("user_name"),
                "user_email": d.get("user_email"),
                "user_phone": d.get("user_phone"),
                "room_name": d.get("room_name") or "Allocated Suite",
                "property_name": d.get("property_name") or "Ashro Living Amdavad",
                "status": "Pending Submission",
                "id_type": "Aadhaar Card",
                "id_number": "",
                "occupation_type": "Working Professional",
                "institution_name": "",
                "permanent_address": "",
                "city": "",
                "state": "Gujarat",
                "pincode": "",
                "emergency_name": "",
                "emergency_phone": "",
                "emergency_relation": "Parent",
                "id_front_image": None,
                "id_back_image": None,
                "work_id_image": None,
                "rejection_reason": None,
                "submitted_at": None,
                "verified_at": None
            }
        return d

def save_user_kyc(user_id, data):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO kyc_records (
                user_id, id_type, id_number, id_front_image, id_back_image,
                occupation_type, institution_name, work_id_image,
                permanent_address, city, state, pincode,
                emergency_name, emergency_phone, emergency_relation,
                status, rejection_reason, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Under Review', NULL, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                id_type = excluded.id_type,
                id_number = excluded.id_number,
                id_front_image = COALESCE(excluded.id_front_image, kyc_records.id_front_image),
                id_back_image = COALESCE(excluded.id_back_image, kyc_records.id_back_image),
                occupation_type = excluded.occupation_type,
                institution_name = excluded.institution_name,
                work_id_image = COALESCE(excluded.work_id_image, kyc_records.work_id_image),
                permanent_address = excluded.permanent_address,
                city = excluded.city,
                state = excluded.state,
                pincode = excluded.pincode,
                emergency_name = excluded.emergency_name,
                emergency_phone = excluded.emergency_phone,
                emergency_relation = excluded.emergency_relation,
                status = 'Under Review',
                rejection_reason = NULL,
                updated_at = CURRENT_TIMESTAMP;
        """, (
            user_id,
            data.get('id_type', 'Aadhaar Card'),
            data.get('id_number', ''),
            data.get('id_front_image'),
            data.get('id_back_image'),
            data.get('occupation_type', 'Working Professional'),
            data.get('institution_name', ''),
            data.get('work_id_image'),
            data.get('permanent_address', ''),
            data.get('city', ''),
            data.get('state', 'Gujarat'),
            data.get('pincode', ''),
            data.get('emergency_name', ''),
            data.get('emergency_phone', ''),
            data.get('emergency_relation', 'Parent')
        ))
        cursor.execute("UPDATE users SET kyc_status = 'Under Review' WHERE id = ?;", (user_id,))
    return get_user_kyc(user_id)

def get_all_kyc_records(status=None):
    with get_db() as conn:
        cursor = conn.cursor()
        query = """
            SELECT k.*, u.name as user_name, u.email as user_email, u.phone as user_phone, u.avatar_url,
                   r.name as room_name, p.name as property_name, b.booking_reference
            FROM kyc_records k
            JOIN users u ON k.user_id = u.id
            LEFT JOIN bookings b ON u.id = b.user_id AND b.status = 'Confirmed'
            LEFT JOIN rooms r ON b.room_id = r.id
            LEFT JOIN properties p ON b.property_id = p.id
        """
        params = []
        if status and status != 'all':
            query += " WHERE k.status = ?"
            params.append(status)
        query += " ORDER BY k.updated_at DESC;"
        cursor.execute(query, params)
        return rows_to_list(cursor.fetchall())

def update_kyc_status(kyc_id, status, rejection_reason=None):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM kyc_records WHERE id = ?;", (kyc_id,))
        row = cursor.fetchone()
        if not row:
            return None
        user_id = row['user_id']

        if status == 'Verified':
            cursor.execute("""
                UPDATE kyc_records
                SET status = 'Verified', rejection_reason = NULL, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?;
            """, (kyc_id,))
            cursor.execute("UPDATE users SET kyc_status = 'Verified' WHERE id = ?;", (user_id,))
        elif status == 'Rejected':
            cursor.execute("""
                UPDATE kyc_records
                SET status = 'Rejected', rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?;
            """, (rejection_reason or 'Document details unclear. Please re-upload.', kyc_id))
            cursor.execute("UPDATE users SET kyc_status = 'Rejected' WHERE id = ?;", (user_id,))
        else:
            cursor.execute("UPDATE kyc_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (status, kyc_id))
            cursor.execute("UPDATE users SET kyc_status = ? WHERE id = ?;", (status, user_id))

        cursor.execute("""
            SELECT k.*, u.name as user_name, u.email as user_email, u.phone as user_phone,
                   r.name as room_name, p.name as property_name
            FROM kyc_records k
            JOIN users u ON k.user_id = u.id
            LEFT JOIN bookings b ON u.id = b.user_id
            LEFT JOIN rooms r ON b.room_id = r.id
            LEFT JOIN properties p ON b.property_id = p.id
            WHERE k.id = ?;
        """, (kyc_id,))
        return dict_from_row(cursor.fetchone())
