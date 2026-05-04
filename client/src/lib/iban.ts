export function cleanIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

export function formatIban(input: string): string {
  const cleaned = cleanIban(input);
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

export function isValidIban(input: string): boolean {
  const iban = cleanIban(input);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(iban)) return false;
  if (iban.length < 15 || iban.length > 34) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const value =
      code >= 65 && code <= 90 ? code - 55 : code >= 48 && code <= 57 ? code - 48 : -1;
    if (value < 0) return false;
    if (value < 10) {
      remainder = (remainder * 10 + value) % 97;
    } else {
      remainder = (remainder * 100 + value) % 97;
    }
  }
  return remainder === 1;
}
