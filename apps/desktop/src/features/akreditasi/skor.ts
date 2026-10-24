import { predikatFromScore, type Instrumen } from '@perpustakaan/shared';
import type { ButirJawaban } from '@/lib/akreditasi';

export interface KomponenSkor {
  no: number;
  judul: string;
  skor: number;
  skorMaks: number;
  bobot: number;
  /** Weighted contribution on the 0..bobot scale. */
  nilai: number;
  answered: number;
  total: number;
}

export interface HasilSkor {
  komponen: KomponenSkor[];
  /** Weighted final score on a 0..100 scale. */
  nilai: number;
  answered: number;
  total: number;
  predikat: 'A' | 'B' | 'C' | 'TidakTerakreditasi';
  /** Components with the largest lost points (improvement priorities). */
  gap: KomponenSkor[];
}

export function butirKey(komponen: number, butir: number): string {
  return `${komponen}:${butir}`;
}

export function toJawabanMap(rows: ButirJawaban[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.jawaban) map.set(butirKey(r.komponen, r.butir), r.jawaban);
  }
  return map;
}

export function computeSkor(instrumen: Instrumen, rows: ButirJawaban[]): HasilSkor {
  const map = toJawabanMap(rows);
  let answered = 0;

  const komponen: KomponenSkor[] = instrumen.komponen.map((k) => {
    const butirList = instrumen.butir.filter((b) => b.komponen === k.no);
    let skor = 0;
    let kompAnswered = 0;
    for (const b of butirList) {
      const j = map.get(butirKey(b.komponen, b.no));
      if (j && b.opsi[j as 'a' | 'b' | 'c' | 'd']) {
        skor += b.opsi[j as 'a' | 'b' | 'c' | 'd'].skor;
        kompAnswered += 1;
      }
    }
    answered += kompAnswered;
    const skorMaks = k.skorMaks || butirList.length * 4;
    const nilai = skorMaks > 0 ? (skor / skorMaks) * k.bobot : 0;
    return {
      no: k.no,
      judul: k.judul,
      skor,
      skorMaks,
      bobot: k.bobot,
      nilai,
      answered: kompAnswered,
      total: butirList.length,
    };
  });

  const nilai = komponen.reduce((acc, k) => acc + k.nilai, 0);
  const total = instrumen.butir.length;
  const gap = [...komponen]
    .map((k) => ({ ...k, lost: k.bobot - k.nilai }))
    .sort((a, b) => b.lost - a.lost);

  return {
    komponen,
    nilai,
    answered,
    total,
    predikat: predikatFromScore(nilai),
    gap,
  };
}
