import { describe, it, expect } from 'vitest';
import { buildEpcQrPayload } from './epcQr';

describe('buildEpcQrPayload', () => {
  it('produces a v002 SCT payload with expected line layout', () => {
    const payload = buildEpcQrPayload({
      beneficiaryName: 'Clara Test',
      iban: 'AT61 1904 3002 3457 3201',
      amountCents: 1234,
      remittance: 'Mittag Mittwoch',
    });
    const lines = payload.split('\n');
    expect(lines[0]).toBe('BCD');
    expect(lines[1]).toBe('002');
    expect(lines[2]).toBe('1');
    expect(lines[3]).toBe('SCT');
    expect(lines[4]).toBe('');
    expect(lines[5]).toBe('Clara Test');
    expect(lines[6]).toBe('AT611904300234573201');
    expect(lines[7]).toBe('EUR12.34');
    expect(lines[8]).toBe('');
    expect(lines[9]).toBe('');
    expect(lines[10]).toBe('Mittag Mittwoch');
  });

  it('pads cents below 10 with a leading zero', () => {
    const payload = buildEpcQrPayload({
      beneficiaryName: 'X',
      iban: 'AT611904300234573201',
      amountCents: 105,
    });
    expect(payload.split('\n')[7]).toBe('EUR1.05');
  });

  it('truncates beneficiary name to 70 chars', () => {
    const long = 'a'.repeat(100);
    const payload = buildEpcQrPayload({
      beneficiaryName: long,
      iban: 'AT611904300234573201',
      amountCents: 100,
    });
    expect(payload.split('\n')[5]!.length).toBe(70);
  });

  it('truncates remittance to 140 chars and strips line breaks', () => {
    const payload = buildEpcQrPayload({
      beneficiaryName: 'X',
      iban: 'AT611904300234573201',
      amountCents: 100,
      remittance: 'a\nb\r\nc' + 'x'.repeat(200),
    });
    const remit = payload.split('\n')[10]!;
    expect(remit.length).toBe(140);
    expect(remit).not.toContain('\n');
    expect(remit).not.toContain('\r');
  });

  it('rejects zero or negative amounts', () => {
    expect(() =>
      buildEpcQrPayload({
        beneficiaryName: 'X',
        iban: 'AT611904300234573201',
        amountCents: 0,
      }),
    ).toThrow();
    expect(() =>
      buildEpcQrPayload({
        beneficiaryName: 'X',
        iban: 'AT611904300234573201',
        amountCents: -50,
      }),
    ).toThrow();
  });

  it('transliterates German umlauts to the SEPA Latin character set', () => {
    const payload = buildEpcQrPayload({
      beneficiaryName: 'Jürgen Müller',
      iban: 'AT611904300234573201',
      amountCents: 100,
      remittance: 'Schöne Grüße — straße',
    });
    const lines = payload.split('\n');
    expect(lines[5]).toBe('Juergen Mueller');
    expect(lines[10]).toBe('Schoene Gruesse strasse');
  });

  it('drops characters outside the SEPA Latin set', () => {
    const payload = buildEpcQrPayload({
      beneficiaryName: 'X',
      iban: 'AT611904300234573201',
      amountCents: 100,
      remittance: 'Pizza 🍕 #1 @lunch',
    });
    expect(payload.split('\n')[10]).toBe('Pizza 1 lunch');
  });

  it('rejects empty beneficiary or IBAN', () => {
    expect(() =>
      buildEpcQrPayload({
        beneficiaryName: '',
        iban: 'AT611904300234573201',
        amountCents: 100,
      }),
    ).toThrow();
    expect(() =>
      buildEpcQrPayload({
        beneficiaryName: 'X',
        iban: '',
        amountCents: 100,
      }),
    ).toThrow();
  });
});
