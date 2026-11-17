"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loading, Wordmark } from "@/components/ui";
import { turnOffReminders } from "@/lib/store";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Off />
    </Suspense>
  );
}

/** Where the "turn them off" link in a reminder email lands. No sign-in needed. */
function Off() {
  const token = useSearchParams().get("u") ?? "";
  const [state, setState] = useState<"ask" | "working" | "done" | "failed">("ask");

  async function go() {
    setState("working");
    setState((await turnOffReminders(token)) ? "done" : "failed");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-6">
      <Wordmark />
      <div className="mt-16">
        <p className="eyebrow">Reminders</p>
        {state === "done" ? (
          <>
            <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none">Reminders are off</h1>
            <p className="mt-4 text-bone-dim">No more reminder emails. Your goals and your check-in dates stay as they are.</p>
            <Link href="/settings" className="btn-ghost mt-8 w-full">
              Open Settings
            </Link>
            <p className="mt-3 text-center text-xs text-bone-mute">You can turn them back on there any time.</p>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none">Turn off reminder emails?</h1>
            <p className="mt-4 text-bone-dim">
              This stops the emails about check-ins and next steps, for your own goals and the ones you walk with a brother on.
            </p>
            <button type="button" className="btn-gold mt-8 w-full" disabled={state === "working" || !token} onClick={go}>
              {state === "working" ? "Turning off…" : "Turn Them Off"}
            </button>
            {(state === "failed" || !token) && (
              <p className="mt-4 text-sm text-bad" role="alert">
                That link didn&apos;t work. Open Settings in the app and switch reminders off there.
              </p>
            )}
            <Link href="/" className="mt-4 block min-h-[44px] content-center text-center text-sm text-bone-mute hover:text-bone">
              Keep them on
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
