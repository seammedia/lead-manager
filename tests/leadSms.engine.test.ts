// npm test: end-to-end dry runs of the lead texting engine with an in-memory database and the TendCall
// line (Twilio) mocked. Clock times are Melbourne (AEDT, +11:00) unless marked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine, monthlyCost } from "../src/lib/leadSms/engine";
import { blankLead, memoryStore, mockLine } from "./memoryStore";

function setup(mode: "off" | "test" | "live", startIso: string, opts: { booking?: string | null } = {}) {
  const clock = { t: new Date(startIso) };
  const now = () => clock.t;
  const db = memoryStore(now);
  db.settings.lead_sms_mode = mode;
  const tel = mockLine();
  const fallback: string[] = [];
  let seed = 0;
  const engine = createEngine({
    store: db.store, line: tel.line, now, linkBase: "https://leads.test",
    bookingUrl: async () => opts.booking ?? null,
    fallbackAlert: async (m) => { fallback.push(m); },
    random: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 31 + 7) % 251)),
  });
  const at = (iso: string) => { clock.t = new Date(iso); };
  const toLead = () => tel.sends.filter((s) => s.to !== "owner");
  const toOwner = () => tel.sends.filter((s) => s.to === "owner");
  return { engine, db, tel, at, toLead, toOwner, fallback };
}

test("off (the default): nothing is queued or sent", async () => {
  const s = setup("off", "2026-11-17T10:00:00+11:00");
  s.db.leads.set("L1", blankLead({ id: "L1" }));
  const r = await s.engine.queueLead("L1");
  assert.equal(r.ok, false);
  assert.match(String(r.reason), /off/);
  await s.engine.runDue();
  assert.equal(s.tel.sends.length, 0);
  assert.equal(s.db.leads.get("L1")!.sms_state, null);
});

test("full lifecycle: evening lead queued to 8 am, tracked, day 1 alert, day 3 final text, cold, never a third", async () => {
  const s = setup("live", "2026-11-16T21:30:00+11:00", { booking: "https://calendar.app.google/example" });
  s.db.leads.set("L1", blankLead({ id: "L1", name: "Sam Taylor", company: "Taylor Psychology" }));

  const q = await s.engine.queueLead("L1");
  assert.equal(q.ok, true);
  assert.equal(q.due, new Date("2026-11-17T08:00:00+11:00").toISOString());
  assert.equal(s.toLead().length, 0, "nothing sent at 9:30 pm");

  s.at("2026-11-17T07:50:00+11:00"); await s.engine.runDue();
  assert.equal(s.toLead().length, 0, "still quiet at 7:50 am");

  s.at("2026-11-17T08:00:00+11:00"); const r1 = await s.engine.runDue();
  assert.equal(r1.firstSent, 1);
  const first = s.toLead()[0];
  assert.equal(first.to, "+61412345678");
  const token = s.db.leads.get("L1")!.sms_token!;
  assert.equal(first.body, `Hi Sam, Heath from Seam Media. Book a 15 min call about your ads: https://leads.test/b/${token} or reply with a time. Reply STOP to opt out`);
  assert.ok(first.body.length <= 160);

  // Twilio says delivered, with its price
  await s.engine.handleEvent({ type: "status", sid: first.sid, status: "sent" });
  await s.engine.handleEvent({ type: "status", sid: first.sid, status: "delivered", price: "-0.0515", price_unit: "USD", segments: 1 });
  await s.engine.handleEvent({ type: "status", sid: first.sid, status: "sent" }); // late, out of order: ignored
  assert.equal(s.db.leads.get("L1")!.sms_delivery, "delivered");
  assert.equal(s.db.events.find((e) => e.twilio_sid === first.sid && e.type === "sent")!.price, 0.0515);

  // Clicks: a link preview isn't counted, a person is, and a quick double tap counts once
  s.at("2026-11-17T08:05:00+11:00");
  const c0 = await s.engine.click(token, "facebookexternalhit/1.1");
  assert.equal(c0.counted, false);
  assert.equal(c0.url, "https://calendar.app.google/example");
  await s.engine.click(token, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile Safari");
  await s.engine.click(token, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile Safari");
  assert.equal(s.db.events.filter((e) => e.type === "clicked").length, 1);
  assert.ok(s.db.leads.get("L1")!.sms_clicked_at);
  assert.equal((await s.engine.click("nope000", "Mozilla/5.0 Safari")).url, "https://calendar.app.google/example");

  // Day 1, before 24 hours: no alert yet
  s.at("2026-11-18T07:59:00+11:00"); await s.engine.runDue();
  assert.equal(s.toOwner().length, 0);
  // 24 hours passed but 8 am isn't business hours; 9 am is
  s.at("2026-11-18T08:10:00+11:00"); await s.engine.runDue();
  assert.equal(s.toOwner().length, 0);
  s.at("2026-11-18T09:00:00+11:00"); const r2 = await s.engine.runDue();
  assert.equal(r2.alerts, 1);
  assert.match(s.toOwner()[0].body, /^Seam lead line: call Sam Taylor, Taylor Psychology today, 0412 345 678\. Guide lead, budget \$500 to \$1,000 a month\. No reply or booking since the text 8:00 am Tue 17 Nov\.$/);
  s.at("2026-11-18T09:10:00+11:00"); await s.engine.runDue();
  assert.equal(s.toOwner().length, 1, "only one alert");

  // Day 3: the final text, then cold
  s.at("2026-11-20T07:50:00+11:00"); await s.engine.runDue();
  assert.equal(s.toLead().length, 1, "72 hours not up and before 8 am");
  s.at("2026-11-20T08:00:00+11:00"); const r3 = await s.engine.runDue();
  assert.equal(r3.finalSent, 1);
  assert.equal(s.toLead()[1].body, `Hi Sam, Heath from Seam Media again. If a 15 min call would help, book here: https://leads.test/b/${token} If not, no worries. Reply STOP to opt out`);
  assert.equal(s.db.leads.get("L1")!.sms_state, "cold");
  assert.equal(s.db.leads.get("L1")!.sms_count, 2);

  // Never a third, whatever happens next
  s.at("2026-11-23T10:00:00+11:00"); await s.engine.runDue();
  s.db.leads.set("L1", { ...s.db.leads.get("L1")!, sms_state: "sent" }); // even if the state were wrong
  await s.engine.runDue();
  assert.equal((await s.engine.sendText("L1", "final")).sent, false);
  assert.equal(s.toLead().length, 2);
});

test("reply: stored, marked Replied, forwarded to Heath with name and business; no follow-ups", async () => {
  const s = setup("live", "2026-11-17T10:00:00+11:00");
  s.db.leads.set("L1", blankLead({ id: "L1", name: "Sam Taylor", company: "Taylor Psychology", phone: "0412-345-678" }));
  await s.engine.queueLead("L1");
  assert.equal(s.toLead().length, 1, "sent straight away in the day");

  s.at("2026-11-17T10:20:00+11:00");
  const r = await s.engine.handleEvent({ type: "inbound", from: "+61412345678", body: "Tuesday at 10 works, thanks" });
  assert.equal(r.matched, true);
  assert.equal(r.alert, 'Seam lead line: reply from Sam Taylor, Taylor Psychology (0412 345 678):\n"Tuesday at 10 works, thanks"');
  const l = s.db.leads.get("L1")!;
  assert.equal(l.sms_state, "replied");
  assert.equal(s.db.events.find((e) => e.type === "replied")!.body, "Tuesday at 10 works, thanks");

  s.at("2026-11-20T10:00:00+11:00"); await s.engine.runDue();
  assert.equal(s.toLead().length, 1, "no final text after a reply");
  assert.equal(s.toOwner().length, 0, "no day 1 alert after a reply");
});

test("STOP: opted out, recorded by number, and a later sign-up with the same number isn't texted", async () => {
  const s = setup("live", "2026-11-17T10:00:00+11:00");
  s.db.leads.set("L1", blankLead({ id: "L1" }));
  await s.engine.queueLead("L1");
  const r = await s.engine.handleEvent({ type: "inbound", from: "+61412345678", body: "STOP" });
  assert.match(String(r.alert), /replied STOP\. Opted out and recorded/);
  assert.equal(s.db.leads.get("L1")!.sms_state, "opted_out");
  assert.ok(s.db.optouts.has("+61412345678"));

  s.at("2026-11-20T10:00:00+11:00"); await s.engine.runDue();
  assert.equal(s.toLead().length, 1);

  s.db.leads.set("L2", blankLead({ id: "L2", created_at: "2026-11-21T00:00:00Z", phone: "+61 412 345 678" }));
  const q = await s.engine.queueLead("L2");
  assert.equal(q.reason, "number opted out");
  assert.equal(s.toLead().length, 1);

  // A STOP from a number with no lead is still recorded
  await s.engine.handleEvent({ type: "inbound", from: "+61499999999", body: "unsubscribe" });
  assert.ok(s.db.optouts.has("+61499999999"));
});

test("phone matching: typed formats match; unknown numbers don't", async () => {
  const s = setup("live", "2026-11-17T10:00:00+11:00");
  s.db.leads.set("L1", blankLead({ id: "L1", phone: "(04) 1234 5678", name: "Alex Kim", company: "Kim Dental" }));
  const call = await s.engine.handleEvent({ type: "call", from: "+61412345678" });
  assert.equal(call.label, "Alex Kim, Kim Dental");
  const none = await s.engine.handleEvent({ type: "inbound", from: "+61400000999", body: "hello" });
  assert.equal(none.matched, false);
  assert.equal(none.alert, null);
});

test("test mode: only leads Heath allows are texted, and no day 3 text", async () => {
  const s = setup("test", "2026-11-17T10:00:00+11:00");
  s.db.leads.set("L1", blankLead({ id: "L1" }));
  s.db.leads.set("L2", blankLead({ id: "L2", phone: "0412 000 111" }));
  assert.match(String((await s.engine.queueLead("L1")).reason), /not allowed/);
  assert.equal(s.toLead().length, 0);
  const r = await s.engine.queueLead("L2", { allow: true });
  assert.equal(r.ok, true);
  assert.equal(s.toLead().length, 1);
  assert.equal(s.toLead()[0].to, "+61412000111");
  s.at("2026-11-18T10:00:00+11:00"); await s.engine.runDue();
  assert.equal(s.toOwner().length, 1, "day 1 alert still goes to Heath");
  s.at("2026-11-20T10:00:00+11:00"); await s.engine.runDue();
  assert.equal(s.toLead().length, 1, "final text needs live mode");
});

test("2-text cap holds under two runs at once", async () => {
  const s = setup("live", "2026-11-17T10:00:00+11:00");
  s.db.leads.set("L1", blankLead({ id: "L1", sms_state: "queued", sms_phone: "+61412345678", sms_kind: "social", sms_token: "Tok2345", sms_due_at: "2026-11-17T00:00:00Z" }));
  const [a, b] = await Promise.all([s.engine.sendText("L1", "first"), s.engine.sendText("L1", "first")]);
  assert.equal([a, b].filter((x) => x.sent).length, 1);
  assert.equal(s.toLead().length, 1);
});

test("don't-call leads: no call offer and no alert to Heath", async () => {
  const s = setup("live", "2026-11-17T10:00:00+11:00");
  s.db.leads.set("L1", blankLead({ id: "L1", notes: "Asked for the social media guide | Budget: Under $250 a month | DON'T CALL (said just the guide, or under $250 a month)" }));
  await s.engine.queueLead("L1");
  assert.equal(s.toLead()[0].body, "Hi Test, Heath from Seam Media. Thanks for grabbing the guide. Any questions about it, just reply to this text. Reply STOP to opt out");
  s.at("2026-11-18T10:00:00+11:00"); await s.engine.runDue();
  assert.equal(s.toOwner().length, 0);
});

test("a reply to the email, a stage change or no mobile stops or skips texting", async () => {
  const s = setup("live", "2026-11-17T10:00:00+11:00");
  s.db.leads.set("L1", blankLead({ id: "L1" }));
  s.db.leads.set("L2", blankLead({ id: "L2", phone: "03 9555 1234" }));
  s.db.leads.set("L3", blankLead({ id: "L3", phone: "0412 000 333", notes: "Asked about the Smart Website ($99 a week)" }));
  await s.engine.queueLead("L1");
  assert.equal((await s.engine.queueLead("L2")).reason, "no Australian mobile number");
  assert.equal((await s.engine.queueLead("L3")).reason, "not a guide lead");
  s.db.emailStatus.L1 = "replied";
  s.at("2026-11-17T10:10:00+11:00"); const r = await s.engine.runDue();
  assert.equal(r.stopped, 1);
  assert.equal(s.db.leads.get("L1")!.sms_state, "stopped");
});

test("send failure (for example Twilio suspended): no retry, count kept, Heath emailed", async () => {
  const s = setup("live", "2026-11-17T10:00:00+11:00");
  s.db.leads.set("L1", blankLead({ id: "L1" }));
  s.tel.state.fail = true;
  await s.engine.queueLead("L1");
  const l = s.db.leads.get("L1")!;
  assert.equal(l.sms_state, "failed");
  assert.equal(l.sms_count, 1);
  assert.equal(s.fallback.length, 1);
  assert.match(s.fallback[0], /couldn't be sent: Twilio 401/);
});

test("backfill: a text sent by hand in the Twilio console is matched from the message log and counts toward the cap", async () => {
  const s = setup("test", "2026-11-16T11:00:00+11:00");
  s.db.leads.set("L1", blankLead({ id: "L1", phone: "0412 345 678" }));
  s.tel.state.logged = [{ sid: "SMconsole0000000000000000000000001", to: "+61412345678", body: "Hi Test, it's Heath from Seam Media... Reply STOP to opt out.", date_sent: "2026-11-15T22:52:28.000Z", status: "delivered", price: -0.103, price_unit: "USD", segments: 2 }];
  const r = await s.engine.backfillFromLine(14);
  assert.deepEqual(r, { checked: 1, recorded: 1, unmatched: 0, already: 0 });
  const l = s.db.leads.get("L1")!;
  assert.equal(l.sms_count, 1);
  assert.equal(l.sms_state, "sent");
  assert.equal(l.sms_first_sent_at, "2026-11-15T22:52:28.000Z");
  assert.equal(l.sms_allowed, true);
  assert.equal(s.db.events.find((e) => e.type === "sent")!.price, 0.103);
  assert.deepEqual(await s.engine.backfillFromLine(14), { checked: 1, recorded: 0, unmatched: 0, already: 1 });
  assert.match(String((await s.engine.queueLead("L1")).reason), /already sent/);
  assert.equal(s.toLead().length, 0, "backfill never sends");
  // A reply now matches the lead
  assert.equal((await s.engine.handleEvent({ type: "inbound", from: "+61412345678", body: "Sure, Thursday?" })).matched, true);
});

test("price backfill and the monthly cost report", async () => {
  const s = setup("live", "2026-11-17T10:00:00+11:00");
  s.db.leads.set("L1", blankLead({ id: "L1" }));
  await s.engine.queueLead("L1");
  await s.engine.alertHeath("L1", "test alert");
  for (const x of s.tel.sends) s.tel.state.prices[x.sid] = -0.0515;
  s.at("2026-11-17T10:30:00+11:00");
  assert.equal(await s.engine.backfillPrices(), 2);
  const months = monthlyCost(s.db.events.map((e) => ({ ...e, created_at: e.created_at! })));
  assert.deepEqual(months, [{ month: "2026-11", leadTexts: 1, alerts: 1, segments: 2, cost: { USD: 0.103 }, unpriced: 0 }]);
});
