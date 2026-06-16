export type Severity = "low" | "moderate" | "high" | "critical";
export type AlertStatus = "pending" | "investigating" | "approved" | "dismissed";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Disease {
  id: string;
  name: string;
  icd10?: string;
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
  disease: string;
  symptoms: string[];
  location: string;
  geo?: GeoPoint;
  facility?: string;
  anonymous: boolean;
  notes?: string;
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
  disease: string;
  icd10?: string;
  location: string;
  geo?: GeoPoint;
  severity: Severity;
  status: AlertStatus;
  confidence: number;
  reports: number;
  cluster?: { radiusKm: number; growthRate: number };
  createdAt: string;
  summary?: string;
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
  totalReports: number;
  activeAlerts: number;
  pendingReviews: number;
  activeClusters: number;
}

export interface TrendPoint {
  date: string;
  [disease: string]: number | string;
}

export interface HealthStatus {
  api: "ok" | "degraded" | "down";
  database: "ok" | "degraded" | "down";
  uptimeSeconds: number;
  lastSync: string;
}
