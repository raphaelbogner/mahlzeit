export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 20;

// Clamp any number into the allowed quantity range. Non-finite input (NaN
// from an empty field) falls back to the minimum.
export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return MIN_QUANTITY;
  const n = Math.trunc(value);
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, n));
}

// Parse free text from the stepper's input. Returns null when the text is
// not a plain integer so the caller can keep the previous value.
export function parseQuantity(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  return clampQuantity(Number.parseInt(trimmed, 10));
}

export function lineTotalCents(priceCents: number | null, quantity: number): number | null {
  if (priceCents === null) return null;
  return priceCents * clampQuantity(quantity);
}
