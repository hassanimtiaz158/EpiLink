/**
 * Centralized API configuration for EpiLink.
 * All backend URLs live here. Override with VITE_API_BASE_URL.
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

/**
 * Optional Mapbox token. If present, the map will switch to Mapbox tiles.
 * Defaults to OpenStreetMap when unset (no token required).
 */
export const MAPBOX_TOKEN: string | undefined = import.meta.env.VITE_MAPBOX_TOKEN as
  | string
  | undefined;

export const MAPBOX_STYLE: string =
  (import.meta.env.VITE_MAPBOX_STYLE as string | undefined) ?? "mapbox/light-v11";

/**
 * Endpoint registry. Keep all backend paths in one place so they can be
 * swapped or namespaced without hunting through call sites.
 * If your FastAPI exposes different paths, edit this map only.
 */
export const ENDPOINTS = {
  // Reports (v1)
  reports: {
    list: "/api/v1/reports",
    create: "/api/v1/report",
    byId: (id: string) => `/api/v1/reports/${id}`,
  },
  // Input processing (new unified endpoints)
  input: {
    text: "/api/input/text",
    form: "/api/input/form",
    image: "/api/input/image",
    ocrText: "/api/input/ocr-text",
    health: "/api/input/health",
  },
  // AI Analysis pipeline
  analysis: {
    analyze: "/api/v1/analysis/analyze",
    run: (reportId: string) => `/api/v1/analysis/${reportId}`,
    status: (reportId: string) => `/api/v1/analysis/${reportId}/status`,
  },
  // Outbreak alerts (v1)
  alerts: {
    list: "/api/v1/alerts",
    byId: (id: string) => `/api/v1/alerts/${id}`,
    review: (id: string) => `/api/v1/alerts/${id}/review`,
  },
  // Map data
  map: {
    markers: "/api/v1/map/markers",
    clusters: "/api/v1/map/clusters",
  },
  // Dashboard analytics (v1)
  dashboard: {
    summary: "/api/v1/dashboard",
    trends: "/api/v1/dashboard",
    weekly: "/api/v1/dashboard",
    alertGrowth: "/api/v1/dashboard",
  },
  // Health/status
  health: {
    status: "/health",
    db: "/health",
    uptime: "/health",
    lastSync: "/health",
  },
  // Reference data
  reference: {
    diseases: "/api/v1/reference/diseases",
  },
  // Auth
  auth: {
    signup: "/api/auth/signup",
    login: "/api/auth/login",
    me: "/api/auth/me",
  },
} as const;

export const QUERY_KEYS = {
  alerts: ["alerts"] as const,
  alert: (id: string) => ["alerts", id] as const,
  reports: ["reports"] as const,
  mapMarkers: ["map", "markers"] as const,
  dashboardSummary: ["dashboard", "summary"] as const,
  dashboardTrends: ["dashboard", "trends"] as const,
  dashboardWeekly: ["dashboard", "weekly"] as const,
  dashboardAlertGrowth: ["dashboard", "alert-growth"] as const,
  health: ["health"] as const,
  diseases: ["reference", "diseases"] as const,
  analysis: (id: string) => ["analysis", id] as const,
  input: ["input"] as const,
};
