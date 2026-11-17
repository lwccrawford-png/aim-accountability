"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SignInForm } from "@/components/account-card";
import { NameCard } from "@/components/name-card";
import { PostCard } from "@/components/post-card";
import { Chip, Loading, Shell } from "@/components/ui";
import { createPost, KIND_LABEL, loadFeed, SHARE_DRAFT, type Post, type PostKind, type ShareDraft } from "@/lib/feed";
import { updateSettings, useApp } from "@/lib/store";
import { accountsEnabled } from "@/lib/supabase";
import { uid } from "@/lib/templates";

type Draft = ShareDraft;

function takeDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(SHARE_DRAFT);
    if (!raw) return null;
    window.sessionStorage.removeItem(SHARE_DRAFT);
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

export default function Brotherhood() {
  const app = useApp();
  if (!app) return <Loading />;
  const s = app.settings;
  const gate = !accountsEnabled ? "off" : !app.account ? "signin" : !s.lmtlssMode ? "mode" : !s.displayName?.trim() ? "name" : null;

  return (
    <Shell lmtlss={s.lmtlssMode}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">LMTLSS</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none">Brotherhood</h1>
        </div>
        {(app.account?.role === "moderator" || app.account?.role === "admin") && (
          <Link href="/brotherhood/reports" className="text-sm text-gold hover:underline">
            Reports
          </Link>
        )}
      </div>
      <p className="mt-3 text-bone-dim">Wins, steps of faith and finished goals from men in the fight. Cheer them on.</p>

      <div className="mt-6">
        {gate === "off" && <p className="text-bone-mute">The Brotherhood opens once accounts are live.</p>}
        {gate === "signin" && (
          <div className="card p-5">
            <p className="mb-4 text-bone-dim">Sign in to see and share with the Brotherhood.</p>
            <SignInForm next="/brotherhood" />
          </div>
        )}
        {gate === "mode" && (
          <div className="card space-y-4 p-5">
            <p className="text-bone-dim">The Brotherhood is part of LMTLSS mode: Steps of Faith, the Origins Rooms, and this feed.</p>
            <button className="btn-gold w-full" onClick={() => updateSettings({ lmtlssMode: true })}>
              Turn On LMTLSS Mode
            </button>
          </div>
        )}
        {gate === "name" && (
          <div className="card p-5">
            <p className="mb-4 text-bone-dim">One thing first: the name brothers will see on your posts.</p>
            <NameCard current={s.displayName} compact />
          </div>
        )}
        {!gate && <Feed />}
      </div>
    </Shell>
  );
}

function Feed() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [err, setErr] = useState("");
  const [more, setMore] = useState(true);
  const [draft] = useState<Draft | null>(takeDraft);

  const refresh = useCallback(async () => {
    try {
      const p = await loadFeed();
      setPosts(p);
      setMore(p.length === 20);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load the feed.");
      setPosts((cur) => cur ?? []);
    }
  }, []);

  useEffect(() => {
    let live = true;
    loadFeed()
      .then((p) => {
        if (!live) return;
        setPosts(p);
        setMore(p.length === 20);
      })
      .catch((e) => {
        if (!live) return;
        setErr(e instanceof Error ? e.message : "Couldn't load the feed.");
        setPosts([]);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <Composer initial={draft} onPosted={refresh} />
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      {!posts ? (
        <Loading />
      ) : posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-600 px-5 py-6 text-center text-sm text-bone-mute">Be the first to share a win.</p>
      ) : (
        <>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onChange={refresh} />
          ))}
          {more && (
            <button
              className="btn-ghost w-full"
              onClick={async () => {
                const last = posts[posts.length - 1];
                const older = await loadFeed(last.createdAt);
                setPosts([...posts, ...older.filter((o) => !posts.some((p) => p.id === o.id))]);
                setMore(older.length === 20);
              }}
            >
              Show Older
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Composer({ initial, onPosted }: { initial: Draft | null; onPosted: () => void }) {
  const [open, setOpen] = useState(!!initial);
  const [kind, setKind] = useState<PostKind>(initial?.kind ?? "win");
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // One id per draft: a double tap or retry posts once.
  const [postId, setPostId] = useState(uid);

  if (!open)
    return (
      <button className="btn-gold w-full" onClick={() => setOpen(true)}>
        Share a Win
      </button>
    );

  const reset = () => {
    setOpen(false);
    setHeadline("");
    setBody("");
    setPreview(false);
    setPostId(uid());
  };

  return (
    <div className="card space-y-4 border-gold/40 p-5">
      {preview ? (
        <>
          <p className="eyebrow">Preview: this is everything brothers will see</p>
          <div className="rounded-xl border border-ink-600 p-4">
            <span className="rounded-full border border-gold/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gold">{KIND_LABEL[kind]}</span>
            {headline.trim() && <p className="mt-3 font-display text-2xl font-extrabold uppercase leading-tight">{headline.trim()}</p>}
            <p className="mt-2 whitespace-pre-line text-bone-dim">{body.trim()}</p>
          </div>
          {err && <p role="alert" className="text-sm text-bad">{err}</p>}
          <div className="flex gap-2">
            <button
              className="btn-gold flex-1"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErr("");
                try {
                  await createPost(kind, body.trim(), headline.trim() || undefined, postId);
                  reset();
                  onPosted();
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Couldn't post.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Sharing…" : "Share It"}
            </button>
            <button className="btn-ghost" onClick={() => setPreview(false)}>
              Edit
            </button>
          </div>
        </>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) setPreview(true);
          }}
        >
          <div className="flex flex-wrap gap-2" role="group" aria-label="What kind of win">
            {(Object.keys(KIND_LABEL) as PostKind[]).map((k) => (
              <Chip key={k} on={kind === k} gold onClick={() => setKind(k)}>
                {KIND_LABEL[k]}
              </Chip>
            ))}
          </div>
          <input className="field" aria-label="Headline" maxLength={120} placeholder="Headline (optional)" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          <textarea
            className="field resize-none"
            rows={4}
            aria-label="What happened"
            maxLength={1000}
            placeholder="What happened? Keep private details private: no dollar amounts, names or places you wouldn't say out loud."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="text-xs text-bone-mute">Only what you write here is shared. Nothing else from your goals goes with it.</p>
          <div className="flex gap-2">
            <button type="submit" className="btn-gold flex-1" disabled={!body.trim()}>
              Preview
            </button>
            <button type="button" className="btn-ghost" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
