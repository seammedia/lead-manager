-- Lead texting (16 November 2026)
-- New guide leads get one instant text from Seam's lead line (+61 468 171 514, sent through TendCall),
-- a day 1 "call this lead" alert to Heath, and one final text on day 3. Never more than 2 texts a lead.
-- Off until settings.lead_sms_mode is 'test' (allowed leads only) or 'live' (every new guide lead).

alter table leads add column if not exists sms_allowed boolean not null default false; -- picked by hand for test mode
alter table leads add column if not exists sms_state text
  check (sms_state in ('queued', 'sent', 'replied', 'booked', 'opted_out', 'cold', 'stopped', 'skipped', 'failed'));
alter table leads add column if not exists sms_kind text;           -- guide: social or website
alter table leads add column if not exists sms_phone text;          -- the AU mobile texted, +614xxxxxxxx
alter table leads add column if not exists sms_token text;          -- short booking link /b/<token>
alter table leads add column if not exists sms_due_at timestamptz;  -- when a queued first text goes
alter table leads add column if not exists sms_count smallint not null default 0 check (sms_count between 0 and 2);
alter table leads add column if not exists sms_first_sent_at timestamptz;
alter table leads add column if not exists sms_delivery text;       -- latest Twilio status
alter table leads add column if not exists sms_clicked_at timestamptz;
alter table leads add column if not exists sms_replied_at timestamptz;
alter table leads add column if not exists sms_opted_out_at timestamptz;
alter table leads add column if not exists sms_booked_at timestamptz;
alter table leads add column if not exists sms_alerted_at timestamptz; -- day 1 alert to Heath
alter table leads add column if not exists sms_cold_at timestamptz;
alter table leads add column if not exists sms_skip_reason text;
alter table leads add column if not exists budget_monthly_min integer; -- from the guide form's budget answer
alter table leads add column if not exists dont_call boolean not null default false;

create unique index if not exists leads_sms_token_idx on leads (sms_token) where sms_token is not null;
create index if not exists leads_sms_phone_idx on leads (sms_phone) where sms_phone is not null;
create index if not exists leads_sms_state_idx on leads (sms_state) where sms_state in ('queued', 'sent');

-- Every text, delivery status, click, reply, opt-out, call and alert, with Twilio's price for the cost report
create table if not exists lead_sms_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  type text not null check (type in ('queued', 'skipped', 'sent', 'delivered', 'failed', 'clicked', 'replied', 'opted_out', 'called', 'alert', 'booked', 'cold', 'stopped')),
  twilio_sid text,
  body text,
  detail jsonb,
  price numeric,      -- Twilio's price, positive, in price_unit (usually USD)
  price_unit text,
  segments smallint
);
create index if not exists lead_sms_events_lead_idx on lead_sms_events (lead_id, created_at desc);
create index if not exists lead_sms_events_sid_idx on lead_sms_events (twilio_sid) where twilio_sid is not null;
create index if not exists lead_sms_events_type_created_idx on lead_sms_events (type, created_at desc);

-- Opt-outs by number, so a STOP sticks even if the same person signs up again as a new lead (Spam Act)
create table if not exists sms_optouts (
  phone text primary key,
  created_at timestamptz not null default now(),
  lead_id uuid references leads(id) on delete set null,
  source text
);

-- Service role only: no policies, so the anon key can't read numbers or replies
alter table lead_sms_events enable row level security;
alter table sms_optouts enable row level security;

-- Off by default. 'test' texts only leads with sms_allowed = true (no day 3 text); 'live' texts every new guide lead.
insert into settings (key, value) values ('lead_sms_mode', '"off"'::jsonb) on conflict (key) do nothing;
-- Heath's Google Calendar appointment schedule link; null until he pastes it in
insert into settings (key, value) values ('lead_sms_booking_url', 'null'::jsonb) on conflict (key) do nothing;
