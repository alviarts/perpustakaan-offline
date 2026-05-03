import { useEffect, useId, useRef, useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

/**
 * Reusable autocomplete (revisi #20).
 *
 * - 2-line item layout via `renderItem`.
 * - Fuzzy match via consumer-supplied `getMatchScore` (or built-in substring).
 * - Async results via `onQueryChange` (debounced upstream).
 *
 * Generic over the item type T.
 */
export interface AutocompleteProps<T> {
  /** Current text in the input. Controlled. */
  value: string;
  /** Called when user types. Use this to fetch + supply `items`. */
  onValueChange: (value: string) => void;
  /** Result items to display. */
  items: T[];
  /** Stable key for each item. */
  getItemKey: (item: T) => string | number;
  /** Render the visible item (recommended: 2-line). */
  renderItem: (item: T) => React.ReactNode;
  /** Called on user pick. */
  onSelect: (item: T) => void;
  /** Placeholder text in the input. */
  placeholder?: string;
  /** Empty-state text. */
  emptyText?: string;
  /** Test id for outer popover content. */
  'data-testid'?: string;
  /** Disable input. */
  disabled?: boolean;
  /** Loading flag (shows pulse on input). */
  isLoading?: boolean;
}

export function Autocomplete<T>({
  value,
  onValueChange,
  items,
  getItemKey,
  renderItem,
  onSelect,
  placeholder,
  emptyText = 'Tidak ada hasil.',
  disabled,
  isLoading,
  ...rest
}: AutocompleteProps<T>) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const id = useId();

  // Open whenever there's input text + at least one item.
  useEffect(() => {
    if (value.trim().length === 0) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [value, items.length]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative">
          <Command shouldFilter={false} className="overflow-visible bg-transparent">
            <CommandInput
              value={value}
              onValueChange={(v) => onValueChange(v)}
              placeholder={placeholder}
              disabled={disabled}
              data-testid={rest['data-testid'] ? `${rest['data-testid']}-input` : undefined}
              aria-controls={id}
              aria-expanded={open}
              className={isLoading ? 'animate-pulse' : undefined}
            />
          </Command>
        </div>
      </PopoverAnchor>
      {open && (
        <PopoverContent
          id={id}
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          data-testid={rest['data-testid']}
          className="p-0"
        >
          <Command shouldFilter={false}>
            <CommandList>
              {items.length === 0 ? (
                <CommandEmpty>{emptyText}</CommandEmpty>
              ) : (
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem
                      key={getItemKey(item)}
                      onSelect={() => {
                        onSelect(item);
                        setOpen(false);
                      }}
                    >
                      {renderItem(item)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      )}
    </Popover>
  );
}

/** Simple fuzzy score helper for callers that want to sort items. */
export function fuzzyScore(query: string, value: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const v = value.toLowerCase();
  if (v === q) return 100;
  if (v.startsWith(q)) return 80;
  if (v.includes(q)) return 60;
  // Subsequence match.
  let qi = 0;
  for (let i = 0; i < v.length && qi < q.length; i += 1) {
    if (v[i] === q[qi]) qi += 1;
  }
  return qi === q.length ? 30 : 0;
}
