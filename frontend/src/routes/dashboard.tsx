import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Globe2, Radio, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AuthGate } from "@/components/auth-gate";
import GlobalMap from "@/components/map/GlobalMap";
import { ENDPOINTS } from "@/lib/api/config";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingState, EmptyState, ErrorState } from "@/components/feedback";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api/client";
import type { Alert, AlertListResponse } from "@/lib/api/types";

const LEVEL_COLORS: Record<string, string> = {
  HIGH: "bg-red-500",
  REVIEW: "bg-amber-400",
  NORMAL: "bg-emerald-500",
};

const LEVEL_BADGES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  NORMAL: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const GOVERNORATE_COORDS: Record<string, [number, number]> = {
  "Cairo": [30.0444, 31.2357],
  "Alexandria": [31.2001, 29.9187],
  "Giza": [30.0131, 31.2089],
  "Qalyubia": [30.4069, 31.1846],
  "Port Said": [31.2565, 32.2841],
  "Suez": [29.9668, 32.5498],
  "Luxor": [25.6872, 32.6396],
  "Aswan": [24.0889, 32.8998],
  "Asyut": [27.1810, 31.1837],
  "Beheira": [31.0371, 30.4398],
  "Beni Suef": [29.0661, 31.0994],
  "Dakahlia": [31.0364, 31.3807],
  "Damietta": [31.4165, 31.8133],
  "Faiyum": [29.3084, 30.8428],
  "Gharbia": [30.8754, 31.0113],
  "Ismailia": [30.6043, 32.2723],
  "Kafr El Sheikh": [31.1107, 30.9388],
  "Matrouh": [31.3543, 27.2373],
  "Minya": [28.0871, 30.7342],
  "Monufia": [30.5972, 30.9876],
  "New Valley": [25.4390, 30.5586],
  "North Sinai": [30.2824, 33.6823],
  "Qena": [26.1551, 32.7160],
  "Red Sea": [26.7500, 33.9360],
  "Sharqia": [30.7327, 31.7195],
  "Sohag": [26.5570, 31.6948],
  "South Sinai": [28.2364, 33.6254],
};

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard - EpiLink" },
      {
        name: "description",
        content: "Live map of disease outbreak signals from clinician reports.",
      },
    ],
  }),
  component: () => (
    <AuthGate>
      <DashboardPage />
    </AuthGate>
  ),
});

function DashboardPage() {
  const [q, setQ] = useState("");

  const alertsQ = useQuery({
    queryKey: ["alerts"],
    queryFn: () => apiFetch<AlertListResponse>(ENDPOINTS.alerts.list),
  });

  const rawAlerts: Alert[] = alertsQ.data?.alerts ?? [];

  const filtered = useMemo(() => {
    if (!q) return rawAlerts;
    const lower = q.toLowerCase();
    return rawAlerts.filter(
      (a) =>
        a.icd10_code.toLowerCase().includes(lower) || a.governorate.toLowerCase().includes(lower),
    );
  }, [rawAlerts, q]);

  const markers = useMemo(() => {
    return filtered.map((a, index) => {
      const coords = GOVERNORATE_COORDS[a.governorate] || GOVERNORATE_COORDS["Cairo"];

      const offset = (index % 10) * 0.01;

      const lat = coords[0] + offset;
      const lng = coords[1] - offset;

      let severity: "low" | "moderate" | "high" | "critical" = "moderate";
      if (a.alert_level === "HIGH") severity = "critical";
      if (a.alert_level === "NORMAL") severity = "low";

      return {
        id: a.id,
        disease: a.icd10_code,
        severity,
        lat,
        lng,
        reports: 1,
        location: a.governorate,
      };
    });
  }, [filtered]);

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <header className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Global Outbreak Map</h1>
            <p className="text-sm text-muted-foreground">
              Live signals from clinician reports across Egypt.
            </p>
          </div>
        </header>

        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Map */}
          <div className="flex-1 overflow-hidden rounded-xl border relative z-0">
            <GlobalMap markers={markers} />
          </div>

          {/* Sidebar alerts */}
          <div className="hidden w-80 flex-col overflow-hidden xl:flex">
            <div className="mb-3 flex items-center gap-2">
              <Radio className="h-4 w-4 text-red-500 animate-pulse" />
              <span className="text-sm font-medium">Live Alerts</span>
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {rawAlerts.length}
              </Badge>
            </div>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search..."
                className="h-8 pl-7 text-xs"
              />
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {alertsQ.isLoading && <LoadingState />}
              {alertsQ.isError && <ErrorState error={alertsQ.error} />}
              {!alertsQ.isLoading && filtered.length === 0 && (
                <EmptyState title="No alerts" icon={<AlertTriangle className="h-5 w-5" />} />
              )}
              {filtered.map((a) => (
                <div key={a.id} className="rounded-lg border p-3 transition hover:shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{a.icd10_code}</span>
                    <Badge
                      className={cn(
                        "border px-1.5 py-0 text-[9px]",
                        LEVEL_BADGES[a.alert_level] ?? "",
                      )}
                    >
                      {a.alert_level}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{a.governorate}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{new Date(a.created_at).toLocaleDateString()}</span>
                    {a.confidence != null && <span>{Math.round(a.confidence * 100)}%</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
