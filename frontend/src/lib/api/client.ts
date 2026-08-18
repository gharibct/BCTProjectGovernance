import { useSession } from "@/stores/session";

// Relative — proxied to the backend by next.config.ts's rewrite so the
// browser sees it as same-origin, which is what lets the OneLogin session
// cookie (httpOnly, SameSite=Lax) work without needing HTTPS locally.
const BASE_URL = "/api/v1";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `Request failed with status ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

// A 401 means the session cookie is missing/expired/invalid — clear the
// locally cached user and bounce to /login rather than leaving the app
// showing stale role/scope data for a session that no longer exists
// server-side.
function handleUnauthorized() {
  if (typeof window === "undefined") return;
  useSession.getState().signOut();
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

// Every FastAPI route in this backend also requires X-API-Key (see
// backend/app/core/security.py) as a defense-in-depth shared secret on top
// of the per-user session cookie (credentials: "include" below).
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...init?.headers,
    },
  });

  if (res.status === 401) handleUnauthorized();
  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, isJson ? (body?.detail ?? body) : body);
  }

  return body as T;
}

// For multipart uploads (document-processing) — deliberately omits
// Content-Type so fetch sets its own multipart boundary; a FormData body
// can't be JSON.stringify'd like request()'s other callers.
async function postForm<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "X-API-Key": API_KEY },
    body: formData,
  });

  if (res.status === 401) handleUnauthorized();
  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, isJson ? (body?.detail ?? body) : body);
  }

  return body as T;
}

// For file downloads (document-processing) — a plain <a href> can't attach
// the X-API-Key header this backend requires on every route, so downloads
// fetch a Blob here and the caller turns it into a synthetic anchor click.
async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: { "X-API-Key": API_KEY },
  });

  if (res.status === 401) handleUnauthorized();

  if (!res.ok) {
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await res.json() : await res.text();
    throw new ApiError(res.status, isJson ? (body?.detail ?? body) : body);
  }

  return res.blob();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  postForm: <T>(path: string, formData: FormData) => postForm<T>(path, formData),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  getBlob: (path: string) => getBlob(path),
};

export type Page<T> = {
  items: T[];
  total: number;
  skip: number;
  limit: number;
};
