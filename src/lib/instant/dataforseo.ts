// Minimal DataForSEO client for the instant lead checks. Live endpoints only, so results come back
// in seconds. Each call costs a fraction of a cent; the cost is returned so runs can be totalled.
// Auth: DATAFORSEO_AUTH (base64 of "login:password"), or DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD.

const ROOT = "https://api.dataforseo.com/v3";

function authHeader() {
  const b64 = process.env.DATAFORSEO_AUTH?.trim();
  if (b64) return `Basic ${b64}`;
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("DataForSEO credentials are not set");
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

export interface DfsResult<T = Record<string, unknown>> {
  items: T[];
  result: Record<string, unknown> | null;
  cost: number;
}

export async function dfsLive<T = Record<string, unknown>>(path: string, task: Record<string, unknown>, timeoutMs = 45_000): Promise<DfsResult<T>> {
  const res = await fetch(`${ROOT}${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify([task]),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload) throw new Error(`DataForSEO ${path} failed: HTTP ${res.status}`);
  const t = payload.tasks?.[0];
  // 40102 = "No Search Results": a normal empty answer, not a failure
  if (t?.status_code === 40102) return { items: [], result: null, cost: Number(t.cost ?? 0) };
  if (!t || (t.status_code && t.status_code >= 40000)) {
    throw new Error(`DataForSEO ${path} task error: ${t?.status_code} ${t?.status_message ?? ""}`.trim());
  }
  const result = (t.result?.[0] ?? null) as Record<string, unknown> | null;
  const items = ((result?.items as T[] | undefined) ?? []).filter(Boolean);
  return { items, result, cost: Number(t.cost ?? 0) };
}
