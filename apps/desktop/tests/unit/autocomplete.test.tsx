import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Autocomplete, fuzzyScore } from '@/components/shared/Autocomplete';

interface Item {
  id: number;
  nama: string;
  kelas: string;
}

function Wrapper({ onSelect }: { onSelect: (item: Item) => void }) {
  const items: Item[] = [
    { id: 1, nama: 'Budi', kelas: 'XII IPA' },
    { id: 2, nama: 'Citra', kelas: 'XII IPS' },
  ];
  const [value, setValue] = useState('');
  return (
    <Autocomplete
      value={value}
      onValueChange={setValue}
      items={items}
      getItemKey={(i) => i.id}
      renderItem={(i) => (
        <div>
          <div>{i.nama}</div>
          <div className="text-xs">{i.kelas}</div>
        </div>
      )}
      onSelect={onSelect}
      placeholder="cari"
      data-testid="ac"
    />
  );
}

describe('Autocomplete', () => {
  it('renders input with placeholder and accepts user typing', () => {
    const onSelect = vi.fn();
    render(<Wrapper onSelect={onSelect} />);
    const input = screen.getByPlaceholderText('cari');
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'Bu' } });
    expect((input as HTMLInputElement).value).toBe('Bu');
  });
});

describe('fuzzyScore', () => {
  it('returns 100 for exact match', () => {
    expect(fuzzyScore('budi', 'Budi')).toBe(100);
  });
  it('returns 80 for prefix match', () => {
    expect(fuzzyScore('bud', 'Budi Santoso')).toBe(80);
  });
  it('returns 60 for substring match', () => {
    expect(fuzzyScore('san', 'Budi Santoso')).toBe(60);
  });
  it('returns 30 for subsequence match', () => {
    expect(fuzzyScore('bdi', 'Budi')).toBe(30);
  });
  it('returns 0 for no match', () => {
    expect(fuzzyScore('xyz', 'Budi')).toBe(0);
  });
  it('returns 0 for empty query', () => {
    expect(fuzzyScore('', 'anything')).toBe(0);
  });
});
