# Digital Transformation Initiatives in Maintenance & Business Operations
### Ashok Leyland Limited — Alwar Plant, Rajasthan
**Summer Industrial Internship Report (17 May – 19 June 2026)**  
**Author:** Shreyansh Choudhary (24BEI0025)  
**Department:** B.Tech Electronics and Instrumentation Engineering, Vellore Institute of Technology (VIT), Vellore  
**Industry Mentor:** Vaseem Akhtar, Deputy Manager, Ashok Leyland Limited  

---

## Executive Overview

This report consolidates three digital transformation initiatives undertaken across two departments during a 5-week industrial internship at **Ashok Leyland Limited, Alwar Plant**:
1. **Factory Floor Maintenance Dashboard** (Maintenance Department) — A live telemetry and tracking tool built to reduce equipment downtime and MTTR on the commercial vehicle assembly line.
2. **Vendor Evaluation and Performance Management System (VEMS)** (Operations & Business Excellence - OS&BE) — A 26-sub-KPI mathematical scoring framework and technical BRD addressing upstream supplier reliability and quality escapes.
3. **MPAS Store Digitisation** (Operations & Business Excellence - OS&BE) — A comprehensive 50-step process mapping, risk scoring, and root-cause analysis of the plant's inbound material planning and stores workflow.

Together, these three initiatives form an end-to-end operational chain: **VEMS** manages upstream vendor performance, **MPAS** manages warehouse material handling before it reaches the floor, and the **Maintenance Dashboard** ensures zero tool and equipment starvation during assembly.

---

# PART I: Factory Floor Maintenance Dashboard

## 1. Problem Statement: Shopfloor Disconnection
Before this system, maintenance and production communication on the Alwar chassis assembly line relied on four disconnected channels:
- **Paper Checklists**: Filled once per shift, stored in binders, rarely analyzed for trends.
- **Verbal Escalation**: Operators physically walked across the shopfloor or made phone calls to locate technicians during breakdowns.
- **Static Spreadsheets**: Unsynchronized Excel files for asset registers and tool allocations, slow to search under pressure.
- **Tribal Knowledge**: Unwritten repair routines and equipment quirks held only in individual technicians' memories.

A fault resolved by Shift A was frequently re-reported by Shift B. Most critically, tool availability for the next shift depended on whoever noticed a missing tool, with no structured way to verify tool readiness against the day's vehicle production schedule.

## 2. Project Goals
1. **Digital Checklists**: Replace paper checks with a 5-step structured digital logging sequence.
2. **Real-time Incident Visibility**: Provide a live, unrefreshed view of active faults across the entire plant floor.
3. **Standard Operating Procedure (SOP) Diagnostic Assistant**: Encode deterministic recovery steps for 6 major machine types to standardize maintenance quality across junior and senior staff.
4. **Centralized Asset & Node Registry**: Searchable inventory tracking make, controller serial numbers, static IP addresses, and stage locations.
5. **Material Code Tool Readiness Lookup**: Proactively surface required tools, counts, and stage locations based on scheduled vehicle variants before a shift begins.

## 3. System Architecture & Features
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS with shopfloor-optimized ergonomic touch targets.
- **Real-Time Data**: Firebase Realtime Database for instant push updates without polling.
- **Excel & BOM Integration**: SheetJS (XLSX) parser auto-mapping legacy spreadsheets and preserving custom plant attributes.
- **Access Control**: Role-based routing (Operator vs. Technician) with password-protected incident clearance.

### MTTR Response Time Reduction Model
Mean Time to Repair (MTTR) was dissected into five sequential stages, targeting each phase with digital automation:

$$\text{MTTR} = T_{\text{Detection}} + T_{\text{Notification}} + T_{\text{Diagnosis}} + T_{\text{Logistics}} + T_{\text{Repair \& Verification}}$$

| Phase | Traditional Shopfloor Bottleneck | Digital Dashboard Solution |
|---|---|---|
| **Detection** | Fault noticed only when an operator encounters a stoppage. | 5-step checklist & real-time telemetry card pushes status instantly. |
| **Notification** | Operator walks across the floor or phones maintenance. | Automated alert posted directly to team intercom and technician console. |
| **Diagnosis** | Relies on technician memory and experience. | Built-in SOP Bot guides the operator through verified recovery steps. |
| **Logistics** | Tool shortages discovered when line is already waiting. | Morning vehicle BOM lookup pre-identifies required tools before shift starts. |
| **Verification** | Unconfirmed verbal closure; re-reported by next shift. | One-click resolution with audit stamp, timestamp, and status clearance. |

---

# PART II: Vendor Evaluation & Performance Management System (VEMS)

## 1. Problem Statement
Vendor performance tracking was historically fragmented across individual buyer spreadsheets, meeting notes, and subjective opinions. This led to:
- **No Performance Baseline**: Conversations around delivery reliability and quality were opinion-based.
- **Lack of Trend Visibility**: Deteriorating supplier performance over 3–6 months went undetected until a major line stoppage occurred.
- **Audit Vulnerability**: Inability to provide structured historical records during supplier quality assurance (SQA) audits.

## 2. 26 Sub-KPI Evaluation Framework
A weighted scoring matrix (1–5 scale) was structured across five performance pillars:

1. **Delivery Performance**: On-time delivery rate, lead time adherence, ASN compliance, dock-to-stock cycle time, emergency delivery frequency.
2. **Quality Performance**: Incoming inspection pass rate, PPM defect rate, SQA rejection frequency, field return rate, repeat defect recurrence.
3. **Responsiveness & Communication**: Speed of response to ASN exceptions, ODC resolution turnaround, buyer query response time, escalation handling.
4. **Documentation & Compliance**: Invoice accuracy, GRN supporting document completeness, regulatory and certification compliance, audit readiness.
5. **Commercial & Relationship**: Price stability, responsiveness to process improvement, dispute resolution behavior, strategic partnership contribution.

## 3. On-Premises Architecture Constraint
Because vendor pricing and evaluation data are commercially confidential, cloud hosting was strictly prohibited. The system was designed for on-premises deployment:
- **Web Server**: Internet Information Services (IIS) on Windows Server (reverse proxy).
- **Application Server**: Node.js managed under PM2 process supervisor.
- **Database**: PostgreSQL on-premises with relational integrity for scoring audits.
- **Handover Deliverable**: A fully drafted, LaTeX-authored technical Business Requirements Document (BRD) specifying entity schemas, calculation logic, and UI wireframes.

---

# PART III: MPAS Store Digitisation

## 1. Problem Statement
The Material Planning and Store (MPAS) workflow connects vendor gate entry to assembly line feeding. Field analysis revealed severe structural bottlenecks:
- **Batch GRN Entry**: Goods Receipt Notes (GRN) entered in SAP only at shift end, creating up to 8 hours of phantom stockouts.
- **MROBIN Excel Circulation**: Bin locations referenced via offline Excel files shared over WhatsApp, leading to wrong-bin putaways.
- **Unverified Manual Picking**: Picklists printed on paper; parts visually selected with zero barcode verification, causing assembly mismatches.
- **Lost ODC Records**: Over, Damage, and Shortage claims written on paper invoices without photo evidence or system SLAs.

## 2. Current-State Risk Analysis
Consolidated 50 individual process steps across four internal plant documents:
- **Critical Risk (Score 9–10)**: 17 steps (notably Step 16: manual count at unloading, and Step 45: manual picking without scan).
- **High Risk (Score 7–8)**: 25 steps.
- **Medium Risk (Score 5–6)**: 7 steps.

## 3. Priority Improvement Roadmap
1. **Scan-based Receiving at Dock (Step 16)**: Barcode scan against open SAP Purchase Order before vendor vehicle exits.
2. **Live SAP Bin Query (Step 35/36)**: Eliminate WhatsApp MROBIN spreadsheets in favor of real-time mobile bin lookups.
3. **Point-of-Receipt GRN (Step 29)**: Trigger instant SAP inventory posting upon physical unloading.
4. **Scan-Guided Picking (Step 45)**: Force QR scan confirmation before parts can be moved to assembly kitting carts.
5. **Digital ODC Tracking with Photo Evidence (Step 21/27)**: Automatic PO line block and buyer notification with SLA tracking.

### 5 Workaround Steps Automatically Eliminated Upon Digitisation
- **Step 14**: Duplicate bin logging in manual registers.
- **Step 24**: Third separate proof-of-delivery (POD) paper register.
- **Step 25**: Physical walking of paper ODC slips to Data Entry Operators (DEO).
- **Step 43**: Manual recreation of picklists from downloaded spreadsheets.
- **Step 44**: Physical paper distribution of pick sheets across shopfloor zones.

---

## Core Engineering Insights
1. *"The same information recorded three times is not three times safer. Redundancy without linkage is noise, not control."*
2. *"An offline file is not a digital system. Stale spreadsheets circulated on chat carry all the failure modes of paper registers with the added risk of accidental corruption."*
3. *"Batch processing is invisible operational debt. It appears efficient in transaction logs, but blinds planners and line supervisors for an entire shift."*
4. *"A missing scan is a missing gate. Without physical scan validation, errors compound until an assembler encounters a defective or missing component."*
5. *"Designing for the shopfloor requires large touch targets, minimal typing, and clear color coding. A system operators actually use is worth infinitely more than a complex system they bypass."*
