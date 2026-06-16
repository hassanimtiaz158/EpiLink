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
import { severityBadgeClass, severityLabel } from "@/lib/severity";
import { cn } from "@/lib/utils";
import { LoadingState, EmptyState, ErrorState } from "@/components/feedback";

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

function ReviewPage() {
  const { id } = Route.useSearch();
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: QUERY_KEYS.alerts,
    queryFn: () => alertsService.list({ status: "pending" }),
    enabled: !id,
  });
  const detailQ = useQuery({
    queryKey: id ? QUERY_KEYS.alert(id) : ["alert", "none"],
    queryFn: () => alertsService.get(id as string),
    enabled: !!id,
  });

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
      toast.success("Requested more data");
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
                  <CardTitle className="text-xl">{detailQ.data.disease}</CardTitle>
                  <Badge
                    className={cn(
                      "border",
                      severityBadgeClass[detailQ.data.severity],
                    )}
                  >
                    {severityLabel[detailQ.data.severity]}
                  </Badge>
                  {detailQ.data.icd10 && (
                    <Badge variant="outline">ICD-10 {detailQ.data.icd10}</Badge>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-4 w-4" /> {detailQ.data.location}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Stat label="Reports" value={String(detailQ.data.reports)} />
                  <Stat
                    label="Confidence"
                    value={`${Math.round(detailQ.data.confidence * 100)}%`}
                  />
                  <Stat label="Status" value={detailQ.data.status} />
                </div>

                {detailQ.data.cluster && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Layers className="h-4 w-4" /> Cluster details
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 text-sm">
                      <div>
                        <div className="text-xs text-slate-500">Radius</div>
                        <div className="font-medium">
                          {detailQ.data.cluster.radiusKm} km
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Growth rate</div>
                        <div className="font-medium">
                          {detailQ.data.cluster.growthRate}× / week
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {detailQ.data.summary && (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                    {detailQ.data.summary}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={() => approve.mutate(detailQ.data!.id)}
                    disabled={approve.isPending}
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
          {!listQ.isLoading && (listQ.data ?? []).length === 0 && (
            <EmptyState
              title="No pending alerts"
              description="When the AI flags a new outbreak signal, it will appear here for review."
              icon={<CheckCircle2 className="h-6 w-6" />}
            />
          )}
          <div className="grid gap-3">
            {(listQ.data ?? []).map((a) => (
              <Card key={a.id}>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-[180px] flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.disease}</span>
                      <Badge
                        className={cn(
                          "border text-[10px]",
                          severityBadgeClass[a.severity],
                        )}
                      >
                        {severityLabel[a.severity]}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500">{a.location}</div>
                  </div>
                  <Stat label="Reports" value={String(a.reports)} />
                  <Stat
                    label="Confidence"
                    value={`${Math.round(a.confidence * 100)}%`}
                  />
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
