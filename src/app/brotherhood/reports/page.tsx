"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Empty, Loading, Shell } from "@/components/ui";
import { listReports, moderate, type ReportItem } from "@/lib/feed";
import { useApp } from "@/lib/store";

export default function Reports() {
  const app = useApp();
  if (!app) return <Loading />;
  const mod = app.account?.role === "moderator" || app.account?.role === "admin";
  return (
    <Shell lmtlss={app.settings.lmtlssMode}>
      <Link href="/brotherhood" className="text-sm text-bone-mute hover:text-bone">
        ← Brotherhood
      </Link>
      <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-none">Reports</h1>
      <p className="mt-3 text-sm text-bone-dim">Anything three men report is hidden until you look at it. Hide takes it down; Keep puts it back and clears the reports.</p>
      <div className="mt-6">{mod ? <Queue /> : <Empty title="Moderators only" body="This page is for Brotherhood moderators." href="/brotherhood" cta="Back to the Feed" />}</div>
    </Shell>
  );
}

function Queue() {
  const [items, setItems] = useState<ReportItem[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listReports());
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load reports.");
      setItems((cur) => cur ?? []);
    }
  }, []);

  useEffect(() => {
    let live = true;
    listReports()
      .then((r) => live && setItems(r))
      .catch((e) => {
        if (!live) return;
        setErr(e instanceof Error ? e.message : "Couldn't load reports.");
        setItems([]);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!items) return <Loading />;
  return (
    <div className="space-y-3">
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      {items.length === 0 && <p className="rounded-2xl border border-dashed border-ink-600 px-5 py-6 text-center text-sm text-bone-mute">Nothing reported. All quiet.</p>}
      {items.map((r) => (
        <article key={r.type + r.id} className="card space-y-3 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-bone-mute">
            {r.type === "post" ? "Post" : "Comment"} by {r.author ?? "someone"} · {r.count} report{r.count === 1 ? "" : "s"}
            {r.status === "hidden" && <span className="text-bad"> · hidden now</span>}
            {r.status === "removed" && <span> · removed by author</span>}
          </p>
          {r.headline && <p className="font-display text-xl font-bold uppercase">{r.headline}</p>}
          <p className="whitespace-pre-line text-bone-dim">{r.body}</p>
          {r.reasons && r.reasons.length > 0 && (
            <ul className="space-y-1 text-sm">
              {r.reasons.map((x, i) => (
                <li key={i} className="text-bone-mute">“{x}”</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            {(["hide", "keep"] as const).map((a) => (
              <button
                key={a}
                className={`${a === "hide" ? "btn-ghost border-bad/50 text-bad" : "btn-ghost"} flex-1`}
                disabled={busy === r.id}
                onClick={async () => {
                  setBusy(r.id);
                  try {
                    await moderate(r.type, r.id, a);
                    await load();
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Couldn't save.");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {a === "hide" ? "Hide" : "Keep"}
              </button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
