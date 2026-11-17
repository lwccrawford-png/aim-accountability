// Reminder emails for goal setters and their accountability partners.
// An hourly database job calls this with a shared secret. It asks the database who
// is due an email right now, sends one email per man through Resend, and records it.
//
// Secrets (Supabase dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY   the sender's key
//   REMINDERS_FROM   e.g. "Accountability <reminders@yourdomain.com>" (a domain verified in Resend)
//   APP_URL          where the app lives, e.g. "https://app.yourdomain.com"
// Until all three are set it answers {skipped:"not_configured"} and sends nothing.
//
// POST {}                       send what's due
// POST {"dryRun":true}          build the emails and return them; nothing is sent or recorded
// POST {"dryRun":true,"now":…}  the same, as if it were that moment (ISO timestamp)
// POST ?u=<token>               one-click unsubscribe from a mail app (no secret needed)
//
// Deploy with JWT verification off; the shared secret is the gate.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { compose, type Digest } from "./compose.ts";

const MAX_PER_RUN = 100; // the rest go out on the next hourly run
const PAUSE_MS = 550; // stay under Resend's two-per-second limit

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false }
  });
  const url = new URL(req.url);

  // One-click unsubscribe: mail apps POST here from the List-Unsubscribe header.
  const token = url.searchParams.get("u");
  if (token) {
    if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ error: "bad_request" }, 400);
    const { error } = await admin.rpc("reminder_unsubscribe", { p_token: token });
    return error ? json({ error: "failed" }, 500) : json({ ok: true });
  }

  const secret = req.headers.get("x-cron-secret") ?? "";
  if (!secret) return json({ error: "not_allowed" }, 401);

  let body: { dryRun?: boolean; now?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* an empty body is fine */
  }
  const dryRun = body.dryRun === true;
  const args: { p_secret: string; p_now?: string } = { p_secret: secret };
  if (dryRun && body.now) args.p_now = body.now;

  const { data, error } = await admin.rpc("reminders_due", args);
  if (error) return json({ error: error.code === "42501" ? "not_allowed" : "failed" }, error.code === "42501" ? 401 : 500);
  const digests = (data as Digest[]) ?? [];

  const key = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("REMINDERS_FROM")?.trim();
  const appUrl = Deno.env.get("APP_URL")?.trim();

  if (dryRun) {
    const emails = digests.map((d) => {
      const e = compose(d, appUrl || "https://app.example");
      return e && { to: d.email, subject: e.subject, count: e.count, text: e.text, html: e.html };
    });
    return json({ dryRun: true, configured: Boolean(key && from && appUrl), due: digests.length, emails: emails.filter(Boolean) });
  }

  if (!key || !from || !appUrl) return json({ skipped: "not_configured", due: digests.length });

  const oneClick = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-reminders?u=`;
  let sent = 0;
  let failed = 0;
  for (const d of digests.slice(0, MAX_PER_RUN)) {
    const e = compose(d, appUrl);
    if (!e) continue;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [d.email],
          subject: e.subject,
          html: e.html,
          text: e.text,
          headers: {
            "List-Unsubscribe": `<${oneClick}${d.unsubToken}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
          }
        })
      });
      if (!res.ok) {
        failed++;
        console.error("resend", res.status, (await res.text()).slice(0, 200));
      } else {
        sent++;
        // Recorded only after the send, so a failure is retried next hour.
        await admin.rpc("reminders_mark", { p_secret: secret, p_member: d.memberId, p_local: d.localDate, p_items: e.count });
      }
    } catch (err) {
      failed++;
      console.error("send", String(err).slice(0, 200));
    }
    await sleep(PAUSE_MS);
  }
  return json({ sent, failed, due: digests.length, held: Math.max(0, digests.length - MAX_PER_RUN) });
});
