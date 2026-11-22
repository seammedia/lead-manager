// Website offer reply wording and rules (pure, so `npm test` can load it). Sending lives in websiteOffer.ts.

import type { InstantLeadForm } from "./form";
import type { GuideQualifier } from "./guide";
import { businessPhrase, firstName } from "./leadName";

export const WEBSITE_OFFER_URL = "https://www.seammedia.com.au/website-offer";
export const WEBSITE_OFFER_SUBJECT = "Your new website, free until it works";
const WALK_AWAY_DAYS = 60;

// Top budget band on the seammedia.com.au forms (lib/lead-qualify.ts BUDGETS): "$2,500+ a month".
// 23 Nov 2026: a lead on this band with no Google profile got the automatic decline and turned out to be a real
// NDIS allied-health provider. A top-band lead is never auto-declined or auto-sent: the reply is held as a draft
// and Heath is alerted to handle it by hand, whatever the Google profile or industry answer.
export const HIGH_BUDGET_BAND = "$2,500+ a month";
export const isHighBudget = (budget: string | null | undefined) => !!budget && /\$\s*2,?500\s*\+/.test(budget);
export const HIGH_BUDGET_FLAG = "HIGH BUDGET - check by hand";

export function websiteOfferMessages(form: InstantLeadForm, qual: GuideQualifier) {
  const first = firstName(form);
  const callOk = qual.qualified !== false;
  const fewReviews = !!qual.reviews && !/10 or more/i.test(qual.reviews);
  const ecommerce = qual.industry === "Ecommerce and retail";
  const high = isHighBudget(qual.budget);
  const lines = [
    `Hi ${first || "there"},`,
    "",
    `Thanks for asking about a new website${businessPhrase(form)}.`,
    "",
  ];
  if ((fewReviews || ecommerce) && high) {
    // Not eligible for the offer as asked, but too promising to turn away: no decline, Heath reviews this draft
    lines.push(
      "I'd like to hear a bit more about your business and what you're after, so I'll give you a quick call within one business day. If there's a better time, or you'd rather sort it by email, just reply and let me know.",
    );
  } else if (fewReviews || ecommerce) {
    lines.push(
      fewReviews
        ? "This offer is for established businesses with a Google Business Profile with 10 or more reviews, so it's not one I can do for you just yet."
        : "This offer is for trades and local service businesses rather than online stores, so it's not one I can do for you.",
      "",
      "If you'd like to talk about other ways I can help, just reply to this email.",
    );
  } else {
    lines.push(
      "Here's how it works. I build your website in 7 days at no cost. You only start paying once it's brought you 3 real enquiries. If it doesn't, you don't pay a cent.",
      "",
      "What you get:",
      "",
      "- A website built for your business, set up so you show up on Google",
      "- Missed calls get an automatic text back, so the job doesn't go to the next number on the list",
      "- Every form enquiry gets an instant reply",
      "- Every enquiry (calls, texts, forms and missed calls) is sent to your phone by SMS",
      "",
      "A real enquiry is a form submission, a call or a missed call from a new potential customer through your website. Spam, existing customers and suppliers don't count.",
      "",
      `After the 3rd real enquiry it's $99 a week + GST, month to month, with no setup fee and no lock-in. If it hasn't brought 3 real enquiries within ${WALK_AWAY_DAYS} days, you can walk away owing nothing. I host and manage the website, and I do the work myself, here in Australia.`,
      "",
      "All the details are here:",
      WEBSITE_OFFER_URL,
      "",
      callOk
        ? "I'll give you a quick call within one business day to ask about your business and the work you want more of. If there's a better time, or you'd rather sort it by email, just reply and let me know."
        : "If you'd like to go ahead, or have any questions, just reply to this email.",
    );
  }
  lines.push("", "Thanks,", "Heath");
  return { subject: WEBSITE_OFFER_SUBJECT, email: lines.join("\n") };
}

// Whether the reply may go out without Heath (auto mode only). Top-band leads are always held as a draft.
export const websiteOfferAutoSend = (mode: string, qual: GuideQualifier) => mode === "auto" && !isHighBudget(qual.budget);

// The alert to Heath (text, or the email subject "Lead alert: ..." when Twilio isn't set)
export function websiteOfferAlert(qual: GuideQualifier, who: string, callLine: string, sent: string) {
  const callOk = qual.qualified !== false;
  if (isHighBudget(qual.budget)) {
    const fit = callOk ? "eligible for the offer" : "NOT eligible for the offer as asked (Google reviews or e-commerce), so no decline was sent";
    return `${HIGH_BUDGET_FLAG}: website offer lead on ${qual.budget}, ${fit}. Handle personally: ${who}. ${callLine}. ${sent}, not sent.`;
  }
  return `Website offer lead, ${callOk ? "call them" : "email only, DON'T CALL"}: ${who}. ${callLine}. ${sent}.`;
}
