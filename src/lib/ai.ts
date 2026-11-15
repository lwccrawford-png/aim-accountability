"use client";

import { supabase } from "@/lib/supabase";
import {
  buildBlockerPrompt,
  buildStartPrompt,
  copyablePrompt,
  looksLikeCrisis,
  type BlockerInput,
  type StartInput,
  type Suggestion
} from "../../supabase/functions/ai-assist/prompts";

export type AssistResult =
  | { kind: "ok"; steps: Suggestion[]; left?: number }
  | { kind: "crisis" }
  | { kind: "fallback"; prompt: string; reason: "not_configured" | "offline" | "error" }
  | { kind: "limit"; prompt: string };

async function call(body: Record<string, unknown>, prompt: string): Promise<AssistResult> {
  if (!supabase) return { kind: "fallback", prompt, reason: "not_configured" };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { kind: "fallback", prompt, reason: "offline" };
  const { data, error } = await supabase.functions.invoke("ai-assist", { body });
  if (data?.crisis) return { kind: "crisis" };
  if (data?.steps?.length) return { kind: "ok", steps: data.steps, left: data.left };
  // Errors come back with the JSON body on the response object.
  let code: string | undefined = data?.error;
  if (!code && error && "context" in error) {
    try {
      code = (await (error as { context: Response }).context.json())?.error;
    } catch {
      /* ignore */
    }
  }
  if (code === "limit") return { kind: "limit", prompt };
  return { kind: "fallback", prompt, reason: code === "not_configured" ? "not_configured" : "error" };
}

export function suggestFirstSteps(i: StartInput): Promise<AssistResult> {
  if (looksLikeCrisis(i.commitment)) return Promise.resolve({ kind: "crisis" });
  return call({ kind: "start", ...i }, copyablePrompt(buildStartPrompt(i)));
}

export function suggestBlockerMoves(i: BlockerInput): Promise<AssistResult> {
  if (looksLikeCrisis(i.commitment, i.blocker)) return Promise.resolve({ kind: "crisis" });
  return call({ kind: "blocker", ...i }, copyablePrompt(buildBlockerPrompt(i)));
}
