# Seam Media Lead Manager

A comprehensive CRM and lead management platform for Seam Media, featuring Gmail integration, AI-powered email drafting, Zapier webhook integration for Meta Lead Ads, automated follow-up system, real-time statistics, and a full-featured inbox with email threading.

## Features

- **Lead Management** - Track leads through 10 stages with auto-archiving for closed leads
- **PIN Authentication** - Simple PIN login (202417) with 30-day session persistence
- **Multiple Views** - Table view, Kanban board, and Chart view for visualizing leads
- **Global Search** - Search leads by name, email, or company from the header
- **Gmail Integration** - Full inbox with compose, reply, archive, delete, star, and email thread viewing
- **Email History in Lead Modal** - View all email communication when opening a lead
- **Automated Follow-ups** - Cron job sends follow-up emails after 2 days of no response
- **AI Email Drafting** - Generate professional email responses using OpenAI GPT-4o-mini
- **Business Context for AI** - Configure business notes and documents for AI to reference
- **Next Action Tracking** - Quick notes field for tracking next steps per lead
- **Zapier Webhook** - Automatically import leads from Meta/Facebook Lead Ads
- **Real-time Statistics** - Dashboard with live stats, date range picker (Google Ads style)
- **Revenue Tracking** - Track revenue per converted lead with source attribution
- **Top Opportunities** - Dashboard showing highest-value leads by conversion probability
- **Archive System** - Archive old leads without deleting them
- **Email Logging** - All sent emails are logged for statistics tracking
- **Auto-sync Last Contacted** - Syncs from Gmail history when opening a lead

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Email**: Gmail API with OAuth 2.0
- **AI**: OpenAI API (GPT-4o-mini)
- **Charts**: Recharts
- **Deployment**: Vercel
- **Icons**: Lucide React
- **External Cron**: cron-job.org (for automated follow-ups)

## Lead Stages

The application uses 10 lead stages in this order:

| Stage | Description | Color | Behavior |
|-------|-------------|-------|----------|
| `contacted_1` | First contact made | Yellow | Default for new leads (auto-email sent) |
| `contacted_2` | Follow-up contact made | Pink | Auto-set when sending follow-up email |
| `called` | Phone call made | Purple | Manual |
| `not_interested` | Lead declined | Red | **Auto-archived, hidden from table/board** |
| `no_response` | No response after follow-ups | Gray | **Auto-archived, hidden from table/board** |
| `not_qualified` | Lead doesn't meet criteria | Slate | **Auto-archived, hidden from table/board** |
| `on_hold` | Temporarily paused | Amber | **Hidden by default, use "Show On Hold" toggle** |
| `interested` | Lead has shown interest | Orange | Auto-set if lead responds |
| `onboarding_sent` | Onboarding email sent | Teal | Auto-set when sending onboarding email |
| `converted` | Successfully closed deal | Emerald | Track revenue here |

### Stage Behavior Notes

- **Archived Stages** (Not Interested, No Response, Not Qualified):
  - Automatically archived when stage is set
  - Hidden from Table and Board views by default
  - Still appear in Chart view and count in total lead statistics
  - Click "Show Archived" to see them in table/board
  - Auto-unarchived if stage changes to a non-archived stage

- **On Hold**: For leads you want to pause but may revisit later
  - Hidden from Table/Board by default
  - Use "Show On Hold" toggle to view them
  - Still counts in lead statistics
  - Not auto-archived (separate from archived leads)

- **Contacted 1**: Default stage for all new leads (since auto-email is sent)
- **Contacted 2**: Auto-set when you send a "Follow Up" email
- **Onboarding Sent**: Auto-set when you send an "Onboarding" email
- **Interested**: Auto-set when a lead responds to your emails

## Setup Instructions

### 1. Supabase Setup

1. Go to [Supabase](https://supabase.com) and create a new project
2. Go to **SQL Editor** and run the following migrations in order:

#### Migration 1: Leads Table
```sql
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  stage TEXT DEFAULT 'new',
  source TEXT DEFAULT 'website',
  owner TEXT DEFAULT 'Heath Maes',
  conversion_probability INTEGER DEFAULT 20,
  revenue DECIMAL(10, 2),
  notes TEXT,
  next_action TEXT,
  last_contacted TIMESTAMP WITH TIME ZONE,
  archived BOOLEAN DEFAULT FALSE,
  meta_lead_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stage constraint for valid stages
ALTER TABLE leads ADD CONSTRAINT leads_stage_check
  CHECK (stage IN ('contacted_1', 'contacted_2', 'called', 'not_interested', 'no_response', 'not_qualified', 'on_hold', 'interested', 'onboarding_sent', 'converted'));

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_archived ON leads(archived);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
CREATE POLICY "Service role can manage leads" ON leads
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

#### Migration 2: Email Logs Table
```sql
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  subject TEXT,
  body TEXT,
  gmail_message_id TEXT,
  thread_id TEXT,
  is_sent BOOLEAN DEFAULT true,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_lead_id ON email_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage email_logs" ON email_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

#### Migration 3: Business Context Table (for AI Assistant)
```sql
CREATE TABLE IF NOT EXISTS business_context (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE business_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage business_context" ON business_context
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

#### Migration 4: Settings Table (for Gmail tokens & cron access)
```sql
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage settings" ON settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

3. Get your Supabase credentials:
   - Go to **Project Settings** > **API**
   - Copy your **Project URL** (looks like `https://xxxxx.supabase.co`)
   - Copy your **anon/public** key
   - Copy your **service_role** key (for server-side operations)

### 2. Google Cloud Setup (Gmail)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the **Gmail API**:
   - Go to **APIs & Services** > **Library**
   - Search for "Gmail API" and enable it
4. Configure **OAuth Consent Screen**:
   - Go to **APIs & Services** > **OAuth consent screen**
   - Choose "External" user type
   - Fill in app name, support email, developer email
   - Add scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.compose`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
5. Create **OAuth 2.0 Client ID**:
   - Go to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Add **Authorized redirect URI**: `https://your-domain.vercel.app/api/gmail/callback`
   - Copy the **Client ID** and **Client Secret**

### 3. OpenAI Setup

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Go to **API Keys** and create a new API key
4. Copy the API key (starts with `sk-`)

### 4. Vercel Deployment

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com) and import your repository
3. Add the following **Environment Variables**:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google OAuth (Gmail)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app/api/gmail/callback

# OpenAI
OPENAI_API_KEY=sk-your_openai_api_key

# Authentication
MASTER_PIN=202417

# Cron Job Secret (generate with: openssl rand -hex 32)
CRON_SECRET=your_random_secret_here

# Optional: Webhook security
WEBHOOK_API_KEY=your_optional_webhook_secret
```

4. Deploy your application

**Important**: After adding environment variables, redeploy for changes to take effect.

### 5. Zapier Integration (Meta Lead Ads)

To automatically import leads from Facebook/Meta Lead Ads:

1. Create a Zap in Zapier:
   - **Trigger**: Facebook Lead Ads > New Lead
   - **Action**: Webhooks by Zapier > POST

2. Configure the webhook:
   - **URL**: `https://your-domain.vercel.app/api/leads/webhook`
   - **Payload Type**: JSON
   - **Data**:
     ```
     name: {{lead_name}}
     email: {{lead_email}}
     phone: {{lead_phone}}
     company: {{lead_company}}
     ```

3. Test the webhook and publish your Zap

**Note**: Leads from Zapier are automatically set to `contacted_1` stage with `last_contacted` timestamp, since Zapier sends the first email.

### 6. Automated Follow-up Cron Setup

The app includes an automated follow-up system that:
- Checks for leads in "Contacted 1" stage with no contact for 24+ hours
- If no response from lead: Sends follow-up email, moves to "Contacted 2"
- If lead responded: Moves to "Interested"

Since Vercel Hobby plan has limited cron jobs, use an external service:

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create a new cron job:
   - **URL**: `https://your-domain.vercel.app/api/cron/follow-up`
   - **Schedule**: Every 6 hours (or daily)
   - **Headers**: Add `Authorization: Bearer YOUR_CRON_SECRET` (same as CRON_SECRET env var)
3. **Important**: After setting up, reconnect Gmail in app Settings so tokens are stored in database for the cron to access

## Authentication

The app uses a simple PIN-based authentication:

- **Default PIN**: `202417` (can be changed via `MASTER_PIN` env var)
- **Session Duration**: 30 days (browser remembers you)
- **Logout**: Click "Sign Out" in the sidebar

Public routes (no auth required):
- `/login`
- `/api/leads/webhook` (Zapier)
- `/api/cron/follow-up` (uses CRON_SECRET header)
- `/api/gmail/callback` (OAuth)
- `/api/meta/webhook`

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Yes | OAuth callback URL |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `MASTER_PIN` | No | Login PIN (default: 202417) |
| `CRON_SECRET` | No | Secret for cron job authentication |
| `WEBHOOK_API_KEY` | No | Optional webhook authentication |

## API Routes

### Authentication

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/login` | POST | Login with PIN |
| `/api/auth/logout` | POST | Logout (clear session) |

### Leads

| Route | Method | Description |
|-------|--------|-------------|
| `/api/leads` | GET | Fetch all leads (query: `?archived=true/false`) |
| `/api/leads` | POST | Create a new lead |
| `/api/leads/[id]` | GET | Get a single lead |
| `/api/leads/[id]` | PATCH | Update a lead |
| `/api/leads/[id]` | DELETE | Delete a lead |
| `/api/leads/webhook` | POST | Zapier webhook endpoint |
| `/api/leads/search` | GET | Search leads (query: `?q=searchterm`) |
| `/api/leads/check-responses` | GET | Check for lead responses, auto-advance to interested (query: `?leadId=optional`) |

### Gmail

| Route | Method | Description |
|-------|--------|-------------|
| `/api/gmail/auth` | GET | Get OAuth authorization URL |
| `/api/gmail/callback` | GET | OAuth callback (also saves tokens to DB for cron) |
| `/api/gmail/status` | GET | Check Gmail connection status |
| `/api/gmail/disconnect` | POST | Disconnect Gmail |
| `/api/gmail/emails` | GET | Fetch emails (query: `?maxResults=20&query=from:email`) |
| `/api/gmail/send` | POST | Send or reply to email |
| `/api/gmail/thread` | GET | Fetch full email thread |
| `/api/gmail/actions` | POST | Archive, trash, star, mark read/unread |

### Cron & Stats

| Route | Method | Description |
|-------|--------|-------------|
| `/api/cron/follow-up` | GET | Automated follow-up job (requires Bearer token) |
| `/api/stats` | GET | Get real-time statistics (query: `?period=7&start=&end=`) |
| `/api/ai/draft` | POST | Generate AI email draft |
| `/api/settings/business-context` | GET/POST | Get/save AI business context |

## Features in Detail

### Global Search

The header includes a search bar that:
- Searches leads by name, email, or company
- Shows results in a dropdown as you type (minimum 2 characters)
- Clicking a result opens the lead modal with full details and email history

### Lead Modal with Email History

When you open a lead (from search or table), the modal shows:
- **Left side**: Lead details form (name, email, company, stage, etc.)
- **Right side**: Email history with the lead
- **Auto-sync**: If emails show more recent contact than `last_contacted`, it auto-updates

### Date Range Picker (Stats Page)

Google Ads-style date picker with:
- Presets: Last 7 days, Last 14 days, Last 30 days, This month, Last month
- Custom range with calendar selector
- Charts show daily data for 7/14 days, weekly for 30+ days

### Not Interested Lead Handling

When a lead is marked "Not Interested":
- **Hidden from Table/Board**: Keeps the active lead list clean
- **Shown in Chart**: Still counts in "Leads by Stage" chart
- **Counted in Stats**: Included in total lead counts
- **Viewable via "Show Archived"**: Click to see these leads

### Automated Follow-up System

The `/api/cron/follow-up` endpoint:
1. Finds leads in "contacted_1" with `last_contacted` > 24 hours ago
2. Checks Gmail for responses (emails FROM the lead)
3. If no response: Sends follow-up email, moves to "contacted_2"
4. If responded: Moves to "interested"

### Real-Time Response Detection

In addition to the cron job, the app detects lead responses in real-time:
- **When inbox loads/refreshes**: Checks all "contacted_1" leads for responses
- **When viewing a lead modal**: Checks that specific lead if in "contacted_1" stage
- Leads who respond are immediately moved to "interested" to prevent automatic follow-ups

This is handled by the `/api/leads/check-responses` endpoint which:
1. Queries leads in "contacted_1" stage
2. Checks Gmail for emails FROM each lead after their `last_contacted` date
3. Auto-advances responding leads to "interested" stage

**Follow-up email template**:
```
Hi {firstName},

Just following up on this one and seeing if you needed any further information?

Look forward to hearing from you.

Thanks,

Heath
```

### Auto-Stage Changes on Email Send

| Email Type | New Stage |
|------------|-----------|
| Follow Up Email | contacted_2 |
| Onboarding Email | onboarding_sent |
| General Email | (no change) |

### Lead Sources

| Source | Display Name |
|--------|--------------|
| `website` | Website |
| `linkedin` | LinkedIn |
| `referral` | Referral |
| `email` | Email |
| `instagram` | Instagram Messages |
| `meta_ads` | Meta Ads |
| `google_ads` | Google Ads |
| `other` | Other |

## Troubleshooting

### Authentication Issues

**Can't login:**
- Default PIN is `202417`
- Check `MASTER_PIN` env var if changed
- Clear cookies and try again

### Gmail Issues

**"Insufficient authentication scopes":**
- Disconnect and reconnect Gmail to get all required scopes

**Cron job not working:**
- Ensure `CRON_SECRET` env var is set in Vercel
- Ensure Authorization header in cron-job.org is `Bearer YOUR_SECRET`
- Reconnect Gmail after setting up settings table (tokens must be in DB)

**Email history not showing:**
- Gmail API needs the query format `{from:email to:email}`
- Check that Gmail is connected

### Supabase Issues

**Stage constraint error:**
- Run migration to update stage constraint:
```sql
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_stage_check;
ALTER TABLE leads ADD CONSTRAINT leads_stage_check
  CHECK (stage IN ('contacted_1', 'contacted_2', 'called', 'not_interested', 'no_response', 'not_qualified', 'on_hold', 'interested', 'onboarding_sent', 'converted'));
```

**Settings table missing:**
- Run Migration 4 above to create settings table

### Build Issues

**"middleware is deprecated" warning:**
- This is a Next.js 16 warning, can be ignored for now

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env.local` with all environment variables
4. Run: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

For local cron testing, you can call the endpoint directly:
```bash
curl -H "Authorization: Bearer your_cron_secret" http://localhost:3000/api/cron/follow-up
```

## Database Schema

### leads
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Lead name |
| email | TEXT | Email address |
| company | TEXT | Company name |
| phone | TEXT | Phone number |
| stage | TEXT | Lead stage (constrained) |
| source | TEXT | Lead source |
| owner | TEXT | Assigned owner |
| conversion_probability | INTEGER | 0-100% |
| revenue | DECIMAL | Revenue when converted |
| notes | TEXT | Long-form notes |
| next_action | TEXT | Quick action note |
| last_contacted | TIMESTAMP | Last contact date |
| archived | BOOLEAN | Archive status |
| meta_lead_id | TEXT | Meta Ads lead ID |
| created_at | TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | Last update |

### email_logs
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| lead_id | UUID | FK to leads |
| subject | TEXT | Email subject |
| body | TEXT | Email content |
| gmail_message_id | TEXT | Gmail message ID |
| thread_id | TEXT | Gmail thread ID |
| is_sent | BOOLEAN | True if outgoing |
| sent_at | TIMESTAMP | Send timestamp |

### settings
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| key | TEXT | Setting key (unique) |
| value | JSONB | Setting value |
| created_at | TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | Last update |

**Settings keys used:**
- `gmail_tokens`: Stores OAuth tokens for cron job access

### business_context
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | TEXT | User identifier |
| notes | TEXT | Business context notes |
| attachments | JSONB | Uploaded documents |

## Deployment Checklist

- [ ] All environment variables set in Vercel
- [ ] Supabase migrations run (leads, email_logs, business_context, settings tables)
- [ ] Stage constraint updated for all 10 stages
- [ ] Gmail OAuth redirect URI matches Vercel domain
- [ ] OpenAI API key is valid and has credits
- [ ] CRON_SECRET set in Vercel
- [ ] External cron job configured (cron-job.org)
- [ ] Gmail reconnected after settings table created
- [ ] Test login with PIN
- [ ] Test lead creation
- [ ] Test Gmail connection
- [ ] Test search functionality
- [ ] Test AI draft generation
- [ ] Test email sending
- [ ] Test cron job manually

## UI Configuration

### Table Pagination

- **Leads per page**: 10 (configurable in `LeadsTable.tsx` via `ITEMS_PER_PAGE`)
- Shows "Showing X to Y of Z leads" at bottom
- Pagination controls appear when leads exceed page size

### View Toggles

The leads page includes filter toggles:
- **Show On Hold**: Reveals leads in "on_hold" stage (hidden by default)
- **Show Archived**: Reveals leads in archived stages (not_interested, no_response, not_qualified)

## Learnings & Implementation Notes

### Stage Management

**Stages evolved from 8 to 10:**
1. Removed "new" stage - leads now start at "contacted_1" since auto-email is sent
2. Added "no_response" - for leads who never replied (separate from active decline)
3. Added "not_qualified" - for leads who don't meet criteria
4. Added "on_hold" - for temporarily paused leads

**Auto-Archive Logic** (in `/api/leads/[id]/route.ts`):
- Stages `not_interested`, `no_response`, `not_qualified` auto-set `archived: true`
- Changing to any other stage auto-sets `archived: false`
- This keeps the main view clean while preserving lead data

**Stage Filtering** (in `/app/leads/page.tsx`):
```javascript
const archivedStages = ["not_interested", "no_response", "not_qualified"];
const tableLeads = leads.filter(l => {
  if (archivedStages.includes(l.stage) && !showArchived) return false;
  if (l.stage === "on_hold" && !showOnHold) return false;
  return true;
});
```

### Real-Time Response Detection

**Problem**: Leads who respond to emails shouldn't receive automatic follow-ups.

**Solution**: The `/api/leads/check-responses` endpoint checks Gmail for responses:
- Called when inbox loads/refreshes
- Called when viewing a lead modal (if lead is in "contacted_1")
- Checks for emails FROM the lead after `last_contacted` date
- Auto-advances responding leads to "interested" stage

**Implementation**:
```javascript
// Check if lead responded
const query = `from:${lead.email}`;
const responseEmails = await listEmails(accessToken, refreshToken, { query });
const hasResponded = responseEmails.some(email =>
  new Date(email.date) > new Date(lead.last_contacted)
);
if (hasResponded) {
  await supabase.from("leads").update({ stage: "interested" }).eq("id", lead.id);
}
```

### Stage Colors Reference

| Stage | Tailwind BG | Hex Color |
|-------|-------------|-----------|
| contacted_1 | yellow-100/500 | #eab308 |
| contacted_2 | pink-100/500 | #ec4899 |
| called | purple-100/500 | #a855f7 |
| not_interested | red-100/500 | #ef4444 |
| no_response | gray-100/500 | #6b7280 |
| not_qualified | slate-100/500 | #475569 |
| on_hold | amber-100/500 | #f59e0b |
| interested | orange-100/500 | #f97316 |
| onboarding_sent | teal-100/500 | #14b8a6 |
| converted | emerald-100/500 | #10b981 |

### Files to Update When Adding/Modifying Stages

1. **Type definitions**:
   - `src/types/index.ts` - LeadStage type
   - `src/lib/supabase.ts` - LeadStage type

2. **UI Components**:
   - `src/components/leads/LeadStageTag.tsx` - stageConfig, stageOrder
   - `src/components/leads/StageChart.tsx` - stageConfig, stageOrder, stageCounts
   - `src/components/leads/KanbanBoard.tsx` - stages array
   - `src/components/leads/LeadModal.tsx` - stages array
   - `src/components/leads/LeadsTable.tsx` - stagePriority

3. **API Routes**:
   - `src/app/api/leads/route.ts` - default stage
   - `src/app/api/leads/[id]/route.ts` - ARCHIVED_STAGES array
   - `src/app/api/meta/webhook/route.ts` - default stage
   - `src/app/api/meta/sync-leads/route.ts` - default stage
   - `src/app/api/leads/migrate-stages/route.ts` - stageMapping

4. **Page Logic**:
   - `src/app/leads/page.tsx` - archivedStages filter

5. **Database**:
   - Update Supabase constraint with new stage values

### Key Constants

```javascript
// Leads table pagination
const ITEMS_PER_PAGE = 10;  // LeadsTable.tsx

// Stages that auto-archive
const ARCHIVED_STAGES = ["not_interested", "no_response", "not_qualified"];

// Follow-up timing
const FOLLOW_UP_HOURS = 24;  // Hours before sending follow-up

// Session duration
const SESSION_DAYS = 30;  // PIN login session length
```

### Common Supabase Queries

**Get all active leads (not archived):**
```javascript
const { data } = await supabase
  .from("leads")
  .select("*")
  .eq("archived", false)
  .order("created_at", { ascending: false });
```

**Get leads needing follow-up:**
```javascript
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { data } = await supabase
  .from("leads")
  .select("*")
  .eq("stage", "contacted_1")
  .eq("archived", false)
  .lt("last_contacted", oneDayAgo);
```

**Update stage with auto-archive:**
```javascript
const ARCHIVED_STAGES = ["not_interested", "no_response", "not_qualified"];
const updates = { stage: newStage };
if (ARCHIVED_STAGES.includes(newStage)) {
  updates.archived = true;
} else {
  updates.archived = false;
}
await supabase.from("leads").update(updates).eq("id", leadId);
```

## Instagram/Meta DM Integration

The app supports tracking Instagram DMs as leads via Meta's webhook system.

### Database Setup for Instagram

Run this migration to add Instagram/Facebook ID columns:

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS instagram_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS facebook_id TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_instagram_id ON leads(instagram_id);
CREATE INDEX IF NOT EXISTS idx_leads_facebook_id ON leads(facebook_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_instagram_id_unique ON leads(instagram_id) WHERE instagram_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_facebook_id_unique ON leads(facebook_id) WHERE facebook_id IS NOT NULL;
```

### Meta Developer App Setup

1. Go to [Meta for Developers](https://developers.facebook.com/) and create a new app
2. Select "Business" type app
3. Add use cases:
   - **Engage with customers on Messenger from Meta**
   - **Manage messaging & content on Instagram**

### Webhook Configuration

1. In Meta Developer Dashboard, go to **Use cases** → **Customize** on Instagram use case
2. Configure webhooks:
   - **Callback URL**: `https://your-domain.vercel.app/api/meta/webhook`
   - **Verify Token**: Create a secret (e.g., `seam_media_webhook_verify_2024`)
3. Add environment variable to Vercel:
   ```
   META_WEBHOOK_VERIFY_TOKEN=seam_media_webhook_verify_2024
   ```
4. Subscribe to webhook fields:
   - `messages` - for DM notifications
   - `messaging_postbacks` - for button clicks
   - `messaging_referral` - for referral tracking

### Instagram Tester Setup (Development Mode)

For testing without publishing the app:

1. Go to **App roles** → **Add People** → Select **Instagram Tester**
2. Enter the Instagram username to test with
3. On Instagram, go to **Settings** → **Apps and websites** → **Tester Invites** → **Accept**

**Important**: Instagram webhooks require the app to be in **published state** for production use. In development mode, you can test with accounts that have tester roles.

### How Instagram DM Tracking Works

When someone DMs your Instagram account:

1. **New Lead Creation**: If the sender isn't in your system, a new lead is created with:
   - Source: `instagram`
   - Name: `Instagram User XXXXXX` (last 6 digits of their ID)
   - Stage: `contacted_1`
   - Notes: Contains their first message

2. **Existing Lead Response**: If the sender matches an existing lead's `instagram_id`:
   - Activity logged to the lead
   - If in early stages (contacted_1, contacted_2, called, no_response), auto-advances to `interested`

### Meta API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/meta/auth` | GET | Get Meta OAuth URL |
| `/api/meta/callback` | GET | OAuth callback |
| `/api/meta/status` | GET | Check Meta connection |
| `/api/meta/disconnect` | POST | Disconnect Meta |
| `/api/meta/webhook` | GET/POST | Webhook verification & events |
| `/api/meta/sync-leads` | POST | Manually sync leads from Meta Lead Ads |

### Environment Variables for Meta

```
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_REDIRECT_URI=https://your-domain.vercel.app/api/meta/callback
META_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
```

## Stats Page Features

### Lead Growth Chart

The Lead Growth Trend chart displays two data series:
- **Leads** (Blue #3B82F6): Total new leads over time
- **Conversions** (Green #10B981): Leads that converted

Both are shown as stacked area charts with a legend in the top-right corner.

### Date Range Options

- Last 7 days (daily data)
- Last 14 days (daily data)
- Last 30 days (weekly data)
- This month
- Last month
- Custom range with calendar picker

## View Toggles on Leads Page

The leads page includes three filter toggles:

| Toggle | Default | When Active | Stages Affected |
|--------|---------|-------------|-----------------|
| **Show On Hold** | Off | Shows paused leads | `on_hold` |
| **Show Converted** | Off | Shows won deals | `converted` |
| **Show Archived** | Off | Shows closed/lost leads | `not_interested`, `no_response`, `not_qualified` |

**Behavior**:
- Hidden leads still count in stats and appear in Chart view
- Toggles only affect Table and Board views
- Converted toggle is green when active, positioned between On Hold and Archived

### Stage Filtering Logic

```javascript
const tableLeads = leads.filter(l => {
  if (archivedStages.includes(l.stage) && !showArchived) return false;
  if (l.stage === "on_hold" && !showOnHold) return false;
  if (l.stage === "converted" && !showConverted) return false;
  return true;
});
```

## Extended Database Schema

### leads (additional columns)

| Column | Type | Description |
|--------|------|-------------|
| instagram_id | TEXT | Instagram user ID (for DM tracking) |
| facebook_id | TEXT | Facebook user ID (for Messenger tracking) |
| meta_lead_id | TEXT | Meta Lead Ads lead ID |

## Recent Updates Log

### December 2024

1. **Instagram DM Integration**
   - Added webhook handler for Instagram messages
   - Auto-creates leads from new DM senders
   - Auto-advances leads to "interested" when they respond via DM
   - Added `instagram_id` and `facebook_id` columns to leads table

2. **Chart Color Update**
   - Lead Growth Trend now shows both Leads (blue) and Conversions (green)
   - Added legend to distinguish data series

3. **Show Converted Toggle**
   - Added "Show Converted" button between On Hold and Archived toggles
   - Converted leads hidden from table/board by default
   - Still counted in all statistics

4. **On Hold Stage**
   - Added `on_hold` stage for temporarily paused leads
   - Separate toggle from archived leads
   - Not auto-archived when selected

5. **Stage Updates**
   - Added `no_response` stage for leads who never replied
   - Added `not_qualified` stage for leads who don't meet criteria
   - These stages auto-archive when set

## License

Copyright 2025 Seam Media. All rights reserved.
