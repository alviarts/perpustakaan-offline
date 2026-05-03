import * as React from 'react';
import { ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { fuzzySearch } from '@/lib/fuzzy';

export interface AutocompleteOption {
  value: string;
  label: string;
  /** Optional secondary line shown beneath label (revisi #20: 2-line item). */
  hint?: string | null;
}

interface AutocompleteProps {
  options: AutocompleteOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** When true, the user can type a value not present in `options`. */
  allowCustomValue?: boolean;
  disabled?: boolean;
  className?: string;
  /** `data-testid` to expose for e2e tests. */
  'data-testid'?: string;
  /** Optional id for label/htmlFor association. */
  id?: string;
}

/**
 * Generic autocomplete (revisi #20). Wraps shadcn Command + Popover with a
 * 2-line item layout (label + hint), fuzzy match, keyboard navigation, and a
 * popup whose width follows the trigger via CSS variable.
 */
export const Autocomplete: React.FC<AutocompleteProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Pilih…',
  searchPlaceholder = 'Cari…',
  emptyText = 'Tidak ada hasil',
  allowCustomValue = false,
  disabled,
  className,
  id,
  ...rest
}) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [popoverWidth, setPopoverWidth] = React.useState<number | undefined>();

  const selected = React.useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value],
  );

  const filtered = React.useMemo(() => {
    if (!query.trim()) return options.slice(0, 50);
    return fuzzySearch({
      items: options,
      query,
      fields: [(opt) => opt.label, (opt) => opt.hint, (opt) => opt.value],
      limit: 50,
    });
  }, [options, query]);

  const handleSelect = (next: string | null): void => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    if (next && triggerRef.current) {
      setPopoverWidth(triggerRef.current.getBoundingClientRect().width);
    }
  };

  const showCustom =
    allowCustomValue &&
    query.trim().length > 0 &&
    !filtered.some((opt) => opt.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selected && !value && 'text-muted-foreground',
            className,
          )}
          data-testid={rest['data-testid']}
        >
          <span className="truncate">
            {selected?.label ?? value ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        sideOffset={4}
        style={popoverWidth ? { width: popoverWidth } : undefined}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {filtered.length === 0 && !showCustom ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : (
              <CommandGroup>
                {value && (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => handleSelect(null)}
                    className="text-muted-foreground"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Kosongkan pilihan
                  </CommandItem>
                )}
                {filtered.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.value}__${opt.label}`}
                    onSelect={() => handleSelect(opt.value)}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{opt.label}</span>
                      {opt.hint && (
                        <span className="truncate text-xs text-muted-foreground">{opt.hint}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
                {showCustom && (
                  <CommandItem
                    value={`__custom__:${query.trim()}`}
                    onSelect={() => handleSelect(query.trim())}
                  >
                    <span className="text-sm">
                      Gunakan &ldquo;<span className="font-medium">{query.trim()}</span>&rdquo;
                    </span>
                  </CommandItem>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
