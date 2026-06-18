import { apiFetch } from "./client";
import { ENDPOINTS } from "./config";
import type {
  Alert,
  AnalysisResult,
  DashboardSummary,
  Disease,
  HealthStatus,
  MapMarker,
  Report,
  ReportInput,
  TrendPoint,
} from "./types";

// ---------- Reports ----------
export const reportsService = {
  create: (input: ReportInput) =>
  apiFetch<any>(ENDPOINTS.reports.create, {
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
  list: (params?: {
    status?: string;
  }) =>
    apiFetch<any[]>(ENDPOINTS.alerts.list, {
      query: params,
    }),

  review: (id: string, status: string) =>
    apiFetch<any>(ENDPOINTS.alerts.review(id), {
      method: "PATCH",
      body: { status },
    }),
};

// ---------- Map ----------
export const mapService = {
  markers: (params?: { disease?: string; severity?: string }) =>
    apiFetch<MapMarker[]>(ENDPOINTS.map.markers, { query: params }),
};

// ---------- Dashboard ----------
export const dashboardService = {
  summary: () =>
    apiFetch<any>(ENDPOINTS.dashboard.summary),
};

// ---------- Health ----------
export const healthService = {
  status: () => apiFetch<HealthStatus>(ENDPOINTS.health.status),
};

// ---------- Reference ----------
export const referenceService = {
  // TODO: confirm whether diseases list comes from /api/reference/diseases
  // or is embedded in another payload.
  diseases: () => apiFetch<Disease[]>(ENDPOINTS.reference.diseases),
};
