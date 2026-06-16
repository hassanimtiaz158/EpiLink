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
  list: () => apiFetch<Report[]>(ENDPOINTS.reports.list),
  // TODO: confirm FastAPI response shape (returns created Report).
  create: (input: ReportInput) =>
    apiFetch<Report>(ENDPOINTS.reports.create, {
      method: "POST",
      body: input,
    }),
  get: (id: string) => apiFetch<Report>(ENDPOINTS.reports.byId(id)),
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
    q?: string;
    status?: string;
    disease?: string;
    minConfidence?: number;
  }) => apiFetch<Alert[]>(ENDPOINTS.alerts.list, { query: params }),
  get: (id: string) => apiFetch<Alert>(ENDPOINTS.alerts.byId(id)),
  approve: (id: string) =>
    apiFetch<Alert>(ENDPOINTS.alerts.approve(id), { method: "POST" }),
  requestData: (id: string) =>
    apiFetch<Alert>(ENDPOINTS.alerts.requestData(id), { method: "POST" }),
  dismiss: (id: string) =>
    apiFetch<Alert>(ENDPOINTS.alerts.dismiss(id), { method: "POST" }),
};

// ---------- Map ----------
export const mapService = {
  markers: (params?: { disease?: string; severity?: string }) =>
    apiFetch<MapMarker[]>(ENDPOINTS.map.markers, { query: params }),
};

// ---------- Dashboard ----------
export const dashboardService = {
  summary: () => apiFetch<DashboardSummary>(ENDPOINTS.dashboard.summary),
  trends: () => apiFetch<TrendPoint[]>(ENDPOINTS.dashboard.trends),
  weekly: () => apiFetch<TrendPoint[]>(ENDPOINTS.dashboard.weekly),
  alertGrowth: () => apiFetch<TrendPoint[]>(ENDPOINTS.dashboard.alertGrowth),
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
