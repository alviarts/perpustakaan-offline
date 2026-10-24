import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-manager';
import {
  DEFAULT_NOTA_TEMPLATE,
  printNota,
  type NotaPaper,
  type NotaPerPage,
  type NotaTemplate,
} from '@/lib/pdf/nota';
import { useIdentityStore } from '@/stores/identityStore';
import { FieldRow, SettingsSection } from './SettingsSection';

const LS_KEY = 'perpustakaan.nota.template';

export function loadNotaTemplate(): NotaTemplate {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_NOTA_TEMPLATE;
    return { ...DEFAULT_NOTA_TEMPLATE, ...(JSON.parse(raw) as Partial<NotaTemplate>) };
  } catch {
    return DEFAULT_NOTA_TEMPLATE;
  }
}

export function saveNotaTemplate(t: NotaTemplate): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(t));
  } catch {
    // ignore
  }
}

export function NotaTemplatePage(): JSX.Element {
  const { t } = useTranslation('settings');
  const { showToast } = useToast();
  const identity = useIdentityStore((s) => s.identity);
  const [tpl, setTpl] = React.useState<NotaTemplate>(() => loadNotaTemplate());

  const update = <K extends keyof NotaTemplate>(key: K, value: NotaTemplate[K]): void => {
    setTpl((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (): void => {
    saveNotaTemplate(tpl);
    showToast({ title: t('sections.nota.saveSuccess', { defaultValue: 'Template nota disimpan.' }) });
  };

  const handlePreview = (): void => {
    printNota(
      {
        nomor: 'PJ-CONTOH-0001',
        anggotaNama: 'Budi Santoso',
        anggotaKode: 'A0001',
        tanggalPinjam: '2026-10-24',
        tanggalJatuhTempo: '2026-10-31',
        items: [
          { judul: 'Laskar Pelangi', kode: '813-HIR-L-01-0', eksemplarKode: '813-HIR-L-01-0-01' },
          { judul: 'Bumi Manusia', kode: '899-TOE-B-01-0', eksemplarKode: '899-TOE-B-01-0-01' },
        ],
        totalDenda: 0,
        identitas: { nama: identity.nama, alamat: identity.alamat },
      },
      tpl,
    );
  };

  return (
    <div className="space-y-6">
      <SettingsSection i18nKey="nota" testId="settings-nota">
        <p className="text-sm text-muted-foreground">
          {t('sections.nota.description', {
            defaultValue:
              'Atur ukuran kertas, kop, dan isi nota. Berlaku untuk cetak satu maupun banyak sekaligus.',
          })}
        </p>
        <FieldRow label={t('sections.nota.paper', { defaultValue: 'Ukuran kertas' })}>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={tpl.paper}
            onChange={(e) => update('paper', e.target.value as NotaPaper)}
            data-testid="nota-paper"
          >
            <option value="a4">A4</option>
            <option value="a5">A5</option>
            <option value="thermal80">Thermal 80mm</option>
            <option value="thermal58">Thermal 58mm</option>
          </select>
        </FieldRow>

        <FieldRow label={t('sections.nota.perPage', { defaultValue: 'Nota per halaman (A4/A5)' })}>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={String(tpl.perPage)}
            onChange={(e) => update('perPage', Number(e.target.value) as NotaPerPage)}
            disabled={tpl.paper === 'thermal80' || tpl.paper === 'thermal58'}
            data-testid="nota-per-page"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="4">4</option>
          </select>
        </FieldRow>

        <FieldRow label={t('sections.nota.heading', { defaultValue: 'Judul nota' })}>
          <Input
            value={tpl.heading}
            onChange={(e) => update('heading', e.target.value)}
            data-testid="nota-heading"
          />
        </FieldRow>

        <FieldRow label={t('sections.nota.footer', { defaultValue: 'Catatan kaki' })}>
          <Input
            value={tpl.footer}
            onChange={(e) => update('footer', e.target.value)}
            data-testid="nota-footer"
          />
        </FieldRow>

        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['showAlamat', 'Tampilkan alamat perpustakaan'],
              ['showEksemplar', 'Tampilkan kolom kode eksemplar'],
              ['showDenda', 'Tampilkan ringkasan denda'],
              ['showTandaTangan', 'Tampilkan kolom tanda tangan'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={tpl[key]}
                onChange={(e) => update(key, e.target.checked)}
                data-testid={`nota-${key}`}
              />
              {t(`sections.nota.${key}`, { defaultValue: label })}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" onClick={handleSave} data-testid="nota-save">
            {t('common:action.save', { defaultValue: 'Simpan' })}
          </Button>
          <Button type="button" variant="outline" onClick={handlePreview}>
            <Printer className="mr-2 h-4 w-4" />
            {t('sections.nota.preview', { defaultValue: 'Pratinjau cetak' })}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setTpl(DEFAULT_NOTA_TEMPLATE);
              saveNotaTemplate(DEFAULT_NOTA_TEMPLATE);
            }}
          >
            {t('common:action.reset', { defaultValue: 'Reset' })}
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
