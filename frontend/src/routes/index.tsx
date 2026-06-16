import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Globe2, Layers, Radio, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import GlobalMap from "@/components/map/GlobalMap";
import { mapService, alertsService, referenceService } from "@/lib/api/services";
import { QUERY_KEYS } from "@/lib/api/config";
import { severityBadgeClass, severityLabel } from "@/lib/severity";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingState, EmptyState, ErrorState } from "@/components/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EpiLink — Global Outbreak Map" },
      {
        name: "description",
        content:
          "Live world map of disease outbreak signals, clusters, and alerts powered by clinician reports.",
      },
    ],
  }),
  component: GlobalMapPage,
});

function GlobalMapPage() {
  const [disease, setDisease] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const markersQ = useQuery({
    queryKey: [...QUERY_KEYS.mapMarkers, disease],
    queryFn: () => mapService.markers(disease ? { disease } : undefined),
    refetchInterval: 60_000,
  });
  const alertsQ = useQuery({
    queryKey: [...QUERY_KEYS.alerts, "recent"],
    queryFn: () => alertsService.list(),
    refetchInterval: 30_000,
  });
  const diseasesQ = useQuery({
    queryKey: QUERY_KEYS.diseases,
    queryFn: () => referenceService.diseases(),
  });

  const markers = markersQ.data ?? [];
  const alerts = alertsQ.data ?? [];

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, moderate: 0, low: 0 };
    for (const m of markers) c[m.severity]++;
    return c;
  }, [markers]);

  const filteredAlerts = alerts.filter((a) =>
    q ? `${a.disease} ${a.location}`.toLowerCase().includes(q.toLowerCase()) : true,
  );

  const chips = (diseasesQ.data ?? []).slice(0, 8);

  return (
    <AppShell fullBleed>
      <div className="relative h-screen w-full">
        <div className="absolute inset-0">
          {markersQ.isLoading ? (
            <div className="h-full w-full animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />
          ) : (
            <GlobalMap markers={markers} />
          )}
        </div>

        {/* Top overlay */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[400] p-4 md:p-6">
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 rounded-xl bg-white/95 px-4 py-2.5 shadow-md backdrop-blur">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-sky-500 to-indigo-600 text-white">
                <Globe2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight">
                  EpiLink Global Signal
                </div>
                <div className="text-[11px] text-slate-500">
                  End the silence between the clinician and the dashboard.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CounterChip color="bg-red-500" label="Critical" value={counts.critical} />
              <CounterChip color="bg-orange-500" label="High" value={counts.high} />
              <CounterChip color="bg-amber-400" label="Moderate" value={counts.moderate} />
              <CounterChip color="bg-emerald-500" label="Low" value={counts.low} />
            </div>
          </div>

          {/* Filter chips */}
          <div className="pointer-events-auto mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setDisease(null)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                !disease
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white/90 text-slate-700 hover:bg-white",
              )}
            >
              All diseases
            </button>
            {chips.map((d) => (
              <button
                key={d.id}
                onClick={() => setDisease(d.name)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  disease === d.name
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white/90 text-slate-700 hover:bg-white",
                )}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>

        {/* Recent alerts sidebar */}
        <aside className="absolute right-4 top-32 z-[400] hidden w-[340px] max-h-[70vh] flex-col rounded-xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur md:flex">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Radio className="h-4 w-4 text-red-500" /> Recent Alerts
            </div>
            <Badge variant="secondary" className="bg-slate-100">
              {alerts.length}
            </Badge>
          </div>
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search alerts"
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {alertsQ.isLoading && <LoadingState />}
            {alertsQ.isError && (
              <div className="p-2">
                <ErrorState error={alertsQ.error} onRetry={() => alertsQ.refetch()} />
              </div>
            )}
            {!alertsQ.isLoading && filteredAlerts.length === 0 && (
              <div className="p-2">
                <EmptyState
                  title="No active alerts"
                  description="Outbreak signals will appear here as reports stream in."
                  icon={<AlertTriangle className="h-6 w-6" />}
                />
              </div>
            )}
            <ul className="space-y-1.5">
              {filteredAlerts.map((a) => (
                <li
                  key={a.id}
                  className="group rounded-lg border border-slate-100 p-2.5 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.disease}</div>
                      <div className="truncate text-xs text-slate-500">
                        {a.location}
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        "shrink-0 border text-[10px]",
                        severityBadgeClass[a.severity],
                      )}
                    >
                      {severityLabel[a.severity]}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" /> {a.reports} reports
                    </span>
                    <span>{Math.round(a.confidence * 100)}% conf.</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Legend */}
        <div className="pointer-events-auto absolute bottom-4 left-4 z-[400] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] shadow-md backdrop-blur">
          <div className="mb-1 font-semibold uppercase tracking-wider text-slate-500">
            Severity
          </div>
          <div className="flex items-center gap-3">
            <LegendDot color="#22c55e" label="Low" />
            <LegendDot color="#eab308" label="Moderate" />
            <LegendDot color="#f97316" label="High" />
            <LegendDot color="#ef4444" label="Critical" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function CounterChip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 shadow-md backdrop-blur">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      <span className="text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
