import { describe, it, expect } from 'vitest';
import { generateId } from './ids';

describe('generateId', () => {
  it('returns a 16-character string by default', () => {
    const id = generateId();
    expect(id).toHaveLength(16);
  });

  it('only contains lowercase alphanumerics', () => {
    const id = generateId(64);
    expect(id).toMatch(/^[0-9a-z]+$/);
  });

  it('respects custom length', () => {
    expect(generateId(8)).toHaveLength(8);
    expect(generateId(32)).toHaveLength(32);
  });

  it('produces unique-looking ids', () => {
    const set = new Set<string>();
    for (let i = 0; i < 500; i++) set.add(generateId());
    expect(set.size).toBe(500);
  });
});
