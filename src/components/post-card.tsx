"use client";

import { useState } from "react";
import { addComment, editComment, editPost, KIND_LABEL, react, REACTIONS, removeComment, removePost, report, type FeedComment, type Post } from "@/lib/feed";

const when = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

export function PostCard({ post, onChange }: { post: Post; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState(post.headline ?? "");
  const [body, setBody] = useState(post.body);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [menu, setMenu] = useState<"none" | "remove" | "report">("none");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const mine = new Set(post.myReactions ?? []);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`card p-5 ${post.status === "hidden" ? "border-bad/40 opacity-70" : ""}`}>
      <header className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-semibold">{post.author}</span>
          <span className="text-bone-mute"> · {when(post.createdAt)}{post.editedAt ? " · edited" : ""}</span>
        </p>
        <span className="shrink-0 rounded-full border border-gold/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gold">{KIND_LABEL[post.kind]}</span>
      </header>
      {post.status === "hidden" && <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-bad">Hidden while it&apos;s reviewed</p>}

      {editing ? (
        <div className="mt-3 space-y-2">
          <input className="field" aria-label="Headline" maxLength={120} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline (optional)" />
          <textarea className="field resize-none" rows={3} aria-label="Post" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-gold flex-1" disabled={busy || !body.trim()} onClick={() => run(async () => { await editPost(post.id, body, headline); setEditing(false); })}>
              Save
            </button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {post.headline && <h2 className="mt-3 font-display text-2xl font-extrabold uppercase leading-tight">{post.headline}</h2>}
          <p className="mt-2 whitespace-pre-line leading-relaxed text-bone-dim">{post.body}</p>
        </>
      )}

      {post.status === "visible" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {REACTIONS.map((r) => {
            const on = mine.has(r.id);
            const n = post.reactions?.[r.id] ?? 0;
            return (
              <button
                key={r.id}
                aria-pressed={on}
                disabled={busy || post.mine}
                title={post.mine ? "Brothers react to your post" : undefined}
                onClick={() => run(() => react(post.id, r.id, !on))}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-sm transition ${
                  on ? "border-gold bg-gold/15 text-gold-soft" : "border-ink-600 text-bone-dim hover:border-bone-mute"
                } disabled:cursor-default`}
              >
                <span aria-hidden className="text-xs">{r.glyph}</span>
                {r.label}
                {n > 0 && <span className="tabular-nums text-bone-mute">{n}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-ink-700 pt-3 text-sm">
        <button className="text-bone-mute hover:text-bone" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {post.comments.length ? `${post.comments.length} comment${post.comments.length === 1 ? "" : "s"}` : "Comment"}
        </button>
        <span className="flex gap-4">
          {post.mine ? (
            <>
              {!editing && <button className="text-bone-mute hover:text-bone" onClick={() => setEditing(true)}>Edit</button>}
              <button className="text-bone-mute hover:text-bad" onClick={() => setMenu(menu === "remove" ? "none" : "remove")}>Remove</button>
            </>
          ) : post.reported ? (
            <span className="text-bone-mute">Reported</span>
          ) : (
            <button className="text-bone-mute hover:text-bone" onClick={() => setMenu(menu === "report" ? "none" : "report")}>Report</button>
          )}
        </span>
      </div>

      {menu === "remove" && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-bad/40 px-4 py-3 text-sm">
          <span>Take this post down?</span>
          <button className="font-semibold text-bad" disabled={busy} onClick={() => run(() => removePost(post.id))}>Remove</button>
        </div>
      )}
      {menu === "report" && (
        <div className="mt-3 space-y-2 rounded-xl border border-ink-600 p-3">
          <input className="field py-2.5 text-sm" aria-label="Why are you reporting this" placeholder="What's wrong with it? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn-ghost w-full" disabled={busy} onClick={() => run(async () => { await report("post", post.id, reason); setMenu("none"); })}>
            Send Report
          </button>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-3">
          {post.comments.map((c) => (
            <CommentRow key={c.id} c={c} onChange={onChange} />
          ))}
          {post.status === "visible" && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!comment.trim()) return;
                run(async () => {
                  await addComment(post.id, comment.trim());
                  setComment("");
                });
              }}
            >
              <input className="field py-2.5 text-sm" aria-label="Write a comment" maxLength={500} placeholder="Encourage him" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button type="submit" className="btn-gold shrink-0 px-4 text-sm" disabled={busy || !comment.trim()}>
                Send
              </button>
            </form>
          )}
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-bad">{err}</p>}
    </article>
  );
}

function CommentRow({ c, onChange }: { c: FeedComment; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(c.body);
  const [reported, setReported] = useState(!!c.reported);
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      onChange();
    } catch {
      /* the next refresh shows the truth */
    }
  };
  return (
    <div className={`rounded-xl bg-ink-800 px-4 py-3 text-sm ${c.status === "hidden" ? "opacity-60" : ""}`}>
      <p className="text-xs text-bone-mute">
        <span className="font-semibold text-bone">{c.author}</span> · {when(c.createdAt)}
        {c.editedAt ? " · edited" : ""}
        {c.status === "hidden" ? " · hidden" : ""}
      </p>
      {editing ? (
        <div className="mt-2 flex gap-2">
          <input className="field py-2 text-sm" aria-label="Edit comment" maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn-gold shrink-0 px-3 text-sm" onClick={() => act(async () => { await editComment(c.id, body); setEditing(false); })}>Save</button>
        </div>
      ) : (
        <p className="mt-1">{c.body}</p>
      )}
      <p className="mt-1 flex gap-4 text-xs">
        {c.mine ? (
          <>
            <button className="text-bone-mute hover:text-bone" onClick={() => setEditing((e) => !e)}>{editing ? "Cancel" : "Edit"}</button>
            <button className="text-bone-mute hover:text-bad" onClick={() => act(() => removeComment(c.id))}>Remove</button>
          </>
        ) : reported ? (
          <span className="text-bone-mute">Reported</span>
        ) : (
          <button className="text-bone-mute hover:text-bone" onClick={() => act(async () => { await report("comment", c.id); setReported(true); })}>Report</button>
        )}
      </p>
    </div>
  );
}
