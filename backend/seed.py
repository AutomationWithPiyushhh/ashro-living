import json
import sqlite3
from datetime import datetime, timedelta
from backend.db import get_db, init_db

def seed_database():
    init_db()

    with get_db() as conn:
        cursor = conn.cursor()

        # Clean existing data
        cursor.execute("DELETE FROM inquiries;")
        cursor.execute("DELETE FROM kyc_records;")
        cursor.execute("DELETE FROM notices;")
        cursor.execute("DELETE FROM meal_preferences;")
        cursor.execute("DELETE FROM meal_menu;")
        cursor.execute("DELETE FROM tickets;")
        cursor.execute("DELETE FROM invoices;")
        cursor.execute("DELETE FROM bookings;")
        cursor.execute("DELETE FROM visits;")
        cursor.execute("DELETE FROM beds;")
        cursor.execute("DELETE FROM users;")
        cursor.execute("DELETE FROM rooms;")
        cursor.execute("DELETE FROM properties;")
        cursor.execute("DELETE FROM sqlite_sequence;")

        # 1. Properties (Amdavad active + upcoming)
        properties_data = [
            # Active Branches in Amdavad
            (
                "Ashro Living — Vastral",
                "vastral",
                "Amdavad",
                "Vastral",
                "Near Nirant Cross Road, SP Ring Road, Vastral, Amdavad, Gujarat 382418",
                "Unisex / Separate Floors",
                32,
                "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1920&q=80",
                "Located near Nirant Cross Road and SP Ring Road. Perfect for students and working professionals. Direct transport to Odhav, Nikol, and ring road offices.",
                json.dumps([
                    "Free High-Speed Wi-Fi",
                    "3 Times Homemade Meals Included",
                    "Daily Room & Bathroom Cleaning",
                    "24/7 CCTV & Security Guard",
                    "RO Drinking Water",
                    "100% Power Backup (No Power Cuts)",
                    "Washing Machine & Laundry Area",
                    "Hot Water Geyser in Every Bathroom"
                ]),
                "Active"
            ),
            (
                "Ashro Living — Naroda",
                "naroda",
                "Amdavad",
                "Naroda",
                "Near Galaxy Cinema, Naroda-Dehgam Road, Naroda, Amdavad, Gujarat 382330",
                "Unisex / Separate Floors",
                28,
                "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1920&q=80",
                "Located right on Naroda-Dehgam road near Galaxy Cinema. Close to Naroda GIDC, hospitals, and markets. Easy bus and auto availability.",
                json.dumps([
                    "Free High-Speed Wi-Fi",
                    "Daily Fresh Breakfast, Lunch & Dinner",
                    "Daily Room Cleaning",
                    "CCTV Camera & Safe Environment",
                    "RO Purified Water",
                    "Vehicle Parking Space"
                ]),
                "Active"
            ),
            (
                "Ashro Living — Rabari Colony Metro",
                "rabari-colony",
                "Amdavad",
                "Rabari Colony",
                "Opposite Metro Pillar 118, Rabari Colony Metro Station, Amraiwadi, Amdavad, Gujarat 380026",
                "Unisex / Separate Floors",
                24,
                "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1920&q=80",
                "Just 2 minutes walk from Rabari Colony Metro Station. Direct metro line to Kalupur Railway Station, Gandhinagar, and West Ahmedabad.",
                json.dumps([
                    "2 Minutes Walk to Metro Station",
                    "Free Fast Wi-Fi",
                    "3 Homemade Meals Included",
                    "Biometric Fingerprint Entry",
                    "Personal Study Table in Room",
                    "Power Backup"
                ]),
                "Active"
            ),
            # Upcoming Locations in Amdavad
            (
                "Ashro Living — CG Road",
                "cg-road",
                "Amdavad",
                "CG Road",
                "Off CG Road, Near Municipal Market, Navrangpura / CG Road, Amdavad 380009",
                "Unisex",
                40,
                "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1920&q=80",
                "Opening soon in the heart of Ahmedabad on CG Road. Walkable to colleges, coaching institutes, and offices.",
                json.dumps(["AC Rooms", "Attached Washrooms", "Food Included", "Wi-Fi"]),
                "Upcoming"
            ),
            (
                "Ashro Living — Thaltej",
                "thaltej",
                "Amdavad",
                "Thaltej",
                "Near Sindhu Bhavan Road & SG Highway, Thaltej, Amdavad 380059",
                "Unisex",
                36,
                "https://images.unsplash.com/photo-1600573472550-8090b5e0745e?auto=format&fit=crop&w=1920&q=80",
                "Opening soon near Sindhu Bhavan Road and SG Highway. Ideal for corporate employees working on SG Highway.",
                json.dumps(["AC Rooms", "Attached Washrooms", "Food Included", "Wi-Fi"]),
                "Upcoming"
            ),
            (
                "Ashro Living — Vastrapur",
                "vastrapur",
                "Amdavad",
                "Vastrapur",
                "Near Vastrapur Lake, Vastrapur, Amdavad 380015",
                "Unisex",
                30,
                "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1920&q=80",
                "Opening soon near Vastrapur Lake, IIM Ahmedabad, and Alpha One Mall. Great for students and young working professionals.",
                json.dumps(["AC Rooms", "Attached Washrooms", "Food Included", "Wi-Fi"]),
                "Upcoming"
            ),
            (
                "Ashro Living — Navrangpura",
                "navrangpura",
                "Amdavad",
                "Navrangpura",
                "Near Commerce Six Roads, Navrangpura, Amdavad 380009",
                "Unisex",
                26,
                "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1920&q=80",
                "Opening soon near Commerce Six Roads and Gujarat University campus. Perfect for college students.",
                json.dumps(["AC Rooms", "Attached Washrooms", "Food Included", "Wi-Fi"]),
                "Upcoming"
            )
        ]

        cursor.executemany("""
            INSERT INTO properties (name, slug, city, area, full_address, gender_type, total_rooms, hero_image, description, amenities, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, properties_data)

        cursor.execute("SELECT id, slug FROM properties;")
        prop_map = {row['slug']: row['id'] for row in cursor.fetchall()}
        prop_vastral_id = prop_map["vastral"]
        prop_naroda_id = prop_map["naroda"]
        prop_rabari_id = prop_map["rabari-colony"]

        # 2. Users (Admin / Owner & Demo Resident)
        users_data = [
            (
                "Aarav Sharma",
                "aarav@example.com",
                "resident123",
                "9876543210",
                "resident",
                "Verified",
                "Rajesh Sharma (Father) — 9876543210",
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
            ),
            (
                "Admin",
                "vasudevahir21@gmail.com",
                "admin123",
                "9876543210",
                "admin",
                "Verified",
                "Owner Direct — 9876543210",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"
            ),
            (
                "Kavya Patel",
                "kavya.patel@example.com",
                "resident123",
                "9876543210",
                "resident",
                "Verified",
                "Hitesh Patel — 9876543210",
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80"
            )
        ]

        cursor.executemany("""
            INSERT INTO users (name, email, password, phone, role, kyc_status, emergency_contact, avatar_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """, users_data)

        # Seed initial KYC Records
        aadhaar_aarav_front = (
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">'
            '<rect width="400" height="250" fill="%23FFFFFF" rx="8" stroke="%23DED5C9" stroke-width="2"/>'
            '<rect width="400" height="35" fill="%23302720"/>'
            '<text x="20" y="23" fill="%23FFFFFF" font-family="sans-serif" font-size="12" font-weight="bold">GOVERNMENT OF INDIA • AADHAAR CARD</text>'
            '<rect x="25" y="55" width="80" height="100" fill="%23E8DED1" rx="4"/>'
            '<circle cx="65" cy="90" r="25" fill="%23B69B83"/>'
            '<path d="M40 140 C40 115 90 115 90 140 Z" fill="%23B69B83"/>'
            '<text x="125" y="75" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23302720">NAME: AARAV SHARMA</text>'
            '<text x="125" y="98" font-family="sans-serif" font-size="11" fill="%23756D65">DOB: 14/08/1998 • Gender: Male</text>'
            '<text x="125" y="125" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23765B49">XXXX XXXX 8241</text>'
            '<rect x="0" y="220" width="400" height="30" fill="%23F7F3ED"/>'
            '<text x="20" y="238" font-family="sans-serif" font-size="10" fill="%23756D65">Mera Aadhaar, Meri Pehchaan • Verified</text></svg>'
        )

        aadhaar_aarav_back = (
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">'
            '<rect width="400" height="250" fill="%23FFFFFF" rx="8" stroke="%23DED5C9" stroke-width="2"/>'
            '<rect width="400" height="35" fill="%23302720"/>'
            '<text x="20" y="23" fill="%23FFFFFF" font-family="sans-serif" font-size="12" font-weight="bold">UNIQUE IDENTIFICATION AUTHORITY OF INDIA</text>'
            '<text x="25" y="70" font-family="sans-serif" font-size="11" font-weight="bold" fill="%23302720">Permanent Address:</text>'
            '<text x="25" y="92" font-family="sans-serif" font-size="11" fill="%23756D65">B-402, Shivalik Residency, 150 Feet Ring Road</text>'
            '<text x="25" y="112" font-family="sans-serif" font-size="11" fill="%23756D65">Rajkot, Gujarat - 360005</text>'
            '<rect x="25" y="145" width="350" height="40" fill="%23E8DED1" rx="4"/>'
            '<text x="40" y="170" font-family="monospace" font-size="11" fill="%23302720">||| | ||||| || |||||| | |||| ||| ||||</text>'
            '<rect x="0" y="220" width="400" height="30" fill="%23F7F3ED"/>'
            '<text x="20" y="238" font-family="sans-serif" font-size="10" fill="%23756D65">Official Proof of Residence</text></svg>'
        )

        work_id_aarav = (
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">'
            '<rect width="400" height="250" fill="%23FFFFFF" rx="8" stroke="%23DED5C9" stroke-width="2"/>'
            '<rect width="400" height="35" fill="%23765B49"/>'
            '<text x="20" y="23" fill="%23FFFFFF" font-family="sans-serif" font-size="12" font-weight="bold">EMPLOYEE ID • TATA CONSULTANCY SERVICES</text>'
            '<rect x="25" y="55" width="80" height="100" fill="%23E8DED1" rx="4"/>'
            '<circle cx="65" cy="90" r="25" fill="%23B69B83"/>'
            '<path d="M40 140 C40 115 90 115 90 140 Z" fill="%23B69B83"/>'
            '<text x="125" y="75" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23302720">AARAV SHARMA</text>'
            '<text x="125" y="95" font-family="sans-serif" font-size="11" fill="%23756D65">Designation: Systems Engineer</text>'
            '<text x="125" y="115" font-family="sans-serif" font-size="11" fill="%23756D65">Emp ID: TCS-748921</text>'
            '<text x="125" y="135" font-family="sans-serif" font-size="11" fill="%23756D65">Campus: Infocity, Gandhinagar</text>'
            '<rect x="0" y="220" width="400" height="30" fill="%23F7F3ED"/>'
            '<text x="20" y="238" font-family="sans-serif" font-size="10" fill="%23756D65">Corporate Employment Verification Card</text></svg>'
        )

        aadhaar_kavya_front = (
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">'
            '<rect width="400" height="250" fill="%23FFFFFF" rx="8" stroke="%23DED5C9" stroke-width="2"/>'
            '<rect width="400" height="35" fill="%23302720"/>'
            '<text x="20" y="23" fill="%23FFFFFF" font-family="sans-serif" font-size="12" font-weight="bold">GOVERNMENT OF INDIA • AADHAAR CARD</text>'
            '<rect x="25" y="55" width="80" height="100" fill="%23E8DED1" rx="4"/>'
            '<circle cx="65" cy="90" r="25" fill="%23B69B83"/>'
            '<path d="M40 140 C40 115 90 115 90 140 Z" fill="%23B69B83"/>'
            '<text x="125" y="75" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23302720">NAME: KAVYA PATEL</text>'
            '<text x="125" y="98" font-family="sans-serif" font-size="11" fill="%23756D65">DOB: 22/11/2002 • Gender: Female</text>'
            '<text x="125" y="125" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23765B49">XXXX XXXX 5192</text>'
            '<rect x="0" y="220" width="400" height="30" fill="%23F7F3ED"/>'
            '<text x="20" y="238" font-family="sans-serif" font-size="10" fill="%23756D65">Mera Aadhaar, Meri Pehchaan • Pending Review</text></svg>'
        )

        college_id_kavya = (
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">'
            '<rect width="400" height="250" fill="%23FFFFFF" rx="8" stroke="%23DED5C9" stroke-width="2"/>'
            '<rect width="400" height="35" fill="%23B69B83"/>'
            '<text x="20" y="23" fill="%23302720" font-family="sans-serif" font-size="12" font-weight="bold">STUDENT ID • NIRMA UNIVERSITY</text>'
            '<rect x="25" y="55" width="80" height="100" fill="%23E8DED1" rx="4"/>'
            '<circle cx="65" cy="90" r="25" fill="%23B69B83"/>'
            '<path d="M40 140 C40 115 90 115 90 140 Z" fill="%23B69B83"/>'
            '<text x="125" y="75" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23302720">KAVYA PATEL</text>'
            '<text x="125" y="95" font-family="sans-serif" font-size="11" fill="%23756D65">Program: B.Tech Computer Engineering</text>'
            '<text x="125" y="115" font-family="sans-serif" font-size="11" fill="%23756D65">Roll No: 2024-BTECH-CE-082</text>'
            '<text x="125" y="135" font-family="sans-serif" font-size="11" fill="%23756D65">Campus: SG Highway, Ahmedabad</text>'
            '<rect x="0" y="220" width="400" height="30" fill="%23F7F3ED"/>'
            '<text x="20" y="238" font-family="sans-serif" font-size="10" fill="%23756D65">Valid Academic ID 2024-2028</text></svg>'
        )

        kyc_data = [
            (
                1, # Aarav Sharma
                "Aadhaar Card",
                "XXXX XXXX 8241",
                aadhaar_aarav_front,
                aadhaar_aarav_back,
                "Working Professional",
                "Tata Consultancy Services (TCS), Gandhinagar",
                work_id_aarav,
                "B-402, Shivalik Residency, 150 Feet Ring Road",
                "Rajkot",
                "Gujarat",
                "360005",
                "Rajesh Sharma",
                "9876543210",
                "Father",
                "Verified",
                None,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ),
            (
                3, # Kavya Patel
                "Aadhaar Card",
                "XXXX XXXX 5192",
                aadhaar_kavya_front,
                aadhaar_aarav_back,
                "Student",
                "Nirma University, Ahmedabad",
                college_id_kavya,
                "A-12, Nilkanth Society, Near Bus Station",
                "Surat",
                "Gujarat",
                "395009",
                "Hitesh Patel",
                "9876543210",
                "Father",
                "Under Review",
                None,
                None
            )
        ]

        cursor.executemany("""
            INSERT INTO kyc_records (
                user_id, id_type, id_number, id_front_image, id_back_image,
                occupation_type, institution_name, work_id_image,
                permanent_address, city, state, pincode,
                emergency_name, emergency_phone, emergency_relation,
                status, rejection_reason, verified_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, kyc_data)

        cursor.execute("UPDATE users SET kyc_status = 'Under Review' WHERE id = 3;")

        # 3. Rooms & Suites (Simple, practical names for students and professionals)
        rooms_data = [
            (
                prop_vastral_id,
                "Single Private Room (AC)",
                "Single Private Room",
                1,
                "Most Popular",
                14500.0,
                14500.0,
                210,
                "Fully Furnished",
                "Attached Bathroom",
                1,
                1,
                "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80",
                json.dumps([
                    "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80",
                    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80"
                ]),
                "A private room for 1 person with comfortable bed, attached bathroom with hot water geyser, dedicated study table and chair, personal wardrobe with lock, and split AC.",
                json.dumps(["Single Bed with Soft Mattress", "Attached Bathroom with Geyser", "Study Table and Chair", "Split AC", "Personal Lockable Wardrobe", "Free High-Speed Wi-Fi"]),
                "Available",
                2,
                3
            ),
            (
                prop_vastral_id,
                "2 Sharing Room (Double)",
                "Double Sharing",
                2,
                "Best Value",
                8500.0,
                8500.0,
                250,
                "Fully Furnished",
                "Attached Bathroom",
                0,
                1,
                "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
                json.dumps([
                    "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80"
                ]),
                "Spacious room for 2 people. Each person gets a separate bed, personal study desk, and separate wardrobe with lock. Includes attached washroom and AC.",
                json.dumps(["2 Separate Single Beds", "Attached Bathroom with Hot Water", "Separate Wardrobe for Each Person", "2 Study Desks", "Split AC"]),
                "Available",
                3,
                6
            ),
            (
                prop_vastral_id,
                "Studio Room (with Balcony)",
                "Studio Living",
                1,
                "Premium Comfort",
                18500.0,
                18500.0,
                310,
                "Fully Furnished",
                "Attached Bathroom",
                1,
                1,
                "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=800&q=80",
                json.dumps([
                    "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=800&q=80"
                ]),
                "Large private room with a private balcony, mini sofa seating, small fridge access, attached bathroom, and smart TV.",
                json.dumps(["Double Bed", "Private Balcony with Open View", "Attached Bathroom", "Mini Fridge Access", "Smart TV", "Split AC"]),
                "Available",
                1,
                2
            ),
            (
                prop_naroda_id,
                "Single Room (AC) — Naroda",
                "Single Private Room",
                1,
                "Quiet & Comfortable",
                13500.0,
                13500.0,
                195,
                "Fully Furnished",
                "Attached Bathroom",
                1,
                1,
                "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80",
                json.dumps([
                    "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80"
                ]),
                "Private single room located near Galaxy Cinema on Naroda-Dehgam road. Comes with attached washroom, balcony, AC, and study table.",
                json.dumps(["Single Bed with Mattress", "Attached Bathroom with Geyser", "Study Table", "Personal Cupboard", "Split AC"]),
                "Available",
                2,
                4
            ),
            (
                prop_naroda_id,
                "2 Sharing Room (Double) — Naroda",
                "Double Sharing",
                2,
                "Affordable Sharing",
                8000.0,
                8000.0,
                240,
                "Fully Furnished",
                "Attached Bathroom",
                0,
                1,
                "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
                json.dumps([
                    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80"
                ]),
                "Comfortable 2 sharing room with 2 separate beds, separate wardrobes, attached bathroom, and Wi-Fi. All meals included in rent.",
                json.dumps(["2 Single Beds", "Attached Bathroom", "2 Lockable Wardrobes", "Study Tables", "Wi-Fi"]),
                "Available",
                4,
                8
            ),
            (
                prop_rabari_id,
                "Single Room (Near Metro)",
                "Single Private Room",
                1,
                "Metro Connected",
                12500.0,
                12500.0,
                190,
                "Fully Furnished",
                "Attached Bathroom",
                1,
                1,
                "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
                json.dumps([
                    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80"
                ]),
                "Just 2 minutes from Rabari Colony Metro Station. Quick access to railway station and city center. Single room with attached bathroom and balcony.",
                json.dumps(["Single Bed", "Attached Bathroom", "Balcony View", "Study Table", "Fast Wi-Fi"]),
                "Available",
                2,
                4
            )
        ]

        cursor.executemany("""
            INSERT INTO rooms (
                property_id, name, room_type, sharing_count, tag, price_monthly, security_deposit,
                size_sqft, furnishing, washroom_type, balcony, air_conditioned, cover_image,
                gallery, description, features, status, available_beds, total_beds
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, rooms_data)

        # 4. Beds
        beds_data = [
            (1, "Room-101-Bed-A", "Occupied", 1), # Room 1 occupied by Aarav Sharma
            (1, "Room-102-Bed-A", "Available", None),
            (1, "Room-103-Bed-A", "Available", None),
            (2, "Room-201-Bed-A", "Occupied", 3), # Room 2 occupied by Kavya
            (2, "Room-201-Bed-B", "Available", None),
            (3, "Room-301-Bed-A", "Available", None),
            (4, "Room-401-Bed-A", "Available", None),
            (5, "Room-501-Bed-A", "Available", None),
            (6, "Room-601-Bed-A", "Available", None)
        ]
        cursor.executemany("""
            INSERT INTO beds (room_id, bed_number, status, current_tenant_id)
            VALUES (?, ?, ?, ?);
        """, beds_data)

        # 5. Active Lease for Aarav Sharma
        today = datetime.now()
        move_in = (today - timedelta(days=30)).strftime("%Y-%m-%d")
        cursor.execute("""
            INSERT INTO bookings (
                booking_reference, user_id, guest_name, guest_email, guest_phone,
                property_id, room_id, bed_id, move_in_date, tenure_months,
                monthly_rent, security_deposit, token_amount_paid, discount_applied,
                meal_plan_included, special_requests, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            "ASHRO-2026-9042",
            1,
            "Aarav Sharma",
            "aarav@example.com",
            "9876543210",
            prop_vastral_id,
            1, # Single Private Room (AC)
            1, # Room-101-Bed-A
            move_in,
            6,
            14500.0,
            14500.0,
            5000.0,
            1000.0,
            1,
            "Corner room with good natural daylight.",
            "Active"
        ))

        # 6. Invoices
        invoices_data = [
            (
                "INV-2026-0101",
                1,
                1,
                "Security Deposit (100% Refundable)",
                14500.0,
                move_in,
                move_in,
                "UPI Transfer",
                "Paid",
                "/receipts/INV-2026-0101.pdf"
            ),
            (
                "INV-2026-0102",
                1,
                1,
                "Monthly Rent — Previous Month",
                13500.0,
                (today - timedelta(days=30)).strftime("%Y-%m-%d"),
                (today - timedelta(days=28)).strftime("%Y-%m-%d"),
                "Online Payment (GPay)",
                "Paid",
                "/receipts/INV-2026-0102.pdf"
            ),
            (
                "INV-2026-0158",
                1,
                1,
                "Monthly Rent — Current Month",
                13500.0,
                (today + timedelta(days=5)).strftime("%Y-%m-%d"),
                None,
                None,
                "Pending",
                None
            )
        ]
        cursor.executemany("""
            INSERT INTO invoices (invoice_number, booking_id, user_id, title, amount, due_date, paid_date, payment_method, status, receipt_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, invoices_data)

        # 7. Tickets
        tickets_data = [
            (
                "TCK-201",
                1,
                1,
                "Wi-Fi",
                "Check Wi-Fi router on 2nd floor",
                "Wi-Fi speed is slow in evening between 8 PM to 10 PM. Please check router.",
                "Medium",
                "In Progress",
                "Wi-Fi Technician",
                "Router settings updated, checking speed today."
            ),
            (
                "TCK-189",
                1,
                1,
                "Cleaning",
                "Extra bedsheet change requested",
                "Requested extra fresh bedsheet for weekend.",
                "Low",
                "Resolved",
                "Cleaning Staff",
                "Fresh bedsheet provided."
            )
        ]
        cursor.executemany("""
            INSERT INTO tickets (ticket_number, user_id, room_id, category, title, description, priority, status, assigned_to, resolution_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, tickets_data)

        # 8. Weekly Food Menu (Easy, familiar home food names)
        meals = [
            ("Monday", "Breakfast", "Methi Thepla with Fresh Curd, Pickle, and Hot Masala Tea / Coffee", 420, "Vegetarian"),
            ("Monday", "Lunch", "Paneer Sabzi, Dal Fry, Jeera Rice, Soft Roti, and Green Salad", 650, "Vegetarian"),
            ("Monday", "Evening Snacks", "Hot Handvo with Green Chutney, Tea", 210, "Snack"),
            ("Monday", "Dinner", "Kadhi Khichdi with Ghee, Batata Nu Shaak, Papad, Sweet Mohan Thal", 680, "Vegetarian"),

            ("Tuesday", "Breakfast", "Idli Sambar with Coconut Chutney and Hot Tea / Coffee", 410, "Vegetarian"),
            ("Tuesday", "Lunch", "Rajma Masala, Aloo Palak, Steamed Rice, Tawa Roti, Raita", 620, "Vegetarian"),
            ("Tuesday", "Evening Snacks", "Fresh Khaman Dhokla with Fried Green Chilli, Tea", 190, "Snack"),
            ("Tuesday", "Dinner", "Paneer Tikka Masala, Yellow Dal, Pulao, Chapati, Kheer", 710, "Vegetarian"),

            ("Wednesday", "Breakfast", "Grilled Veg Sandwich, Seasonal Fruit, Tea / Coffee", 380, "Vegetarian"),
            ("Wednesday", "Lunch", "Sev Tameta Nu Shaak, Gujarati Dal, Steamed Rice, Phulkas, Chhas (Buttermilk)", 590, "Vegetarian"),
            ("Wednesday", "Evening Snacks", "Veg Cutlet with Chutney, Tea", 220, "Snack"),
            ("Wednesday", "Dinner", "Dum Aloo, Dal Makhani, Peas Pulao, Roti, Gulab Jamun", 720, "Special Dinner"),

            ("Thursday", "Breakfast", "Poha with Roasted Peanuts and Sev, Hot Tea / Coffee", 360, "Vegetarian"),
            ("Thursday", "Lunch", "Chole Masala, Steamed Rice, Boondi Raita, Soft Rotis", 690, "Vegetarian"),
            ("Thursday", "Evening Snacks", "Crispy Muthia with Sesame, Cardamom Tea", 200, "Snack"),
            ("Thursday", "Dinner", "Shahi Paneer, Moong Dal Fry, Jeera Rice, Roti, Shrikhand", 710, "Vegetarian"),

            ("Friday", "Breakfast", "Masala Dosa with Sambar and Chutney, Filter Coffee", 430, "Vegetarian"),
            ("Friday", "Lunch", "Veg Biryani, Raita, Dal Tadka, Roasted Papad", 660, "Vegetarian"),
            ("Friday", "Evening Snacks", "Pav Bhaji (Butter Pav), Lemon Tea", 310, "Snack"),
            ("Friday", "Dinner", "Malai Kofta, Dal Fry, Steamed Rice, Phulkas, Rasgulla", 740, "Vegetarian"),

            ("Saturday", "Breakfast", "Puri Bhaji with spicy potato sabzi, Halwa, Masala Tea", 470, "Vegetarian"),
            ("Saturday", "Lunch", "Dal Baati with Churma and Gatte ki Sabzi", 730, "Special Lunch"),
            ("Saturday", "Evening Snacks", "Bhel Puri with Chutney, Coffee", 190, "Snack"),
            ("Saturday", "Dinner", "Paneer Tikka, Veg Pulao, Dal Makhani, Roti, Ice Cream", 780, "Weekend Dinner"),

            ("Sunday", "Breakfast", "Aloo Paratha with Curd and Butter, Masala Tea", 400, "Vegetarian"),
            ("Sunday", "Lunch", "Sunday Special Thali: Paneer Makhani, Gujarati Dal, Steamed Rice, Puri, Basundi", 760, "Feast"),
            ("Sunday", "Evening Snacks", "Vegetable Samosa with Chutney, Tea", 240, "Snack"),
            ("Sunday", "Dinner", "Light Veg Pulao, Gujarati Kadhi, Roasted Papad, Jalebi", 580, "Vegetarian")
        ]

        cursor.executemany("""
            INSERT INTO meal_menu (day_of_week, meal_type, menu_items, calories, dietary_tags)
            VALUES (?, ?, ?, ?, ?);
        """, meals)

        today_str = today.strftime("%Y-%m-%d")
        cursor.execute("""
            INSERT INTO meal_preferences (user_id, date, meal_type, status)
            VALUES (?, ?, 'Dinner', 'Opted-In');
        """, (1, today_str))

        # 9. Notices
        notices_data = [
            (
                "Special Offer: Zero Brokerage & Free Wi-Fi on 6-Month Bookings",
                "Offer",
                "Book any single or sharing room for 6 months or more and get zero brokerage and 1,000 rupees off every month.",
                1
            ),
            (
                "Saturday Community Dinner & Music Night",
                "Event",
                "Join your fellow residents this Saturday at 7:30 PM for a community dinner and music on the terrace.",
                1
            ),
            (
                "Water Filter Maintenance on Tuesday (2 PM to 3 PM)",
                "Maintenance",
                "RO water filters will be serviced on Tuesday between 2 PM and 3 PM. Clean backup drinking water is available on every floor.",
                0
            )
        ]

        cursor.executemany("""
            INSERT INTO notices (title, category, content, is_pinned)
            VALUES (?, ?, ?, ?);
        """, notices_data)

        # 10. Sample Scheduled Visits in Amdavad
        visits_data = [
            (
                "Hardik Shah",
                "hardik.shah@example.com",
                "9876543210",
                prop_vastral_id,
                1,
                (today + timedelta(days=1)).strftime("%Y-%m-%d"),
                "11:00 AM",
                "In-Person",
                "College student looking for a single room near SP Ring Road.",
                "Scheduled"
            ),
            (
                "Mansi Vora",
                "mansi.vora@example.com",
                "9876543210",
                prop_rabari_id,
                6,
                (today + timedelta(days=2)).strftime("%Y-%m-%d"),
                "03:30 PM",
                "In-Person",
                "Working near metro station, wants to visit Rabari Colony PG.",
                "Scheduled"
            )
        ]

        cursor.executemany("""
            INSERT INTO visits (name, email, phone, property_id, room_id, visit_date, visit_time, tour_type, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, visits_data)

        # 11. Inquiries
        inquiries_data = [
            (
                "Parth Desai",
                "parth@example.com",
                "9876543210",
                "CG Road PG Booking",
                "Hi, when is the CG Road branch opening? I want to book a room.",
                "New"
            )
        ]

        cursor.executemany("""
            INSERT INTO inquiries (name, email, phone, subject, message, status)
            VALUES (?, ?, ?, ?, ?, ?);
        """, inquiries_data)

    print("Ashro Living database seeded successfully for Amdavad locations.")

if __name__ == "__main__":
    seed_database()
