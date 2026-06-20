import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthContext } from "@/routes/__root";

const ROLE_RANK: Record<string, number> = { viewer: 0, epi_officer: 1, admin: 2 };

export function AuthGate({
  children,
  minRole = "viewer",
}: {
  children: ReactNode;
  minRole?: string;
}) {
  const { user, loading } = useAuthContext() ?? { user: null, loading: true };
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/" });
      return;
    }
    const userRank = ROLE_RANK[user.role] ?? 0;
    const requiredRank = ROLE_RANK[minRole] ?? 0;
    if (userRank < requiredRank) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, minRole, navigate]);

  if (loading) return null;
  if (!user) return null;
  const userRank = ROLE_RANK[user.role] ?? 0;
  const requiredRank = ROLE_RANK[minRole] ?? 0;
  if (userRank < requiredRank) return null;

  return <>{children}</>;
}
