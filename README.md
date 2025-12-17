# Seam Media Lead Manager

A comprehensive CRM and lead management platform for Seam Media, featuring Gmail integration, AI-powered email drafting with OpenAI, Zapier webhook integration for Meta Lead Ads, real-time statistics, and a full-featured inbox with email threading.

## Features

- **Lead Management** - Track leads through stages (New, Contacted 1, Interested, Contacted 2, Not Interested, Converted)
- **Multiple Views** - Table view, Kanban board, and Chart view for visualizing leads
- **Gmail Integration** - Full inbox with compose, reply, archive, delete, star, and email thread viewing
- **AI Email Drafting** - Generate professional email responses using OpenAI GPT-4o-mini with custom prompts
- **Business Context for AI** - Configure business notes and documents for AI to reference
- **Next Action Tracking** - Quick notes field for tracking next steps per lead
- **Zapier Webhook** - Automatically import leads from Meta/Facebook Lead Ads
- **Real-time Statistics** - Dashboard with live stats from database (leads, conversions, revenue, emails sent)
- **Revenue Tracking** - Track revenue per converted lead with source attribution
- **Top Opportunities** - Dashboard showing highest-value leads by conversion probability
- **Archive System** - Archive old leads without deleting them
- **Email Logging** - All sent emails are logged for statistics tracking

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Email**: Gmail API with OAuth 2.0
- **AI**: OpenAI API (GPT-4o-mini)
- **Charts**: Recharts
- **Deployment**: Vercel
- **Icons**: Lucide React

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

#### Migration 2: Email Logs Table (for tracking sent emails)
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_logs_lead_id ON email_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
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

-- Enable RLS
ALTER TABLE business_context ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
CREATE POLICY "Service role can manage business_context" ON business_context
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

#### Gmail OAuth Setup

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

**Note**: The application uses the `gpt-4o-mini` model for cost-effective, fast responses.

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
| `WEBHOOK_API_KEY` | No | Optional webhook authentication |

## API Routes

### Leads

| Route | Method | Description |
|-------|--------|-------------|
| `/api/leads` | GET | Fetch all leads (query: `?archived=true/false`) |
| `/api/leads` | POST | Create a new lead |
| `/api/leads/[id]` | GET | Get a single lead |
| `/api/leads/[id]` | PATCH | Update a lead |
| `/api/leads/[id]` | DELETE | Delete a lead |
| `/api/leads/webhook` | POST | Zapier webhook endpoint |
| `/api/leads/migrate-stages` | POST | Migrate old stages to new format |

### Gmail

| Route | Method | Description |
|-------|--------|-------------|
| `/api/gmail/auth` | GET | Get OAuth authorization URL |
| `/api/gmail/callback` | GET | OAuth callback handler |
| `/api/gmail/status` | GET | Check Gmail connection status |
| `/api/gmail/disconnect` | POST | Disconnect Gmail |
| `/api/gmail/emails` | GET | Fetch emails (query: `?maxResults=20&labelIds=INBOX`) |
| `/api/gmail/send` | POST | Send or reply to email (also logs to database) |
| `/api/gmail/thread` | GET | Fetch full email thread |
| `/api/gmail/actions` | POST | Archive, trash, star, mark read/unread |

### AI & Stats

| Route | Method | Description |
|-------|--------|-------------|
| `/api/ai/draft` | POST | Generate AI email draft with custom prompt support |
| `/api/settings/business-context` | GET/POST | Get/save business context for AI |
| `/api/stats` | GET | Get real-time statistics (query: `?days=30`) |

## Lead Stages

The application uses 6 lead stages:

| Stage | Description | Color |
|-------|-------------|-------|
| `new` | Fresh lead, not yet contacted | Blue |
| `contacted_1` | First contact made | Yellow |
| `interested` | Lead has shown interest | Green |
| `contacted_2` | Follow-up contact made | Orange |
| `not_interested` | Lead declined | Red |
| `converted` | Successfully closed deal | Emerald |

### Stage Priority (for sorting)
Leads are sorted by stage priority (highest first):
1. Converted (6)
2. Not Interested (5)
3. Contacted 2 (4)
4. Interested (3)
5. Contacted 1 (2)
6. New (1)

## Lead Sources

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

## Features in Detail

### Lead Views

1. **Table View** - Full-featured table with:
   - Sortable columns (click headers)
   - Inline editing for stage, owner, source, next action
   - Color-coded last contacted time (green < 1 day, orange 2-3 days, red 4+ days)
   - Search functionality
   - Pagination

2. **Board View** - Kanban-style pipeline with drag-and-drop

3. **Chart View** - Horizontal bar chart showing leads count by stage

### Next Action Field

Quick notes field for tracking next steps:
- Click "Add action..." to add a note
- Examples: "Send SEO details", "Schedule call", "Follow up Monday"
- Inline editable in table view
- Also editable in lead modal

### AI Email Drafting

The AI assistant uses OpenAI GPT-4o-mini to draft email responses:

1. **Reply Types**: Professional, Friendly, Brief
2. **Custom Prompts**: Add specific instructions for the AI
3. **Business Context**: References your configured business info
4. **Sign-off**: All emails signed with "Thanks,\n\nHeath"

To configure business context:
1. Go to **Settings** > **AI Assistant**
2. Add business notes (company info, services, pricing, tone preferences)
3. Upload reference documents (TXT, MD, CSV, JSON)
4. Click **Save Changes**

### Email Threading

- Click an email to view the full thread
- All messages in the conversation are displayed
- Reply continues the thread
- Thread view shows sender, timestamp, and full content

### Statistics Dashboard

Real-time stats pulled from database:
- **Total Leads**: Count of all leads (including archived)
- **Emails Sent**: Count from email_logs table
- **Conversions**: All leads with stage "converted"
- **Conv Rate**: Conversions / Total Leads
- **Revenue**: Total, by period, average deal size, by source
- **Charts**: Leads by source, Conversions by source, Revenue by source

### Last Contacted Indicator

Color-coded relative time:
- **Green**: Contacted within last 24 hours
- **Orange**: Contacted 2-3 days ago
- **Red**: Contacted 4+ days ago or never

## Troubleshooting

### Gmail Issues

**"Insufficient authentication scopes" error when archiving:**
- Disconnect and reconnect Gmail to get the `gmail.modify` scope
- Click "Disconnect" in Gmail Status, then "Connect Gmail" again

**Emails not showing:**
- Enable the Gmail API in Google Cloud Console
- Check that OAuth credentials are correct
- Verify the redirect URI matches exactly

**Thread messages not showing content:**
- Email body extraction handles multiple formats (text/plain, text/html, nested parts)
- If still missing, check browser console for errors

### OpenAI Issues

**"401 Unauthorized" error:**
- Verify OPENAI_API_KEY is set correctly in Vercel
- Check the key starts with `sk-`
- Ensure the key has not been revoked

**"Failed to generate response" error:**
- Verify OPENAI_API_KEY is set in Vercel environment variables
- Redeploy after adding environment variables
- Check OpenAI account has available credits

### Supabase Issues

**"Column does not exist" errors:**
- Run all SQL migrations in Supabase SQL Editor
- Common missing columns: `next_action`, `revenue`

**Updates not saving:**
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set (not just the anon key)
- The service role key is needed for server-side operations

**Leads not showing:**
- Check RLS policies are created
- Verify service role key is correct

### Stats Issues

**Emails Sent showing 0:**
- Emails are logged when sent via the Gmail send API
- Check email_logs table exists in Supabase

**Conversions not updating:**
- Conversions count ALL leads with stage "converted"
- Not filtered by date range

### Build/Deploy Issues

**TypeScript errors about missing properties:**
- Ensure all mock data includes new fields (like `next_action`)
- Run `npm run build` locally to check for errors before deploying

## Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/seam-media-lead-manager.git
   cd seam-media-lead-manager
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/callback
   OPENAI_API_KEY=sk-your_openai_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── ai/
│   │   │   └── draft/              # AI email drafting (OpenAI)
│   │   ├── gmail/
│   │   │   ├── auth/               # Gmail OAuth
│   │   │   ├── callback/           # OAuth callback
│   │   │   ├── emails/             # Fetch emails
│   │   │   ├── send/               # Send emails + log to DB
│   │   │   ├── thread/             # Fetch email threads
│   │   │   ├── actions/            # Archive, trash, star
│   │   │   ├── status/             # Connection status
│   │   │   └── disconnect/         # Disconnect Gmail
│   │   ├── leads/
│   │   │   ├── [id]/               # Single lead CRUD
│   │   │   ├── webhook/            # Zapier webhook
│   │   │   └── migrate-stages/     # Stage migration utility
│   │   ├── settings/
│   │   │   └── business-context/   # AI business context
│   │   └── stats/                  # Real-time statistics API
│   ├── dashboard/                  # Main dashboard
│   ├── inbox/                      # Gmail inbox with threading
│   ├── leads/                      # Leads management (table/board/chart)
│   ├── settings/                   # App settings
│   └── stats/                      # Statistics page
├── components/
│   ├── leads/
│   │   ├── LeadsTable.tsx          # Table view with inline editing
│   │   ├── KanbanBoard.tsx         # Kanban pipeline view
│   │   ├── StageChart.tsx          # Bar chart by stage
│   │   ├── LeadModal.tsx           # Add/edit lead modal
│   │   ├── LeadStageTag.tsx        # Stage dropdown
│   │   └── TopOpportunities.tsx    # Top leads widget
│   ├── stats/
│   │   ├── StatCard.tsx            # Stat display card
│   │   ├── SourceChart.tsx         # Pie chart by source
│   │   └── RevenueSourceChart.tsx  # Revenue breakdown chart
│   └── AppLayout.tsx               # Main layout
├── lib/
│   ├── gmail.ts                    # Gmail API functions
│   ├── supabase.ts                 # Supabase client
│   ├── auth-cookies.ts             # Cookie management
│   ├── utils.ts                    # Utility functions (formatRelativeTime, etc.)
│   └── mockData.ts                 # Helper functions
└── types/
    └── index.ts                    # TypeScript interfaces
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
| stage | TEXT | Lead stage |
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

### business_context
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | TEXT | User identifier |
| notes | TEXT | Business context notes |
| attachments | JSONB | Uploaded documents |

## Deployment Checklist

- [ ] All environment variables set in Vercel
- [ ] Supabase migrations run (leads, email_logs, business_context tables)
- [ ] Gmail OAuth redirect URI matches Vercel domain
- [ ] OpenAI API key is valid and has credits
- [ ] Test lead creation
- [ ] Test Gmail connection
- [ ] Test AI draft generation
- [ ] Test email sending (check email_logs table)

## License

Copyright 2025 Seam Media. All rights reserved.
