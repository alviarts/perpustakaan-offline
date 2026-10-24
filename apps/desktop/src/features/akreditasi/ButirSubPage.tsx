import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-manager';
import {
  akreditasiApi,
  DEFAULT_AKREDITASI_PROFIL,
  type ButirJawaban,
} from '@/lib/akreditasi';
import { getJenjang } from '@perpustakaan/shared';
import { getInstrumen } from '@shared/instrumen';
import { butirKey, toJawabanMap } from './skor';

const OPSI: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];

export function AkreditasiButir(): JSX.Element {
  const { t } = useTranslation(['akreditasi']);
  const { showToast } = useToast();
  const [jenjang, setJenjang] = useState(DEFAULT_AKREDITASI_PROFIL.jenjang);
  const [rows, setRows] = useState<ButirJawaban[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const p = await akreditasiApi.profilGet();
        const list = await akreditasiApi.butirList(p.jenjang);
        if (cancel) return;
        setJenjang(p.jenjang);
        setRows(list);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const instrumen = useMemo(() => getInstrumen(jenjang), [jenjang]);
  const jw = useMemo(() => toJawabanMap(rows), [rows]);
  const answered = jw.size;

  async function setJawaban(komponen: number, butir: number, jawaban: string, catatan: string): Promise<void> {
    try {
      const row = await akreditasiApi.butirSet(jenjang, komponen, butir, jawaban, catatan);
      setRows((prev) => {
        const next = prev.filter((r) => !(r.komponen === komponen && r.butir === butir));
        next.push(row);
        return next;
      });
    } catch {
      showToast({
        variant: 'destructive',
        title: t('akreditasi:butirPenilaian.saveError', { defaultValue: 'Gagal menyimpan jawaban.' }),
      });
    }
  }

  async function handleReset(): Promise<void> {
    await akreditasiApi.butirReset(jenjang);
    setRows([]);
    showToast({ title: t('akreditasi:butirPenilaian.resetDone', { defaultValue: 'Jawaban direset.' }) });
  }

  if (loading) return <Skeleton className="h-[400px] w-full" />;

  if (!instrumen) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {t('akreditasi:butirPenilaian.noInstrumen', {
            defaultValue: 'Instrumen untuk jenjang ini belum tersedia.',
          })}
        </CardContent>
      </Card>
    );
  }

  const jenjangDef = getJenjang(jenjang);

  return (
    <div className="flex flex-col gap-4" data-testid="akreditasi-butir">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <Badge variant="secondary" className="mr-2">
            {jenjangDef?.label ?? jenjang}
          </Badge>
          {t('akreditasi:butirPenilaian.progress', {
            defaultValue: 'Terjawab: {{done}}/{{total}}',
            done: answered,
            total: instrumen.butir.length,
          })}
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={answered === 0}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {t('akreditasi:butirPenilaian.reset', { defaultValue: 'Reset Jawaban' })}
        </Button>
      </div>

      {instrumen.komponen.map((k) => (
        <Card key={k.no}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {k.no}. {k.judul}
            </CardTitle>
            <CardDescription>
              {k.butir} {t('akreditasi:profil.butir', { defaultValue: 'butir' })} ·{' '}
              {t('akreditasi:butirPenilaian.skorMaks', { defaultValue: 'Skor maks' })} {k.skorMaks} ·{' '}
              {t('akreditasi:butirPenilaian.bobot', { defaultValue: 'Bobot' })} {k.bobot}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y p-0">
            {instrumen.butir
              .filter((b) => b.komponen === k.no)
              .map((b) => {
                const cur = jw.get(butirKey(b.komponen, b.no)) ?? '';
                const catatan = rows.find((r) => r.komponen === b.komponen && r.butir === b.no)?.catatan ?? '';
                return (
                  <div key={b.no} className="flex flex-col gap-3 p-4">
                    <div className="text-sm font-medium">
                      {b.komponen}.{b.no} {b.teks}
                    </div>
                    {b.bukti && (
                      <details className="rounded-md border bg-muted/30 p-2 text-xs">
                        <summary className="cursor-pointer font-medium text-muted-foreground">
                          {t('akreditasi:butirPenilaian.bukti', { defaultValue: 'Bukti fisik yang diperlukan' })}
                        </summary>
                        <p className="mt-2 whitespace-pre-line text-muted-foreground">{b.bukti}</p>
                      </details>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {OPSI.map((key) => {
                        const o = b.opsi[key];
                        if (!o) return null;
                        const id = `o-${b.komponen}-${b.no}-${key}`;
                        return (
                          <label
                            key={key}
                            htmlFor={id}
                            className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs transition-colors ${
                              cur === key ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                            }`}
                          >
                            <input
                              id={id}
                              type="radio"
                              name={`j-${b.komponen}-${b.no}`}
                              checked={cur === key}
                              onChange={() => setJawaban(b.komponen, b.no, key, catatan)}
                              className="mt-0.5"
                            />
                            <span>
                              <span className="font-semibold uppercase">
                                {key} — {o.label} ({t('akreditasi:butirPenilaian.skor', { defaultValue: 'skor' })} {o.skor})
                              </span>
                              <br />
                              <span className="text-muted-foreground">{o.kriteria}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <Input
                      placeholder={t('akreditasi:butirPenilaian.catatanPlaceholder', {
                        defaultValue: 'Catatan / bukti pendukung',
                      })}
                      defaultValue={catatan}
                      onBlur={(e) => {
                        if (catatan !== e.target.value) {
                          void setJawaban(b.komponen, b.no, cur, e.target.value);
                        }
                      }}
                    />
                  </div>
                );
              })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
