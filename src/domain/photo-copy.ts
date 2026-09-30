import type { Day } from "@/data/schema";

/** Copiar a foto do exercício `from` para o `to`. `inline` é a imagem embutida de exercícios antigos. */
export interface PhotoCopy {
  from: string;
  to: string;
  inline?: string;
}

/**
 * As fotos a copiar depois de `cloneDaysWithNewIds`. O clone preserva a ordem de
 * dias e exercícios, então origem e cópia se casam por posição.
 */
export function photoCopies(source: Day[], copied: Day[]): PhotoCopy[] {
  const pairs: PhotoCopy[] = [];
  (source ?? []).forEach((d, i) => {
    (d.exercises ?? []).forEach((e, j) => {
      const target = copied[i]?.exercises?.[j];
      if (!target || !(e.hasPhoto || e.photoUrl)) return;
      pairs.push(e.photoUrl ? { from: e.id, to: target.id, inline: e.photoUrl } : { from: e.id, to: target.id });
    });
  });
  return pairs;
}

/** Marca `hasPhoto` nos exercícios cuja foto terminou de copiar. */
export function withPhotoFlags(days: Day[], exIds: ReadonlySet<string>): Day[] {
  return (days ?? []).map((d) => ({
    ...d,
    exercises: (d.exercises ?? []).map((e) => (exIds.has(e.id) ? { ...e, hasPhoto: true } : e)),
  }));
}
