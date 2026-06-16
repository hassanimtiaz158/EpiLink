import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Database, RefreshCw, Server } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { healthService } from "@/lib/api/services";
import { QUERY_KEYS } from "@/lib/api/config";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/feedback";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Health Status — EpiLink" },
      {
        name: "description",
        content: "Live API and database health, uptime, and last sync time.",
      },
    ],
  }),
  component: HealthPage,
});

function HealthPage() {
  const q = useQuery({
    queryKey: QUERY_KEYS.health,
    queryFn: healthService.status,
    refetchInterval: 15_000,
  });

  return (
    <AppShell>
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Health Status</h1>
          <p className="text-sm text-slate-500">
            System health for the EpiLink backend.
          </p>
        </div>
      </header>

      {q.isLoading && <LoadingState label="Checking systems" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}

      {q.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard
            label="API"
            status={q.data.api}
            icon={<Server className="h-4 w-4" />}
          />
          <StatusCard
            label="Database"
            status={q.data.database}
            icon={<Database className="h-4 w-4" />}
          />
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
                <CheckCircle2 className="h-4 w-4" /> Uptime
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {formatUptime(q.data.uptimeSeconds)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
                <RefreshCw className="h-4 w-4" /> Last Sync
              </div>
              <div className="mt-1 text-lg font-semibold">
                {new Date(q.data.lastSync).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function StatusCard({
  label,
  status,
  icon,
}: {
  label: string;
  status: "ok" | "degraded" | "down";
  icon: React.ReactNode;
}) {
  const tone =
    status === "ok"
      ? "bg-emerald-100 text-emerald-700"
      : status === "degraded"
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-700";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
          {icon} {label}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Badge className={`${tone} border-0 capitalize`}>{status}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function formatUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}
