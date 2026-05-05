import { useTranslation } from 'react-i18next';
import { ImportWizard } from '@/components/shared/ImportWizard';
import { bukuApi, type BukuImportItem } from '@/lib/buku';
import type { ImportWizardResult } from '@/components/shared/ImportWizard';
import type { ImportFieldDef } from '@/lib/importWizard';

interface ImportBukuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (result: ImportWizardResult) => void;
}

export function ImportBukuDialog({ open, onOpenChange, onImported }: ImportBukuDialogProps) {
  const { t } = useTranslation(['buku', 'common']);

  const fields: ImportFieldDef<BukuImportItem>[] = [
    {
      key: 'kodeBuku',
      label: t('buku:columns.kode', { defaultValue: 'Kode Buku' }),
      required: true,
      aliases: ['kode_buku', 'kodebuku', 'kode', 'book_code'],
      sample: 'BK-0001',
    },
    {
      key: 'judul',
      label: t('buku:columns.judul', { defaultValue: 'Judul' }),
      required: true,
      aliases: ['title', 'book_title'],
      sample: 'Bumi Manusia',
    },
    {
      key: 'pengarang',
      label: t('buku:columns.pengarang', { defaultValue: 'Pengarang' }),
      required: false,
      aliases: ['author', 'penulis'],
      sample: 'Pramoedya Ananta Toer',
    },
    {
      key: 'penerbit',
      label: t('buku:columns.penerbit', { defaultValue: 'Penerbit' }),
      required: false,
      aliases: ['publisher'],
      sample: 'Hasta Mitra',
    },
    {
      key: 'tahunTerbit',
      label: t('buku:columns.tahun', { defaultValue: 'Tahun Terbit' }),
      required: false,
      aliases: ['tahun', 'tahun_terbit', 'year', 'year_published'],
      sample: '1980',
      validate: (v) => {
        const n = Number(v);
        if (!Number.isFinite(n) || !Number.isInteger(n)) return 'Tahun tidak valid';
        if (n < 1000 || n > 2100) return 'Tahun di luar rentang 1000–2100';
        return null;
      },
    },
    {
      key: 'kodeDdc',
      label: t('buku:columns.ddc', { defaultValue: 'Kode DDC' }),
      required: false,
      aliases: ['ddc', 'kode_ddc', 'klasifikasi'],
      sample: '899.221',
    },
    {
      key: 'kategori',
      label: t('buku:columns.kategori', { defaultValue: 'Kategori' }),
      required: false,
      aliases: ['category'],
      sample: 'Fiksi',
    },
    {
      key: 'isbn',
      label: 'ISBN',
      required: false,
      aliases: ['isbn'],
      sample: '978-602-7888-71-2',
    },
    {
      key: 'jumlahEksemplar',
      label: t('buku:columns.eksemplar', { defaultValue: 'Jumlah Eksemplar' }),
      required: false,
      aliases: ['jumlah', 'jumlah_eksemplar', 'copies', 'qty'],
      sample: '3',
      validate: (v) => {
        const n = Number(v);
        if (!Number.isFinite(n) || !Number.isInteger(n)) return 'Jumlah tidak valid';
        if (n < 0 || n > 9999) return 'Jumlah di luar rentang 0–9999';
        return null;
      },
    },
    {
      key: 'bahasa',
      label: t('buku:columns.bahasa', { defaultValue: 'Bahasa' }),
      required: false,
      aliases: ['language', 'lang'],
      sample: 'Indonesia',
    },
  ];

  const rowParser = (raw: Record<string, string>): BukuImportItem => {
    const item: BukuImportItem = {
      kodeBuku: (raw.kodeBuku ?? '').trim(),
      judul: (raw.judul ?? '').trim(),
    };
    const pengarang = (raw.pengarang ?? '').trim();
    if (pengarang) item.pengarang = pengarang;
    const penerbit = (raw.penerbit ?? '').trim();
    if (penerbit) item.penerbit = penerbit;
    const tahun = (raw.tahunTerbit ?? '').trim();
    if (tahun) {
      const n = Number(tahun);
      if (Number.isFinite(n)) item.tahunTerbit = Math.trunc(n);
    }
    const ddc = (raw.kodeDdc ?? '').trim();
    if (ddc) item.kodeDdc = ddc;
    const kategori = (raw.kategori ?? '').trim();
    if (kategori) item.kategori = kategori;
    const isbn = (raw.isbn ?? '').trim();
    if (isbn) item.isbn = isbn;
    const jumlah = (raw.jumlahEksemplar ?? '').trim();
    if (jumlah) {
      const n = Number(jumlah);
      if (Number.isFinite(n)) item.jumlahEksemplar = Math.trunc(n);
    }
    const bahasa = (raw.bahasa ?? '').trim();
    if (bahasa) item.bahasa = bahasa;
    return item;
  };

  return (
    <ImportWizard<BukuImportItem>
      open={open}
      onOpenChange={onOpenChange}
      title={t('buku:import.title', { defaultValue: 'Impor Buku dari Excel/CSV' })}
      description={t('buku:import.description', {
        defaultValue:
          'Unggah file lalu cocokkan kolomnya dengan field aplikasi. Baris dengan error akan dilewati.',
      })}
      fields={fields}
      templateSheetName="Buku"
      templateFilename="template-impor-buku.xlsx"
      rowParser={rowParser}
      onImport={async (items) => bukuApi.importBatch(items)}
      onImported={onImported}
    />
  );
}
