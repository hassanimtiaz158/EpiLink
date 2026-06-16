import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckSquare,
  FileText,
  Globe2,
  HeartPulse,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useOnline } from "@/hooks/use-online";
import { offlineQueue } from "@/lib/offline-queue";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Globe2;
  exact?: boolean;
};
const NAV: NavItem[] = [
  { to: "/", label: "Global Map", icon: Globe2, exact: true },
  { to: "/submit", label: "Submit Report", icon: FileText },
  { to: "/analysis", label: "AI Analysis", icon: Sparkles },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/review", label: "Alert Review", icon: CheckSquare },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/health", label: "Health Status", icon: HeartPulse },
];

export function AppShell({
  children,
  fullBleed = false,
}: {
  children: ReactNode;
  fullBleed?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const online = useOnline();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const sync = () => setPending(offlineQueue.list().length);
    sync();
    window.addEventListener("epilink:queue-changed", sync);
    return () => window.removeEventListener("epilink:queue-changed", sync);
  }, []);

  useEffect(() => {
    if (online && pending > 0) {
      offlineQueue.flush();
    }
  }, [online, pending]);

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-900">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold tracking-tight">EpiLink</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              Outbreak Intelligence
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span>Status</span>
            {online ? (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                Online
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 gap-1">
                <WifiOff className="h-3 w-3" /> Offline
              </Badge>
            )}
          </div>
          {pending > 0 && (
            <div className="mt-2 text-[11px] text-amber-700">
              {pending} report{pending === 1 ? "" : "s"} pending sync
            </div>
          )}
        </div>
      </aside>
      <main className={cn("flex-1 min-w-0", fullBleed ? "" : "p-6 md:p-8")}>
        {children}
      </main>
    </div>
  );
}
