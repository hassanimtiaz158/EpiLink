import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — EpiLink" },
      {
        name: "description",
        content:
          "Surveillance dashboard: total reports, active alerts, and disease trends.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const dashboardQ = useQuery({
    queryKey: QUERY_KEYS.dashboardSummary,
    queryFn: dashboardService.summary,
  });

  const data = dashboardQ.data;

  return (
    <AppShell>
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-900 text-white">
          <BarChart3 className="h-5 w-5" />
        </div>
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
