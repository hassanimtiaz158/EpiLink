export type Severity = "low" | "moderate" | "high" | "critical";
export type AlertStatus = "pending" | "investigating" | "approved" | "dismissed";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Disease {
  id: string;
  name: string;
  icd10_code: string;
  group_label: string;
  alert_minutes: number;
  description: string | null;
}

export interface Report {
  id: string;
  disease: string;
  symptoms: string[];
  location: string;
  geo?: GeoPoint;
  facility?: string;
  anonymous: boolean;
  notes?: string;
  createdAt: string;
}

export interface ReportInput {
  facility_id: string;
  physician_id: string;
  governorate: string;
  district: string;
  age_group: "<1" | "1-4" | "5-14" | "15-29" | "30-59" | "60+";
  sex: "Male" | "Female";
  nationality: string;
  icd10_code: string;
  symptom_onset_date: string;
  diagnosis_basis: "Clinical" | "Lab-confirmed" | "Epidemiological link";
  hospitalized: boolean;
  outcome: "Alive" | "Dead" | "Unknown";
  lab_sample_taken: boolean;
  submission_mode: "online" | "offline-cached" | "sms-fallback";
}

export interface MapMarker {
  id: string;
  disease: string;
  severity: Severity;
  lat: number;
  lng: number;
  reports: number;
  location: string;
}

export interface Alert {
  id: string;
  case_report_id?: string;
  icd10_code: string;
  governorate: string;
  alert_level?: string;
  z_score?: number;
  confidence?: number;
  status: string;
  dispatched_at?: string;
  dispatch_targets?: Record<string, unknown>;
  reviewed_by?: string;
  reviewed_at?: string;
  review_decision?: string;
  review_notes?: string;
  created_at: string;
}

export interface AlertListResponse {
  total: number;
  alerts: Alert[];
}

export interface ReviewResponse {
  alert_id: string;
  status: string;
  reviewed_at: string;
}

export interface AnalysisResult {
  reportId: string;
  disease: string;
  icd10: string;
  confidence: number;
  alertLevel: Severity;
  stages: {
    validated: boolean;
    classified: boolean;
    geomapped: boolean;
    clustered: boolean;
    assessed: boolean;
  };
}

export interface DashboardSummary {
  total_reports_this_week: number;
  total_alerts_this_week: number;
  alert_rate: number;
  alert_rate_status: string;
  pending_reviews: number;
}

export interface WeeklyTrendItem {
  epi_week: number;
  week_start: string;
  total_reports: number;
  group_a_reports: number;
  group_b_reports: number;
  alerts_dispatched: number;
}

export interface TopDiseaseItem {
  disease: string;
  icd10: string;
  count: number;
}

export interface DashboardDrift {
  last_audit?: string;
  mean_confidence: number;
  human_confirmation_rate: number;
  status: string;
}

export interface DashboardResponse {
  summary: DashboardSummary;
  weekly_trend: WeeklyTrendItem[];
  top_diseases: TopDiseaseItem[];
  recent_alerts: Alert[];
  drift: DashboardDrift;
}

export interface TrendPoint {
  date: string;
  [disease: string]: number | string;
}

export interface HealthStatus {
  /** Backend field: "ok" when running */
  status: string;
  version: string;
  /** Backend returns "connected" | "disconnected" */
  database: string;
  timestamp: string;
}
