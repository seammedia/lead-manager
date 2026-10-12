// Adds a lead who replied to the Seam pipeline dashboard (seam-pipeline-dashboard.vercel.app).
// The dashboard holds warm leads only, so this runs on a reply, never on a new form fill.
// Env: PIPELINE_SUPABASE_URL, PIPELINE_SUPABASE_ANON_KEY, PIPELINE_ACCESS_KEY (the dashboard's storage key).

interface PipelineRecord {
  id: string;
  kind: string;
  business: string;
  email?: string | null;
}

async function rpc<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const url = process.env.PIPELINE_SUPABASE_URL;
  const anon = process.env.PIPELINE_SUPABASE_ANON_KEY;
  const access = process.env.PIPELINE_ACCESS_KEY;
  if (!url || !anon || !access) throw new Error("Pipeline dashboard env is not set");
  const res = await fetch(`${url}/rest/v1/rpc/seam_pipeline_request`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ access_key: access, action, payload }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Pipeline ${action} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export const PLAN_MONTHLY_CENTS: Record<string, number> = {
  // Weekly price x 52 / 12, matching how the dashboard shows existing records
  "Local Marketing Foundation": 60667,
  Growth: 101833,
  "Complete Growth": 151667,
};

export async function addRepliedLead(input: {
  business: string;
  contact: string;
  email: string;
  phone: string | null;
  plan: string | null;
  notes: string;
  followUp: string; // YYYY-MM-DD
}): Promise<{ id: string; created: boolean }> {
  const { records } = await rpc<{ records: PipelineRecord[] }>("list");
  const existing = records.find(
    (r) => (r.email && r.email.toLowerCase() === input.email.toLowerCase()) || r.business.trim().toLowerCase() === input.business.trim().toLowerCase()
  );
  if (existing) return { id: existing.id, created: false };
  const { record } = await rpc<{ record: PipelineRecord }>("create", {
    kind: "pipeline",
    business: input.business,
    contact: input.contact,
    email: input.email,
    phone: input.phone,
    value_cents: input.plan ? PLAN_MONTHLY_CENTS[input.plan] ?? null : null,
    value_basis: "monthly",
    stage: "Contacted",
    source: "Meta Ads",
    next_step: "Read their reply and answer within the day",
    follow_up: input.followUp,
    notes: input.notes,
  });
  return { id: record.id, created: true };
}
