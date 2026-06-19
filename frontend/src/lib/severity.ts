import type { Severity } from "./api/types";

export const severityColor: Record<Severity, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

export const severityLabel: Record<Severity, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
};

export const severityBadgeClass: Record<Severity, string> = {
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
  moderate: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

/**
 * Maps backend alert_level values to a human-readable label and badge colour.
 * Backend values observed: "LOW", "MODERATE", "HIGH", "CRITICAL" (uppercase).
 * Falls back gracefully for unknown values.
 */
export function alertLevelBadgeClass(level?: string): string {
  switch (level?.toLowerCase()) {
    case "low":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "moderate":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "critical":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

