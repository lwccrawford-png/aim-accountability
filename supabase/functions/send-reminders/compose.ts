// Builds one reminder email from a man's due items. Pure: no network, no Deno APIs,
// so the same file runs in the node tests.

export interface OwnItem {
  goalId: string;
  commitment: string;
  checkinDue?: string;
  nextAction?: string;
  nextActionDate?: string;
}

export interface PartnerItem {
  goalId: string;
  ownerName: string;
  commitment: string;
  checkinDue?: string;
  ownerLateSince?: string;
}

export interface Digest {
  memberId: string;
  email: string;
  name?: string;
  localDate: string; // "YYYY-MM-DD" in his time zone
  unsubToken: string;
  own?: OwnItem[];
  partner?: PartnerItem[];
}

export interface Line {
  title: string;
  detail: string;
  when: string;
  late: boolean;
  href: string;
  cta: string;
}

export interface Email {
  subject: string;
  html: string;
  text: string;
  count: number;
}

const day = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;

/** "Today", "1 day late", "4 days late". */
export function whenLabel(due: string, today: string): { when: string; late: boolean } {
  const n = Math.round(day(today) - day(due));
  if (n <= 0) return { when: "Today", late: false };
  return { when: n === 1 ? "1 day late" : `${n} days late`, late: true };
}

const short = (d: string) =>
  new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });

const clip = (s: string, n = 120) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export function lines(d: Digest, appUrl: string): Line[] {
  const base = appUrl.replace(/\/+$/, "");
  const out: Line[] = [];
  for (const g of d.own ?? []) {
    if (g.checkinDue) {
      out.push({
        title: "Check in on your goal",
        detail: clip(g.commitment),
        ...whenLabel(g.checkinDue, d.localDate),
        href: `${base}/goals/${g.goalId}/check-in`,
        cta: "Check in"
      });
    }
    if (g.nextAction && g.nextActionDate) {
      out.push({
        title: `Next step: ${clip(g.nextAction, 90)}`,
        detail: clip(g.commitment),
        ...whenLabel(g.nextActionDate, d.localDate),
        href: `${base}/goals/${g.goalId}`,
        cta: "Open goal"
      });
    }
  }
  for (const p of d.partner ?? []) {
    const who = p.ownerName || "your brother";
    if (p.checkinDue) {
      out.push({
        title: `Check in with ${who}`,
        detail: clip(p.commitment),
        ...whenLabel(p.checkinDue, d.localDate),
        href: `${base}/brother/${p.goalId}`,
        cta: "Check in with him"
      });
    }
    if (p.ownerLateSince) {
      out.push({
        title: `${who} hasn't checked in since ${short(p.ownerLateSince)}`,
        detail: `${clip(p.commitment)} · A word from you could get him moving.`,
        ...whenLabel(p.ownerLateSince, d.localDate),
        href: `${base}/brother/${p.goalId}`,
        cta: "Reach out"
      });
    }
  }
  return out;
}

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** null when there is nothing to send. */
export function compose(d: Digest, appUrl: string): Email | null {
  const items = lines(d, appUrl);
  if (!items.length) return null;
  const base = appUrl.replace(/\/+$/, "");
  const off = `${base}/reminders/off?u=${d.unsubToken}`;
  const settings = `${base}/settings`;
  const subject = items.length === 1 ? clip(items[0].title, 70) : `${items.length} things need you today`;
  const hello = d.name ? `${d.name},` : "Hello,";
  const lead = items.length === 1 ? "One thing is due." : `${items.length} things are due.`;

  const text = [
    hello,
    "",
    lead,
    "",
    ...items.flatMap((l) => [`${l.title} (${l.when})`, l.detail, l.href, ""]),
    "You get this because reminders are on in Accountability.",
    `Change the time: ${settings}`,
    `Turn them off: ${off}`
  ].join("\n");

  const rows = items
    .map(
      (l) => `
      <tr><td style="padding:0 0 12px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#151614;border:1px solid #2a2c28;border-radius:14px;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0 0 8px 0;font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:${l.late ? "#e2725b" : "#c9a961"};">${esc(l.when)}</p>
            <p style="margin:0 0 6px 0;font:700 18px/1.3 Arial,Helvetica,sans-serif;color:#f3f1ea;">${esc(l.title)}</p>
            <p style="margin:0 0 16px 0;font:400 14px/1.5 Arial,Helvetica,sans-serif;color:#a9a79e;">${esc(l.detail)}</p>
            <a href="${esc(l.href)}" style="display:inline-block;background:#c9a961;color:#0b0c0b;font:700 13px/1 Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;text-decoration:none;padding:13px 20px;border-radius:10px;">${esc(l.cta)}</a>
          </td></tr>
        </table>
      </td></tr>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#0b0c0b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0c0b;">
    <tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding:0 4px 22px 4px;">
          <p style="margin:0;font:800 20px/1 Arial,Helvetica,sans-serif;letter-spacing:4px;text-transform:uppercase;color:#f3f1ea;">Account<span style="color:#c9a961;">ability</span></p>
        </td></tr>
        <tr><td style="padding:0 4px 18px 4px;">
          <p style="margin:0 0 6px 0;font:400 16px/1.5 Arial,Helvetica,sans-serif;color:#f3f1ea;">${esc(hello)}</p>
          <p style="margin:0;font:400 16px/1.5 Arial,Helvetica,sans-serif;color:#a9a79e;">${esc(lead)}</p>
        </td></tr>
        ${rows}
        <tr><td style="padding:14px 4px 0 4px;">
          <p style="margin:0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#77756d;">You get this because reminders are on in Accountability. <a href="${esc(settings)}" style="color:#a9a79e;">Change the time</a> or <a href="${esc(off)}" style="color:#a9a79e;">turn them off</a>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text, count: items.length };
}
