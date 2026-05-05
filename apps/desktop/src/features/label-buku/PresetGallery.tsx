import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LabelBukuPreview } from './LabelBukuPreview';
import { LABEL_BUKU_PRESETS, type LabelBukuPreset } from './presets';
import { defaultBukuSample } from '@/lib/labelBuku';
import type { LibraryIdentity } from '@/stores/identityStore';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identity: LibraryIdentity;
  onPick: (preset: LabelBukuPreset) => void;
}

/**
 * Modal gallery surfacing the bundled `LABEL_BUKU_PRESETS`. Mirrors
 * `kta/PresetGallery.tsx` — picking a card calls `onPick(preset)` and
 * the parent decides how to apply it (copy into editor, persist, etc.).
 */
export function PresetGallery({ open, onOpenChange, identity, onPick }: Props) {
  const { t } = useTranslation('label-buku');
  const sample = defaultBukuSample();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('gallery.title', { defaultValue: 'Galeri Template Label Buku' })}
          </DialogTitle>
          <DialogDescription>
            {t('gallery.description', {
              defaultValue:
                'Pilih salah satu desain bawaan untuk dijadikan titik awal. Setelah dipilih, Anda tetap bisa mengubah warna, posisi, dan teks lewat editor template.',
            })}
          </DialogDescription>
        </DialogHeader>
        <ul
          data-testid="label-buku-preset-gallery"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {LABEL_BUKU_PRESETS.map((preset) => (
            <li
              key={preset.id}
              className="rounded-lg border border-border bg-card p-3 hover:border-primary transition-colors flex flex-col gap-3"
            >
              <div className="flex items-center justify-center min-h-[140px] bg-muted/40 rounded-md">
                <LabelBukuPreview
                  layout={preset.layout}
                  buku={sample}
                  identity={identity}
                  scale={preset.layout.heightMm > preset.layout.widthMm ? 1.3 : 1.05}
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{preset.nama}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{preset.deskripsi}</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  onPick(preset);
                  onOpenChange(false);
                }}
                data-testid={`label-buku-preset-pick-${preset.id}`}
              >
                {t('gallery.use', { defaultValue: 'Gunakan template ini' })}
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
