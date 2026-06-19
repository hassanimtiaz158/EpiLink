import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckSquare,
  FileText,
  Globe2,
  HeartPulse,
  LogOut,
  Menu,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useOnline } from "@/hooks/use-online";
import { offlineQueue } from "@/lib/offline-queue";
import { useAuthContext } from "@/routes/__root";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Globe2;
  exact?: boolean;
};
const NAV: NavItem[] = [
  { to: "/dashboard", label: "Global Map", icon: Globe2 },
  { to: "/submit", label: "Submit Report", icon: FileText },
  { to: "/analysis", label: "AI Analysis", icon: Sparkles },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/review", label: "Alert Review", icon: CheckSquare },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuthContext() ?? { user: null, logout: () => {} };

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
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-border bg-card transition-transform duration-300 md:static md:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight text-foreground">EpiLink</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Outbreak Intelligence
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">Appearance</span>
            <ThemeToggle />
          </div>
        </div>
        {user && (
          <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">{user.full_name}</div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500">{user.role}</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 w-full justify-start gap-2 text-xs text-slate-500 hover:text-red-600"
              onClick={logout}
            >
              <LogOut className="h-3 w-3" /> Sign out
            </Button>
          </div>
        )}
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex items-center justify-between">
            <span>Status</span>
            {online ? (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                Online
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-800 gap-1 dark:bg-amber-900/30 dark:text-amber-400"
              >
                <WifiOff className="h-3 w-3" /> Offline
              </Badge>
            )}
          </div>
          {pending > 0 && (
            <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              {pending} report{pending === 1 ? "" : "s"} pending sync
            </div>
          )}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Header */}
        <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
              <Activity className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight text-foreground">EpiLink</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <div className={cn("flex-1", fullBleed ? "" : "p-6 md:p-8")}>{children}</div>
      </main>
    </div>
  );
}
