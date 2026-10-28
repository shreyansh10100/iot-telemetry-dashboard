# 🏭 Factory Floor Operations & Maintenance Dashboard
### Ashok Leyland Limited — Alwar Plant, Rajasthan
**Summer Industrial Internship Project**  
**Author:** Shreyansh Choudhary (24BEI0025) — B.Tech Electronics & Instrumentation, VIT Vellore  
**Mentor:** Vaseem Akhtar, Deputy Manager, Ashok Leyland Limited  

> 📄 **Project Artifacts & Official Documentation**:  
> - 📖 **Full 15-Page Report (Markdown)**: [`docs/INTERNSHIP_REPORT.md`](docs/INTERNSHIP_REPORT.md)  
> - 📑 **Original Completion Report (PDF)**: [`docs/Ashok_Leyland_Internship_Report.pdf`](docs/Ashok_Leyland_Internship_Report.pdf)  
> - 📊 **Slide Deck (PPTX)**: [`docs/Ashok_Leyland_Internship_Presentation.pptx`](docs/Ashok_Leyland_Internship_Presentation.pptx)  
> - 🔗 **Broader Initiative Context**: *Part 1 of Ashok Leyland's Digital Transformation Suite: Maintenance Dashboard (Shopfloor Execution), MPAS Store Digitisation (Warehouse Handling), and VEMS (Upstream Supplier Quality).*

---

A real-time industrial maintenance telemetry and shopfloor tracking system built for factory floor operators and maintenance technicians. Logs equipment health, tracks line assets, coordinates cross-shift handovers, guides recovery procedures via SOP bot, and turns the daily vehicle production schedule into a prioritized tool checklist.

---

## Mean Time to Repair (MTTR) Reduction Framework

$$\text{MTTR} = T_{\text{Detection}} + T_{\text{Notification}} + T_{\text{Diagnosis}} + T_{\text{Logistics}} + T_{\text{Repair \& Verification}}$$

| Phase | Traditional Shopfloor Bottleneck | Digital Dashboard Solution |
|---|---|---|
| **Detection** | Fault noticed only when an operator encounters a stoppage. | 5-step checklist & real-time telemetry card pushes status instantly. |
| **Notification** | Operator walks across the floor or phones maintenance. | Automated alert posted directly to team intercom and technician console. |
| **Diagnosis** | Relies on technician memory and experience. | Built-in SOP Bot guides the operator through verified recovery steps. |
| **Logistics** | Tool shortages discovered when line is already waiting. | Morning vehicle BOM lookup pre-identifies required tools before shift starts. |
| **Verification** | Unconfirmed verbal closure; re-reported by next shift. | One-click resolution with audit stamp, timestamp, and status clearance. |

---

## Features

- **Equipment Logging** — 5-step checklist form to log status checks and fault reports across Tools, Panels, UPS, and TVs/Scanners
- **Live Incident Wall** — Real-time synchronization of open shopfloor faults; duty Technicians resolve directly with audit stamps
- **Team Intercom** — Cross-shift communication with plant photo attachments and auto-broadcasted fault alerts
- **SOP Bot** — Deterministic troubleshooting assistant across 6 machine types with step-by-step recovery procedures
- **Asset Registry** — IP-mapped line equipment inventory with live status flags, custom attributes, and SOP QR code uploads
- **Vehicle Tool Planner** — Match scheduled vehicle models against the BOM matrix to generate active tool requirements
- **Shift Log Export** — Full audit history with live filters, multi-field search, and one-click 18-column CSV export
- **Role-based Access** — Differentiated interfaces for Operators and Technicians with password-gated resolution controls

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
├── types/
│   └── index.ts                 # TypeScript data contracts & interfaces
├── lib/
│   └── firebase.ts              # Realtime Database initialization & fallback config
├── constants/
│   └── sopMatrix.ts             # 6-machine SOP diagnostic decision matrix
├── utils/
│   └── helpers.ts               # IP formatter & client image compression
├── context/
│   └── AppContext.ts            # Global company config & toast notification context
├── components/
│   ├── Navbar.tsx               # Top header, shift status & mobile navigation
│   ├── LoginView.tsx            # Operator/Technician floor terminal login
│   ├── DashboardView.tsx        # Active alarms, category KPIs, open incident wall
│   ├── UnifiedFiveStepForm.tsx  # 5-step maintenance checklist & fault logging
│   ├── IntercomChat.tsx         # Cross-shift intercom with photo attachments
│   ├── SopBotWidget.tsx         # Deterministic SOP diagnostic assistant
│   ├── LogsSheetView.tsx        # Shift audit log table & 18-column CSV exporter
│   ├── AssetCatalogueView.tsx   # Asset registry, QR code upload & Excel sync
│   ├── ToolMaterialsPanel.tsx   # Vehicle-wise Tool Planner & BOM Excel matcher
│   └── ToastContainer.tsx       # Plant alert notifications
└── App.tsx                      # Root coordinator & database listeners
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
