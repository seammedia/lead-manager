-- Instant lead emails (13 October 2026)
-- A new Meta lead is checked (Google profile, Maps rank, website, Google Ads, Instagram) and gets a
-- personal email drafted or sent within minutes. Each run is stored here so it can be reviewed.

-- Leads handled by the instant flow skip the generic 24-hour "Just following up" email.
alter table leads add column if not exists instant_flow boolean not null default false;

create table if not exists lead_enrichments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- received -> checking -> drafted | sent -> replied; failed if the run broke
  status text not null default 'received'
    check (status in ('received', 'checking', 'drafted', 'sent', 'replied', 'failed', 'skipped')),
  mode text,                 -- the delivery mode used: draft or auto
  form jsonb not null default '{}'::jsonb,
  facts jsonb,
  email_subject text,
  email_body text,
  recommended_plan text,
  fit text,
  confidence text,
  notes_for_heath text,
  validation jsonb,
  gmail_draft_id text,
  gmail_message_id text,
  gmail_thread_id text,
  sent_at timestamptz,
  replied_at timestamptz,
  pipeline_record_id text,
  cost_usd numeric,
  timings jsonb,
  error text
);

create index if not exists lead_enrichments_status_created_idx on lead_enrichments (status, created_at desc);
create index if not exists lead_enrichments_lead_idx on lead_enrichments (lead_id);

-- Service role only: no policies, so the anon key can't read lead details or emails.
alter table lead_enrichments enable row level security;

-- Delivery mode, changed without a redeploy: 'draft' (Gmail draft + SMS), 'auto' (send when confident), 'off'.
insert into settings (key, value)
values ('instant_email_mode', '"draft"'::jsonb)
on conflict (key) do nothing;
