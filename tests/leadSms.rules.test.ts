// npm test: unit tests for the lead texting rules (no network, no database)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  budgetText, displayMobile, finalText, firstName, firstText, guideKind, inBusinessHours, inSendWindow, isBot, isDontCall,
  isGsm, isOptOutText, nextBusinessTime, nextSendTime, parseBudgetMin, toMobile,
} from "../src/lib/leadSms/rules";

const mel = (iso: string) => new Date(iso); // ISO strings below carry the Melbourne offset

test("phone: Australian mobiles only, in every common format", () => {
  for (const p of ["0412 345 678", "0412345678", "+61 412 345 678", "61412345678", "(04) 1234-5678", "0061412345678"]) assert.equal(toMobile(p), "+61412345678", p);
  for (const p of ["03 9555 1234", "+1 415 555 0100", "1300 123 456", "", null, "0412 345 67"]) assert.equal(toMobile(p), null, String(p));
  assert.equal(displayMobile("+61412345678"), "0412 345 678");
});

test("quiet hours: 8 am to 8 pm Melbourne, otherwise 8 am next", () => {
  assert.equal(nextSendTime(mel("2026-11-16T21:30:00+11:00")).toISOString(), mel("2026-11-17T08:00:00+11:00").toISOString());
  assert.equal(nextSendTime(mel("2026-11-17T06:15:00+11:00")).toISOString(), mel("2026-11-17T08:00:00+11:00").toISOString());
  const day = mel("2026-11-17T08:30:00+11:00");
  assert.equal(nextSendTime(day), day);
  assert.ok(inSendWindow(mel("2026-11-17T19:59:00+11:00")));
  assert.ok(!inSendWindow(mel("2026-11-17T20:00:00+11:00")));
  assert.ok(!inSendWindow(mel("2026-11-17T07:59:00+11:00")));
  // Daylight saving starts 4 Oct 2026: 11 pm on the 3rd (AEST) -> 8 am on the 4th (AEDT)
  assert.equal(nextSendTime(mel("2026-10-03T23:00:00+10:00")).toISOString(), mel("2026-10-04T08:00:00+11:00").toISOString());
  // Winter (AEST, +10)
  assert.equal(nextSendTime(mel("2026-07-01T22:00:00+10:00")).toISOString(), mel("2026-07-02T08:00:00+10:00").toISOString());
});

test("business hours for Heath's alerts: weekdays 9 to 5", () => {
  assert.ok(inBusinessHours(mel("2026-11-17T09:00:00+11:00")));
  assert.ok(!inBusinessHours(mel("2026-11-21T10:00:00+11:00"))); // Saturday
  assert.equal(nextBusinessTime(mel("2026-11-20T18:00:00+11:00")).toISOString(), mel("2026-11-23T09:00:00+11:00").toISOString()); // Fri 6 pm -> Mon 9 am
});

test("budget, guide kind and don't-call from the guide notes", () => {
  assert.equal(budgetText("Asked for the social media guide | Industry: Health | Budget: $500 to $1,000 a month | Ad: X"), "$500 to $1,000 a month");
  assert.equal(parseBudgetMin("$500 to $1,000 a month"), 500);
  assert.equal(parseBudgetMin("$1,000+ a month"), 1000);
  assert.equal(parseBudgetMin("$2k to $5k"), 2000);
  assert.equal(parseBudgetMin("Under $250 a month"), 0);
  assert.equal(parseBudgetMin(null), null);
  assert.equal(guideKind("Asked for the tradie website guide"), "website");
  assert.equal(guideKind("Asked for the social media guide"), "social");
  assert.equal(guideKind("Asked about the Smart Website ($99 a week)"), null);
  assert.ok(isDontCall({ name: null, company: null, notes: "Budget: Under $250 | DON'T CALL (said just the guide)", next_action: null }));
  assert.ok(isDontCall({ name: null, company: null, notes: null, next_action: "Don't call: said just the guide" }));
  assert.ok(!isDontCall({ name: null, company: null, notes: "Budget: $500", next_action: null }));
});

test("STOP and similar opt-outs", () => {
  for (const w of ["STOP", "stop", "Stop.", " UNSUBSCRIBE ", "opt out", "Stop texting me", "no more texts", "don't text me"]) assert.ok(isOptOutText(w), w);
  for (const w of ["stop by Tuesday?", "Can we talk at 3", "", "Please don't stop"]) assert.ok(!isOptOutText(w), w);
});

test("texts: one GSM segment, Seam Media named, STOP included, for every variant", () => {
  const links = [null, "https://seam-media-lead-manager.vercel.app/b/AbC2345", "https://go.seammedia.com.au/b/AbC2345"];
  const names = ["David", "Jo", "Alexandria", "Maximilianus", "there"];
  for (const first of names) for (const kind of ["social", "website"] as const) for (const dontCall of [false, true]) for (const link of links) {
    for (const t of [firstText({ first, kind, dontCall, link }), finalText({ first, kind, dontCall, link })]) {
      assert.ok(t.length <= 160, `${t.length}: ${t}`);
      assert.ok(isGsm(t), t);
      assert.match(t, /Seam Media/);
      assert.match(t, /Reply STOP to opt out$/);
      assert.ok(!/\u2014|\u2013/.test(t));
    }
  }
  // Links are kept when they fit; a don't-call lead is never offered a call
  assert.match(firstText({ first: "David", kind: "social", dontCall: false, link: links[1] }), /vercel\.app\/b\/AbC2345 or reply with a time/);
  assert.ok(!/call/.test(firstText({ first: "David", kind: "social", dontCall: true, link: links[1] })));
  // The no-link wording the coordinator approved for the first live test, now trimmed to one segment
  assert.equal(firstText({ first: "David", kind: "social", dontCall: false, link: null }),
    "Hi David, Heath from Seam Media. Thanks for grabbing the guide. Happy to do a quick 15 min call about your ads, just reply with a time. Reply STOP to opt out");
});

test("first names: clean or 'there'", () => {
  assert.equal(firstName("david smith"), "David");
  assert.equal(firstName("Legion13 Perth | BJJ"), "there");
  assert.equal(firstName(""), "there");
});

test("link previews and bots don't count as clicks", () => {
  assert.ok(isBot("facebookexternalhit/1.1"));
  assert.ok(isBot("Mozilla/5.0 (Linux; Android 14) Google-PageRenderer"));
  assert.ok(isBot("WhatsApp/2.23"));
  assert.ok(isBot(""));
  assert.ok(!isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"));
});
