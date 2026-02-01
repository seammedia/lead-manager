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
