# 🏭 Factory Floor Operations Dashboard

A real-time industrial maintenance tracking system built for factory floor operators and technicians. Logs equipment status, manages assets, tracks spare parts inventory, and enables cross-shift communication — all synced live via Firebase.

---

## Features

- **Equipment Logging** — 5-step form to log status checks and fault reports across Tools, Panels, UPS, and TVs/Scanners
- **Live Incident Wall** — Real-time view of all open faults; Technicians can resolve directly from the dashboard
- **Team Intercom** — Cross-shift chat with image attachments and auto-generated fault alerts
- **SOP Bot** — Guided troubleshooting assistant for 6 machine types with step-by-step fix procedures; auto-escalates unknown issues
- **Asset Registry** — IP-mapped device inventory with fault status tracking and SOP QR code uploads
- **BOM Inventory** — Spare parts stock management with low-stock warnings and live quantity editing
- **Shift Log Export** — Full log history with search/filter and one-click CSV export (18 columns)
- **Role-based Access** — Operator and Technician roles with password-gated Technician features

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Firebase Realtime Database |
| Build | Vite |
| Deployment | Vercel |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/shreyansh10100/iot-telemetry-dashboard.git
cd iot-telemetry-dashboard
```

### 2. Install dependencies

```bash
npm i
```

### 3. Configure Environment Variables

Copy the example environment file to `.env`:

```bash
cp .env.example .env
```

Open `.env` and configure your Firebase Database URL and Technician password:

```env
VITE_FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
VITE_TECH_PASSWORD=your_secure_password
```

### 4. Start the dev server

```bash
npm run dev
```

App runs at `http://localhost:5173`

---

## Deployment

The project is configured for Vercel. Push to `main` and Vercel will auto-deploy.

Make sure to add `VITE_FIREBASE_DATABASE_URL` as an environment variable in your Vercel project settings.

---

## Login Roles

| Role | Access |
|---|---|
| **Operator** | Log entries, view incidents, use SOP bot, send intercom messages |
| **Technician** | All operator access + resolve incidents, register assets, edit BOM quantities, reset data |

Technician login requires a shared password. Contact your project admin for credentials.

---

## Project Structure

```
src/
└── App.tsx          # All components in a single file
    ├── App                  (login + main shell)
    ├── DashboardView        (stat cards, incident wall, form, intercom)
    ├── UnifiedFiveStepForm  (equipment logging)
    ├── IntercomChat         (team chat + SOP bot toggle)
    ├── SopBotWidget         (guided troubleshooting)
    ├── LogsSheetView        (log history + CSV export)
    ├── AssetCatalogueView   (asset registry)
    ├── BOMInventoryView     (spare parts management)
    └── ToastContainer       (notifications)
```

---

## Firebase Data Structure

```
/logs/{logId}          — Equipment log entries
/assets/{assetId}      — Registered network devices
/messages/{msgId}      — Intercom chat messages
/bom/{modelId}/parts   — Spare parts per machine model
/telemetry/machines/   — Live machine telemetry flags (SOP bot)
```

---

## Design Reference

Original UI design: [Figma — Industrial Digital Tools Dashboard](https://www.figma.com/design/kyK8ltQ8N1T5zYIGKVZYXB/Industrial-Digital-Tools-Dashboard)
