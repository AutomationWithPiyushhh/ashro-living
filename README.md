# 🏛️ ASHRÉ — Boutique Serviced Residences & Co-Living • Amdavad

> **A Sanctuary for Living, Designed with Intention.**  
> Inspired by boutique hotels, luxury serviced apartments, and contemporary minimalist architecture.

---

## 🎨 Luxury Light Design System

- **Primary Background:** Warm Ivory (`#F7F3ED`)
- **Cards & Surfaces:** Pure White (`#FFFFFF`)
- **Secondary Sections:** Soft Sand (`#E8DED1`)
- **Accents:** Mocha Brown (`#B69B83`)
- **Secondary Highlights:** Cocoa Brown (`#765B49`)
- **Headings & Primary Buttons:** Deep Espresso (`#302720`)
- **Secondary Text:** Warm Grey (`#756D65`)
- **Borders:** Light Beige (`#DED5C9`)
- **Typography:**
  - Headings: **Cormorant Garamond** (Google Fonts)
  - Body Text: **DM Sans** (Google Fonts)
- **Zero Emojis:** Replaced entirely with minimal line SVG icons and editorial typographic badges.

---

## 📍 Locations in Amdavad (Ahmedabad)

### Currently Operating:
1. **Vastral Manor:** Near Nirant Cross Road & SP Ring Road, Vastral, Amdavad 382418
2. **Naroda House:** Near Galaxy Boulevard, Naroda-Dehgam Corridor, Naroda, Amdavad 382330
3. **Rabari Colony Metro Suites:** Near Rabari Colony Metro Station, Amraiwadi, Amdavad 380026

### Opening Soon (Priority Waitlist Active):
- **CG Road Residence** (Opening Q3 2026)
- **Thaltej Pavilion** (Opening Q4 2026)
- **Vastrapur Lake Suites** (Opening Late 2026)
- **Navrangpura Studio** (Opening Early 2027)

---

## 📞 Official Concierge & Contact

- **Founder & Manager:** Piyush
- **Official Email:** `piyush@automationwithpiyush.com`
- **Phone & WhatsApp:** `+91 98765 43210` (`9876543210`)

---

## 🔐 Role-Based Authentication

Access to private portals is gated with credential verification:

### 1. Resident Portal (`/resident`)
- Sign in with verified tenant credentials.
- **Demo Resident:** `aarav@example.com` / `resident123`
- Features: View room allocation, lease agreement, monthly invoices, one-click payment, facility service tickets, daily meal opt-in/opt-out.

### 2. Property Manager Hub (`/admin`)
- Sign in with owner / administrator credentials.
- **Manager:** `piyush@automationwithpiyush.com` / `admin123`
- Features: Real-time occupancy KPIs, room inventory CRUD, tour request triage, maintenance desk, and master lease ledger.

---

## 🚀 Running the Platform

```bash
# Start server
./run.sh

# Or directly:
python3 -m backend.server
```

- **Public Platform:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Resident Desk:** [http://127.0.0.1:8000/resident](http://127.0.0.1:8000/resident)
- **Manager Hub:** [http://127.0.0.1:8000/admin](http://127.0.0.1:8000/admin)

---

## 🌐 Cloud Deployment (Render)

This repository includes pre-configured deployment files (`render.yaml`, `start.sh`, `requirements.txt`, and `Dockerfile`):

### Option 1: Automatic Blueprint (Recommended)
1. Push your repository to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/) -> **New +** -> **Blueprint**.
3. Connect your repository. Render will automatically detect `render.yaml` and configure:
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `./start.sh`
4. Click **Apply**. Your app will be live on a free `onrender.com` HTTPS URL within 1-2 minutes!

### Option 2: Manual Web Service
1. In Render, select **New +** -> **Web Service**.
2. Select your repository.
3. Configure settings:
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `./start.sh`
4. Click **Create Web Service**.

### Option 3: Docker
```bash
docker build -t ashro-living .
docker run -p 8000:8000 ashro-living
```
