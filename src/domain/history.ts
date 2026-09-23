import { todayKey, weekKeyOf } from "./week";
import type { Client, Day, HistoryEntry } from "@/data/schema";

/** Campos de série cuja alteração vira registro de histórico. */
const TRACKED_FIELDS = new Set(["repsDone", "load"]);

/**
 * Troca um campo de uma série dentro do array de dias, sem tocar em histórico.
 * Exportada porque a edição de plano de semana futura usa o mesmo mapeamento e
 * NÃO deve gerar histórico: planejar não é treinar.
 */
export function setFieldInDays(
  days: Day[],
  dayId: string,
  exId: string,
  setId: string,
  field: string,
  value: string,
): Day[] {
  return (days ?? []).map((d) => {
    if (d.id !== dayId) return d;
    return {
      ...d,
      exercises: (d.exercises ?? []).map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: (ex.sets ?? []).map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
        };
      }),
    };
  });
}

export function applySetFieldChange(
  client: Client,
  dayId: string,
  exId: string,
  setId: string,
  field: string,
  value: string,
): { days: Day[]; history: HistoryEntry[] } {
  const days = setFieldInDays(client.days ?? [], dayId, exId, setId, field, value);

  const previous = client.history ?? [];
  if (!TRACKED_FIELDS.has(field)) return { days, history: previous };

  const day = days.find((d) => d.id === dayId);
  const ex = day?.exercises.find((e) => e.id === exId);
  const setIndex = ex?.sets.findIndex((s) => s.id === setId) ?? -1;
  const set = setIndex >= 0 ? ex?.sets[setIndex] : undefined;
  // Sem dia, exercício ou série não há o que registrar, e o push abaixo lê
  // `day.title`, `ex.name` e `set.repsGoal` direto: sem esta guarda ele
  // estouraria em cima de undefined no meio da digitação do aluno, e o
  // setIndex que iria junto já seria -1. Acontece quando o treinador apaga um
  // exercício enquanto o aluno está digitando nele.
  if (!day || !ex || !set) return { days, history: previous };

  const dateKey = todayKey();
  // Uma série editada várias vezes no mesmo dia deixa UMA entrada, não uma por tecla.
  const history = previous.filter((h) => !(h.setId === setId && h.dateKey === dateKey));
  history.push({
    dateKey,
    weekKey: weekKeyOf(dateKey),
    dayId,
    dayTitle: day.title,
    exId,
    exName: ex.name,
    setId,
    setIndex,
    repsGoal: set.repsGoal ?? "",
    repsDone: set.repsDone ?? "",
    load: set.load ?? "",
  });

  return { days, history };
}

/**
 * Última vez que o aluno REALMENTE fez cada série, indexado por "nome|índice".
 * `beforeWeekKey` limita a busca ao que aconteceu antes daquela semana, usado ao
 * montar o plano de uma semana futura.
 */
export function buildLastDoneIndex(
  history: HistoryEntry[],
  beforeWeekKey?: string,
): Map<string, HistoryEntry> {
  const map = new Map<string, HistoryEntry>();
  for (const h of history) {
    if (!h.exName) continue;
    if (beforeWeekKey && h.weekKey && h.weekKey >= beforeWeekKey) continue;
    if (!h.repsDone && !h.load) continue;
    const k = `${h.exName}|${h.setIndex}`;
    const cur = map.get(k);
    if (!cur || (h.dateKey ?? "") >= (cur.dateKey ?? "")) map.set(k, h);
  }
  return map;
}
