// npm test: quick job reply rules (no network, no database). Fictional test data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/lib/leadSms/engine";
import { normaliseLeadPayload } from "../src/lib/instant/form";
import {
  FINANCE_FLAG, QUICK_JOBS, isQuickJobLead, looksLikeFinanceBroker, quickJobAlert, quickJobAutoSend, quickJobCallOk,
  quickJobMessages, quickJobNextAction, quickJobNote, readQuickJob,
} from "../src/lib/instant/quickJobCopy";
import { blankLead, memoryStore, mockLine } from "./memoryStore";

const body = (over: Record<string, unknown> = {}) => ({
  offer: "quick-job", name: "Jane Example", company: "Banksia Bay Plumbing", email: "jane@example.com", phone_number: "0412 555 019",
  job: "website", budget: "$1,500-$3,000", timing: "This month", website: "banksiabay.example", details: "Old site, needs redoing", ...over,
});
const setup = (over: Record<string, unknown> = {}) => { const b = body(over); return { form: normaliseLeadPayload(b), q: readQuickJob(b) }; };

test("reply: thanks, the job, the from price, one business day, sign-off, and nothing else on price", () => {
  const prices: Record<string, string | null> = { website: "$1,490", shopify: "$1,490", crm: "$690", small: "$290", other: null };
  assert.deepEqual(Object.keys(QUICK_JOBS).sort(), Object.keys(prices).sort());
  for (const [job, price] of Object.entries(prices)) {
    const { form, q } = setup({ job });
    const { email } = quickJobMessages(form, q);
    assert.ok(email.startsWith("Hi Jane,\n"));
    assert.ok(email.includes(`You asked about ${QUICK_JOBS[job].ask} for Banksia Bay Plumbing.`));
    assert.match(email, /within one business day, with a fixed price or a question/);
    assert.ok(email.endsWith("Thanks,\nHeath"));
    assert.deepEqual(email.match(/\$[\d,]+/g), price ? [price] : null, job);
    if (price) assert.ok(email.includes(`${price} + GST`));
    assert.doesNotMatch(email, /month to month|lock-in|package|a week|guide|guarantee|call you|\bwe\b|\bour\b|team|agency|—|–/i);
  }
});

test("the reply never echoes what they typed in the details or link", () => {
  const { form, q } = setup({ details: "BUY NOW http://spam.example", website: "spam.example" });
  assert.doesNotMatch(quickJobMessages(form, q).email, /spam|BUY/);
});

test("only Under $300 is email only", () => {
  for (const budget of ["$300-$700", "$700-$1,500", "$1,500-$3,000", "$3,000+", "Not sure"]) {
    const { form, q } = setup({ budget });
    assert.ok(quickJobCallOk(q), budget);
    assert.doesNotMatch(quickJobNote(q, false) + quickJobAlert(q, form, null, "Reply emailed", false), /DON'T CALL/);
  }
  const { form, q } = setup({ budget: "Under $300" });
  assert.ok(!quickJobCallOk(q));
  assert.match(quickJobAlert(q, form, null, "Reply emailed", false), /^Quick job lead, email only, DON'T CALL: /);
  assert.match(quickJobNote(q, false), /DON'T CALL \(budget under \$300\)/);
  assert.match(quickJobNextAction(q, false)!, /^Don't call/);
  assert.ok(quickJobMessages(form, q).email.includes("$1,490 + GST"), "still gets the email");
  assert.ok(quickJobAutoSend("auto", false));
});

test("alert has the job, budget, timing, link and details", () => {
  const { form, q } = setup();
  const a = quickJobAlert(q, form, "OJ1", "Reply emailed", false);
  for (const s of ["Website redesign", "Budget: $1,500-$3,000", "Timing: This month", "Link: banksiabay.example", "Details: Old site, needs redoing", "0412 555 019", "jane@example.com", "Ad: OJ1", "finance or mortgage broker"]) assert.ok(a.includes(s), s);
});

test("finance and mortgage brokers are flagged and the reply is held", () => {
  for (const over of [{ company: "Example Mortgage Choice" }, { company: "Example Finance Group" }, { website: "examplehomeloans.example" }, { email: "jane@examplefinance.example" }, { details: "I'm a mortgage broker and need a site" }]) {
    const { form, q } = setup(over);
    assert.ok(looksLikeFinanceBroker(form, q), JSON.stringify(over));
  }
  const { form, q } = setup({ details: "The finance page on our website is broken" });
  assert.ok(!looksLikeFinanceBroker(form, q));
  assert.ok(!quickJobAutoSend("auto", true));
  assert.ok(!quickJobAutoSend("draft", false));
  assert.ok(quickJobAlert(q, form, null, "Reply is in Drafts, not sent", true).startsWith(FINANCE_FLAG));
  assert.match(quickJobNextAction(q, true)!, /held as a Gmail draft/);
});

test("odd input: unknown job is Something else, pipes and newlines can't break the notes", () => {
  assert.equal(setup({ job: "constructor" }).q.job, "other");
  const { q } = setup({ details: "one | two\nthree" });
  assert.equal(q.details, "one / two three");
});

test("quick job leads are recognised in notes, on new and existing leads", () => {
  const { q } = setup();
  const note = quickJobNote(q, false);
  assert.ok(isQuickJobLead(note));
  assert.ok(isQuickJobLead(`Asked for the social media guide | Budget: Not sure | ${note}`));
  assert.ok(!isQuickJobLead("Asked for the social media guide"));
  assert.ok(!isQuickJobLead(null));
});

test("lead texts: a quick job lead is never queued, and an earlier guide lead's texts stop", async () => {
  const clock = new Date("2026-11-25T10:00:00+11:00");
  const db = memoryStore(() => clock);
  db.settings.lead_sms_mode = "live";
  const tel = mockLine();
  const engine = createEngine({ store: db.store, line: tel.line, now: () => clock, linkBase: "https://leads.test", bookingUrl: async () => null, fallbackAlert: async () => {}, random: (n) => new Uint8Array(n) });
  const note = quickJobNote(setup({ details: "redo the social media guide on my site" }).q, false);
  db.leads.set("Q1", blankLead({ id: "Q1", notes: note }));
  assert.equal((await engine.queueLead("Q1")).ok, false);
  db.leads.set("Q2", blankLead({ id: "Q2", notes: `Asked for the social media guide | ${note}`, sms_state: "queued", sms_phone: "+61412555019", sms_due_at: clock.toISOString() }));
  await engine.runDue();
  assert.equal(tel.sends.length, 0);
});
