const priceFormatter = new Intl.NumberFormat('de-AT', {
  style: 'currency',
  currency: 'EUR',
});

export function parsePrice(input: string): number | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().replace(/\s*€\s*$/u, '').replace(/^€\s*/u, '').trim();
  if (trimmed === '') return null;

  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');

  let normalized: string;
  if (hasComma && hasDot) {
    if (trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.')) {
      normalized = trimmed.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = trimmed.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = trimmed.replace(',', '.');
  } else {
    normalized = trimmed;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const euros = Number.parseFloat(normalized);
  if (!Number.isFinite(euros)) return null;
  return Math.round(euros * 100);
}

export function fmtPrice(cents: number): string {
  return priceFormatter.format(cents / 100);
}
