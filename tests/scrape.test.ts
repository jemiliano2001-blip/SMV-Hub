import { describe, it, expect } from 'vitest';
import { parsePrice } from '@/lib/scrape';

describe('parsePrice', () => {
  it('should parse simple decimal strings', () => {
    expect(parsePrice('12.34')).toBe(12.34);
    expect(parsePrice('0.99')).toBe(0.99);
  });

  it('should remove currency symbols and letters', () => {
    expect(parsePrice('US $1234.56')).toBe(1234.56);
    expect(parsePrice('€45.00')).toBe(45.00);
    expect(parsePrice('MXN 100.50')).toBe(100.50);
  });

  it('should handle commas (assuming comma as thousand separator in this naive implementation)', () => {
    expect(parsePrice('1,234.56')).toBe(1234.56);
    // Note: this implementation just removes non-numbers, so 1,234 becomes 1234
    expect(parsePrice('1,234')).toBe(1234);
  });

  it('should handle malformed data with multiple dots', () => {
    expect(parsePrice('1.234.56')).toBe(1234.56);
    expect(parsePrice('.1.234.56')).toBe(1234.56);
  });

  it('should return null for empty or invalid strings', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
  });
});
