import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card py-14 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description && <div className="max-w-sm text-xs text-muted-foreground">{description}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <div className="font-medium">Couldn't reach the backend</div>
      <div className="mt-1 text-xs opacity-80">{msg}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
        >
          Retry
        </button>
      )}
    </div>
  );
}
