import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { alertsService } from "@/lib/api/services";
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
import { LoadingState, EmptyState, ErrorState } from "@/components/feedback";
import { cn } from "@/lib/utils";
import type { Alert as AlertItem } from "@/lib/api/types";

const LEVEL_BADGES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  NORMAL: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export const Route = createFileRoute("/alerts")({
  beforeLoad: () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("epilink_token") : null;
    if (!token) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Alerts - EpiLink" },
      { name: "description", content: "Browse and filter outbreak alerts." },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [level, setLevel] = useState("all");

  const alertsQ = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsService.list(),
  });

  const rawAlerts: AlertItem[] = alertsQ.data?.alerts ?? [];

  const filtered = useMemo(() => {
    return rawAlerts.filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (level !== "all" && a.alert_level !== level) return false;
      if (q && !`${a.icd10_code} ${a.governorate}`.toLowerCase().includes(q.toLowerCase()))
        return false;
      return true;
    });
  }, [rawAlerts, status, level, q]);

  return (
    <AppShell>
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Every signal surfaced from clinician reports.
          </p>
        </div>
      </header>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ICD-10 or governorate"
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
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="REVIEW">Review</SelectItem>
              <SelectItem value="NORMAL">Normal</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {alertsQ.isLoading && <LoadingState />}
      {alertsQ.isError && <ErrorState error={alertsQ.error} onRetry={() => alertsQ.refetch()} />}
      {!alertsQ.isLoading && filtered.length === 0 && (
        <EmptyState
          title="No alerts match your filters"
          icon={<AlertTriangle className="h-6 w-6" />}
        />
      )}

      <div className="grid gap-3">
        {filtered.map((a) => (
          <Card key={a.id} className="transition hover:shadow-md">
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-[180px] flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{a.icd10_code}</span>
                  <Badge className={cn("border text-[10px]", LEVEL_BADGES[a.alert_level] ?? "")}>
                    {a.alert_level}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {a.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">{a.governorate}</div>
              </div>
              {a.confidence != null && (
                <div className="min-w-[80px]">
                  <div className="text-[10px] uppercase text-muted-foreground">Confidence</div>
                  <div className="text-sm font-semibold">{Math.round(a.confidence * 100)}%</div>
                </div>
              )}
              {a.z_score != null && (
                <div className="min-w-[80px]">
                  <div className="text-[10px] uppercase text-muted-foreground">Z-Score</div>
                  <div className="text-sm font-semibold">{a.z_score.toFixed(2)}</div>
                </div>
              )}
              <div className="min-w-[80px]">
                <div className="text-[10px] uppercase text-muted-foreground">Created</div>
                <div className="text-sm font-semibold">
                  {new Date(a.created_at).toLocaleDateString()}
                </div>
              </div>
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
