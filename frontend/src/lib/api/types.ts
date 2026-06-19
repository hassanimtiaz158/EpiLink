export type Severity = "low" | "moderate" | "high" | "critical";
export type AlertStatus = "pending" | "dispatched" | "under_review" | "confirmed" | "dismissed";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Disease {
  id: string;
  name: string;
  icd10?: string;
}

// Backend-compatible AlertOut (GET /api/v1/alerts)
export interface Alert {
  id: string;
  case_report_id: string;
  icd10_code: string;
  governorate: string;
  alert_level: "HIGH" | "REVIEW" | "NORMAL";
  z_score: number | null;
  confidence: number | null;
  status: AlertStatus;
  dispatched_at: string | null;
  dispatch_targets: Record<string, boolean> | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_decision: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface AlertListResponse {
  total: number;
  alerts: Alert[];
}

export interface ReportInput {
  facility_id: string;
  physician_id: string;
  governorate: string;
  district: string;
  age_group: AgeGroup;
  sex: Sex;
  nationality: Nationality;
  icd10_code: string;
  symptom_onset_date: string;
  diagnosis_basis: DiagnosisBasis;
  hospitalized: boolean;
  outcome: Outcome;
  lab_sample_taken: boolean;
  submission_mode: SubmissionMode;
}

export interface Report extends ReportInput {
  id: string;
  report_id: string;
  submitted_at: string;
  epi_week: number;
  disease_name: string;
  reporting_group: "A" | "B";
  created_at: string;
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

export interface AnalysisOutput {
  success: boolean;
  disease_name: string | null;
  icd10_code: string | null;
  confidence: number;
  severity: Severity;
  alert_level: "HIGH" | "REVIEW" | "NORMAL";
  governorate: string | null;
  district: string | null;
  age_group: string | null;
  sex: string | null;
  summary: string;
  recommendation: string;
  risk_factors: string[];
  nearby_governorates: string[];
  message: string;
}

// Backend DashboardOut (GET /api/v1/dashboard)
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
  last_audit: string | null;
  mean_confidence: number;
  human_confirmation_rate: number;
  status: string;
}

export interface DashboardData {
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

// Backend health response (GET /health)
export interface HealthStatus {
  status: string;
  version: string;
  database: string;
  timestamp: string;
}

// ---------- Input Types (matching backend schemas) ----------

export interface UserOut {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserOut;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
  role?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type AgeGroup = "<1" | "1-4" | "5-14" | "15-29" | "30-59" | "60+";
export type Sex = "Male" | "Female";
export type Nationality = "Egyptian" | "Other";
export type DiagnosisBasis = "Clinical" | "Lab-confirmed" | "Epidemiological link";
export type Outcome = "Alive" | "Dead" | "Unknown";
export type SubmissionMode =
  | "online"
  | "offline-cached"
  | "sms-fallback"
  | "text-extracted"
  | "image-extracted";

export interface StructuredReportData {
  facility_id?: string;
  physician_id?: string;
  governorate?: string;
  district?: string;
  age_group?: AgeGroup;
  sex?: Sex;
  nationality?: Nationality;
  icd10_code?: string;
  symptom_onset_date?: string;
  diagnosis_basis?: DiagnosisBasis;
  hospitalized?: boolean;
  outcome?: Outcome;
  lab_sample_taken?: boolean;
  submission_mode?: SubmissionMode;
}

export interface ExtractionWarning {
  field: string;
  message: string;
  confidence: number;
}

export interface InputResponse {
  success: boolean;
  structured_data?: StructuredReportData;
  report_id?: string;
  reporting_group?: string;
  alert_triggered: boolean;
  message: string;
  warnings: ExtractionWarning[];
  requires_human_review: boolean;
  confidence_score: number;
}

export interface TextInputRequest {
  text: string;
  source?: "manual" | "sms" | "import";
  facility_id?: string;
  physician_id?: string;
}

export interface FormInputRequest {
  facility_id: string;
  physician_id: string;
  governorate: string;
  district: string;
  age_group: AgeGroup;
  sex: Sex;
  nationality: Nationality;
  icd10_code: string;
  symptom_onset_date: string;
  diagnosis_basis: DiagnosisBasis;
  hospitalized: boolean;
  outcome: Outcome;
  lab_sample_taken: boolean;
  submission_mode: SubmissionMode;
}

export interface ImageInputRequest {
  image_base64: string;
  image_format?: "jpeg" | "png" | "pdf";
  facility_id?: string;
  physician_id?: string;
  auto_submit?: boolean;
}

export interface OCRTextInputRequest {
  text: string;
  source_language?: string;
  facility_id?: string;
  physician_id?: string;
}
