# API_SPEC — EpiLink REST API
**Base URL (local):** `http://localhost:8000`
**Base URL (production):** `https://epilink-api.railway.app`

All endpoints return `application/json`. All error responses follow `{"error": "...", "code": "..."}`.

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/v1/report` | Submit case report |
| POST | `/api/v1/sms-webhook` | Twilio SMS fallback receiver |
| GET | `/api/v1/alerts` | List alerts with filters |
| PATCH | `/api/v1/alerts/{id}/review` | Epidemiologist review decision |
| GET | `/api/v1/dashboard` | Weekly stats + recent alerts |

---

## GET `/health`

No authentication required.

**Response 200**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "database": "connected",
  "timestamp": "2026-06-15T10:00:00Z"
}
```

---

## POST `/api/v1/report`

Submit a structured case report. Accepts online form submissions and SMS-decoded payloads (both use same schema).

**Request Body**
```json
{
  "facility_id": "EGY-PHC-0042",
  "physician_id": "raw-id-hashed-before-db-write",
  "governorate": "Cairo",
  "district": "Heliopolis",
  "icd10_code": "A39.0",
  "symptom_onset_date": "2026-06-13",
  "diagnosis_basis": "Lab-confirmed",
  "age_group": "15-29",
  "sex": "Male",
  "nationality": "Egyptian",
  "hospitalized": true,
  "outcome": "Alive",
  "lab_sample_taken": true,
  "submission_mode": "online"
}
```

**Field constraints**

| Field | Type | Allowed values |
|---|---|---|
| `icd10_code` | string | Must exist in `diseases` table |
| `diagnosis_basis` | string | `Clinical`, `Lab-confirmed`, `Epidemiological link` |
| `age_group` | string | `<1`, `1-4`, `5-14`, `15-29`, `30-59`, `60+` |
| `sex` | string | `Male`, `Female` |
| `nationality` | string | `Egyptian`, `Other` |
| `outcome` | string | `Alive`, `Dead`, `Unknown` |
| `submission_mode` | string | `online`, `offline-cached`, `sms-fallback` |

**Response 201**
```json
{
  "status": "received",
  "report_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "reporting_group": "A",
  "alert_triggered": true,
  "message": "Group A disease — immediate alert dispatched"
}
```

**Response 400 — Invalid ICD-10**
```json
{
  "error": "ICD-10 code A99.9 not found in disease registry",
  "code": "INVALID_ICD10"
}
```

**Response 422 — Validation error**
```json
{
  "error": "age_group must be one of: <1, 1-4, 5-14, 15-29, 30-59, 60+",
  "code": "VALIDATION_ERROR"
}
```

**Side effects (async, after 201 returned):**
- Group A: `asyncio.create_task(dispatch_alert(...))` fires — Ministry webhook + WHO FHIR
- Always: `check_cluster_anomaly(governorate, icd10_code)` — z-score computed, alert created if threshold met

---

## POST `/api/v1/sms-webhook`

Twilio webhook receiver. Parses fixed-position SMS format into a case report.

**Request** (Twilio POST, `application/x-www-form-urlencoded`)
```
Body=RPT%23EGY042%23A39.0%2315-29%23M%23ALIVE
From=%2B201012345678
```

Decoded body: `RPT#EGY042#A39.0#15-29#M#ALIVE`

**Field positions (split on `#`):**

| Index | Field | Example |
|---|---|---|
| 0 | Command prefix | `RPT` |
| 1 | Facility ID | `EGY042` |
| 2 | ICD-10 code | `A39.0` |
| 3 | Age group | `15-29` |
| 4 | Sex (`M`/`F`) | `M` |
| 5 | Outcome | `ALIVE` / `DEAD` / `UNKNOWN` |

**Twilio signature validation:** enforced when `ENVIRONMENT=production`. Skipped in development.

**Response 200 (Twilio expects 200)**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>EpiLink: Report received. ID: 3fa85f64. Group A alert dispatched.</Message>
</Response>
```

**Response 400 — Parse failure**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>EpiLink ERROR: Invalid format. Expected RPT#FACILITYID#ICD10#AGEGROUP#SEX#OUTCOME</Message>
</Response>
```

---

## GET `/api/v1/alerts`

List alerts. All parameters optional.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `governorate` | string | Filter by governorate |
| `status` | string | `pending`, `dispatched`, `under_review`, `confirmed`, `dismissed` |
| `icd10_code` | string | Filter by disease |
| `alert_level` | string | `HIGH`, `REVIEW` |
| `limit` | integer | Default 20, max 100 |
| `offset` | integer | Default 0 |

**Response 200**
```json
{
  "total": 3,
  "alerts": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "case_report_id": "8f14e45f-ceea-467a-a866-77a434ea4b72",
      "created_at": "2026-06-15T08:30:00Z",
      "alert_level": "HIGH",
      "z_score": 3.7,
      "confidence": 0.92,
      "status": "dispatched",
      "dispatched_at": "2026-06-15T08:30:05Z",
      "dispatch_targets": {
        "ministry": true,
        "who_fhir": true,
        "sms": false
      },
      "review_decision": null
    }
  ]
}
```

---

## PATCH `/api/v1/alerts/{id}/review`

Epidemiologist submits a review decision on a `REVIEW`-level alert.

**Path parameter:** `id` — UUID of alert

**Request Body**
```json
{
  "decision": "confirmed",
  "reviewed_by": "epi-officer-cairo-01",
  "notes": "Cluster confirmed — 4 additional cases reported from adjacent district"
}
```

| Field | Allowed values |
|---|---|
| `decision` | `confirmed`, `dismissed` |

**Response 200**
```json
{
  "alert_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "confirmed",
  "reviewed_at": "2026-06-15T09:15:00Z"
}
```

**Side effect on `confirmed`:** triggers full Ministry + WHO dispatch if not already sent.

**Response 404**
```json
{
  "error": "Alert not found",
  "code": "ALERT_NOT_FOUND"
}
```

**Response 409 — Already reviewed**
```json
{
  "error": "Alert has already been reviewed",
  "code": "ALREADY_REVIEWED"
}
```

---

## GET `/api/v1/dashboard`

Weekly statistics and recent alert summary. Used by the epidemiologist dashboard.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `weeks` | integer | Number of past weeks to include. Default 4, max 52 |
| `governorate` | string | Optional filter |

**Response 200**
```json
{
  "summary": {
    "total_reports_this_week": 142,
    "total_alerts_this_week": 7,
    "alert_rate": 0.049,
    "alert_rate_status": "NORMAL",
    "pending_reviews": 2
  },
  "weekly_trend": [
    {
      "epi_week": 24,
      "week_start": "2026-06-08",
      "total_reports": 142,
      "group_a_reports": 11,
      "group_b_reports": 131,
      "alerts_dispatched": 7
    }
  ],
  "top_diseases": [
    { "disease": "Meningococcal meningitis", "icd10": "A39.0", "count": 18 },
    { "disease": "Cholera", "icd10": "A00", "count": 12 }
  ],
  "recent_alerts": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "disease": "Meningococcal meningitis",
      "governorate": "Cairo",
      "alert_level": "HIGH",
      "status": "dispatched",
      "created_at": "2026-06-15T08:30:00Z"
    }
  ],
  "drift": {
    "last_audit": "2026-06-08T00:00:00Z",
    "mean_confidence": 0.91,
    "human_confirmation_rate": 0.78,
    "status": "NORMAL"
  }
}
```

---

## Error Format

All error responses:
```json
{
  "error": "Human-readable description",
  "code": "MACHINE_READABLE_CODE"
}
```

| HTTP Code | When |
|---|---|
| 400 | Invalid ICD-10, parse failure |
| 404 | Resource not found |
| 409 | Conflict (already reviewed) |
| 422 | Pydantic validation failure |
| 500 | Unexpected server error |

---

## Demo Scenarios (for judges)

**Scenario 1 — Group A alert pipeline:**
```
POST /api/v1/report  { icd10_code: "A00", governorate: "Cairo", ... }
→ 201: { reporting_group: "A", alert_triggered: true }
→ GET /api/v1/alerts → alert with status "dispatched" appears within 5s
```

**Scenario 2 — SMS fallback:**
```
POST /api/v1/sms-webhook  Body=RPT#EGY042#A00#30-59#M#ALIVE
→ 200 TwiML response
→ GET /api/v1/alerts → same alert pipeline as online
```

**Scenario 3 — Anomaly cluster:**
```
POST /api/v1/report × 8  (same disease, same governorate, rapid succession)
→ z-score exceeds 2.5 → AlertLevel.HIGH
→ GET /api/v1/alerts → HIGH alert with confidence 0.87 dispatched
```
