import type { HistoryEntry } from "@/data/schema";

export interface PastSet {
  setIndex: number;
  repsGoal: string;
  repsDone: string;
  load: string;
}

export interface PastExercise {
  exName: string;
  sets: PastSet[];
}

export interface PastDay {
  dayTitle: string;
  exercises: PastExercise[];
}

/**
 * Reconstrói uma semana encerrada a partir do histórico.
 *
 * Não usa `days`: aquele array guarda o treino CORRENTE, que já foi sobrescrito
 * pela promoção de semana. O histórico é o único registro do que foi feito.
 *
 * Agrupa por título do dia e nome do exercício, e não pelos ids: os ids mudam a
 * cada virada de semana, então dois registros da mesma semana têm ids coerentes
 * entre si, mas o nome é o que continua legível para quem lê a tela.
 */
export function groupWeekByDay(history: HistoryEntry[], weekKey: string): PastDay[] {
  const dayMap = new Map<string, Map<string, Map<number, HistoryEntry>>>();
  /** Data em que cada dia começou a ser treinado, para ordenar a semana. */
  const firstDate = new Map<string, string>();

  for (const h of history) {
    if (h.weekKey !== weekKey) continue;
    const dayTitle = h.dayTitle || "Treino";
    const exName = h.exName || "Exercício";

    const seen = firstDate.get(dayTitle);
    const date = h.dateKey ?? "";
    if (seen === undefined || date < seen) firstDate.set(dayTitle, date);

    let exerciseMap = dayMap.get(dayTitle);
    if (!exerciseMap) dayMap.set(dayTitle, (exerciseMap = new Map()));

    let setMap = exerciseMap.get(exName);
    if (!setMap) exerciseMap.set(exName, (setMap = new Map()));

    const current = setMap.get(h.setIndex);
    if (!current || (h.dateKey ?? "") >= (current.dateKey ?? "")) setMap.set(h.setIndex, h);
  }

  // Ordem cronológica: a semana se lê como foi vivida. O título só desempata,
  // porque dois treinos podem cair no mesmo dia.
  return [...dayMap.entries()]
    .sort(([a], [b]) =>
      (firstDate.get(a) ?? "").localeCompare(firstDate.get(b) ?? "") || a.localeCompare(b))
    .map(([dayTitle, exerciseMap]) => ({
      dayTitle,
      exercises: [...exerciseMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([exName, setMap]) => ({
          exName,
          sets: [...setMap.values()]
            .sort((a, b) => a.setIndex - b.setIndex)
            .map((h) => ({
              setIndex: h.setIndex,
              repsGoal: h.repsGoal ?? "",
              repsDone: h.repsDone ?? "",
              load: h.load ?? "",
            })),
        })),
    }));
}
