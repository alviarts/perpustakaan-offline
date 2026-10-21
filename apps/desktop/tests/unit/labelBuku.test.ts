import { describe, expect, it } from 'vitest';
import { hurufJudul, kodePengarang, rakLabel } from '@/lib/labelBuku';

describe('labelBuku helpers', () => {
  describe('kodePengarang', () => {
    it('takes the first three letters of the last name', () => {
      expect(kodePengarang('Andrea Hirata')).toBe('HIR');
      expect(kodePengarang('J.K. Rowling')).toBe('ROW');
      expect(kodePengarang('Tere Liye')).toBe('LIY');
      expect(kodePengarang('Pramoedya Ananta Toer')).toBe('TOE');
    });

    it('ignores translator/role notes after ; or ,', () => {
      expect(kodePengarang('James Clear ; penerjemah, Alex Tri')).toBe('CLE');
    });

    it('falls back to XXX when there are no letters', () => {
      expect(kodePengarang('')).toBe('XXX');
      expect(kodePengarang('123')).toBe('XXX');
    });
  });

  describe('hurufJudul', () => {
    it('returns the first letter lowercased', () => {
      expect(hurufJudul('Laskar Pelangi')).toBe('l');
      expect(hurufJudul('  Bumi Manusia')).toBe('b');
    });

    it('skips leading punctuation', () => {
      expect(hurufJudul('"The Secret Garden"')).toBe('t');
    });

    it('returns a dash when there are no letters', () => {
      expect(hurufJudul('')).toBe('-');
      expect(hurufJudul('123')).toBe('-');
    });
  });

  describe('rakLabel', () => {
    it('prefixes RAK when missing', () => {
      expect(rakLabel('A1')).toBe('RAK A1');
      expect(rakLabel('9')).toBe('RAK 9');
    });

    it('does not double the RAK prefix', () => {
      expect(rakLabel('RAK B')).toBe('RAK B');
      expect(rakLabel('rak: 9')).toBe('rak: 9');
    });

    it('returns a dash for empty values', () => {
      expect(rakLabel('')).toBe('-');
      expect(rakLabel('   ')).toBe('-');
    });
  });
});
