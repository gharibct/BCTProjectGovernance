import { type APIRequestContext, request } from "@playwright/test";

// Mirrors frontend/src/lib/api/client.ts: same-origin base URL (rides the
// next.config.ts rewrite to the backend) plus the shared X-API-Key header
// every route requires on top of the session cookie carried by storageState.
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "local-dev-key";

export async function apiContextFor(role: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: "http://localhost:3000",
    storageState: `e2e/.auth/${role}.json`,
    extraHTTPHeaders: { "X-API-Key": API_KEY },
  });
}

// The dev seed (backend/scripts/seed_sqlite_dev.py) creates users/roles/orgs
// but no Project rows, so project-scoped specs create their own via a direct
// API call rather than depending on the multi-step wizard UI. Only
// project_name is required (backend/app/schemas/projects.py).
export async function createProject(api: APIRequestContext, name: string) {
  const res = await api.post("/api/v1/projects", { data: { project_name: name } });
  if (!res.ok()) {
    throw new Error(`createProject failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as { id: string; project_code: string };
}

// List endpoints built by app/api/v1/factory.py::build_crud_router return
// {items, total, skip, limit} (app/schemas/common.py::Page), not a bare array.
export async function listAccounts(api: APIRequestContext) {
  const res = await api.get("/api/v1/accounts");
  if (!res.ok()) {
    throw new Error(`listAccounts failed: ${res.status()} ${await res.text()}`);
  }
  const page = (await res.json()) as { items: Array<{ id: string; name: string }> };
  return page.items;
}

export async function listGeos(api: APIRequestContext) {
  const res = await api.get("/api/v1/geos");
  if (!res.ok()) {
    throw new Error(`listGeos failed: ${res.status()} ${await res.text()}`);
  }
  const page = (await res.json()) as { items: Array<{ id: string; name: string }> };
  return page.items;
}
