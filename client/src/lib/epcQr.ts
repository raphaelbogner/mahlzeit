import { cleanIban } from './iban';

// Build an EPC QR (also known as GiroCode / SEPA QR / EPC069-12 v002) payload.
// Spec: https://www.europeanpaymentscouncil.eu/document-library/guidance-documents/quick-response-code-guidelines-enable-data-capture-initiation
//
// Lines (LF separated, max 331 bytes total):
//   1  Service Tag       BCD
//   2  Version           002 (allows empty BIC)
//   3  Character set     1   (UTF-8)
//   4  Identification    SCT
//   5  BIC               (empty allowed in v002)
//   6  Beneficiary name  (max 70)
//   7  IBAN              (no spaces)
//   8  Amount            EUR<value>, 0.01..999999999.99, dot decimal
//   9  Purpose code      (empty)
//  10  Structured ref    (empty when unstructured is used)
//  11  Unstructured ref  (max 140)
//  12  Information       (empty)

export interface EpcQrInput {
  beneficiaryName: string;
  iban: string;
  amountCents: number;
  remittance?: string;
}

// SEPA Latin character set (per EPC069-12 / ISO 20022 SCT):
// a-z A-Z 0-9 / - ? : ( ) . , ' + space.
// Anything outside this set is rejected by many banks even when the QR's
// declared charset is UTF-8, so we transliterate common DACH characters and
// drop the rest.
const SEPA_ALLOWED = /[^A-Za-z0-9/?:().,'+\- ]/g;

function toSepaLatin(input: string): string {
  return input
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(SEPA_ALLOWED, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeLine(input: string, maxLen: number): string {
  const cleaned = toSepaLatin(input);
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function formatEur(cents: number): string {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error('amountCents must be a positive integer');
  }
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return `EUR${euros}.${rest.toString().padStart(2, '0')}`;
}

export function buildEpcQrPayload(input: EpcQrInput): string {
  const iban = cleanIban(input.iban);
  if (iban.length === 0) {
    throw new Error('IBAN required');
  }
  const name = sanitizeLine(input.beneficiaryName, 70);
  if (name.length === 0) {
    throw new Error('Beneficiary name required');
  }
  const amount = formatEur(input.amountCents);
  const remittance = sanitizeLine(input.remittance ?? '', 140);

  return [
    'BCD',
    '002',
    '1',
    'SCT',
    '',
    name,
    iban,
    amount,
    '',
    '',
    remittance,
  ].join('\n');
}
