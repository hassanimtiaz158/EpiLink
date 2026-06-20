import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Database, Server } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { healthService } from "@/lib/api/services";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/feedback";
import type { HealthStatus } from "@/lib/api/types";
import { AuthGate } from "@/components/auth-gate";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Health Status - EpiLink" },
      { name: "description", content: "System health status for EpiLink backend." },
    ],
  }),
  component: () => (
    <AuthGate minRole="admin">
      <HealthPage />
    </AuthGate>
  ),
});

function HealthPage() {
  const q = useQuery({
    queryKey: ["health"],
    queryFn: () => healthService.status(),
    refetchInterval: 15_000,
  });

  return (
    <AppShell>
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Health Status</h1>
          <p className="text-sm text-muted-foreground">System health for the EpiLink backend.</p>
        </div>
      </header>

      {q.isLoading && <LoadingState label="Checking systems" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}

      {q.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard
            label="API"
            status={q.data.status === "ok" ? "ok" : "down"}
            icon={<Server className="h-4 w-4" />}
          />
          <StatusCard
            label="Database"
            status={q.data.database === "connected" ? "ok" : "down"}
            icon={<Database className="h-4 w-4" />}
          />
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" /> Version
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{q.data.version}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Activity className="h-4 w-4" /> Last Check
              </div>
              <div className="mt-1 text-lg font-semibold">
                {new Date(q.data.timestamp).toLocaleString()}
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
  status: "ok" | "down";
  icon: React.ReactNode;
}) {
  const tone =
    status === "ok"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {icon} {label}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Badge className={`${tone} border-0 capitalize`}>
            {status === "ok" ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
