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

const ROLE_RANK: Record<string, number> = { viewer: 0, epi_officer: 1, admin: 2 };

type NavItem = {
  to: string;
  label: string;
  icon: typeof Globe2;
  exact?: boolean;
  minRole: keyof typeof ROLE_RANK;
};
const NAV: NavItem[] = [
  { to: "/dashboard", label: "Global Map", icon: Globe2, minRole: "viewer" },
  { to: "/submit", label: "Submit Report", icon: FileText, minRole: "epi_officer" },
  { to: "/analysis", label: "AI Analysis", icon: Sparkles, minRole: "epi_officer" },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle, minRole: "viewer" },
  { to: "/review", label: "Alert Review", icon: CheckSquare, minRole: "epi_officer" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, minRole: "viewer" },
  { to: "/health", label: "Health Status", icon: HeartPulse, minRole: "admin" },
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);
  const { user, logout } = useAuthContext() ?? { user: null, logout: () => {} };

  useEffect(() => {
    const sync = () => setPending(offlineQueue.list().length);
    sync();
    window.addEventListener("epilink:queue-changed", sync);
    return () => window.removeEventListener("epilink:queue-changed", sync);
  }, []);
  
  useEffect(() => {
  document.body.style.overflow = sidebarOpen ? "hidden" : "";
  return () => {
    document.body.style.overflow = "";
  };
}, [sidebarOpen]);


  useEffect(() => {
    if (online && pending > 0) {
      offlineQueue.flush();
    }
  }, [online, pending]);

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row bg-background text-foreground">
             {/* Mobile Header */}
<div className="sticky top-0 z-40 flex items-center justify-between border-b bg-card p-4 md:hidden shrink-0">
  <div className="flex items-center gap-2">
    <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
      <Activity className="h-4 w-4" />
    </div>
    <span className="font-semibold">EpiLink</span>
  </div>

  <button
  onClick={() => setSidebarOpen((prev) => !prev)}
  className="rounded-md p-2 hover:bg-muted transition-colors"
    aria-label="Open menu"
>
    <Menu className="h-6 w-6" />
  </button>
</div>
       {sidebarOpen && (
  <div
    className="fixed inset-0 z-[9998] bg-black/40 md:hidden"
    onClick={() => setSidebarOpen(false)}
  />
)}
     
     <aside
  className={cn(
    "fixed inset-y-0 left-0 z-[9999] w-60 overflow-y-auto flex flex-col border-r border-border bg-card transform transition-transform duration-200 ease-in-out will-change-transform md:static md:translate-x-0 md:flex",
    sidebarOpen ? "translate-x-0" : "-translate-x-full"
)}
>
        <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-border">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
            <Activity className="h-5 w-5" />
          </div>
          <div className="pl-3.5">
            <div className="text-base font-semibold tracking-tight text-foreground">EpiLink</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Outbreak Intelligence
            </div>
          </div>
          <button
  onClick={() => setSidebarOpen(false)}
  className="rounded-md p-2 hover:bg-muted md:hidden transition-colors"
            aria-label="Close menu"
>
  <X className="h-5 w-5" />
</button>
        </div>
       
   
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.filter((item) => {
            const userRank = ROLE_RANK[user?.role ?? "viewer"] ?? 0;
            return userRank >= ROLE_RANK[item.minRole];
          }).map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
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
      <main
  className={cn(
    "flex-1 min-w-0 overflow-x-hidden",
    fullBleed ? "" : "p-6 md:p-8"
  )}
>{children}</main>
    </div>
  );
}
