import type { UserOut } from "@/lib/api/types";

const ROLE_RANK: Record<string, number> = { viewer: 0, epi_officer: 1, admin: 2 };

export function getStoredUser(): UserOut | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("epilink_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserOut;
  } catch {
    return null;
  }
}

export function hasRole(user: UserOut | null, minRole: string): boolean {
  if (!user) return false;
  const userRank = ROLE_RANK[user.role] ?? 0;
  const requiredRank = ROLE_RANK[minRole] ?? 0;
  return userRank >= requiredRank;
}
