import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getGmail, alertHeath } from "@/lib/instant/deliver";
import type { Fact } from "@/lib/instant/checks";
import type { InstantLeadForm } from "@/lib/instant/form";
import { sendDueGuideFollowUps } from "@/lib/instant/guide";
import { addRepliedLead } from "@/lib/instant/pipeline";
import { classifyReply, isOptOut, plainText, replyText, type Part } from "@/lib/instant/replies";

// Vercel Cron, every 10 minutes (vercel.json). For instant lead emails from the last 21 days:
// 1. Drafts Heath has sent: mark sent and update the lead's last_contacted.
// 2. Leads who replied: Claude reads the reply first (classifyReply). Only warm replies go on the
//    pipeline dashboard, move the lead to "interested" and text Heath. Opt-outs and replies from
//    people who can't buy marketing (no business, after paid ad viewing, spam) are archived as not
//    interested and kept off the pipeline. Unclear replies are flagged to Heath, not added.
// 3. Guide leads who still haven't replied: one follow-up email (lib/instant/guide.ts).

export const maxDuration = 120;

function melbourneDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(d); // YYYY-MM-DD
}

export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceSupabase();
  const since = new Date(Date.now() - 21 * 86_400_000).toISOString();
  const { data: rows, error } = await db
    .from("lead_enrichments")
    .select("id, lead_id, form, status, created_at, email_subject, recommended_plan, facts, gmail_thread_id")
    .in("status", ["drafted", "sent"])
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ checked: 0 });

  const ctx = await getGmail();
  const results = { checked: rows.length, markedSent: 0, replied: 0, optedOut: 0, notALead: 0, unclear: 0, errors: [] as string[] };

  for (const row of rows) {
    const form = row.form as InstantLeadForm;
    const after = Math.floor(Date.parse(row.created_at) / 1000) - 60;
    try {
      let status = row.status as string;
      if (status === "drafted") {
        const sent = await ctx.gmail.users.messages.list({ userId: "me", q: `in:sent to:${form.email} after:${after}`, maxResults: 1 });
        const m = sent.data.messages?.[0];
        if (m) {
          const now = new Date().toISOString();
          await db.from("lead_enrichments").update({ status: "sent", sent_at: now, gmail_message_id: m.id, gmail_thread_id: m.threadId, updated_at: now }).eq("id", row.id);
          if (row.lead_id) await db.from("leads").update({ last_contacted: now, updated_at: now }).eq("id", row.lead_id);
          status = "sent";
          results.markedSent++;
        }
      }

      const reply = await ctx.gmail.users.messages.list({ userId: "me", q: `from:${form.email} after:${after}`, maxResults: 5 });
      // Out-of-office and other automatic replies don't make a lead warm
      let r: { id?: string | null; threadId?: string | null } | undefined;
      for (const m of reply.data.messages ?? []) {
        const meta = await ctx.gmail.users.messages.get({ userId: "me", id: m.id!, format: "metadata", metadataHeaders: ["Auto-Submitted", "Subject", "X-Autoreply", "X-Autorespond"] });
        const h = Object.fromEntries((meta.data.payload?.headers ?? []).map((x) => [String(x.name).toLowerCase(), String(x.value ?? "")]));
        const automatic = (h["auto-submitted"] && h["auto-submitted"].toLowerCase() !== "no") || h["x-autoreply"] || h["x-autorespond"] || /out of (the )?office|automatic reply|auto.?reply|away from/i.test(h["subject"] ?? "");
        if (!automatic) { r = m; break; }
      }
      if (!r) continue;

      const now = new Date().toISOString();
      const full = await ctx.gmail.users.messages.get({ userId: "me", id: r.id!, format: "full" });
      const said = replyText(plainText(full.data.payload as Part) || full.data.snippet || "");
      const check = isOptOut(said) ? { verdict: "opt_out" as const, reason: "Asked to be removed." } : await classifyReply(said, form);
      const who = form.businessCandidates?.[0] || form.company || form.name;
      const thread = `https://mail.google.com/mail/u/0/#all/${r.threadId}`;
      if (check.verdict === "not_a_lead") {
        await db.from("lead_enrichments").update({ status: "not_a_lead", replied_at: now, error: `Reply checked: not a lead. ${check.reason}`, updated_at: now }).eq("id", row.id);
        if (row.lead_id) {
          const { data: lead } = await db.from("leads").select("notes").eq("id", row.lead_id).single();
          await db.from("leads").update({ stage: "not_interested", archived: true, notes: `${lead?.notes ?? ""} | Not a lead (reply ${melbourneDate()}): ${check.reason}`.replace(/^ \| /, ""), updated_at: now }).eq("id", row.lead_id);
        }
        results.notALead++;
        await alertHeath(`${who} (${form.email}) replied but isn't a lead: ${check.reason} Not added to the pipeline; lead archived. No reply needed: ${thread}`).catch((err) => console.error("[instant-replies] text failed", err));
        continue;
      }
      if (check.verdict === "unclear") {
        // Off the pipeline until Heath reads it; status replied so it isn't checked again
        await db.from("lead_enrichments").update({ status: "replied", replied_at: now, error: `Reply not added to the pipeline: unclear. ${check.reason}`, updated_at: now }).eq("id", row.id);
        results.unclear++;
        await alertHeath(`${who} (${form.email}) replied, but it's unclear if they're a lead (${check.reason}). Not added to the pipeline; read it and decide: ${thread}`).catch((err) => console.error("[instant-replies] text failed", err));
        continue;
      }
      if (check.verdict === "opt_out") {
        await db.from("lead_enrichments").update({ status: "opted_out", replied_at: now, error: `Reply asked to be removed (opt-out). Do not contact. ${check.reason}`, updated_at: now }).eq("id", row.id);
        if (row.lead_id) {
          const { data: lead } = await db.from("leads").select("notes").eq("id", row.lead_id).single();
          await db.from("leads").update({ stage: "not_interested", archived: true, notes: `${lead?.notes ?? ""} | DO NOT CONTACT: asked ${melbourneDate()} (by reply) to be removed.`.replace(/^ \| /, ""), updated_at: now }).eq("id", row.lead_id);
        }
        results.optedOut++;
        await alertHeath(`${who} (${form.email}) asked to be removed. Not added to the pipeline; lead archived as not interested. Read it and send a short confirmation: ${thread}`).catch((err) => console.error("[instant-replies] text failed", err));
        continue;
      }
      const facts = ((row.facts as { facts?: Fact[] } | null)?.facts ?? []).filter((f) => f.confidence !== "low");
      const business = form.businessCandidates?.[0] || form.company || form.name;
      const contact = form.company && form.businessCandidates?.[0] !== form.company ? form.company : form.name;
      const notes = [
        `Meta lead ${row.created_at.slice(0, 10)}${form.adsetName ? ` (${form.adsetName})` : ""}, replied ${melbourneDate()}.`,
        form.helpWithRaw && `Asked for: ${form.helpWithRaw.replace(/_/g, " ")}.`,
        form.trade && `Trade: ${form.trade}.`,
        form.website && `Website: ${form.website}`,
        row.email_subject && `Instant email: "${row.email_subject}".`,
        facts.length ? `Checked: ${facts.slice(0, 5).map((f) => f.text).join(" ")}` : null,
        `Gmail: https://mail.google.com/mail/u/0/#all/${r.threadId}`,
      ].filter(Boolean).join(" ");

      const added = await addRepliedLead({
        business,
        contact,
        email: form.email,
        phone: form.phone,
        plan: row.recommended_plan && row.recommended_plan !== "none" ? row.recommended_plan : null,
        notes,
        followUp: melbourneDate(0),
      });
      await db.from("lead_enrichments").update({ status: "replied", replied_at: now, pipeline_record_id: added.id, updated_at: now }).eq("id", row.id);
      if (row.lead_id) {
        await db.from("leads").update({ stage: "interested", updated_at: now }).eq("id", row.lead_id).in("stage", ["contacted_1", "contacted_2", "no_response"]);
      }
      results.replied++;
      await alertHeath(`${business} replied to your email${added.created ? " and is now in the pipeline (Contacted)" : ""}. Reply today.`).catch((err) => console.error("[instant-replies] text failed", err));
    } catch (err) {
      results.errors.push(`${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // After the reply checks above, so someone who has just replied doesn't get a follow-up
  const guideFollowUps = await sendDueGuideFollowUps(ctx).catch((err) => {
    results.errors.push(`guide follow-ups: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  });

  return NextResponse.json({ ...results, guideFollowUps });
}
