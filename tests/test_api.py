import unittest
from backend.seed import seed_database
import backend.models as models

class TestAshroLivingCore(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        seed_database()

    def test_properties(self):
        props = models.get_all_properties()
        self.assertGreaterEqual(len(props), 3)
        names = [p['name'] for p in props]
        self.assertTrue(any('Vastral' in n for n in names))
        self.assertTrue(any('Naroda' in n for n in names))

    def test_authentication(self):
        # Admin auth
        admin = models.authenticate_user("vasudevahir21@gmail.com", "admin123")
        self.assertIsNotNone(admin)
        self.assertEqual(admin['role'], 'admin')

        # Resident auth
        resident = models.authenticate_user("aarav@example.com", "resident123")
        self.assertIsNotNone(resident)
        self.assertEqual(resident['role'], 'resident')

        # Invalid auth
        invalid = models.authenticate_user("aarav@example.com", "wrongpass")
        self.assertIsNone(invalid)

    def test_rooms_and_filtering(self):
        all_rooms = models.get_rooms()
        self.assertGreaterEqual(len(all_rooms), 6)

        single_rooms = models.get_rooms(room_type="Single Private Room")
        self.assertTrue(all(r['room_type'] == "Single Private Room" for r in single_rooms))

        affordable = models.get_rooms(max_price=10000)
        self.assertTrue(all(r['price_monthly'] <= 10000 for r in affordable))

        search_res = models.get_rooms(search="Studio")
        self.assertTrue(any("Studio" in r['name'] for r in search_res))

    def test_room_details(self):
        room = models.get_room_by_id(1)
        self.assertIsNotNone(room)
        self.assertEqual(room['name'], "Single Private Room (AC)")
        self.assertIn("Bed", "".join(room['features']))
        self.assertIn("beds", room)
        self.assertGreaterEqual(len(room['beds']), 1)

    def test_visit_creation_and_status(self):
        new_visit = models.create_visit({
            "name": "Kavita Roy",
            "email": "kavita@test.com",
            "phone": "+91 9988776655",
            "property_id": 1,
            "room_id": 1,
            "visit_date": "2026-06-15",
            "visit_time": "02:00 PM",
            "tour_type": "Video Tour",
            "notes": "Interested in 6-month stay"
        })
        self.assertIsNotNone(new_visit['id'])
        self.assertEqual(new_visit['status'], "Scheduled")

        updated = models.update_visit_status(new_visit['id'], "Completed")
        self.assertEqual(updated['status'], "Completed")

        # Test notification dispatch synchronously
        import backend.notifications as notifications
        notifications.notify_admin_visit(new_visit, async_mode=False)

    def test_booking_creation_and_inventory(self):
        new_booking = models.create_booking({
            "room_id": 2, # Twin Comfort Suite
            "guest_name": "Deepak Mehta",
            "guest_email": "deepak.m@test.com",
            "guest_phone": "+91 98712 34567",
            "move_in_date": "2026-06-01",
            "tenure_months": 6,
            "token_amount_paid": 2000.0,
            "special_requests": "Lower bunk or bed near window"
        })
        self.assertIsNotNone(new_booking['id'])
        self.assertTrue(new_booking['booking_reference'].startswith("ASHRO-"))
        self.assertEqual(new_booking['status'], "Confirmed")

    def test_invoices_and_payment(self):
        invoices = models.get_user_invoices(1)
        self.assertGreaterEqual(len(invoices), 2)

        pending = [inv for inv in invoices if inv['status'] == 'Pending']
        if pending:
            target = pending[0]
            paid = models.pay_invoice(target['id'], "Credit Card")
            self.assertEqual(paid['status'], "Paid")
            self.assertIsNotNone(paid['paid_date'])

    def test_tickets_flow(self):
        ticket = models.create_ticket({
            "user_id": 1,
            "room_id": 1,
            "category": "Housekeeping",
            "title": "Extra linen change request",
            "description": "Please arrange fresh bedsheets and towels for weekend.",
            "priority": "Low"
        })
        self.assertIsNotNone(ticket['id'])
        self.assertEqual(ticket['status'], "Open")

        updated = models.update_ticket_status(ticket['id'], "Resolved", assigned_to="Deepak (Housekeeping)", resolution_notes="New linen set provided")
        self.assertEqual(updated['status'], "Resolved")

    def test_meal_planner(self):
        meals = models.get_weekly_meals()
        self.assertGreaterEqual(len(meals), 20)

        # Set meal preference
        pref = models.set_meal_preference(1, "2026-06-02", "Dinner", "Opted-Out")
        self.assertEqual(pref['status'], "Opted-Out")

    def test_admin_dashboard_stats(self):
        stats = models.get_admin_dashboard_stats()
        self.assertIn("total_properties", stats)
        self.assertIn("occupancy_rate", stats)
        self.assertIn("revenue_collected", stats)
        self.assertIn("pending_kyc", stats)
        self.assertGreater(stats['total_rooms'], 0)

    def test_kyc_flow(self):
        # 1. Check existing verified user (Aarav)
        aarav_kyc = models.get_user_kyc(1)
        self.assertIsNotNone(aarav_kyc)
        self.assertEqual(aarav_kyc['status'], "Verified")
        self.assertEqual(aarav_kyc['id_type'], "Aadhaar Card")

        # 2. Check pending review user (Kavya)
        kavya_kyc = models.get_user_kyc(3)
        self.assertIsNotNone(kavya_kyc)
        self.assertEqual(kavya_kyc['status'], "Under Review")

        # 3. Save new/updated KYC
        updated = models.save_user_kyc(3, {
            "id_type": "Aadhaar Card",
            "id_number": "XXXX XXXX 9999",
            "occupation_type": "Student",
            "institution_name": "Nirma University Engineering",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "pincode": "382481",
            "emergency_name": "Hitesh Patel",
            "emergency_phone": "9876543210"
        })
        self.assertEqual(updated['status'], "Under Review")
        self.assertEqual(updated['id_number'], "XXXX XXXX 9999")

        # 4. Admin fetch all records
        all_kyc = models.get_all_kyc_records()
        self.assertGreaterEqual(len(all_kyc), 2)

        # 5. Admin approve KYC
        kavya_record = [k for k in all_kyc if k['user_id'] == 3][0]
        approved = models.update_kyc_status(kavya_record['id'], "Verified")
        self.assertEqual(approved['status'], "Verified")
        self.assertIsNotNone(approved['verified_at'])

        # 6. Admin test rejection with reason
        rejected = models.update_kyc_status(kavya_record['id'], "Rejected", "Aadhaar back image blurry")
        self.assertEqual(rejected['status'], "Rejected")
        self.assertEqual(rejected['rejection_reason'], "Aadhaar back image blurry")

        # 7. Test notification dispatch
        import backend.notifications as notifications
        notifications.notify_admin_kyc(approved, async_mode=False)

if __name__ == '__main__':
    unittest.main()
