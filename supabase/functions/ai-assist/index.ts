// AI helper: "Help Me Start" and blocker moves.
// Calls a free Groq model with a key that never leaves the server, caps uses per
// man per day, and never coaches through crisis language (it returns 988 instead).
//
// Secrets: GROQ_API_KEY (or "Groq API Key") for live answers, GROQ_MODEL (optional).
// Without a key it answers {error:"not_configured"} and the app offers a copyable prompt.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildBlockerPrompt, buildStartPrompt, looksLikeCrisis, parseSuggestions } from "./prompts.ts";

const CAP_SIGNED_IN = 20;
const CAP_ANON = 5;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let body: { kind?: string; commitment?: string; category?: string; blocker?: string; view?: string; lmtlss?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const commitment = (body.commitment ?? "").toString();
  if (!commitment.trim() || commitment.length > 1000) return json({ error: "bad_request" }, 400);
  if (body.kind !== "start" && body.kind !== "blocker") return json({ error: "bad_request" }, 400);
  if (body.kind === "blocker" && !(body.blocker ?? "").toString().trim()) return json({ error: "bad_request" }, 400);

  // Safety first, before any model call or quota use.
  if (looksLikeCrisis(commitment, body.blocker)) return json({ crisis: true });

  // GROQ_API_KEY is the standard name; "Groq API Key" is how it was first saved in the dashboard.
  const key = (Deno.env.get("GROQ_API_KEY") ?? Deno.env.get("Groq API Key"))?.trim();
  if (!key) return json({ error: "not_configured" }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false }
  });

  // Who's asking: a signed-in man by id, otherwise a hashed IP with a smaller cap.
  let who = "";
  let cap = CAP_ANON;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token && token.split(".").length === 3) {
    const { data } = await admin.auth.getUser(token);
    if (data.user) {
      who = `u:${data.user.id}`;
      cap = CAP_SIGNED_IN;
    }
  }
  if (!who) {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    who = `ip:${await sha256(ip)}`;
  }
  const { data: left, error: capErr } = await admin.rpc("take_ai_use", { p_key: who, p_cap: cap });
  if (capErr) return json({ error: "unavailable" }, 503);
  if (left === -1) return json({ error: "limit", cap }, 429);

  const prompt =
    body.kind === "start"
      ? buildStartPrompt({ commitment, category: body.category, lmtlss: !!body.lmtlss })
      : buildBlockerPrompt({
          commitment,
          blocker: body.blocker!.toString(),
          view: body.view === "perceived" || body.view === "real" ? body.view : undefined,
          lmtlss: !!body.lmtlss
        });

  // Groq retires models now and then: try ours in order, moving on only when one is gone.
  const models = [Deno.env.get("GROQ_MODEL"), "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"].filter(
    (m, i, all): m is string => !!m && all.indexOf(m) === i
  );
  let res: Response | null = null;
  for (const model of models) {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_tokens: 1200,
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user }
        ]
      })
    });
    if (res.status !== 404) break;
  }
  const giveBack = () => admin.rpc("give_back_ai_use", { p_key: who });
  if (!res || !res.ok) {
    await giveBack();
    return json({ error: res?.status === 429 ? "busy" : "model_error" }, 502);
  }
  const out = await res.json();
  const steps = parseSuggestions(out?.choices?.[0]?.message?.content ?? "", body.kind === "start" ? 4 : 3);
  if (steps.length === 0) {
    await giveBack();
    return json({ error: "model_error" }, 502);
  }
  return json({ steps, left });
});
