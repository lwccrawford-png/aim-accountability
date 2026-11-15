"use client";

import { useState } from "react";
import { friendly } from "@/lib/dates";
import type { Suggested, TimelineEntry } from "@/lib/types";

/** The conversation between a man and his brother on one goal. */
export function Thread({
  entries,
  today,
  viewer,
  onPost,
  onApply,
  onDismiss,
  postLabel = "Reply"
}: {
  entries: (TimelineEntry & { mine?: boolean })[];
  today: string;
  viewer: "owner" | "partner";
  onPost?: (text: string) => Promise<void>;
  onApply?: (entry: TimelineEntry) => Promise<void>;
  onDismiss?: (entry: TimelineEntry) => Promise<void>;
  postLabel?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const shown = entries.filter((e) =>
    ["partner_checkin", "question", "suggestion", "reply", "partner_joined", "partner_left", ...(viewer === "partner" ? ["checkin", "completed"] : [])].includes(e.kind)
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <p className="eyebrow mb-3">Between you two</p>
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-600 px-5 py-4 text-sm text-bone-mute">Nothing yet. Check-ins and questions show up here.</p>
      ) : (
        <ol className="space-y-3">
          {shown.map((e) => {
            const fromPartner = viewer === "owner" ? !!e.author : !!e.mine;
            const who = viewer === "owner" ? e.author ?? "You" : e.mine ? "You" : e.author ?? "";
            if (e.kind === "partner_joined" || e.kind === "partner_left")
              return (
                <li key={e.id} className="text-center text-xs uppercase tracking-[0.16em] text-bone-mute">
                  {who} {e.kind === "partner_joined" ? "joined" : "left"} · {friendly(e.at.slice(0, 10), today)}
                </li>
              );
            const mineSide = viewer === "owner" ? !fromPartner : !!e.mine;
            return (
              <li key={e.id} className={`flex ${mineSide ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl border px-4 py-3 ${mineSide ? "border-ink-600 bg-ink-800" : "border-gold/30 bg-gold/[0.06]"}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bone-mute">
                    {who} · {LABEL[e.kind] ?? e.kind} · {new Date(e.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                  <Body e={e} />
                  {e.kind === "suggestion" && viewer === "owner" && !e.resolution && onApply && onDismiss && (
                    <div className="mt-3 flex gap-2">
                      <button className="btn-gold min-h-[40px] flex-1 px-3 text-sm" disabled={busy} onClick={() => run(() => onApply(e))}>
                        Use It
                      </button>
                      <button className="btn-ghost min-h-[40px] px-3 text-sm" disabled={busy} onClick={() => run(() => onDismiss(e))}>
                        Not Now
                      </button>
                    </div>
                  )}
                  {e.kind === "suggestion" && e.resolution && (
                    <p className={`mt-2 text-xs font-semibold uppercase tracking-wider ${e.resolution === "accepted" ? "text-gold" : "text-bone-mute"}`}>
                      {e.resolution === "accepted" ? "✓ Used" : "Set aside"}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {onPost && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!text.trim()) return;
            run(async () => {
              await onPost(text.trim());
              setText("");
            });
          }}
        >
          <input className="field py-3" aria-label={postLabel} placeholder={viewer === "owner" ? "Answer him, or ask him something" : "Ask him something"} value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="btn-gold shrink-0 px-4" disabled={busy || !text.trim()}>
            Send
          </button>
        </form>
      )}
      {err && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {err}
        </p>
      )}
    </section>
  );
}

const LABEL: Partial<Record<TimelineEntry["kind"], string>> = {
  partner_checkin: "Checked in",
  question: "Asked",
  suggestion: "Suggested",
  reply: "Said",
  checkin: "Check-in",
  completed: "Finished"
};

function Body({ e }: { e: TimelineEntry }) {
  if (e.kind === "partner_checkin" && e.responses)
    return (
      <div className="mt-1 space-y-1 text-sm">
        {e.responses.did && (
          <p>
            <span className="text-bone-mute">Saw: </span>
            {e.responses.did}
          </p>
        )}
        {e.responses.next && (
          <p>
            <span className="text-bone-mute">Asks: </span>
            {e.responses.next}
          </p>
        )}
      </div>
    );
  if (e.kind === "checkin" && e.responses)
    return (
      <div className="mt-1 space-y-1 text-sm">
        {e.responses.did && <p><span className="text-bone-mute">Did: </span>{e.responses.did}</p>}
        {e.responses.blocker && <p><span className="text-bone-mute">In the way: </span>{e.responses.blocker}</p>}
        {e.responses.next && <p><span className="text-bone-mute">Next: </span>{e.responses.next}</p>}
      </div>
    );
  if (e.kind === "suggestion") return <SuggestionBody text={e.text} s={e.suggested} />;
  return e.text ? <p className="mt-1 text-sm">{e.text}</p> : null;
}

function SuggestionBody({ text, s }: { text?: string; s?: Suggested }) {
  const rows = [
    ["Commitment", s?.commitment],
    ["Next step", s?.nextAction && `${s.nextAction}${s.nextActionDate ? ` (by ${s.nextActionDate})` : ""}`],
    ["Done looks like", s?.outcome]
  ].filter(([, v]) => v);
  return (
    <div className="mt-1 text-sm">
      {text && <p>{text}</p>}
      {rows.length > 0 && (
        <dl className="mt-2 space-y-1 rounded-lg border border-ink-600 px-3 py-2">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] uppercase tracking-wider text-bone-mute">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
