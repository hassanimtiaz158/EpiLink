import { useCallback, useEffect, useState } from "react";
import { setToken, clearToken, apiFetch } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/config";
import type { UserOut, TokenResponse } from "@/lib/api/types";

interface AuthState {
  user: UserOut | null;
  loading: boolean;
  error: string | null;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getCachedUser(): UserOut | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem("epilink_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getCachedToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem("epilink_token");
  } catch {
    return null;
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const token = getCachedToken();
    const cached = getCachedUser();

    if (cached && token) {
      setState({ user: cached, loading: false, error: null });
      return;
    }

    if (token) {
      apiFetch<UserOut>(ENDPOINTS.auth.me)
        .then((u) => {
          localStorage.setItem("epilink_user", JSON.stringify(u));
          setState({ user: u, loading: false, error: null });
        })
        .catch(() => {
          clearToken();
          setState({ user: null, loading: false, error: null });
        });
      return;
    }

    setState({ user: null, loading: false, error: null });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res: TokenResponse = await apiFetch<TokenResponse>(ENDPOINTS.auth.login, {
        method: "POST",
        body: { email, password },
      });
      setToken(res.access_token);
      localStorage.setItem("epilink_user", JSON.stringify(res.user));
      setState({ user: res.user, loading: false, error: null });
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw err;
    }
  }, []);

  const signup = useCallback(
    async (email: string, password: string, fullName: string, role: string = "viewer") => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res: TokenResponse = await apiFetch<TokenResponse>(ENDPOINTS.auth.signup, {
          method: "POST",
          body: { email, password, full_name: fullName, role },
        });
        setToken(res.access_token);
        localStorage.setItem("epilink_user", JSON.stringify(res.user));
        setState({ user: res.user, loading: false, error: null });
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Signup failed";
        setState((s) => ({ ...s, loading: false, error: msg }));
        throw err;
      }
    },
    [],
  );

  const logout = useCallback(() => {
    clearToken();
    setState({ user: null, loading: false, error: null });
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    login,
    signup,
    logout,
    isAuthenticated: !!state.user,
  };
}
