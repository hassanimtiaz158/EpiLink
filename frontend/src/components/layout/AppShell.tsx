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
  Menu,
  X,
  Moon,
  Sun,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useOnline } from "@/hooks/use-online";
import { offlineQueue } from "@/lib/offline-queue";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // If system is selected, we could check matchMedia, but simply toggling light/dark is fine.
  const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
      title="Toggle Theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}


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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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
    <div className="flex min-h-screen w-full flex-col md:flex-row bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50">
      
      {/* Mobile Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white p-4 md:hidden dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
            <Activity className="h-4 w-4" />
          </div>
          <div className="text-sm font-semibold tracking-tight">EpiLink</div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600 dark:text-slate-400">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-[9998] bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[9999] flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white transform transition-transform duration-200 ease-in-out md:static md:translate-x-0 dark:border-slate-800 dark:bg-slate-950",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
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
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
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
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex items-center justify-between mb-3 hidden md:flex">
             <span className="font-medium">Theme</span>
             <ThemeToggle />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Status</span>
            {online !== null &&
              (online ? (
                <Badge
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0"
                >
                  Online
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 gap-1 border-0"
                >
                  <WifiOff className="h-3 w-3" />
                  Offline
                </Badge>
              ))}
          </div>
          {pending > 0 && (
            <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              {pending} report{pending === 1 ? "" : "s"} pending sync
            </div>
          )}
        </div>
      </aside>
      
      <main className={cn("flex-1 min-w-0 flex flex-col h-full", fullBleed ? "" : "p-4 md:p-6 lg:p-8")}>
        {children}
      </main>
    </div>
  );
}
