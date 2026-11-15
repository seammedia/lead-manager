// HTTP client for TendCall's /api/seam-lead-line, which holds the Twilio account and sends from the
// Seam lead line. Authenticated with the shared secret SEAM_LEAD_LINE_SECRET (the same value is set on
// both Vercel projects). This repo never holds Twilio credentials or Heath's mobile number.

import type { Line, LineMessage, SendResult } from "./engine";

export const DEFAULT_LINE_URL = "https://app.tendcall.com/api/seam-lead-line";
export const SECRET_HEADER = "x-seam-lead-line-secret";

export function httpLine(env: Record<string, string | undefined> = process.env, f: typeof fetch = fetch): Line {
  const url = env.SEAM_LEAD_LINE_URL || DEFAULT_LINE_URL;
  const secret = env.SEAM_LEAD_LINE_SECRET;

  async function call<T>(mode: string, body: unknown): Promise<T> {
    if (!secret) throw new Error("SEAM_LEAD_LINE_SECRET is not set");
    const res = await f(`${url}?mode=${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json", [SECRET_HEADER]: secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`lead line ${mode} ${res.status}: ${data?.error ?? "failed"}`);
    return data as T;
  }

  return {
    send: (to, body) => call<SendResult>("send", { to, body }),
    prices: async (sids) => (await call<{ prices: Awaited<ReturnType<Line["prices"]>> }>("price", { sids })).prices,
    sentMessages: async (days) => (await call<{ messages: LineMessage[] }>("messages", { days })).messages,
  };
}
