import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen, Plus, Save, User2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Autocomplete, type AutocompleteOption } from '@/components/shared/Autocomplete';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/components/ui/toast-manager';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import { bukuApi, type Buku } from '@/lib/buku';
import { formatTauriError } from '@/lib/errors';
import {
  peminjamanApi,
  type AnggotaSummary,
  type BukuSummary,
} from '@/lib/peminjaman';

const MAX_BUKU = 10;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function PeminjamanForm() {
  const { t } = useTranslation(['peminjaman', 'common']);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [bukuList, setBukuList] = useState<Buku[]>([]);
  const [anggotaId, setAnggotaId] = useState<number | null>(null);
  const [anggotaSummary, setAnggotaSummary] = useState<AnggotaSummary | null>(null);
  const [bukuIds, setBukuIds] = useState<number[]>([]);
  const [bukuSummaries, setBukuSummaries] = useState<Record<number, BukuSummary>>({});
  const [tanggalPinjam, setTanggalPinjam] = useState<string>(todayIso());
  const [tanggalJt, setTanggalJt] = useState<string>(plusDays(7));
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load top-N anggota + buku for autocomplete (fuzzy filtered locally).
  useEffect(() => {
    let cancel = false;
    Promise.all([
      anggotaApi.list({ aktif: true, limit: 200 }).catch(() => ({ items: [] as Anggota[] })),
      bukuApi.list({ limit: 200 }).catch(() => ({ items: [] as Buku[] })),
    ]).then(([a, b]) => {
      if (cancel) return;
      setAnggotaList((a as { items: Anggota[] }).items ?? []);
      setBukuList((b as { items: Buku[] }).items ?? []);
    });
    return () => {
      cancel = true;
    };
  }, []);

  // Fetch summary panel info when anggota selected.
  useEffect(() => {
    if (anggotaId == null) {
      setAnggotaSummary(null);
      return;
    }
    let cancel = false;
    peminjamanApi
      .anggotaSummary(anggotaId)
      .then((s) => !cancel && setAnggotaSummary(s))
      .catch(() => !cancel && setAnggotaSummary(null));
    return () => {
      cancel = true;
    };
  }, [anggotaId]);

  // Fetch buku summaries for added items.
  useEffect(() => {
    let cancel = false;
    Promise.all(
      bukuIds.map((id) =>
        peminjamanApi
          .bukuSummary(id)
          .then((s) => [id, s] as const)
          .catch(() => null),
      ),
    ).then((rows) => {
      if (cancel) return;
      const map: Record<number, BukuSummary> = {};
      for (const r of rows) {
        if (r) map[r[0]] = r[1];
      }
      setBukuSummaries(map);
    });
    return () => {
      cancel = true;
    };
  }, [bukuIds]);

  const anggotaOptions = useMemo<AutocompleteOption[]>(
    () =>
      anggotaList.map((a) => ({
        value: String(a.id),
        label: a.nama,
        hint: `${a.kodeAnggota}${a.kelas ? ` · ${a.kelas}` : ''}`,
      })),
    [anggotaList],
  );

  const bukuOptions = useMemo<AutocompleteOption[]>(
    () =>
      bukuList
        .filter((b) => b.jumlahTersedia > 0 && !bukuIds.includes(b.id))
        .map((b) => ({
          value: String(b.id),
          label: b.judul,
          hint: `${b.kodeBuku}${b.pengarang ? ` · ${b.pengarang}` : ''} · ${b.jumlahTersedia} tersedia`,
        })),
    [bukuList, bukuIds],
  );

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (anggotaId == null) e.anggota = t('peminjaman:error.anggotaRequired', { defaultValue: 'Pilih anggota' });
    if (bukuIds.length === 0) e.buku = t('peminjaman:error.bukuRequired', { defaultValue: 'Pilih minimal 1 buku' });
    if (bukuIds.length > MAX_BUKU)
      e.buku = t('peminjaman:error.bukuMax', { defaultValue: `Maksimum ${MAX_BUKU} buku` });
    if (!tanggalPinjam) e.tanggalPinjam = t('peminjaman:error.tanggalPinjam', { defaultValue: 'Tanggal pinjam wajib diisi' });
    if (!tanggalJt) e.tanggalJt = t('peminjaman:error.tanggalJt', { defaultValue: 'Tanggal jatuh tempo wajib diisi' });
    if (tanggalPinjam && tanggalJt && tanggalJt < tanggalPinjam) {
      e.tanggalJt = t('peminjaman:error.jtBeforePinjam', {
        defaultValue: 'Jatuh tempo tidak boleh sebelum tanggal pinjam',
      });
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(): Promise<void> {
    if (!validate() || anggotaId == null) return;
    setSubmitting(true);
    try {
      const result = await peminjamanApi.create({
        anggotaId,
        bukuIds,
        tanggalPinjam,
        tanggalJatuhTempo: tanggalJt,
        catatan: catatan.trim() || undefined,
      });
      showToast({
        title: t('peminjaman:feedback.created', { defaultValue: 'Peminjaman berhasil dibuat' }),
        description: result.header.nomorPinjam,
      });
      void navigate({ to: '/peminjaman/$id', params: { id: String(result.header.id) } });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('peminjaman:feedback.createError', { defaultValue: 'Gagal membuat peminjaman' }),
        description: formatTauriError(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="peminjaman-form">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/peminjaman' })}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('common:action.back', { defaultValue: 'Kembali' })}
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">
            {t('peminjaman:form.title', { defaultValue: 'Pinjam Baru' })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('peminjaman:form.subtitle', { defaultValue: 'Pilih anggota & buku' })}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form column */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('peminjaman:form.anggota', { defaultValue: 'Anggota' })}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Autocomplete
                options={anggotaOptions}
                value={anggotaId == null ? null : String(anggotaId)}
                onChange={(v) => setAnggotaId(v ? Number(v) : null)}
                placeholder={t('peminjaman:form.anggotaPlaceholder', { defaultValue: 'Cari nama / NIS' })}
                searchPlaceholder={t('common:autocomplete.search', { defaultValue: 'Cari…' })}
                emptyText={t('common:autocomplete.empty', { defaultValue: 'Tidak ada hasil' })}
                data-testid="peminjaman-anggota-autocomplete"
              />
              {errors.anggota && <p className="text-xs text-rose-600">{errors.anggota}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {t('peminjaman:form.buku', { defaultValue: 'Buku' })}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {bukuIds.length}/{MAX_BUKU}
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Autocomplete
                options={bukuOptions}
                value={null}
                onChange={(v) => {
                  if (v && bukuIds.length < MAX_BUKU) setBukuIds([...bukuIds, Number(v)]);
                }}
                placeholder={t('peminjaman:form.bukuPlaceholder', { defaultValue: 'Tambah buku…' })}
                searchPlaceholder={t('common:autocomplete.search', { defaultValue: 'Cari…' })}
                emptyText={t('common:autocomplete.empty', { defaultValue: 'Tidak ada hasil' })}
                disabled={bukuIds.length >= MAX_BUKU}
                data-testid="peminjaman-buku-autocomplete"
              />
              {errors.buku && <p className="text-xs text-rose-600">{errors.buku}</p>}
              {bukuIds.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {bukuIds.map((id) => {
                    const b = bukuSummaries[id];
                    return (
                      <li
                        key={id}
                        className="flex items-center gap-2 rounded border border-border bg-muted/40 px-3 py-2 text-sm"
                      >
                        <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{b?.judul ?? `Buku ${id}`}</p>
                          {b && (
                            <p className="text-xs text-muted-foreground">
                              {b.kodeBuku}
                              {b.pengarang ? ` · ${b.pengarang}` : ''}
                            </p>
                          )}
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setBukuIds(bukuIds.filter((x) => x !== id))}
                              aria-label={t('common:actions.delete', { defaultValue: 'Hapus' })}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('common:actions.delete', { defaultValue: 'Hapus' })}
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('peminjaman:form.tanggal', { defaultValue: 'Tanggal' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 xl:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t('peminjaman:form.tanggalPinjam', { defaultValue: 'Tanggal Pinjam' })}
                </label>
                <DatePicker
                  value={tanggalPinjam}
                  onChange={(v) => setTanggalPinjam(v)}
                  ariaLabel={t('peminjaman:form.tanggalPinjam', { defaultValue: 'Tanggal Pinjam' }) as string}
                />
                {errors.tanggalPinjam && (
                  <p className="text-xs text-rose-600 mt-1">{errors.tanggalPinjam}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t('peminjaman:form.tanggalJt', { defaultValue: 'Jatuh Tempo' })}
                </label>
                <DatePicker
                  value={tanggalJt}
                  min={tanggalPinjam || undefined}
                  onChange={(v) => setTanggalJt(v)}
                  ariaLabel={t('peminjaman:form.tanggalJt', { defaultValue: 'Jatuh Tempo' }) as string}
                />
                {errors.tanggalJt && <p className="text-xs text-rose-600 mt-1">{errors.tanggalJt}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('peminjaman:form.catatan', { defaultValue: 'Catatan' })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder={t('peminjaman:form.catatanPlaceholder', { defaultValue: 'Opsional' })}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate({ to: '/peminjaman' })}>
              {t('common:action.cancel', { defaultValue: 'Batal' })}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} data-testid="peminjaman-submit">
              <Save className="mr-2 h-4 w-4" />
              {submitting
                ? t('common:state.submitting', { defaultValue: 'Menyimpan…' })
                : t('peminjaman:form.submit', { defaultValue: 'Simpan & Pinjam' })}
            </Button>
          </div>
        </div>

        {/* Info panel */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('peminjaman:panel.anggotaInfo', { defaultValue: 'Info Anggota' })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {anggotaSummary ? (
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold">{anggotaSummary.nama}</p>
                    <p className="text-xs text-muted-foreground">
                      {anggotaSummary.kodeAnggota}
                      {anggotaSummary.kelas ? ` · ${anggotaSummary.kelas}` : ''}
                    </p>
                    <div className="flex gap-3 pt-1 text-xs">
                      <span>
                        {t('peminjaman:panel.aktif', { defaultValue: 'Aktif' })}:{' '}
                        <strong>{anggotaSummary.aktifCount}</strong>
                      </span>
                      <span className={anggotaSummary.overdueCount > 0 ? 'text-rose-600' : ''}>
                        {t('peminjaman:panel.overdue', { defaultValue: 'Overdue' })}:{' '}
                        <strong>{anggotaSummary.overdueCount}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('peminjaman:panel.anggotaEmpty', { defaultValue: 'Pilih anggota dulu' })}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('peminjaman:panel.bukuInfo', { defaultValue: 'Info Buku' })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bukuIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('peminjaman:panel.bukuEmpty', { defaultValue: 'Belum ada buku dipilih' })}
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {bukuIds.map((id) => {
                    const b = bukuSummaries[id];
                    return (
                      <li key={id} className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{b?.judul ?? `Buku ${id}`}</p>
                          {b && (
                            <p className="text-xs text-muted-foreground">
                              {t('peminjaman:panel.tersedia', { defaultValue: 'Tersedia' })}:{' '}
                              {b.jumlahTersedia}/{b.jumlahEksemplar}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">
                {t('peminjaman:panel.note', { defaultValue: 'Catatan' })}
              </p>
              <p>
                {t('peminjaman:panel.noteText', {
                  defaultValue: 'Setelah submit, sistem akan otomatis mencatat kunjungan & mengurangi stok eksemplar.',
                })}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Plus className="h-3 w-3" />
                <span className="text-xs">
                  {t('peminjaman:panel.printHint', {
                    defaultValue: 'Print nota tersedia di halaman detail setelah submit.',
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
