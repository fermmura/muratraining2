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
  const dias = new Map<string, Map<string, Map<number, HistoryEntry>>>();

  for (const h of history) {
    if (h.weekKey !== weekKey) continue;
    const dayTitle = h.dayTitle || "Treino";
    const exName = h.exName || "Exercício";

    let exercicios = dias.get(dayTitle);
    if (!exercicios) dias.set(dayTitle, (exercicios = new Map()));

    let series = exercicios.get(exName);
    if (!series) exercicios.set(exName, (series = new Map()));

    const atual = series.get(h.setIndex);
    if (!atual || (h.dateKey ?? "") >= (atual.dateKey ?? "")) series.set(h.setIndex, h);
  }

  return [...dias.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayTitle, exercicios]) => ({
      dayTitle,
      exercises: [...exercicios.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([exName, series]) => ({
          exName,
          sets: [...series.values()]
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
