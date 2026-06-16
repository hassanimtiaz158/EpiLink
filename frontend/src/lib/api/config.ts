/**
 * Centralized API configuration for EpiLink.
 * All backend URLs live here. Override with VITE_API_BASE_URL.
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000";

/**
 * Optional Mapbox token. If present, the map will switch to Mapbox tiles.
 * Defaults to OpenStreetMap when unset (no token required).
 */
export const MAPBOX_TOKEN: string | undefined = import.meta.env
  .VITE_MAPBOX_TOKEN as string | undefined;

export const MAPBOX_STYLE: string =
  (import.meta.env.VITE_MAPBOX_STYLE as string | undefined) ??
  "mapbox/light-v11";

/**
 * Endpoint registry. Keep all backend paths in one place so they can be
 * swapped or namespaced without hunting through call sites.
 * If your FastAPI exposes different paths, edit this map only.
 */
export const ENDPOINTS = {
  // Reports
  reports: {
    list: "/api/reports",
    create: "/api/reports",
    byId: (id: string) => `/api/reports/${id}`,
  },
  // AI Analysis pipeline
  analysis: {
    run: (reportId: string) => `/api/analysis/${reportId}`,
    status: (reportId: string) => `/api/analysis/${reportId}/status`,
  },
  // Outbreak alerts
  alerts: {
    list: "/api/alerts",
    byId: (id: string) => `/api/alerts/${id}`,
    approve: (id: string) => `/api/alerts/${id}/approve`,
    requestData: (id: string) => `/api/alerts/${id}/request-data`,
    dismiss: (id: string) => `/api/alerts/${id}/dismiss`,
  },
  // Map data
  map: {
    markers: "/api/map/markers",
    clusters: "/api/map/clusters",
  },
  // Dashboard analytics
  dashboard: {
    summary: "/api/dashboard/summary",
    trends: "/api/dashboard/trends",
    weekly: "/api/dashboard/weekly",
    alertGrowth: "/api/dashboard/alert-growth",
  },
  // Health/status
  health: {
    status: "/api/health",
    db: "/api/health/db",
    uptime: "/api/health/uptime",
    lastSync: "/api/health/last-sync",
  },
  // Reference data
  reference: {
    diseases: "/api/reference/diseases",
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
};
