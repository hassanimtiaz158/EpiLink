import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { alertsService } from "@/lib/api/services";
import { QUERY_KEYS } from "@/lib/api/config";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { severityBadgeClass, severityLabel } from "@/lib/severity";
import { LoadingState, EmptyState, ErrorState } from "@/components/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — EpiLink" },
      {
        name: "description",
        content:
          "Browse, search, and filter outbreak alerts by status, disease, and AI confidence.",
      },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [disease, setDisease] = useState<string>("all");
  const [minConf, setMinConf] = useState<number>(0);

  const alertsQ = useQuery({
    queryKey: QUERY_KEYS.alerts,
    queryFn: () => alertsService.list(),
  });

  const alerts = alertsQ.data ?? [];
  const diseases = useMemo(
    () => Array.from(new Set(alerts.map((a) => a.disease))).sort(),
    [alerts],
  );

  const filtered = alerts.filter((a) => {
    if (status !== "all" && a.status !== status) return false;
    if (disease !== "all" && a.disease !== disease) return false;
    if (a.confidence * 100 < minConf) return false;
    if (q && !`${a.disease} ${a.location}`.toLowerCase().includes(q.toLowerCase()))
      return false;
    return true;
  });

  return (
    <AppShell>
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-red-100 text-red-700">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
          <p className="text-sm text-slate-500">
            Every signal the system has surfaced from clinician reports.
          </p>
        </div>
      </header>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search disease or location"
              className="pl-8"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={disease} onValueChange={setDisease}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Disease" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All diseases</SelectItem>
              {diseases.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <label>Min confidence</label>
            <input
              type="range"
              min={0}
              max={100}
              value={minConf}
              onChange={(e) => setMinConf(Number(e.target.value))}
              className="w-28"
            />
            <span className="tabular-nums w-8">{minConf}%</span>
          </div>
        </CardContent>
      </Card>

      {alertsQ.isLoading && <LoadingState />}
      {alertsQ.isError && (
        <ErrorState error={alertsQ.error} onRetry={() => alertsQ.refetch()} />
      )}
      {!alertsQ.isLoading && filtered.length === 0 && (
        <EmptyState
          title="No alerts match your filters"
          description="Try widening your search or lowering the confidence threshold."
          icon={<AlertTriangle className="h-6 w-6" />}
        />
      )}

      <div className="grid gap-3">
        {filtered.map((a) => (
          <Card key={a.id} className="transition hover:shadow-md">
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-[180px] flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{a.disease}</span>
                  <Badge
                    className={cn("border text-[10px]", severityBadgeClass[a.severity])}
                  >
                    {severityLabel[a.severity]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {a.status}
                  </Badge>
                </div>
                <div className="text-xs text-slate-500">{a.location}</div>
              </div>
              <Stat label="Reports" value={String(a.reports)} />
              <Stat label="Confidence" value={`${Math.round(a.confidence * 100)}%`} />
              <Stat
                label="Created"
                value={new Date(a.createdAt).toLocaleDateString()}
              />
              <Button asChild size="sm" variant="outline">
                <Link to="/review" search={{ id: a.id } as never}>
                  Review <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[80px]">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
