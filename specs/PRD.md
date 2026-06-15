# PRD — EpiLink Backend
**USAII Hackathon 2026 | Graduate Track | Deadline: June 21, 11:59 PM ET**
**Team:** Sarah Abossoud · Hasan Ali · Egharevba Nosakhare

---

## 1. Problem Statement

Disease surveillance in low-resource settings fails at the data collection layer. Existing systems rely on free-text SMS or paper-based reporting, producing unreliable, ambiguous data that delays outbreak detection. By the time a pattern is visible, the epidemiological window for containment has closed.

EpiLink solves this by giving licensed physicians a **structured, offline-capable, mobile-first reporting tool** that feeds a real-time anomaly detection backend — eliminating the data quality problem by design.

---

## 2. Users

| Role | Description | Primary Action |
|------|-------------|----------------|
| Physician | Licensed doctor at a health facility | Submit case reports via structured form |
| Epidemiologist | Ministry-level public health officer | Review escalated alerts, confirm or dismiss |
| System Admin | EpiLink technical operator | Monitor model drift, manage facilities |
| WHO / Ministry | External alert recipients | Receive HL7 FHIR-formatted outbreak notifications |

---

## 3. Core Architectural Decision: Structured Intake

**EpiLink does not use free-text input.** This is a deliberate design choice that eliminates the three most common failure modes in low-resource surveillance systems:

| Problem Eliminated | How |
|---|---|
| Dialect / language variation | Physician selects from validated dropdowns — no typing |
| Spelling errors | No free text fields in the clinical section |
| NLP parsing failures | ICD-10 code is auto-assigned on disease name selection |
| Ambiguous symptom descriptions | Standardised age groups, diagnosis basis options |

SMS is used exclusively as a **delivery channel** for offline fallback — not as a free-text input mechanism. The SMS payload uses fixed-position field encoding (`RPT#FACILITYID#ICD10CODE#AGEGROUP#SEX#OUTCOME`), requiring zero NLP.

---

## 4. Feature Requirements

### 4.1 Structured Case Report Form (P0)

The form schema is fixed. All fields are selection-based.

**Location block**
- Governorate (dropdown — all Egyptian governorates)
- District (dropdown — filtered by governorate selection)
- Facility ID (auto-filled from physician account)

**Disease Classification block**
- Disease Name (dropdown — Egypt DES 45 notifiable diseases)
- ICD-10 Code (auto-assigned on disease selection — not user-editable)
- Reporting Group (auto-classified — Group A: Immediate / Group B: Weekly)
- Symptom Onset Date (date picker)
- Diagnosis Basis (dropdown — Clinical / Lab-confirmed / Epidemiological link)

**Patient (Anonymous) block**
- Age Group (dropdown — `<1`, `1–4`, `5–14`, `15–29`, `30–59`, `60+`)
- Sex (dropdown — Male / Female)
- Hospitalized (boolean)
- Outcome (dropdown — Alive / Dead / Unknown)
- Lab Sample Taken (boolean toggle)

**No patient name, address, or exact date of birth is collected at any point.**

---

### 4.2 Offline-First Submission (P0)

Three submission layers, in priority order:

**Layer 1 — Online:** Form → HTTPS POST → FastAPI → PostgreSQL. Response within 2 seconds.

**Layer 2 — Offline-Cached:** Form → IndexedDB queue. Visual confirmation: "Saved locally — will sync when connected." PWA Service Worker detects reconnection and auto-POSTs all pending reports.

**Layer 3 — SMS Fallback:** Physician sends structured SMS to EpiLink Twilio number. Fixed-position parsing (no NLP). Pipeline: Twilio webhook → FastAPI `/api/v1/sms-webhook` → same validation and alert logic as online submission.

---

### 4.3 Automated Alert System (P0)

- **Group A diseases** trigger an immediate alert pipeline within 60 seconds of report submission
- Alert dispatched to: Ministry webhook, WHO HL7 FHIR endpoint, Epidemiologist dashboard
- **Group B diseases** contribute to weekly aggregate reports only
- Anomaly detection runs on every report: z-score against 52-week seasonal baseline per governorate per disease
- Alerts above the 85% confidence threshold dispatch automatically; below 85% escalate to epidemiologist for manual review

---

### 4.4 Model Drift Monitoring (P0)

- Weekly automated audit job (every Sunday 00:00 UTC)
- Metrics tracked: alert rate (expected 0.5%–15%), mean confidence score, epidemiologist confirmation rate (target >70%)
- Drift detected → immediate admin notification
- Seasonal baseline recalibrated quarterly on rolling 3-year window

---

### 4.5 Privacy & Federated Architecture (P0)

- Patient identifiers never leave the country-level server
- Only anonymized aggregate signals forwarded to EpiLink global: `{icd10_code, age_group, governorate, epi_week, count}`
- No names, no patient IDs, no exact dates of birth transmitted cross-border

---

### 4.6 Dashboard (P1)

- Weekly case counts by disease and governorate
- Active alerts list with status (auto-dispatched / under review / resolved)
- Drift monitoring panel: alert rate trend, confidence distribution histogram, confirmation rate
- Offline queue status (pending sync count)

---

## 5. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Report submission latency (online) | < 2 seconds p95 |
| Group A alert dispatch latency | < 60 seconds from submission |
| Offline queue sync on reconnect | < 30 seconds for up to 50 queued reports |
| SMS parse-to-DB latency | < 10 seconds from Twilio receipt |
| Anomaly detection per report | < 5 seconds |
| API uptime | 99.5% during hackathon demo window |

---

## 6. Out of Scope (Hackathon Build)

- Patient-facing mobile app
- Lab result integration
- Multi-country federated server network (architecture designed for it, single-country for demo)
- Real WHO API integration (mocked with webhook endpoint)
- Authentication / JWT (physician_id hashed, no login flow in demo)
