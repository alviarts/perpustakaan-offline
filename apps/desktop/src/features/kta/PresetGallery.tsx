import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KtaPreview } from './KtaPreview';
import { KTA_PRESETS, type KtaPreset } from './presets';
import type { Anggota } from '@/lib/anggota';
import type { LibraryIdentity } from '@/stores/identityStore';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Used to render the live thumbnail with the operator's school name. */
  identity: LibraryIdentity;
  /** Sample member used to populate the thumbnail; can be `null` for fresh installs. */
  previewAnggota: Anggota | null;
  /** Fires when the operator picks a preset; the parent decides how to apply it. */
  onPick: (preset: KtaPreset) => void;
}

/**
 * Modal gallery surfacing the bundled `KTA_PRESETS`. Each card renders a
 * scaled-down `KtaPreview` so operators see the design as it will print.
 * Picking a card calls `onPick(preset)` and closes the dialog — the parent
 * is then responsible for loading the preset's `layout` into the editor
 * and persisting it via `ktaApi.create` / `ktaApi.update`.
 */
export function PresetGallery({ open, onOpenChange, identity, previewAnggota, onPick }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('kta:gallery.title', 'Galeri Template KTA')}</DialogTitle>
          <DialogDescription>
            {t(
              'kta:gallery.description',
              'Pilih salah satu desain bawaan untuk dijadikan titik awal. Setelah dipilih, Anda tetap bisa mengubah warna, posisi, dan teks lewat editor template.',
            )}
          </DialogDescription>
        </DialogHeader>
        <ul
          data-testid="kta-preset-gallery"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {KTA_PRESETS.map((preset) => (
            <li
              key={preset.id}
              className="rounded-lg border border-border bg-card p-3 hover:border-primary transition-colors flex flex-col gap-3"
            >
              <div className="flex items-center justify-center min-h-[140px]">
                <KtaPreview
                  layout={preset.layout}
                  anggota={previewAnggota}
                  identity={identity}
                  scale={0.55}
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
                data-testid={`kta-preset-pick-${preset.id}`}
              >
                {t('kta:gallery.use', 'Gunakan template ini')}
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
