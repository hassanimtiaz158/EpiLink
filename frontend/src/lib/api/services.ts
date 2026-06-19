import { apiFetch } from "./client";
import { ENDPOINTS } from "./config";
import type {
  Alert,
  AlertListResponse,
  AnalysisResult,
  AnalysisOutput,
  DashboardData,
  Disease,
  HealthStatus,
  MapMarker,
  Report,
  ReportInput,
  TrendPoint,
  InputResponse,
  TextInputRequest,
  FormInputRequest,
  ImageInputRequest,
  OCRTextInputRequest,
  TokenResponse,
  SignupRequest,
  LoginRequest,
  UserOut,
} from "./types";

// ---------- Reports ----------
export const reportsService = {
<<<<<<< HEAD
  list: () => apiFetch<Report[]>(ENDPOINTS.reports.list),
=======
>>>>>>> 67e0f965c0d324d8b9d3c8e6af0746f272eb1adc
  create: (input: ReportInput) =>
  apiFetch<any>(ENDPOINTS.reports.create, {
    method: "POST",
    body: input,
  }),
};

// ---------- Input Processing (New Unified Endpoints) ----------
export const inputService = {
  text: (request: TextInputRequest) =>
    apiFetch<InputResponse>(ENDPOINTS.input.text, {
      method: "POST",
      body: request,
    }),
  form: (request: FormInputRequest) =>
    apiFetch<InputResponse>(ENDPOINTS.input.form, {
      method: "POST",
      body: request,
    }),
  image: (request: ImageInputRequest) =>
    apiFetch<InputResponse>(ENDPOINTS.input.image, {
      method: "POST",
      body: request,
    }),
  ocrText: (request: OCRTextInputRequest) =>
    apiFetch<InputResponse>(ENDPOINTS.input.ocrText, {
      method: "POST",
      body: request,
    }),
  health: () => apiFetch<HealthStatus>(ENDPOINTS.input.health),
};

// ---------- Analysis ----------
export const analysisService = {
  analyze: (text: string) =>
    apiFetch<AnalysisOutput>(ENDPOINTS.analysis.analyze, {
      method: "POST",
      body: { text, source: "manual" },
    }),
  run: (reportId: string) =>
    apiFetch<AnalysisResult>(ENDPOINTS.analysis.run(reportId), {
      method: "POST",
    }),
  status: (reportId: string) => apiFetch<AnalysisResult>(ENDPOINTS.analysis.status(reportId)),
};

// ---------- Alerts ----------
export const alertsService = {
  list: (params?: {
<<<<<<< HEAD
    governorate?: string;
    status?: string;
    icd10_code?: string;
    alert_level?: string;
    limit?: number;
    offset?: number;
  }) => apiFetch<AlertListResponse>(ENDPOINTS.alerts.list, { query: params }),
  get: (id: string) => apiFetch<Alert>(ENDPOINTS.alerts.byId(id)),
  review: (id: string, decision: "confirmed" | "dismissed", reviewedBy: string, notes: string) =>
    apiFetch<{ alert_id: string; status: string; reviewed_at: string }>(
      ENDPOINTS.alerts.review(id),
      {
        method: "PATCH",
        body: { decision, reviewed_by: reviewedBy, notes },
      },
    ),
=======
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
>>>>>>> 67e0f965c0d324d8b9d3c8e6af0746f272eb1adc
};

// ---------- Map ----------
export const mapService = {
  markers: (params?: { disease?: string; severity?: string }) =>
    apiFetch<MapMarker[]>(ENDPOINTS.map.markers, { query: params }),
};

// ---------- Dashboard ----------
export const dashboardService = {
<<<<<<< HEAD
  all: () => apiFetch<DashboardData>(ENDPOINTS.dashboard.summary),
=======
  summary: () =>
    apiFetch<any>(ENDPOINTS.dashboard.summary),
>>>>>>> 67e0f965c0d324d8b9d3c8e6af0746f272eb1adc
};

// ---------- Health ----------
export const healthService = {
  status: () => apiFetch<HealthStatus>(ENDPOINTS.health.status),
};

// ---------- Reference ----------
export const referenceService = {
  diseases: () => apiFetch<Disease[]>(ENDPOINTS.reference.diseases),
};

// ---------- Auth ----------
export const authService = {
  signup: (data: SignupRequest) =>
    apiFetch<TokenResponse>(ENDPOINTS.auth.signup, {
      method: "POST",
      body: data,
    }),
  login: (data: LoginRequest) =>
    apiFetch<TokenResponse>(ENDPOINTS.auth.login, {
      method: "POST",
      body: data,
    }),
  me: () => apiFetch<UserOut>(ENDPOINTS.auth.me),
};
