import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { akreditasiApi, type ArsipRow } from '@/lib/akreditasi';
import { printHtml } from '@/features/laporan/utils';

interface Snapshot {
  html?: string;
  nilai?: number;
  predikat?: string;
}

function parseSnapshot(json: string): Snapshot {
  try {
    return JSON.parse(json) as Snapshot;
  } catch {
    return {};
  }
}

export function AkreditasiArsip(): JSX.Element {
  const { t } = useTranslation(['akreditasi']);
  const [rows, setRows] = useState<ArsipRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    akreditasiApi
      .arsipList()
      .then((list) => {
        if (!cancel) setRows(list);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  async function handleReprint(row: ArsipRow): Promise<void> {
    const snap = parseSnapshot(row.kontenJson);
    if (snap.html) printHtml(snap.html);
  }

  async function handleDelete(id: number): Promise<void> {
    await akreditasiApi.arsipDelete(id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) return <Skeleton className="h-[300px] w-full" />;

  return (
    <div className="flex flex-col gap-4" data-testid="akreditasi-arsip">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('akreditasi:arsip.title', { defaultValue: 'Arsip Laporan Tersahkan' })}
          </CardTitle>
          <CardDescription>
            {t('akreditasi:arsip.subtitle', {
              defaultValue: 'Snapshot laporan yang tidak berubah meski data bertambah',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-muted-foreground">
              {t('akreditasi:arsip.empty', { defaultValue: 'Belum ada laporan diarsipkan.' })}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm" data-testid="akreditasi-arsip-table">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">{t('akreditasi:arsip.jenjang', { defaultValue: 'Jenjang' })}</th>
                    <th className="px-3 py-2 text-right">{t('akreditasi:skor.nilaiAkhir', { defaultValue: 'Nilai' })}</th>
                    <th className="px-3 py-2">{t('akreditasi:skor.predikat', { defaultValue: 'Predikat' })}</th>
                    <th className="px-3 py-2">{t('akreditasi:arsip.penandatangan', { defaultValue: 'Penandatangan' })}</th>
                    <th className="px-3 py-2">{t('akreditasi:arsip.tanggal', { defaultValue: 'Tanggal' })}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const snap = parseSnapshot(r.kontenJson);
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2">{r.periode ?? r.jenjang ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {(r.nilai ?? snap.nilai ?? 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary">{r.predikat ?? snap.predikat ?? '—'}</Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {r.penandatangan ?? '—'}
                          {r.jabatan ? ` (${r.jabatan})` : ''}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {r.createdAt.slice(0, 19).replace('T', ' ')}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => void handleReprint(r)}>
                              <Printer className="mr-1 h-3.5 w-3.5" />
                              {t('akreditasi:bukuBukti.print', { defaultValue: 'Cetak' })}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => void handleDelete(r.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
