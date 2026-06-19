import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  CheckCircle2,
  CircleSlash,
  HelpCircle,
  Layers,
  MapPin,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { alertsService } from "@/lib/api/services";
import { QUERY_KEYS } from "@/lib/api/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoadingState, EmptyState, ErrorState } from "@/components/feedback";
import type { Alert } from "@/lib/api/types";

const searchSchema = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Alert Review — EpiLink" },
      {
        name: "description",
        content:
          "Human-in-the-loop review for AI outbreak signals. AI suggests. Humans decide.",
      },
    ],
  }),
  validateSearch: searchSchema,
  component: ReviewPage,
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
    queryKey: QUERY_KEYS.alerts,
    queryFn: () => alertsService.list({ status: "pending" }),
    enabled: !id,
  });

  // Single alert detail (fetched by id via list-and-filter)
  const detailQ = useQuery({
    queryKey: id ? QUERY_KEYS.alert(id) : ["alert", "none"],
    queryFn: () => alertsService.get(id as string),
    enabled: !!id,
  });

  const alerts: Alert[] = listQ.data?.alerts ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.alerts });
    if (id) qc.invalidateQueries({ queryKey: QUERY_KEYS.alert(id) });
  };

  const approve = useMutation({
    mutationFn: (aid: string) => alertsService.approve(aid),
    onSuccess: () => {
      toast.success("Investigation approved");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const request = useMutation({
    mutationFn: (aid: string) => alertsService.requestData(aid),
    onSuccess: () => {
      toast.success("Marked for further review");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const dismiss = useMutation({
    mutationFn: (aid: string) => alertsService.dismiss(aid),
    onSuccess: () => {
      toast.success("Alert dismissed");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alert Review</h1>
          <p className="text-sm text-slate-500">
            Epidemiologist console for verifying outbreak signals.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-50 to-sky-50 px-4 py-1.5 ring-1 ring-indigo-100">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-900">
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
          {detailQ.data && (
            <Card className="max-w-3xl">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl">{detailQ.data.icd10_code}</CardTitle>
                  <Badge
                    className={cn(
                      "border",
                      alertLevelBadgeClass(detailQ.data.alert_level),
                    )}
                  >
                    {detailQ.data.alert_level ?? "standard"}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {detailQ.data.status}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-4 w-4" /> {detailQ.data.governorate}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Stat
                    label="Confidence"
                    value={`${Math.round((detailQ.data.confidence ?? 0) * 100)}%`}
                  />
                  <Stat
                    label="Z-Score"
                    value={(detailQ.data.z_score ?? 0).toFixed(2)}
                  />
                  <Stat label="Status" value={detailQ.data.status} />
                </div>

                {detailQ.data.review_notes && (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                    {detailQ.data.review_notes}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={() => approve.mutate(detailQ.data!.id)}
                    disabled={
                      approve.isPending ||
                      detailQ.data.review_decision !== null &&
                        detailQ.data.review_decision !== undefined
                    }
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Investigation
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => request.mutate(detailQ.data!.id)}
                    disabled={request.isPending}
                  >
                    <HelpCircle className="mr-2 h-4 w-4" /> Request More Data
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => dismiss.mutate(detailQ.data!.id)}
                    disabled={dismiss.isPending}
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
          {listQ.isError && (
            <ErrorState error={listQ.error} onRetry={() => listQ.refetch()} />
          )}
          {!listQ.isLoading && !listQ.isError && alerts.length === 0 && (
            <EmptyState
              title="No pending alerts"
              description="When the AI flags a new outbreak signal, it will appear here for review."
              icon={<CheckCircle2 className="h-6 w-6" />}
            />
          )}
          <div className="grid gap-3">
            {alerts.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-[180px] flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.icd10_code}</span>
                      <Badge
                        className={cn(
                          "border text-[10px]",
                          alertLevelBadgeClass(a.alert_level),
                        )}
                      >
                        {a.alert_level ?? "standard"}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500">
                      {a.governorate}
                    </div>
                  </div>
                  <Stat label="ICD-10" value={a.icd10_code} />
                  <Stat label="Level" value={a.alert_level ?? "—"} />
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
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-sm font-semibold capitalize tabular-nums">{value}</div>
    </div>
  );
}
