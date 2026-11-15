# Changelog

Dated record of lead manager changes, newest first. README.md holds the current state.

## 16 November 2026 - Lead texting (branch `lead-sms`, off by default)

- Heath approved texting Seam's own new leads from the lead line (+61 468 171 514, the former Point Cook Physio number), sent through TendCall's `/api/seam-lead-line`. See README "Lead texting".
- New `src/lib/leadSms/`: rules (quiet hours, AU mobiles, budget, one-segment texts), engine (queue, 2-text cap, day 1 alert to Heath, day 3 final text, replies, STOP, calls, clicks, bookings, Twilio prices), Supabase store and the TendCall client.
- Texts trimmed to one SMS segment each (Heath, 16 Nov, watching Twilio spend). Twilio's price is logged on every text and alert, and the Stats page shows the monthly cost. Auto-Recharge stays off by Heath's choice.
- The old guide-lead SMS in `processGuideLead` (auto mode only, needed Twilio env this app never had) is removed, so a lead can't get two first texts. The Smart Website one is unchanged and still dormant.
- Routes `/api/cron/lead-sms` (every 10 minutes), `/api/lead-sms/events`, `/api/lead-sms/cost`, `/api/leads/[id]/sms`, `/b/[token]`. A Texts panel on the lead and a cost card on Stats. Migration `013_lead_sms.sql`.
- Tests: `npm test`, 20 passing (rules, plus end-to-end dry runs with the line mocked). `next build --webpack` passes.
