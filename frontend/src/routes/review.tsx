import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, CircleSlash, MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { alertsService } from "@/lib/api/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoadingState, EmptyState, ErrorState } from "@/components/feedback";
import type { Alert as AlertDetail } from "@/lib/api/types";
import { AuthGate } from "@/components/auth-gate";

const searchSchema = z.object({ id: z.string().optional() });

const LEVEL_BADGES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  NORMAL: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Alert Review - EpiLink" },
      { name: "description", content: "Human-in-the-loop review for AI outbreak signals." },
    ],
  }),
  validateSearch: searchSchema,
  component: () => (
    <AuthGate minRole="epi_officer">
      <ReviewPage />
    </AuthGate>
  ),
});

/**
 * Maps backend alert_level values to a human-readable label and badge colour.
 * Backend values observed: "LOW", "MODERATE", "HIGH", "CRITICAL" (uppercase).
 * Falls back gracefully for unknown values.
 */
function alertLevelBadgeClass(level?: string): string {
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

function ReviewPage() {
  const { id } = Route.useSearch();
  const qc = useQueryClient();

  // List of pending alerts (shown when no specific id is in the URL)
  const listQ = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsService.list({ status: "pending" }),
    enabled: !id,
  });

  const rawAlerts: AlertDetail[] = listQ.data?.alerts ?? [];

  const detailQ = useQuery({
    queryKey: id ? ["alerts", id] : ["alerts", "none"],
    queryFn: () => alertsService.get(id as string),
    enabled: !!id,
  });

  const alertDetail: AlertDetail | null = detailQ.data
    ? (detailQ.data as unknown as AlertDetail)
    : null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  const reviewMutation = useMutation({
    mutationFn: ({ aid, decision }: { aid: string; decision: "confirmed" | "dismissed" }) =>
      alertsService.review(aid, decision, "epi-officer-001", `Reviewed via dashboard`),
    onSuccess: () => {
      toast.success("Review submitted");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alert Review</h1>
          <p className="text-sm text-muted-foreground">
            Epidemiologist console for verifying outbreak signals.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-50 to-sky-50 px-4 py-1.5 ring-1 ring-indigo-100 dark:from-indigo-900/20 dark:to-sky-900/20 dark:ring-indigo-800">
          <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-medium text-indigo-900 dark:text-indigo-300">
            AI suggests. Humans decide.
          </span>
        </div>
      </header>

      {id ? (
        <>
          {detailQ.isLoading && <LoadingState />}
          {detailQ.isError && (
            <ErrorState error={detailQ.error} onRetry={() => detailQ.refetch()} />
          )}
          {alertDetail && (
            <Card className="max-w-3xl">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl">{alertDetail.icd10_code}</CardTitle>
                  <Badge className={cn("border", LEVEL_BADGES[alertDetail.alert_level] ?? "")}>
                    {alertDetail.alert_level}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {alertDetail.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {alertDetail.governorate}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  {alertDetail.confidence != null && (
                    <Stat
                      label="Confidence"
                      value={`${Math.round(alertDetail.confidence * 100)}%`}
                    />
                  )}
                  {alertDetail.z_score != null && (
                    <Stat label="Z-Score" value={alertDetail.z_score.toFixed(2)} />
                  )}
                  <Stat label="Status" value={alertDetail.status.replace("_", " ")} />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={() =>
                      reviewMutation.mutate({ aid: alertDetail.id, decision: "confirmed" })
                    }
                    disabled={reviewMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Alert
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      reviewMutation.mutate({ aid: alertDetail.id, decision: "dismissed" })
                    }
                    disabled={reviewMutation.isPending}
                    className="text-red-600 hover:text-red-700"
                  >
                    <CircleSlash className="mr-2 h-4 w-4" /> Dismiss Alert
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          {listQ.isLoading && <LoadingState />}
          {listQ.isError && <ErrorState error={listQ.error} onRetry={() => listQ.refetch()} />}
          {!listQ.isLoading && rawAlerts.length === 0 && (
            <EmptyState
              title="No pending alerts"
              description="When the AI flags a new outbreak signal, it will appear here for review."
              icon={<CheckCircle2 className="h-6 w-6" />}
            />
          )}
          <div className="grid gap-3">
            {rawAlerts.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-[180px] flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.icd10_code}</span>
                      <Badge
                        className={cn("border text-[10px]", LEVEL_BADGES[a.alert_level] ?? "")}
                      >
                        {a.alert_level}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{a.governorate}</div>
                  </div>
                  {a.confidence != null && (
                    <Stat label="Confidence" value={`${Math.round(a.confidence * 100)}%`} />
                  )}
                  <Button asChild size="sm">
                    <a href={`/review?id=${a.id}`}>Open</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[80px]">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold capitalize tabular-nums">{value}</div>
    </div>
  );
}
