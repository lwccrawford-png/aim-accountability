"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignInForm } from "@/components/account-card";
import { Loading, Shell } from "@/components/ui";
import { forgetInvite, previewInvite, recallInvite, rememberInvite, respondInvite, type InvitePreview } from "@/lib/partners";
import { useApp } from "@/lib/store";

// The token rides in the #fragment, so it never reaches a server log.
function readToken(): string | null {
  const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
  if (/^[a-f0-9]{48}$/.test(hash)) return hash;
  return recallInvite();
}

export default function Invite() {
  const app = useApp();
  const router = useRouter();
  const [token] = useState<string | null>(readToken);
  const [preview, setPreview] = useState<InvitePreview | null>(() => (token ? null : { status: "not_found" }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!token) return;
    rememberInvite(token); // survives the sign-in email round trip
    previewInvite(token)
      .then(setPreview)
      .catch(() => setPreview({ status: "not_found" }));
  }, [token]);

  if (!app || !preview) return <Loading />;
  const signedIn = !!app.account;

  const respond = async (accept: boolean) => {
    if (!token) return;
    setBusy(true);
    setErr("");
    try {
      const r = await respondInvite(token, accept);
      router.push(accept && r.goalId ? `/brother/${r.goalId}?new=1` : "/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  const closed = preview.status !== "pending";

  return (
    <Shell lmtlss={app.settings.lmtlssMode} hideNav>
      <div className="animate-rise pt-6">
        <p className="eyebrow">An invitation</p>
        {closed ? (
          <>
            <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-none">
              {preview.status === "not_found" ? "Link not found" : preview.status === "expired" ? "This link expired" : "This link is closed"}
            </h1>
            <p className="mt-4 text-bone-dim">
              {preview.status === "accepted"
                ? "It's already been accepted."
                : preview.status === "not_found"
                  ? "Check that the whole link came through."
                  : `Ask ${preview.from ?? "him"} to send a new one.`}
            </p>
            <button
              className="btn-ghost mt-8 w-full"
              onClick={() => {
                forgetInvite();
                router.push("/");
              }}
            >
              Go to Accountability
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-3 font-display text-[40px] font-extrabold uppercase leading-[0.95]">
              {preview.from} wants you
              <br />
              <span className="text-gold">in his corner.</span>
            </h1>
            <p className="mt-4 text-bone-dim">
              He&apos;s working on a goal and asked you to hold him to it. Say yes and you&apos;ll see what he&apos;s committed to, his next step, and a
              place to check in on him. You set how often.
            </p>
            <p className="mt-3 text-sm text-bone-mute">Sent to {preview.forEmail}. Sign in with that email to accept.</p>

            {signedIn ? (
              <div className="mt-8 space-y-3">
                <p className="text-sm text-bone-mute">Signed in as {app.account?.email}</p>
                <button className="btn-gold w-full" disabled={busy} onClick={() => respond(true)}>
                  I&apos;m In
                </button>
                <button className="btn-ghost w-full" disabled={busy} onClick={() => respond(false)}>
                  Not This Time
                </button>
              </div>
            ) : (
              <div className="card mt-8 p-5">
                <SignInForm next="/invite" cta="Sign In to Answer" />
              </div>
            )}
            {err && (
              <p role="alert" className="mt-4 text-sm text-bad">
                {err}
              </p>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
