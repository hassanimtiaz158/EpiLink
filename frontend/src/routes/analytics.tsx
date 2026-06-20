import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, FileText, Layers } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { ENDPOINTS } from "@/lib/api/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState, EmptyState } from "@/components/feedback";
import { apiFetch } from "@/lib/api/client";
import type { DashboardData } from "@/lib/api/types";
import { AuthGate } from "@/components/auth-gate";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Dashboard - EpiLink" },
      { name: "description", content: "Surveillance dashboard: reports, alerts, and trends." },
    ],
  }),
  component: () => (
    <AuthGate>
      <DashboardPage />
    </AuthGate>
  ),
});

function DashboardPage() {
  const dashboardQ = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardData>(ENDPOINTS.dashboard.summary),
  });

  const data = dashboardQ.data;

  return (
    <AppShell>
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Surveillance at a glance.</p>
        </div>
      </header>

      {dashboardQ.isLoading && <LoadingState />}
      {dashboardQ.isError && (
        <ErrorState error={dashboardQ.error} onRetry={() => dashboardQ.refetch()} />
      )}

      {data && (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Reports This Week"
              value={data.summary.total_reports_this_week}
              icon={<FileText className="h-4 w-4" />}
              accent="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
            />
            <Kpi
              label="Alerts This Week"
              value={data.summary.total_alerts_this_week}
              icon={<AlertTriangle className="h-4 w-4" />}
              accent="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            />
            <Kpi
              label="Pending Reviews"
              value={data.summary.pending_reviews}
              icon={<Layers className="h-4 w-4" />}
              accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            />
            <Kpi
              label="Alert Rate"
              value={`${(data.summary.alert_rate * 100).toFixed(1)}%`}
              icon={<BarChart3 className="h-4 w-4" />}
              accent="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
              isText
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {data.weekly_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={data.weekly_trend.map((w) => ({
                        name: `W${w.epi_week}`,
                        reports: w.total_reports,
                        alerts: w.alerts_dispatched,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="reports" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="alerts" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No trend data yet" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Diseases</CardTitle>
              </CardHeader>
              <CardContent>
                {data.top_diseases.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.top_diseases} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        dataKey="disease"
                        type="category"
                        width={150}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No disease data yet" />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Drift Monitor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Mean Confidence</div>
                    <div className="text-2xl font-semibold">
                      {(data.drift.mean_confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Human Confirmation Rate</div>
                    <div className="text-2xl font-semibold">
                      {(data.drift.human_confirmation_rate * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div
                      className={`text-2xl font-semibold ${data.drift.status === "NORMAL" ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {data.drift.status}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
  isText = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: string;
  isText?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${accent}`}>{icon}</div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums">
            {isText ? value : (value as number).toLocaleString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
