import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, FileText, Layers } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { dashboardService } from "@/lib/api/services";
import { QUERY_KEYS } from "@/lib/api/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState, EmptyState } from "@/components/feedback";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — EpiLink" },
      {
        name: "description",
        content:
          "Surveillance dashboard: total reports, active alerts, clusters, and disease trends.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const summaryQ = useQuery({
    queryKey: QUERY_KEYS.dashboardSummary,
    queryFn: dashboardService.summary,
  });
  const trendsQ = useQuery({
    queryKey: QUERY_KEYS.dashboardTrends,
    queryFn: dashboardService.trends,
  });
  const weeklyQ = useQuery({
    queryKey: QUERY_KEYS.dashboardWeekly,
    queryFn: dashboardService.weekly,
  });
  const growthQ = useQuery({
    queryKey: QUERY_KEYS.dashboardAlertGrowth,
    queryFn: dashboardService.alertGrowth,
  });

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

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Total Reports"
          value={summaryQ.data?.totalReports}
          loading={summaryQ.isLoading}
          icon={<FileText className="h-4 w-4" />}
          accent="bg-sky-100 text-sky-700"
        />
        <Kpi
          label="Active Alerts"
          value={summaryQ.data?.activeAlerts}
          loading={summaryQ.isLoading}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent="bg-red-100 text-red-700"
        />
        <Kpi
          label="Pending Reviews"
          value={summaryQ.data?.pendingReviews}
          loading={summaryQ.isLoading}
          icon={<Layers className="h-4 w-4" />}
          accent="bg-amber-100 text-amber-700"
        />
        <Kpi
          label="Active Clusters"
          value={summaryQ.data?.activeClusters}
          loading={summaryQ.isLoading}
          icon={<BarChart3 className="h-4 w-4" />}
          accent="bg-indigo-100 text-indigo-700"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Disease Trends" query={trendsQ}>
          {(data) => (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {seriesKeys(data).map((k, i) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Weekly Reports" query={weeklyQ}>
          {(data) => (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="reports" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Alert Growth" query={growthQ} className="lg:col-span-2">
          {(data) => (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="alerts"
                  stroke="#ef4444"
                  fill="url(#alertGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </AppShell>
  );
}

const SERIES_COLORS = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#ef4444"];

function seriesKeys(data: Array<Record<string, unknown>>) {
  if (!data?.length) return [];
  return Object.keys(data[0]).filter((k) => k !== "date");
}

function Kpi({
  label,
  value,
  loading,
  icon,
  accent,
}: {
  label: string;
  value?: number;
  loading: boolean;
  icon: React.ReactNode;
  accent: string;
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
            {loading ? "—" : (value ?? 0).toLocaleString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard<T>({
  title,
  query,
  className,
  children,
}: {
  title: string;
  query: { data?: T[]; isLoading: boolean; isError: boolean; error: unknown; refetch: () => void };
  className?: string;
  children: (data: T[]) => React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading && <LoadingState />}
        {query.isError && (
          <ErrorState error={query.error} onRetry={query.refetch} />
        )}
        {!query.isLoading && !query.isError && (!query.data || query.data.length === 0) && (
          <EmptyState title="No data yet" />
        )}
        {query.data && query.data.length > 0 && children(query.data)}
      </CardContent>
    </Card>
  );
}
