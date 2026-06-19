import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
<<<<<<< HEAD
import { AlertTriangle, Globe2, Radio, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
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
=======
import { AlertTriangle, BarChart3, FileText, Layers } from "lucide-react";
import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { dashboardService } from "@/lib/api/services";
import { QUERY_KEYS } from "@/lib/api/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/feedback";
>>>>>>> 67e0f965c0d324d8b9d3c8e6af0746f272eb1adc

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("epilink_token") : null;
    if (!token) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Dashboard - EpiLink" },
      {
        name: "description",
<<<<<<< HEAD
        content: "Live map of disease outbreak signals from clinician reports.",
=======
        content:
          "Surveillance dashboard: total reports, active alerts, and disease trends.",
>>>>>>> 67e0f965c0d324d8b9d3c8e6af0746f272eb1adc
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
<<<<<<< HEAD
  const [q, setQ] = useState("");

  const alertsQ = useQuery({
    queryKey: ["alerts"],
    queryFn: () => apiFetch<AlertListResponse>(ENDPOINTS.alerts.list),
  });
=======
  const dashboardQ = useQuery({
    queryKey: QUERY_KEYS.dashboardSummary,
    queryFn: dashboardService.summary,
  });

  const data = dashboardQ.data;
>>>>>>> 67e0f965c0d324d8b9d3c8e6af0746f272eb1adc

  const rawAlerts: Alert[] = alertsQ.data?.alerts ?? [];

  const filtered = useMemo(() => {
    if (!q) return rawAlerts;
    const lower = q.toLowerCase();
    return rawAlerts.filter(
      (a) =>
        a.icd10_code.toLowerCase().includes(lower) || a.governorate.toLowerCase().includes(lower),
    );
  }, [rawAlerts, q]);

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
          <div className="flex-1 overflow-hidden rounded-xl border">
            <GlobalMap markers={[]} />
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
<<<<<<< HEAD
      </div>
    </AppShell>
  );
}
=======
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Global surveillance at a glance.
          </p>
        </div>
      </header>

      {dashboardQ.isLoading && <LoadingState />}
      {dashboardQ.isError && <ErrorState error={dashboardQ.error} onRetry={dashboardQ.refetch} />}

      {data && (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Total Reports"
              value={data.summary?.total_reports_this_week}
              icon={<FileText className="h-4 w-4" />}
              accent="bg-sky-100 text-sky-700"
            />
            <Kpi
              label="Active Alerts"
              value={data.summary?.total_alerts_this_week}
              icon={<AlertTriangle className="h-4 w-4" />}
              accent="bg-red-100 text-red-700"
            />
            <Kpi
              label="Pending Reviews"
              value={data.summary?.pending_reviews}
              icon={<Layers className="h-4 w-4" />}
              accent="bg-amber-100 text-amber-700"
            />
            <Kpi
              label="Alert Rate"
              value={(data.summary?.alert_rate ?? 0) * 100}
              suffix="%"
              icon={<BarChart3 className="h-4 w-4" />}
              accent="bg-indigo-100 text-indigo-700"
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {data.weekly_trend && data.weekly_trend.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Weekly Reports Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data.weekly_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                      <XAxis dataKey="epi_week" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="total_reports"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        name="Total Reports"
                      />
                      <Line
                        type="monotone"
                        dataKey="alerts_dispatched"
                        stroke="#ef4444"
                        strokeWidth={2}
                        name="Alerts"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {data.top_diseases && data.top_diseases.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Diseases This Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.top_diseases.map((d) => (
                      <div key={d.icd10} className="flex items-center justify-between rounded bg-slate-50 p-3">
                        <span className="text-sm font-medium">{d.disease}</span>
                        <span className="text-sm font-semibold text-slate-700">{d.count} reports</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {data.recent_alerts && data.recent_alerts.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Recent Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.recent_alerts.slice(0, 5).map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded border-l-4 border-red-500 bg-red-50 p-3">
                        <div>
                          <span className="text-sm font-medium">{a.icd10_code}</span>
                          <span className="ml-2 text-xs text-slate-600">{a.governorate}</span>
                        </div>
                        <span className="text-xs font-semibold text-red-700">{a.status}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  icon,
  accent,
  suffix = "",
}: {
  label: string;
  value?: number;
  icon: React.ReactNode;
  accent: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${accent}`}>
          {icon}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            {label}
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {(value ?? 0).toLocaleString()}{suffix}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
>>>>>>> 67e0f965c0d324d8b9d3c8e6af0746f272eb1adc
