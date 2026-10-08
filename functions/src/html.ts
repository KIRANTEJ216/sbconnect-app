/**
 * HTML helpers shared by every outbound email.
 *
 * `sanitize` used to live in index.ts. It is extracted here so the admin-alert
 * module can reuse the exact same escaping rather than shipping a second copy
 * that could drift — every value interpolated into an email body passes through
 * it, because request titles and issue subjects are attacker-controlled.
 */

/** Escape the five characters that matter inside HTML text and attributes. */
export function sanitize(input: string): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Escape a value for inclusion in a plain-text (non-HTML) email. */
export function sanitizeText(input: string): string {
  return String(input ?? '');
}

/** Clamp free text so a long request description cannot flood an inbox. */
export function truncate(input: unknown, max = 180): string {
  const text = String(input ?? '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** One labelled line inside an email's detail block. */
export function emailRow(label: string, value: string): string {
  return `<p style="margin:6px 0;"><strong>${sanitize(label)}:</strong> ${sanitize(value)}</p>`;
}

/** A visually distinct note block, matching the existing drip-email styling. */
export function emailNote(lines: string[]): string {
  if (lines.length === 0) return '';
  const inner = lines
    .map((l) => `<p style="margin:4px 0;">${sanitize(l)}</p>`)
    .join('');
  return `<div style="background:#F5F0E8;border-radius:12px;padding:16px;margin:16px 0;">${inner}</div>`;
}

/**
 * Standard wrapper for every admin-alert email, so all of them read as one
 * system rather than a pile of unrelated messages.
 */
export function emailShell(heading: string, bodyHtml: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1922;">
  <h2 style="color:#2A11A6;margin:0 0 4px;">${sanitize(heading)}</h2>
  <p style="color:#55505F;margin:0 0 16px;">An admin action is needed in SB Connect.</p>
  ${bodyHtml}
  <p style="color:#55505F;margin:16px 0;">Open the SB Connect app and go to the Admin panel to review and act on this.</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #E7E3ED;" />
  <p style="color:#6E6879;font-size:12px;">SB Connect — Business Network</p>
</div>`;
}