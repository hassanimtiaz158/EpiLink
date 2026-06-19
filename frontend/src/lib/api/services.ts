import { apiFetch } from "./client";
import { ENDPOINTS } from "./config";
import type {
  Alert,
  AnalysisResult,
  Disease,
  HealthStatus,
  MapMarker,
  ReportInput,
} from "./types";

// ---------- Reports ----------
export const reportsService = {
  create: (input: ReportInput) =>
    apiFetch<{
      status: string;
      report_id: string;
      reporting_group: string;
      alert_triggered: boolean;
      message: string;
    }>(ENDPOINTS.reports.create, {
      method: "POST",
      body: input,
    }),
};

// ---------- Analysis ----------
export const analysisService = {
  // TODO: confirm whether analysis is sync or async (polling vs WebSocket).
  run: (reportId: string) =>
    apiFetch<AnalysisResult>(ENDPOINTS.analysis.run(reportId), {
      method: "POST",
    }),
  status: (reportId: string) =>
    apiFetch<AnalysisResult>(ENDPOINTS.analysis.status(reportId)),
};

// ---------- Alerts ----------
export const alertsService = {
  /**
   * List alerts. Backend returns: { total: int, alerts: AlertOut[] }
   */
  list: (params?: {
    status?: string;
    governorate?: string;
    icd10_code?: string;
    alert_level?: string;
    limit?: number;
    offset?: number;
  }) =>
    apiFetch<{ total: number; alerts: Alert[] }>(ENDPOINTS.alerts.list, {
      query: params,
    }),

  /**
   * Get a single alert by id.
   * No dedicated GET /alerts/{id} endpoint exists in the backend yet.
   * Fetches the full list and finds by id.
   */
  get: (id: string) =>
    apiFetch<{ total: number; alerts: Alert[] }>(ENDPOINTS.alerts.list).then(
      (res) => {
        const found = res.alerts.find((a) => a.id === id);
        if (!found) throw new Error(`Alert ${id} not found`);
        return found;
      },
    ),

  /**
   * Review an alert. Backend AlertReviewSchema: { decision, reviewed_by, notes }
   * decision: "confirmed" | "dismissed"
   */
  review: (
    id: string,
    decision: string,
    notes = "",
    reviewed_by = "epidemiologist",
  ) =>
    apiFetch<{ alert_id: string; status: string; reviewed_at: string }>(
      ENDPOINTS.alerts.review(id),
      {
        method: "PATCH",
        body: { decision, reviewed_by, notes },
      },
    ),

  /** Confirm/approve an alert */
  approve: (id: string) => alertsService.review(id, "confirmed"),

  /** Dismiss an alert */
  dismiss: (id: string) => alertsService.review(id, "dismissed"),

  /**
   * Request more data — no dedicated backend action yet.
   * Uses "under_review" as the closest proxy status.
   */
  requestData: (id: string) => alertsService.review(id, "under_review"),
};

// ---------- Map ----------
// NOTE: mapService.markers endpoint is NOT implemented by the backend yet.
// Keep code intact; the query is disabled at the call site with a safe fallback.
export const mapService = {
  markers: (params?: { disease?: string; severity?: string }) =>
    apiFetch<MapMarker[]>(ENDPOINTS.map.markers, { query: params }),
};

// ---------- Dashboard ----------
export const dashboardService = {
  summary: () =>
    apiFetch<{
      summary: {
        total_reports_this_week: number;
        total_alerts_this_week: number;
        alert_rate: number;
        alert_rate_status: string;
        pending_reviews: number;
      };
      weekly_trend: Array<{
        epi_week: number;
        week_start: string;
        total_reports: number;
        group_a_reports: number;
        group_b_reports: number;
        alerts_dispatched: number;
      }>;
      top_diseases: Array<{ disease: string; icd10: string; count: number }>;
      recent_alerts: Alert[];
      drift: {
        last_audit?: string;
        mean_confidence: number;
        human_confirmation_rate: number;
        status: string;
      };
    }>(ENDPOINTS.dashboard.summary),
};

// ---------- Health ----------
export const healthService = {
  status: () =>
    apiFetch<{
      status: string;
      version: string;
      database: string;
      timestamp: string;
    }>(ENDPOINTS.health.status),
};

// ---------- Reference ----------
export const referenceService = {
  diseases: () => apiFetch<Disease[]>(ENDPOINTS.reference.diseases),
};
