import os
import json
import mimetypes
import re
from urllib.parse import urlparse, parse_qs
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from backend.config import HOST, PORT, FRONTEND_DIR
import backend.models as models
import backend.notifications as notifications

class JSONResponse:
    @staticmethod
    def send(handler, data, status=200):
        body = json.dumps(data, default=str).encode("utf-8")
        handler.send_response(status)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(body)))
        handler.send_header("Access-Control-Allow-Origin", "*")
        handler.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        handler.end_headers()
        if getattr(handler, "command", "") != "HEAD":
            handler.wfile.write(body)

    @staticmethod
    def error(handler, message, status=400):
        JSONResponse.send(handler, {"error": message, "status": "error"}, status=status)

class AshroLivingHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def get_parsed_body(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 0:
                raw_data = self.rfile.read(content_length).decode("utf-8")
                return json.loads(raw_data)
        except Exception as e:
            print("Error parsing JSON body:", e)
        return {}

    def do_HEAD(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query = parse_qs(parsed_url.query)
        params = {k: v[0] for k, v in query.items()}

        if path.startswith("/api/"):
            try:
                self.handle_api_get(path, params)
            except Exception:
                JSONResponse.error(self, "Internal Server Error", status=500)
            return

        self.serve_static(path)

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query = parse_qs(parsed_url.query)
        params = {k: v[0] for k, v in query.items()}

        # API Routes
        if path.startswith("/api/"):
            try:
                self.handle_api_get(path, params)
            except Exception as e:
                import traceback
                traceback.print_exc()
                JSONResponse.error(self, str(e), status=500)
            return

        # Static file serving
        self.serve_static(path)

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        body = self.get_parsed_body()

        if path.startswith("/api/"):
            try:
                self.handle_api_post(path, body)
            except Exception as e:
                import traceback
                traceback.print_exc()
                JSONResponse.error(self, str(e), status=500)
            return

        JSONResponse.error(self, "Not found", status=404)

    def do_PUT(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        body = self.get_parsed_body()

        if path.startswith("/api/"):
            try:
                self.handle_api_put(path, body)
            except Exception as e:
                import traceback
                traceback.print_exc()
                JSONResponse.error(self, str(e), status=500)
            return

        JSONResponse.error(self, "Not found", status=404)

    # ------------------ API GET HANDLERS ------------------
    def handle_api_get(self, path, params):
        # Auth verification
        if path == "/api/auth/me":
            user_id = params.get("user_id")
            if not user_id:
                JSONResponse.error(self, "Missing user_id", 400)
                return
            user = models.get_user_by_id(int(user_id))
            if user:
                JSONResponse.send(self, {"data": user})
            else:
                JSONResponse.error(self, "User not found", 404)
            return

        # Public
        if path == "/api/properties":
            status = params.get("status")
            props = models.get_all_properties(status=status)
            JSONResponse.send(self, {"data": props})
            return

        prop_match = re.match(r"^/api/properties/(\d+)$", path)
        if prop_match:
            prop = models.get_property_by_id(int(prop_match.group(1)))
            if prop:
                JSONResponse.send(self, {"data": prop})
            else:
                JSONResponse.error(self, "Property not found", 404)
            return

        if path == "/api/rooms":
            rooms = models.get_rooms(
                property_id=params.get("property_id"),
                room_type=params.get("room_type"),
                max_price=params.get("max_price"),
                search=params.get("search"),
                status=params.get("status")
            )
            JSONResponse.send(self, {"data": rooms, "count": len(rooms)})
            return

        room_match = re.match(r"^/api/rooms/(\d+)$", path)
        if room_match:
            room = models.get_room_by_id(int(room_match.group(1)))
            if room:
                JSONResponse.send(self, {"data": room})
            else:
                JSONResponse.error(self, "Room not found", 404)
            return

        if path == "/api/notices":
            notices = models.get_notices()
            JSONResponse.send(self, {"data": notices})
            return

        # Resident Portal
        if path == "/api/resident/bookings":
            user_id = int(params.get("user_id", 1))
            bookings = models.get_bookings(user_id=user_id)
            JSONResponse.send(self, {"data": bookings})
            return

        if path == "/api/resident/invoices":
            user_id = int(params.get("user_id", 1))
            invoices = models.get_user_invoices(user_id=user_id)
            JSONResponse.send(self, {"data": invoices})
            return

        if path == "/api/resident/tickets":
            user_id = int(params.get("user_id", 1))
            tickets = models.get_user_tickets(user_id=user_id)
            JSONResponse.send(self, {"data": tickets})
            return

        if path == "/api/resident/meals":
            meals = models.get_weekly_meals()
            JSONResponse.send(self, {"data": meals})
            return

        if path == "/api/resident/meals/preferences":
            user_id = int(params.get("user_id", 1))
            date_str = params.get("date")
            prefs = models.get_user_meal_preferences(user_id, date_str)
            JSONResponse.send(self, {"data": prefs})
            return

        if path == "/api/resident/kyc":
            user_id = params.get("user_id")
            if not user_id:
                JSONResponse.error(self, "Missing user_id", 400)
                return
            kyc = models.get_user_kyc(int(user_id))
            JSONResponse.send(self, {"data": kyc})
            return

        # Admin Portal
        if path == "/api/admin/stats":
            stats = models.get_admin_dashboard_stats()
            JSONResponse.send(self, {"data": stats})
            return

        if path == "/api/admin/kyc":
            status = params.get("status")
            records = models.get_all_kyc_records(status=status)
            JSONResponse.send(self, {"data": records})
            return

        if path == "/api/admin/visits":
            visits = models.get_all_visits()
            JSONResponse.send(self, {"data": visits})
            return

        if path == "/api/admin/bookings":
            bookings = models.get_bookings()
            JSONResponse.send(self, {"data": bookings})
            return

        if path == "/api/admin/tickets":
            tickets = models.get_all_tickets()
            JSONResponse.send(self, {"data": tickets})
            return

        JSONResponse.error(self, "Endpoint not found", 404)

    # ------------------ API POST HANDLERS ------------------
    def handle_api_post(self, path, body):
        if path == "/api/auth/login":
            email = body.get("email")
            password = body.get("password")
            if not email or not password:
                JSONResponse.error(self, "Please provide both email and password.", 400)
                return
            user = models.authenticate_user(email, password)
            if not user:
                JSONResponse.error(self, "Invalid email or password. Please verify your credentials.", 401)
                return
            token = f"ashro_sess_{user['id']}_{user['role']}"
            JSONResponse.send(self, {
                "message": f"Welcome back, {user['name']}",
                "user": user,
                "token": token
            }, 200)
            return

        if path == "/api/auth/signup":
            name = body.get("name")
            email = body.get("email")
            password = body.get("password")
            phone = body.get("phone", "")
            if not name or not email or not password:
                JSONResponse.error(self, "Please provide full name, email, and password.", 400)
                return
            try:
                user = models.create_user(name, email, password, phone, role="resident")
                token = f"ashro_sess_{user['id']}_{user['role']}"
                JSONResponse.send(self, {
                    "message": f"Account created successfully. Welcome, {user['name']}!",
                    "user": user,
                    "token": token
                }, 201)
            except ValueError as ve:
                JSONResponse.error(self, str(ve), 400)
            except Exception as e:
                JSONResponse.error(self, "Failed to create account. Please try again.", 500)
            return

        if path == "/api/visits":
            required = ["name", "email", "phone", "visit_date"]
            for field in required:
                if not body.get(field):
                    JSONResponse.error(self, f"Missing required field: {field}", 400)
                    return
            visit = models.create_visit(body)
            try:
                notifications.notify_admin_visit(visit)
            except Exception as e:
                print("Notification dispatch error:", e)
            JSONResponse.send(self, {"data": visit, "message": "Visit scheduled successfully"}, 201)
            return

        if path == "/api/bookings":
            required = ["room_id", "guest_name", "guest_email", "guest_phone", "move_in_date"]
            for field in required:
                if not body.get(field):
                    JSONResponse.error(self, f"Missing required field: {field}", 400)
                    return
            booking = models.create_booking(body)
            JSONResponse.send(self, {"data": booking, "message": "Reservation confirmed successfully"}, 201)
            return

        if path == "/api/inquiries":
            required = ["name", "email", "phone", "message"]
            for field in required:
                if not body.get(field):
                    JSONResponse.error(self, f"Missing required field: {field}", 400)
                    return
            inquiry = models.create_inquiry(body)
            JSONResponse.send(self, {"data": inquiry, "message": "Inquiry submitted successfully"}, 201)
            return

        # Resident actions
        if path == "/api/resident/tickets":
            required = ["user_id", "room_id", "category", "title", "description"]
            for field in required:
                if not body.get(field):
                    JSONResponse.error(self, f"Missing required field: {field}", 400)
                    return
            ticket = models.create_ticket(body)
            JSONResponse.send(self, {"data": ticket, "message": "Ticket created successfully"}, 201)
            return

        pay_match = re.match(r"^/api/resident/invoices/(\d+)/pay$", path)
        if pay_match:
            inv_id = int(pay_match.group(1))
            method = body.get("payment_method", "Online UPI")
            updated = models.pay_invoice(inv_id, method)
            JSONResponse.send(self, {"data": updated, "message": "Payment successful"}, 200)
            return

        if path == "/api/resident/meals/preferences":
            required = ["user_id", "date", "meal_type", "status"]
            for field in required:
                if not body.get(field):
                    JSONResponse.error(self, f"Missing required field: {field}", 400)
                    return
            pref = models.set_meal_preference(body["user_id"], body["date"], body["meal_type"], body["status"])
            JSONResponse.send(self, {"data": pref, "message": "Meal preference updated"}, 200)
            return

        if path == "/api/resident/kyc":
            user_id = body.get("user_id")
            if not user_id:
                JSONResponse.error(self, "Missing user_id", 400)
                return
            res = models.save_user_kyc(int(user_id), body)
            try:
                notifications.notify_admin_kyc(res)
            except Exception as e:
                print("KYC notification error:", e)
            JSONResponse.send(self, {"data": res, "message": "KYC documents submitted successfully for verification"}, 200)
            return

        # Admin actions
        if path == "/api/admin/rooms":
            required = ["property_id", "name", "room_type", "price_monthly", "cover_image"]
            for field in required:
                if not body.get(field):
                    JSONResponse.error(self, f"Missing required field: {field}", 400)
                    return
            room = models.create_room(body)
            JSONResponse.send(self, {"data": room, "message": "Room added successfully"}, 201)
            return

        JSONResponse.error(self, "Endpoint not found", 404)

    # ------------------ API PUT HANDLERS ------------------
    def handle_api_put(self, path, body):
        # Admin visit status update
        visit_match = re.match(r"^/api/admin/visits/(\d+)$", path)
        if visit_match:
            v_id = int(visit_match.group(1))
            status = body.get("status")
            if not status:
                JSONResponse.error(self, "Missing status", 400)
                return
            res = models.update_visit_status(v_id, status)
            JSONResponse.send(self, {"data": res, "message": "Visit status updated"}, 200)
            return

        # Admin ticket update
        ticket_match = re.match(r"^/api/admin/tickets/(\d+)$", path)
        if ticket_match:
            t_id = int(ticket_match.group(1))
            status = body.get("status", "In Progress")
            assigned = body.get("assigned_to")
            notes = body.get("resolution_notes")
            res = models.update_ticket_status(t_id, status, assigned, notes)
            JSONResponse.send(self, {"data": res, "message": "Ticket updated"}, 200)
            return

        # Admin KYC update
        kyc_match = re.match(r"^/api/admin/kyc/(\d+)$", path)
        if kyc_match:
            k_id = int(kyc_match.group(1))
            status = body.get("status")
            if not status:
                JSONResponse.error(self, "Missing status", 400)
                return
            reason = body.get("rejection_reason")
            res = models.update_kyc_status(k_id, status, reason)
            JSONResponse.send(self, {"data": res, "message": f"Tenant KYC status updated to {status}"}, 200)
            return

        # Admin room update
        room_match = re.match(r"^/api/admin/rooms/(\d+)$", path)
        if room_match:
            r_id = int(room_match.group(1))
            res = models.update_room(r_id, body)
            JSONResponse.send(self, {"data": res, "message": "Room updated"}, 200)
            return

        JSONResponse.error(self, "Endpoint not found", 404)

    # ------------------ STATIC FILE SERVING ------------------
    def serve_static(self, path):
        # Handle favicon (Luxury Ashro Monogram, No emojis, No green)
        if path in ("/favicon.ico", "/favicon.png"):
            svg = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#302720"/><circle cx="50" cy="50" r="43" fill="none" stroke="#B69B83" stroke-width="2"/><text x="50%" y="65%" font-family="Georgia, serif" font-size="48" font-weight="600" fill="#F7F3ED" text-anchor="middle">A</text></svg>'
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(svg)))
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            if getattr(self, "command", "") != "HEAD":
                self.wfile.write(svg)
            return

        # Clean path
        clean_path = path.strip("/")
        if not clean_path or clean_path in ("", "index.html"):
            file_path = FRONTEND_DIR / "index.html"
        elif clean_path in ("resident", "resident.html"):
            file_path = FRONTEND_DIR / "resident.html"
        elif clean_path in ("admin", "admin.html"):
            file_path = FRONTEND_DIR / "admin.html"
        else:
            file_path = FRONTEND_DIR / clean_path

        # Resolve safely
        try:
            file_path = file_path.resolve()
            if not str(file_path).startswith(str(FRONTEND_DIR.resolve())):
                self.send_error(403, "Forbidden")
                return

            if file_path.is_file():
                mime_type, _ = mimetypes.guess_type(str(file_path))
                if mime_type is None:
                    mime_type = "application/octet-stream"
                if str(file_path).endswith(".html"):
                    mime_type = "text/html; charset=utf-8"
                elif str(file_path).endswith(".css"):
                    mime_type = "text/css; charset=utf-8"
                elif str(file_path).endswith(".js"):
                    mime_type = "application/javascript; charset=utf-8"

                with open(file_path, "rb") as f:
                    content = f.read()

                self.send_response(200)
                self.send_header("Content-Type", mime_type)
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                if getattr(self, "command", "") != "HEAD":
                    self.wfile.write(content)
            else:
                self.send_error(404, "File Not Found")
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            try:
                self.send_error(500, f"Server Error: {str(e)}")
            except Exception:
                pass

def run_server():
    server_address = (HOST, PORT)
    ThreadingHTTPServer.allow_reuse_address = True
    httpd = ThreadingHTTPServer(server_address, AshroLivingHandler)
    display_host = "localhost" if HOST in ("0.0.0.0", "127.0.0.1") else HOST
    print(f"==================================================")
    print(f"  Ashro Living Server running on port {PORT}")
    print(f"  - Public Portal:    http://localhost:{PORT}/  (or http://127.0.0.1:{PORT}/)")
    print(f"  - Resident Portal:  http://localhost:{PORT}/resident")
    print(f"  - Admin Dashboard:  http://localhost:{PORT}/admin")
    print(f"==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
