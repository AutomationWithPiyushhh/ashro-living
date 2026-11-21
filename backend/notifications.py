import os
import smtplib
import threading
import urllib.request
import urllib.parse
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Configuration from Environment Variables
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "vasudevahir21@gmail.com")
ADMIN_PHONE = os.environ.get("ADMIN_PHONE", "9876543210")

# SMTP / Email Configuration
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_USE_SSL = os.environ.get("SMTP_USE_SSL", "false").lower() in ("true", "1", "yes")

# Twilio SMS Configuration
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_PHONE = os.environ.get("TWILIO_FROM_PHONE", "")

# Fast2SMS Configuration (India)
FAST2SMS_API_KEY = os.environ.get("FAST2SMS_API_KEY", "")

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")


def _log_visit_to_console(visit):
    visitor_name = visit.get("name", "N/A")
    visitor_phone = visit.get("phone", "N/A")
    visitor_email = visit.get("email", "N/A")
    property_name = visit.get("property_name") or "Amdavad Campus"
    room_name = visit.get("room_name") or "Any Available Suite"
    visit_date = visit.get("visit_date", "N/A")
    visit_time = visit.get("visit_time", "N/A")
    notes = visit.get("notes") or "None"

    print("\n" + "=" * 65)
    print("🛎️  [ADMIN ALERT] NEW PG VISIT SCHEDULED")
    print(f"• Visitor:     {visitor_name}")
    print(f"• Mobile:      {visitor_phone}")
    print(f"• Email:       {visitor_email}")
    print(f"• PG Campus:   {property_name}")
    print(f"• Suite Pref:  {room_name}")
    print(f"• Schedule:    {visit_date} at {visit_time}")
    print(f"• Notes:       {notes}")
    print("=" * 65 + "\n")


def _send_email_notification(visit):
    if not (SMTP_HOST and SMTP_USER and SMTP_PASS):
        # Email settings not provided in environment
        return

    visitor_name = visit.get("name", "Visitor")
    visitor_phone = visit.get("phone", "N/A")
    visitor_email = visit.get("email", "N/A")
    property_name = visit.get("property_name") or "Amdavad Campus"
    room_name = visit.get("room_name") or "Any Available Suite"
    visit_date = visit.get("visit_date", "N/A")
    visit_time = visit.get("visit_time", "N/A")
    notes = visit.get("notes") or "None"

    subject = f"🛎️ New Visit Scheduled: {visitor_name} at {property_name}"

    html_content = f"""
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #302720; background-color: #F7F3ED; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto; background: #FFFFFF; border-radius: 10px; border: 1px solid #DED5C9; overflow: hidden;">
          <div style="background: #302720; color: #FFFFFF; padding: 20px 24px;">
            <h2 style="margin: 0; font-size: 20px;">🏛️ Ashro Living — New Visit Scheduled</h2>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #B69B83;">A visitor has booked an in-person tour on the website.</p>
          </div>
          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="border-bottom: 1px solid #F0EAE1;">
                <td style="padding: 10px 0; color: #756D65; width: 140px;"><strong>Visitor Name</strong></td>
                <td style="padding: 10px 0; color: #302720; font-weight: 600;">{visitor_name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #F0EAE1;">
                <td style="padding: 10px 0; color: #756D65;"><strong>Mobile Number</strong></td>
                <td style="padding: 10px 0;"><a href="tel:{visitor_phone}" style="color: #765B49; font-weight: bold; text-decoration: none;">{visitor_phone}</a> &nbsp;|&nbsp; <a href="https://wa.me/91{visitor_phone.replace(' ', '').replace('+', '')}" style="color: #25D366; text-decoration: none; font-weight: bold;">WhatsApp</a></td>
              </tr>
              <tr style="border-bottom: 1px solid #F0EAE1;">
                <td style="padding: 10px 0; color: #756D65;"><strong>Email Address</strong></td>
                <td style="padding: 10px 0; color: #302720;"><a href="mailto:{visitor_email}" style="color: #765B49;">{visitor_email}</a></td>
              </tr>
              <tr style="border-bottom: 1px solid #F0EAE1;">
                <td style="padding: 10px 0; color: #756D65;"><strong>PG Campus</strong></td>
                <td style="padding: 10px 0; color: #302720; font-weight: 600;">{property_name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #F0EAE1;">
                <td style="padding: 10px 0; color: #756D65;"><strong>Suite Preference</strong></td>
                <td style="padding: 10px 0; color: #302720;">{room_name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #F0EAE1;">
                <td style="padding: 10px 0; color: #756D65;"><strong>Date & Time</strong></td>
                <td style="padding: 10px 0; color: #302720; font-weight: 600;">{visit_date} at {visit_time}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #756D65;"><strong>Notes / Requests</strong></td>
                <td style="padding: 10px 0; color: #302720;">{notes}</td>
              </tr>
            </table>

            <div style="margin-top: 24px; text-align: center;">
              <a href="https://ashro-living.onrender.com/admin#visits" style="display: inline-block; background: #302720; color: #FFFFFF; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 13px; font-weight: 600;">
                Open Property Manager Desk &rarr;
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_USER
    msg["To"] = ADMIN_EMAIL

    plain_text = (
        f"New PG Visit Scheduled at {property_name}\n"
        f"Visitor: {visitor_name} ({visitor_phone}, {visitor_email})\n"
        f"Date: {visit_date} at {visit_time}\n"
        f"Suite: {room_name}\n"
        f"Notes: {notes}\n"
    )
    msg.attach(MIMEText(plain_text, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        if SMTP_USE_SSL or SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
        print(f"📧 Admin notification email sent successfully to {ADMIN_EMAIL}")
    except Exception as e:
        print(f"⚠️ Failed to send admin email notification: {e}")


def _send_sms_notification(visit):
    visitor_name = visit.get("name", "Visitor")
    visitor_phone = visit.get("phone", "")
    property_name = visit.get("property_name") or "Amdavad Campus"
    visit_date = visit.get("visit_date", "")
    visit_time = visit.get("visit_time", "")

    message_text = f"Ashro Living Alert: New PG visit booked by {visitor_name} ({visitor_phone}) for {property_name} on {visit_date} at {visit_time}."

    # 1. Twilio SMS
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_PHONE and ADMIN_PHONE:
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
            data = urllib.parse.urlencode({
                "From": TWILIO_FROM_PHONE,
                "To": ADMIN_PHONE,
                "Body": message_text
            }).encode("utf-8")

            req = urllib.request.Request(url, data=data, method="POST")
            import base64
            auth = base64.b64encode(f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}".encode("utf-8")).decode("utf-8")
            req.add_header("Authorization", f"Basic {auth}")

            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in (200, 201):
                    print(f"📱 Twilio SMS sent successfully to {ADMIN_PHONE}")
        except Exception as e:
            print(f"⚠️ Twilio SMS error: {e}")

    # 2. Fast2SMS (India)
    if FAST2SMS_API_KEY and ADMIN_PHONE:
        try:
            url = "https://www.fast2sms.com/dev/bulkV2"
            clean_phone = ADMIN_PHONE.replace("+91", "").replace(" ", "").strip()
            params = {
                "authorization": FAST2SMS_API_KEY,
                "message": message_text,
                "language": "english",
                "route": "q",
                "numbers": clean_phone
            }
            req_url = f"{url}?{urllib.parse.urlencode(params)}"
            req = urllib.request.Request(req_url, headers={"cache-control": "no-cache"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                print(f"📱 Fast2SMS sent successfully to {clean_phone}")
        except Exception as e:
            print(f"⚠️ Fast2SMS error: {e}")

    # 3. Telegram Bot (Free push notification)
    if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = urllib.parse.urlencode({
                "chat_id": TELEGRAM_CHAT_ID,
                "text": f"🛎️ *Ashro Living: New Visit Scheduled*\n\n"
                        f"👤 *Visitor:* {visitor_name}\n"
                        f"📞 *Phone:* {visitor_phone}\n"
                        f"📍 *PG:* {property_name}\n"
                        f"🗓️ *Schedule:* {visit_date} at {visit_time}\n"
                        f"🔗 [Open Admin Desk](https://ashro-living.onrender.com/admin#visits)",
                "parse_mode": "Markdown"
            }).encode("utf-8")
            req = urllib.request.Request(url, data=payload, method="POST")
            with urllib.request.urlopen(req, timeout=10) as resp:
                print("💬 Telegram notification sent successfully.")
        except Exception as e:
            print(f"⚠️ Telegram notification error: {e}")


def notify_admin_visit(visit, async_mode=True):
    """
    Triggers console log, email, and SMS notifications.
    By default runs in a background thread so the API response is never delayed.
    """
    def _worker():
        _log_visit_to_console(visit)
        _send_email_notification(visit)
        _send_sms_notification(visit)

    if async_mode:
        thread = threading.Thread(target=_worker, daemon=True)
        thread.start()
        return thread
    else:
        _worker()
        return None
