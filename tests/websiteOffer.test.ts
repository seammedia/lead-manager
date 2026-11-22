// npm test: website offer reply rules (no network, no database). Fictional test data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { InstantLeadForm } from "../src/lib/instant/form";
import type { GuideQualifier } from "../src/lib/instant/guide";
import { businessIsPersonName, businessName, businessPhrase } from "../src/lib/instant/leadName";
import {
  FINANCE_CHECK, HIGH_BUDGET_FLAG, WEBSITE_OFFER_URL, isHighBudget, websiteOfferAlert, websiteOfferAutoSend, websiteOfferMessages,
} from "../src/lib/instant/websiteOfferCopy";

const form = (name: string, company: string): InstantLeadForm => ({
  name, company, email: "test.lead@example.com", phone: null, website: null, socialLinks: [], trade: "", helpWith: [], helpWithRaw: "",
  platform: null, adName: null, adsetName: null, campaignName: null, formName: null, metaLeadId: null, createdTime: null,
  previouslyEmailed: false, businessCandidates: [], emailDomain: null,
});
const qual = (budget: string, reviews: string, industry = "Trades and home services", qualified = false): GuideQualifier => ({ budget, reviews, industry, qualified });

const DECLINE = /not one I can do for you/;

test("budget bands: only the top band ($2,500+ a month) is high budget", () => {
  assert.ok(isHighBudget("$2,500+ a month"));
  assert.ok(isHighBudget("$2500+ a month"));
  for (const b of ["$1,000 to $2,500 a month", "$500 to $1,000 a month", "$250 to $500 a month", "Under $250 a month", "Just looking for now", "", null, undefined]) {
    assert.ok(!isHighBudget(b), String(b));
  }
});

test("high budget, no Google profile: no decline, a call line instead, never auto-sent", () => {
  const q = qual("$2,500+ a month", "No Google Business Profile", "Hospitality and food");
  const { subject, email } = websiteOfferMessages(form("Jane Example", "Example Allied Health"), q);
  assert.equal(subject, "Your new website, free until it works");
  assert.doesNotMatch(email, DECLINE);
  assert.match(email, /quick call within one business day/);
  assert.match(email, /new website for Example Allied Health\./);
  assert.ok(!websiteOfferAutoSend("auto", q));
  assert.ok(!websiteOfferAutoSend("draft", q));
});

test("high budget, e-commerce or under 10 reviews: also held, not declined", () => {
  for (const q of [qual("$2,500+ a month", "10 or more Google reviews", "Ecommerce and retail"), qual("$2,500+ a month", "Under 10 Google reviews")]) {
    assert.doesNotMatch(websiteOfferMessages(form("Jane Example", "Example Co"), q).email, DECLINE);
    assert.ok(!websiteOfferAutoSend("auto", q));
  }
});

test("high budget and eligible: the normal offer email, but still held as a draft", () => {
  const q = qual("$2,500+ a month", "10 or more Google reviews", "Trades and home services", true);
  const { email } = websiteOfferMessages(form("Jane Example", "Example Plumbing"), q);
  assert.ok(email.includes(WEBSITE_OFFER_URL));
  assert.match(email, /quick call within one business day/);
  assert.ok(!websiteOfferAutoSend("auto", q));
});

test("high budget alert is flagged HIGH BUDGET - check by hand, never DON'T CALL", () => {
  const a = websiteOfferAlert(qual("$2,500+ a month", "No Google Business Profile"), "Jane Example, Example Co", "no number | test.lead@example.com", "Reply is in Drafts");
  assert.ok(a.startsWith(`${HIGH_BUDGET_FLAG}:`));
  assert.equal(HIGH_BUDGET_FLAG, "HIGH BUDGET - check by hand");
  assert.doesNotMatch(a, /DON'T CALL/);
  assert.match(a, /Reply is in Drafts, not sent\./);
});

test("high budget alert: eligibility comes from reviews and industry, not qualified = yes; finance broker reminder", () => {
  // The website sends top-band website offer leads as qualified = yes since 23 Nov 2026
  const noProfile = websiteOfferAlert(qual("$2,500+ a month", "No Google Business Profile", "Hospitality and food", true), "Jane Example, Example Co", "x", "Reply is in Drafts");
  assert.ok(noProfile.startsWith("HIGH BUDGET - check by hand:"));
  assert.match(noProfile, /not eligible for the free website offer \(No Google Business Profile\)/);
  assert.ok(noProfile.includes(FINANCE_CHECK));
  assert.match(FINANCE_CHECK, /finance or mortgage broker/);
  const ecom = websiteOfferAlert(qual("$2,500+ a month", "10 or more Google reviews", "Ecommerce and retail", true), "J", "x", "Reply is in Drafts");
  assert.match(ecom, /not eligible for the free website offer \(e-commerce\)/);
  const fit = websiteOfferAlert(qual("$2,500+ a month", "10 or more Google reviews", "NDIS and allied health", true), "J", "x", "Reply is in Drafts");
  assert.match(fit, /, eligible for the free website offer\./);
  assert.ok(fit.includes(FINANCE_CHECK));
  // The reply still has no decline, and is still held, when qualified = yes
  const q = qual("$2,500+ a month", "No Google Business Profile", "Hospitality and food", true);
  assert.doesNotMatch(websiteOfferMessages(form("Jane Example", "Example Co"), q).email, DECLINE);
  assert.ok(!websiteOfferAutoSend("auto", q));
});

test("other budgets: unchanged (decline when ineligible, auto-send in auto mode, DON'T CALL alert)", () => {
  for (const budget of ["$1,000 to $2,500 a month", "$500 to $1,000 a month"]) {
    const q = qual(budget, "No Google Business Profile");
    const { email } = websiteOfferMessages(form("Jane Example", "Example Co"), q);
    assert.match(email, /Google Business Profile with 10 or more reviews, so it's not one I can do for you just yet\./);
    assert.ok(websiteOfferAutoSend("auto", q));
    assert.ok(!websiteOfferAutoSend("draft", q));
    assert.equal(websiteOfferAlert(q, "Jane Example, Example Co", "x", "Reply emailed"), "Website offer lead, email only, DON'T CALL: Jane Example, Example Co. x. Reply emailed.");
  }
  const ecom = websiteOfferMessages(form("Jane Example", "Example Store"), qual("$500 to $1,000 a month", "10 or more Google reviews", "Ecommerce and retail"));
  assert.match(ecom.email, /rather than online stores/);
  const ok = qual("$500 to $1,000 a month", "10 or more Google reviews", "Trades and home services", true);
  assert.equal(websiteOfferAlert(ok, "J", "x", "Reply is in Drafts"), "Website offer lead, call them: J. x. Reply is in Drafts.");
});

test("business name guard: the lead's own name is never printed as the business", () => {
  assert.ok(businessIsPersonName(form("Jane", "Jane")));
  assert.ok(businessIsPersonName(form("Jane Example", "jane")));
  assert.ok(businessIsPersonName(form("Jane Example", "JANE EXAMPLE")));
  assert.ok(businessIsPersonName(form("jane example", "Example")));
  assert.ok(!businessIsPersonName(form("Jane Example", "Example Plumbing")));
  assert.ok(!businessIsPersonName(form("Jane Example", "")));
  assert.ok(!businessIsPersonName(form("", "Example Plumbing")));
  assert.equal(businessName(form("Jane", "Jane")), "");
  assert.equal(businessPhrase(form("Jane", "Jane")), " for your business");
  assert.equal(businessPhrase(form("Jane", "Jane"), "at"), " at your business");
  assert.equal(businessPhrase(form("Jane", "Example Plumbing")), " for Example Plumbing");
  assert.equal(businessPhrase(form("Jane", "")), "");

  const { email } = websiteOfferMessages(form("Jane", "Jane"), qual("$2,500+ a month", "No Google Business Profile"));
  assert.match(email, /^Hi Jane,\n\nThanks for asking about a new website for your business\./);
  assert.doesNotMatch(email, /website for Jane/);
});
