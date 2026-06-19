import { API_BASE_URL } from "./config";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("epilink_token");
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  localStorage.setItem("epilink_token", token);
}

export function clearToken() {
  localStorage.removeItem("epilink_token");
  localStorage.removeItem("epilink_user");
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(
    path.startsWith("http") ? path : `${API_BASE_URL}${path}`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost",
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers, ...rest } = options;
  const token = getToken();
  const init: RequestInit = {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), init);
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : "Network error", 0, null);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const msg =
      (data as { detail?: string } | null)?.detail ??
      (data as { error?: string } | null)?.error ??
      `Request failed: ${res.status}`;

    if (res.status === 401 && !path.includes("/api/auth/")) {
      clearToken();
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }

    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
