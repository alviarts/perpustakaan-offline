import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Paperclip, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-manager';
import { akreditasiApi, pickBuktiFile, type AkreditasiBuktiRow } from '@/lib/akreditasi';
import { BUKTI_WAJIB } from '@perpustakaan/shared';

export function AkreditasiBukti(): JSX.Element {
  const { t } = useTranslation(['akreditasi']);
  const { showToast } = useToast();
  const [saved, setSaved] = useState<Map<string, AkreditasiBuktiRow>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    akreditasiApi
      .buktiList()
      .then((rows) => {
        if (!cancel) setSaved(new Map(rows.map((r) => [r.kode, r])));
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const done = useMemo(
    () => BUKTI_WAJIB.filter((b) => saved.get(b.kode)?.ada).length,
    [saved],
  );

  async function persist(
    kode: string,
    ada: boolean,
    catatan: string,
    filePath: string,
  ): Promise<void> {
    try {
      const row = await akreditasiApi.buktiSet(kode, ada, catatan, filePath);
      setSaved((prev) => new Map(prev).set(kode, row));
    } catch {
      showToast({
        variant: 'destructive',
        title: t('akreditasi:bukti.saveError', { defaultValue: 'Gagal menyimpan bukti.' }),
      });
    }
  }

  async function handlePickFile(kode: string, catatan: string): Promise<void> {
    const src = await pickBuktiFile();
    if (!src) return;
    try {
      const { relPath } = await akreditasiApi.buktiUpload(src);
      await persist(kode, true, catatan, relPath);
    } catch (e) {
      showToast({
        variant: 'destructive',
        title: t('akreditasi:bukti.uploadError', { defaultValue: 'Gagal mengunggah berkas.' }),
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (loading) return <Skeleton className="h-[400px] w-full" />;

  return (
    <div className="flex flex-col gap-4" data-testid="akreditasi-bukti">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('akreditasi:bukti.title', { defaultValue: 'Checklist Bukti Fisik' })}
          </CardTitle>
          <CardDescription>
            {t('akreditasi:bukti.subtitle', {
              defaultValue: 'Tandai dokumen yang sudah tersedia untuk keperluan akreditasi',
            })}{' '}
            — {done}/{BUKTI_WAJIB.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col divide-y rounded-md border">
            {BUKTI_WAJIB.map((b) => {
              const row = saved.get(b.kode);
              const ada = row?.ada ?? false;
              const catatan = row?.catatan ?? '';
              const filePath = row?.filePath ?? '';
              const fileName = filePath ? filePath.split('/').pop() ?? filePath : '';
              return (
                <div key={b.kode} className="flex flex-col gap-2 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="flex flex-1 items-center gap-3">
                      <Checkbox
                        checked={ada}
                        onCheckedChange={(v) => persist(b.kode, v === true, catatan, filePath)}
                        data-testid={`bukti-${b.kode}`}
                      />
                      <span className="text-sm">{b.label}</span>
                      {b.wajib ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {t('akreditasi:bukti.wajib', { defaultValue: 'wajib' })}
                        </Badge>
                      ) : null}
                    </label>
                    <Input
                      className="sm:w-[280px]"
                      placeholder={t('akreditasi:bukti.catatanPlaceholder', {
                        defaultValue: 'Catatan / nomor dokumen',
                      })}
                      defaultValue={catatan}
                      onBlur={(e) => {
                        if (catatan !== e.target.value) {
                          void persist(b.kode, ada, e.target.value, filePath);
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    {filePath ? (
                      <>
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate text-xs text-muted-foreground">{fileName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => void akreditasiApi.buktiOpen(filePath)}
                        >
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          {t('akreditasi:bukti.buka', { defaultValue: 'Buka' })}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => void handlePickFile(b.kode, catatan)}
                        >
                          {t('akreditasi:bukti.ganti', { defaultValue: 'Ganti' })}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-destructive"
                          onClick={() => void persist(b.kode, ada, catatan, '')}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          {t('akreditasi:bukti.hapus', { defaultValue: 'Hapus' })}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => void handlePickFile(b.kode, catatan)}
                      >
                        <Paperclip className="mr-1 h-3.5 w-3.5" />
                        {t('akreditasi:bukti.lampirkan', { defaultValue: 'Lampirkan berkas' })}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
