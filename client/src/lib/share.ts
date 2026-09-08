import { formatDeadlineAbsolute, parseDeadline } from './deadline';

// URLs carry the workspace token on purpose: the token is the invitation.
export function buildWorkspaceUrl(token: string, origin: string): string {
  return `${origin}/w/?w=${encodeURIComponent(token)}`;
}

export function buildSessionUrl(sessionId: string, token: string, origin: string): string {
  return `${origin}/w/s/${encodeURIComponent(sessionId)}?w=${encodeURIComponent(token)}`;
}

export interface InviteTextInput {
  title: string;
  restaurant_name: string;
  deadline_at: string | null;
  url: string;
  now?: Date;
}

// Open session: "come and order".
export function buildInviteText(input: InviteTextInput): string {
  const where = input.restaurant_name.trim() !== '' ? ` bei ${input.restaurant_name.trim()}` : '';
  const lines = [`🍽️ Sammelbestellung „${input.title}“${where}`];
  const deadline = parseDeadline(input.deadline_at);
  if (deadline) {
    lines.push(`Bestellschluss: ${formatDeadlineAbsolute(deadline, input.now ?? new Date())}`);
  }
  lines.push(`Hier mitbestellen: ${input.url}`);
  return lines.join('\n');
}

// Closed session: the summary text (per-person amounts, IBAN) plus a link.
export function buildPaymentText(summaryText: string, url: string): string {
  return `${summaryText}\n\nDetails & QR-Code: ${url}`;
}

export function buildWorkspaceInviteText(url: string): string {
  return `Komm in unseren Mahlzeit-Workspace für Sammelbestellungen: ${url}`;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

// Minimal slice of `navigator` so the logic is testable without a browser.
export interface ShareNavigator {
  share?: (data: { title?: string; text?: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

export async function copyText(text: string, nav: ShareNavigator, doc?: Document): Promise<boolean> {
  if (nav.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path
    }
  }
  if (!doc) return false;
  try {
    const ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    doc.body.appendChild(ta);
    ta.select();
    const ok = doc.execCommand('copy');
    doc.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// Native share sheet on devices that have one (phones), clipboard otherwise.
// A dismissed share sheet is 'cancelled', not an error.
export async function shareOrCopy(
  data: { title: string; text: string },
  nav: ShareNavigator,
  doc?: Document,
): Promise<ShareOutcome> {
  if (nav.share) {
    try {
      await nav.share({ title: data.title, text: data.text });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
      // Unsupported payload or permission issue: fall back to copying.
    }
  }
  return (await copyText(data.text, nav, doc)) ? 'copied' : 'failed';
}
