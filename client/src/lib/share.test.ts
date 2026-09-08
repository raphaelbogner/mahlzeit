import { describe, it, expect, vi } from 'vitest';
import {
  buildInviteText,
  buildPaymentText,
  buildReminderText,
  buildSessionUrl,
  buildWorkspaceInviteText,
  buildWorkspaceUrl,
  shareOrCopy,
} from './share';

const origin = 'https://mahlzeit.example';
const token = 'abc/def+ghi';

describe('url builders', () => {
  it('encodes the token and session id', () => {
    expect(buildWorkspaceUrl(token, origin)).toBe(
      'https://mahlzeit.example/w/?w=abc%2Fdef%2Bghi',
    );
    expect(buildSessionUrl('sess000000000001', token, origin)).toBe(
      'https://mahlzeit.example/w/s/sess000000000001?w=abc%2Fdef%2Bghi',
    );
  });
});

describe('text builders', () => {
  const now = new Date(2026, 8, 8, 10, 0);

  it('builds an invite with restaurant and deadline', () => {
    const deadline = new Date(2026, 8, 8, 11, 30).toISOString();
    const text = buildInviteText({
      title: 'Pizza Freitag',
      restaurant_name: 'Roma',
      deadline_at: deadline,
      url: 'https://x/y',
      now,
    });
    expect(text).toContain('„Pizza Freitag“ bei Roma');
    expect(text).toMatch(/Bestellschluss: heute um \d{2}:\d{2}/);
    expect(text).toContain('Hier mitbestellen: https://x/y');
  });

  it('omits restaurant and deadline when missing', () => {
    const text = buildInviteText({
      title: 'Snack',
      restaurant_name: '',
      deadline_at: null,
      url: 'https://x/y',
      now,
    });
    expect(text).not.toContain(' bei ');
    expect(text).not.toContain('Bestellschluss');
  });

  it('builds a reminder naming the missing people', () => {
    const text = buildReminderText({
      names: ['Anna', 'Bob'],
      title: 'Pizza Freitag',
      deadline_at: new Date(2026, 8, 8, 11, 30).toISOString(),
      url: 'https://x/y',
      now,
    });
    expect(text).toMatch(/^Hey Anna, Bob – Bestellschluss ist heute um \d{2}:\d{2}\./);
    expect(text).toContain('„Pizza Freitag“ – hier bestellen: https://x/y');
    expect(
      buildReminderText({ names: [], title: 'X', deadline_at: null, url: 'u', now }),
    ).toContain('die Bestellung läuft noch');
  });

  it('appends the link to the payment summary', () => {
    expect(buildPaymentText('Gesamt: 10,00 €', 'https://x/y')).toBe(
      'Gesamt: 10,00 €\n\nDetails & QR-Code: https://x/y',
    );
  });

  it('builds the workspace invite', () => {
    expect(buildWorkspaceInviteText('https://x')).toContain('https://x');
  });
});

describe('shareOrCopy', () => {
  it('uses the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareOrCopy({ title: 't', text: 'x' }, { share }, undefined, true)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 't', text: 'x' });
  });

  it('reports a dismissed share sheet as cancelled', async () => {
    const err = new Error('dismissed');
    err.name = 'AbortError';
    const share = vi.fn().mockRejectedValue(err);
    expect(await shareOrCopy({ title: 't', text: 'x' }, { share }, undefined, true)).toBe('cancelled');
  });

  it('falls back to the clipboard without share support or on share errors', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareOrCopy({ title: 't', text: 'x' }, { clipboard: { writeText } })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('x');

    const share = vi.fn().mockRejectedValue(new Error('unsupported'));
    expect(
      await shareOrCopy({ title: 't', text: 'x' }, { share, clipboard: { writeText } }, undefined, true),
    ).toBe('copied');
  });

  it('copies on desktop even when share is available', async () => {
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(
      await shareOrCopy({ title: 't', text: 'x' }, { share, clipboard: { writeText } }, undefined, false),
    ).toBe('copied');
    expect(share).not.toHaveBeenCalled();
  });

  it('fails when nothing is available', async () => {
    expect(await shareOrCopy({ title: 't', text: 'x' }, {})).toBe('failed');
  });
});
