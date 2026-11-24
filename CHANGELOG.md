# Changelog

Dated record of lead manager changes, newest first. README.md holds the current state.

## 2026-11-25 - Quick job offer (branch `odd-jobs`, not deployed)

- New offer `quick-job` on `/api/leads/guide`: its own reply (the "from" price for the job only, a fixed price or a question within one business day) and an alert to Heath with job, budget, timing, link and details. Under $300 is email only. Possible finance or mortgage brokers are flagged and the reply is held as a draft.
- No lead text, and the 48-hour guide follow-up skips any lead with a quick job in its notes (also when the same person asked for a guide earlier). `instant_flow` is set, so the 24-hour follow-up skips them too.
- A guide download in the last 30 minutes doesn't swallow a quick job; a second, different job alerts Heath without a second email.
- Wording and rules in `src/lib/instant/quickJobCopy.ts`, tests in `tests/quickJob.test.ts` (`npm test`, 36 passing).

## 2026-11-23 (security: leads table closed to the public key)

- Found while checking the uncommitted March RLS work: the leads policy "Allow all for authenticated users" applied to every role with USING (true), so the public anon key could read, change and delete all leads (1,916 rows were visible to it in a read-only count test).
- Dropped the policy in production (migration 014). Re-tested with the anon key: leads, activities, email_logs, users, business_context, lead_sms_events and sms_optouts all return 0 rows. The app only uses the service role for leads, so nothing changes for it.
- Committed the March work that was already applied in production but never committed: migration 009 (settings and business_context locked) and its README notes.

## 23 November 2026 - Website offer: top-budget leads held for Heath, business-name guard

- Why: a website offer lead on the top budget band with no Google profile was marked "email only, DON'T CALL" and auto-sent the decline. The business was a real NDIS allied-health provider. The reply also thanked her for asking about a website "for" her own first name, typed in the business name field.
- Top budget band ("$2,500+ a month", the site's `BUDGETS`) is never auto-sent or auto-declined, whatever the Google profile or industry answer. The reply is held as a Gmail draft (no decline paragraph when they're not eligible, a call line instead), the alert to Heath starts "HIGH BUDGET - check by hand", and the lead's note and next action say the same instead of DON'T CALL. The alert's eligibility wording ("eligible" or "not eligible for the free website offer") comes from the raw Google reviews and industry answers, not `qualified`, and it reminds Heath to check the business isn't a finance or mortgage broker (Seam doesn't take those, and the form has no finance option). "$1,000 to $2,500 a month" and below are unchanged.
- Business-name guard: when the business name is the lead's own first, last or full name (any case), the instant reply templates (website offer, Smart Website, social media manager, guides) say "your business" instead of printing it.
- New pure modules `src/lib/instant/leadName.ts` and `src/lib/instant/websiteOfferCopy.ts` so the wording can be tested. Tests: `npm test`, 28 passing (8 new in `tests/websiteOffer.test.ts`). `next build --webpack` passes.
- Website side (seammedia commit c54e0b4): top-band website offer leads now arrive as `qualified: yes`, so the lead manager no longer relies on `qualified` for them.

## 16 November 2026 - Lead texting (branch `lead-sms`, off by default)

- Heath approved texting Seam's own new leads from the lead line (+61 468 171 514, the former Point Cook Physio number), sent through TendCall's `/api/seam-lead-line`. See README "Lead texting".
- New `src/lib/leadSms/`: rules (quiet hours, AU mobiles, budget, one-segment texts), engine (queue, 2-text cap, day 1 alert to Heath, day 3 final text, replies, STOP, calls, clicks, bookings, Twilio prices), Supabase store and the TendCall client.
- Texts trimmed to one SMS segment each (Heath, 16 Nov, watching Twilio spend). Twilio's price is logged on every text and alert, and the Stats page shows the monthly cost. Auto-Recharge stays off by Heath's choice.
- The old guide-lead SMS in `processGuideLead` (auto mode only, needed Twilio env this app never had) is removed, so a lead can't get two first texts. The Smart Website one is unchanged and still dormant.
- Routes `/api/cron/lead-sms` (every 10 minutes), `/api/lead-sms/events`, `/api/lead-sms/cost`, `/api/leads/[id]/sms`, `/b/[token]`. A Texts panel on the lead and a cost card on Stats. Migration `013_lead_sms.sql`.
- Tests: `npm test`, 20 passing (rules, plus end-to-end dry runs with the line mocked). `next build --webpack` passes.
