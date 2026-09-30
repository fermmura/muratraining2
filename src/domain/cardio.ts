import type { CardioEntry } from "@/data/schema";

export interface CardioZone {
  key: string;
  label: string;
}

/** As mesmas do 1.0 (app.js:3098-3104). A chave é o que fica gravado. */
export const CARDIO_ZONES: readonly CardioZone[] = [
  { key: "Z1", label: "Z1 · muito leve" },
  { key: "Z2", label: "Z2 · leve" },
  { key: "Z3", label: "Z3 · moderada" },
  { key: "Z4", label: "Z4 · intensa" },
  { key: "Z5", label: "Z5 · máxima" },
];

/** Minutos digitados no formulário: inteiro positivo, ou null. */
export function parseMinutes(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const minutes = Number(trimmed);
  return minutes > 0 ? minutes : null;
}

export interface CardioTotals {
  totalMin: number;
  byZone: Record<string, number>;
  count: number;
}

/** Soma os registros a partir de `sinceDateKey`, inclusive. */
export function cardioTotals(entries: CardioEntry[], sinceDateKey: string): CardioTotals {
  const totals: CardioTotals = { totalMin: 0, byZone: {}, count: 0 };
  for (const e of entries ?? []) {
    if (e.dateKey < sinceDateKey) continue;
    // o 1.0 pode ter gravado os minutos como texto
    const minutes = Number(e.minutes) || 0;
    totals.totalMin += minutes;
    totals.count++;
    if (e.zone) totals.byZone[e.zone] = (totals.byZone[e.zone] ?? 0) + minutes;
  }
  return totals;
}

export function monthStartKey(dateKey: string): string {
  return dateKey.slice(0, 7) + "-01";
}

/**
 * Mais recente primeiro. O registro só guarda o dia; dentro do mesmo dia, a
 * ordem do array é a de gravação, então inverter antes da ordenação estável
 * põe o último registrado no topo.
 */
export function newestFirst(entries: CardioEntry[]): CardioEntry[] {
  return [...(entries ?? [])].reverse().sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}
