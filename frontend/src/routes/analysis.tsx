import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { analysisService } from "@/lib/api/services";
import { QUERY_KEYS } from "@/lib/api/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { severityBadgeClass, severityLabel } from "@/lib/severity";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/feedback";

const searchSchema = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/analysis")({
  head: () => ({
    meta: [
      { title: "AI Analysis — EpiLink" },
      {
        name: "description",
        content:
          "Watch the AI pipeline classify, geomap, and assess each report in real time.",
      },
    ],
  }),
  validateSearch: searchSchema,
  component: AnalysisPage,
});

const STAGES = [
  { key: "validated", label: "Data Validated" },
  { key: "classified", label: "ICD-10 Classification" },
  { key: "geomapped", label: "Geographic Mapping" },
  { key: "clustered", label: "Cluster Analysis" },
  { key: "assessed", label: "Alert Assessment" },
] as const;

function AnalysisPage() {
  const { id } = Route.useSearch();
  const [playStage, setPlayStage] = useState(0);

  const q = useQuery({
    queryKey: id ? QUERY_KEYS.analysis(id) : ["analysis", "none"],
    queryFn: () => analysisService.status(id as string),
    enabled: !!id,
    refetchInterval: (qr) => {
      const data = qr.state.data;
      if (data?.stages?.assessed) return false;
      return 1500;
    },
  });

  // Cosmetic stage reveal for the demo when no id provided
  useEffect(() => {
    if (id) return;
    const t = setInterval(() => {
      setPlayStage((s) => (s + 1) % (STAGES.length + 2));
    }, 900);
    return () => clearInterval(t);
  }, [id]);

  const result = q.data;
  const stages = result?.stages;

  const stageDone = (key: (typeof STAGES)[number]["key"], idx: number) => {
    if (stages) return Boolean(stages[key]);
    return idx < playStage;
  };

  const completed = STAGES.filter((s, i) => stageDone(s.key, i)).length;
  const progress = (completed / STAGES.length) * 100;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-100 text-indigo-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Analysis</h1>
            <p className="text-sm text-slate-500">
              {id ? `Processing report ${id}` : "Live pipeline demo"}
            </p>
          </div>
        </header>

        {q.isError && (
          <div className="mb-4">
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          </div>
        )}

        <Card className="mb-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pipeline progress</CardTitle>
              <span className="text-xs text-slate-500">
                {completed}/{STAGES.length} stages
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="mb-5 h-2" />
            <ol className="grid gap-3">
              {STAGES.map((s, i) => {
                const done = stageDone(s.key, i);
                const active = !done && i === completed;
                return (
                  <li
                    key={s.key}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-4 py-3 transition",
                      done
                        ? "border-emerald-200 bg-emerald-50"
                        : active
                        ? "border-sky-200 bg-sky-50"
                        : "border-slate-200 bg-white",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-full text-white",
                        done ? "bg-emerald-500" : active ? "bg-sky-500" : "bg-slate-300",
                      )}
                    >
                      {done ? (
                        <Check className="h-4 w-4" />
                      ) : active ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="text-xs">{i + 1}</span>
                      )}
                    </span>
                    <span className="text-sm font-medium text-slate-800">
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Result</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-4">
                <Stat label="Disease" value={result.disease} />
                <Stat label="ICD-10" value={result.icd10} />
                <Stat
                  label="Confidence"
                  value={`${Math.round(result.confidence * 100)}%`}
                />
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">
                    Alert Level
                  </div>
                  <Badge
                    className={cn(
                      "mt-1 border",
                      severityBadgeClass[result.alertLevel],
                    )}
                  >
                    {severityLabel[result.alertLevel]}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!id && !result && (
          <p className="mt-4 text-center text-xs text-slate-500">
            Submit a report to see live analysis on a real submission.
          </p>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}
