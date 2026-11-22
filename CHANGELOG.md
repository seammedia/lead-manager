# Changelog

Dated record of lead manager changes, newest first. README.md holds the current state.

## 23 November 2026 - Website offer: top-budget leads held for Heath, business-name guard

- Why: a website offer lead on the top budget band with no Google profile was marked "email only, DON'T CALL" and auto-sent the decline. The business was a real NDIS allied-health provider. The reply also thanked her for asking about a website "for" her own first name, typed in the business name field.
- Top budget band ("$2,500+ a month", the site's `BUDGETS`) is never auto-sent or auto-declined, whatever the Google profile or industry answer. The reply is held as a Gmail draft (no decline paragraph when they're not eligible, a call line instead), the alert to Heath starts "HIGH BUDGET - check by hand", and the lead's note and next action say the same instead of DON'T CALL. "$1,000 to $2,500 a month" and below are unchanged.
- Business-name guard: when the business name is the lead's own first, last or full name (any case), the instant reply templates (website offer, Smart Website, social media manager, guides) say "your business" instead of printing it.
- New pure modules `src/lib/instant/leadName.ts` and `src/lib/instant/websiteOfferCopy.ts` so the wording can be tested. Tests: `npm test`, 27 passing (7 new in `tests/websiteOffer.test.ts`). `next build --webpack` passes.
- Not changed: seammedia.com.au still sends these leads as `qualified: no` and doesn't fire the Meta Lead event for them (`lib/lead-qualify.ts` in the site repo).

## 16 November 2026 - Lead texting (branch `lead-sms`, off by default)

- Heath approved texting Seam's own new leads from the lead line (+61 468 171 514, the former Point Cook Physio number), sent through TendCall's `/api/seam-lead-line`. See README "Lead texting".
- New `src/lib/leadSms/`: rules (quiet hours, AU mobiles, budget, one-segment texts), engine (queue, 2-text cap, day 1 alert to Heath, day 3 final text, replies, STOP, calls, clicks, bookings, Twilio prices), Supabase store and the TendCall client.
- Texts trimmed to one SMS segment each (Heath, 16 Nov, watching Twilio spend). Twilio's price is logged on every text and alert, and the Stats page shows the monthly cost. Auto-Recharge stays off by Heath's choice.
- The old guide-lead SMS in `processGuideLead` (auto mode only, needed Twilio env this app never had) is removed, so a lead can't get two first texts. The Smart Website one is unchanged and still dormant.
- Routes `/api/cron/lead-sms` (every 10 minutes), `/api/lead-sms/events`, `/api/lead-sms/cost`, `/api/leads/[id]/sms`, `/b/[token]`. A Texts panel on the lead and a cost card on Stats. Migration `013_lead_sms.sql`.
- Tests: `npm test`, 20 passing (rules, plus end-to-end dry runs with the line mocked). `next build --webpack` passes.
