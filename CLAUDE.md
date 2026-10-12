# Claude Instructions for Seam Media Lead Manager

This file contains context and instructions for Claude when working on this codebase.

## Project Overview

A CRM and lead management platform for Seam Media with Gmail integration, AI-powered email drafting, Zapier webhook integration for Meta Lead Ads, and real-time statistics.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Email**: Gmail API with OAuth 2.0
- **AI**: OpenAI API (GPT-4o-mini)
- **Charts**: Recharts
- **Deployment**: Vercel

## Key Files

### Stats & ROAS
- `src/app/api/stats/route.ts` - Stats API with date range filtering
- `src/components/stats/CostMetrics.tsx` - ROAS, CPA, CPL, LTV ROAS calculations
- `src/app/stats/page.tsx` - Stats page

### Leads
- `src/app/api/leads/route.ts` - Leads CRUD API
- `src/app/api/leads/[id]/route.ts` - Single lead API with auto-archive logic
- `src/components/leads/LeadModal.tsx` - Lead edit modal
- `src/components/leads/LeadsTable.tsx` - Leads table with pagination

### Gmail Integration
- `src/lib/gmail.ts` - Gmail API utilities
- `src/app/api/gmail/*.ts` - Gmail API routes

## Common Issues & Fixes

### Stats Date Range Filtering (February 2026)

**Problem**: ROAS and stats not displaying correctly when selecting date ranges at month boundaries.

**Root Cause**: `currentPeriodLeads` filter only used `startDate` without an `endDate` upper bound:
```javascript
// BAD - no upper bound
const currentPeriodLeads = leads.filter(
  (lead) => new Date(lead.created_at) >= startDate
);
```

**Fix**: Add `endDate` variable and use it in the filter:
```javascript
// GOOD - with upper bound
const currentPeriodLeads = leads.filter((lead) => {
  const createdAt = new Date(lead.created_at);
  return createdAt >= startDate && createdAt <= endDate;
});
```

### Why ROAS Shows "-"

ROAS displays "-" when any of these conditions are true:
1. Cost Per Lead not entered (user must click and enter a value)
2. `conversions` count is 0
3. `avgDealSize` is 0 (no revenue set on converted leads)
4. `avgLifetimeMonths` is 0 for LTV ROAS (no sign_on_date on converted leads)

### Variable Shadowing in Stats API

Watch for variable shadowing in the stats API. For example, `endDate` was used both as the outer date range variable and inside the LTV calculation reduce function. The inner variable was renamed to `customerEndDate`.

## Lead Stages

10 stages with auto-archive behavior:

| Stage | Auto-Archive | Hidden by Default |
|-------|--------------|-------------------|
| contacted_1 | No | No |
| contacted_2 | No | No |
| called | No | No |
| not_interested | Yes | Yes (Show Archived toggle) |
| no_response | Yes | Yes (Show Archived toggle) |
| not_qualified | Yes | Yes (Show Archived toggle) |
| on_hold | No | Yes (Show On Hold toggle) |
| interested | No | No |
| onboarding_sent | No | No |
| converted | No | Yes (Show Converted toggle) |

## Auto-Set Fields

When stage changes to "converted":
- `converted_at` = current timestamp
- `sign_on_date` = today's date (if not already set)

When stage changes away from "converted":
- `converted_at` = null

## Files to Update When Modifying

### Adding/Modifying Stages
1. `src/types/index.ts` - LeadStage type
2. `src/components/leads/LeadStageTag.tsx` - stageConfig, stageOrder
3. `src/components/leads/StageChart.tsx` - stageConfig, stageOrder
4. `src/components/leads/KanbanBoard.tsx` - stages array
5. `src/components/leads/LeadModal.tsx` - stages array
6. `src/components/leads/LeadsTable.tsx` - stagePriority
7. `src/app/api/leads/[id]/route.ts` - ARCHIVED_STAGES array
8. `src/app/leads/page.tsx` - archivedStages filter
9. Supabase constraint

### Adding New Lead Fields
1. `src/types/index.ts` - Lead interface
2. `src/components/leads/LeadModal.tsx` - formData, useEffect, handleSubmit, form JSX
3. `src/app/api/leads/[id]/route.ts` - auto-set logic if needed
4. `src/app/api/stats/route.ts` - if field affects stats
5. Supabase: `ALTER TABLE leads ADD COLUMN`

## Deployment

Push to `main` branch triggers automatic Vercel deployment.

```bash
git add .
git commit -m "message"
git push origin main
```

## Database

Supabase PostgreSQL. Key tables:
- `leads` - Lead data with all stages and fields
- `email_logs` - Email history
- `settings` - Gmail tokens, app settings
- `business_context` - AI context for email drafting

## Instant lead emails (13 October 2026)

A new Meta lead gets a personal email, drafted (or sent) within minutes, built from checks on their actual business instead of the generic Zapier email.

**Flow:** Zapier POSTs the lead to `/api/leads/instant` (header `x-api-key: LEAD_INTAKE_KEY`; `?dry_run=1` returns the facts and email without saving anything). The route saves the lead and a `lead_enrichments` row, replies 202, then `processEnrichment` (`src/lib/instant/run.ts`) runs:
1. Checks (`checks.ts`, DataForSEO live endpoints, about US$0.02 a lead): Google profile via a Maps search for the name (plus the website title's brand), Maps rank for their category searched from their suburb, the website (title, H1, tap-to-call, platform, Google Ads tag and Meta pixel), Google Ads via the Ads Transparency Center, Instagram via a `site:instagram.com` search, and mobile speed for website enquiries.
2. Live prices from /marketing-packages (`packages.ts`). If the page can't be read, no prices are quoted.
3. Claude (`compose.ts`, default `claude-opus-5-5`) writes the email from the facts only; `validate.ts` enforces Heath's rules (no em dashes, Australian spelling, first person, live prices only, packages link, "Thanks,\nHeath", no guarantee or contract talk). One retry on failure.
4. Delivery (`deliver.ts`): Gmail draft, or a send in auto mode when confidence is high, fit is good, validation passed and the business identity is confirmed. Heath's Gmail signature is added from send-as settings (API messages don't get it automatically). Alert to Heath by text when the Twilio env is set, otherwise an email to contact+leads@.
5. `/api/cron/instant-replies` (Vercel cron, every 10 minutes): marks drafts Heath has sent, and when a lead replies (out-of-office ignored) adds them to the pipeline dashboard as Contacted (`pipeline.ts`), moves the lead to `interested` and alerts Heath.

**Mode** lives in `settings.instant_email_mode`: `draft` (default), `auto` or `off`; change it with SQL, no redeploy. Leads handled by this flow have `leads.instant_flow = true` and skip the generic 24-hour follow-up (`/api/cron/follow-up`).

**Env:** `LEAD_INTAKE_KEY`, `DATAFORSEO_AUTH` (base64 login:password), `ANTHROPIC_API_KEY` (Seam's key from marketing-audit-tool; never the alc-review-hub key, which is the employer's), `PIPELINE_SUPABASE_URL`, `PIPELINE_SUPABASE_ANON_KEY`, `PIPELINE_ACCESS_KEY`; optional `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `OWNER_ALERT_FROM`, `OWNER_ALERT_TO`, `INSTANT_EMAIL_MODEL`, `INSTANT_ALERT_EMAIL`. The AI receptionist's Twilio values are marked sensitive in Vercel and can't be copied across.

**Learnings from testing on real leads (Legion 13, Pat's Gems):**
- DataForSEO `my_business_info` returned "No Search Results" for "Legion13 Perth"; a Maps search found it straight away.
- Maps rank needs a real location: a country-wide location with the suburb in the keyword returns nothing. Use `location_name` "Suburb,State,Australia" (about 2,900 AU suburbs, then the postcode). Searching from the business's own coordinates flatters it (#1 vs #3 from the suburb), and positions move between searches minutes apart, so a top-3 result is stated as "in the top 3".
- One shared word isn't a match ("Should Be Digging" is not "Digging Downunder Excavations"). The website title's brand found the right profile (Pat's Gems), and a website-domain match beats a name match.
- A page fetch misses tags loaded by scripts (legion13.com.au loads Google Analytics that way), so "no Meta pixel / no Ads tag" is only claimed when the site's GTM or GT container was read.
- Instagram: a handle linked from their website wins; people often type their Instagram display name into the form's name field.
- Claude Opus 5.5 rejects a forced `tool_choice`; use `auto` and ask for the tool call in the system prompt.
- The model expanded "KB" to kettlebell (it's kickboxing), so the prompt forbids guessing abbreviations.
