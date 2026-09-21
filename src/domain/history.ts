import { todayKey, weekKeyOf } from "./week";
import type { Client, Day, HistoryEntry } from "@/data/schema";

/** Campos de série cuja alteração vira registro de histórico. */
const TRACKED_FIELDS = new Set(["repsDone", "load"]);

export function applySetFieldChange(
  client: Client,
  dayId: string,
  exId: string,
  setId: string,
  field: string,
  value: string,
): { days: Day[]; history: HistoryEntry[] } {
  let dayTitle = "";
  let exName = "";
  let setIndex = 0;

  const days = (client.days ?? []).map((d) => {
    if (d.id !== dayId) return d;
    dayTitle = d.title;
    return {
      ...d,
      exercises: (d.exercises ?? []).map((ex) => {
        if (ex.id !== exId) return ex;
        exName = ex.name;
        return {
          ...ex,
          sets: (ex.sets ?? []).map((s, i) => {
            if (s.id !== setId) return s;
            setIndex = i;
            return { ...s, [field]: value };
          }),
        };
      }),
    };
  });

  const previous = client.history ?? [];
  if (!TRACKED_FIELDS.has(field)) return { days, history: previous };

  const dateKey = todayKey();
  const set = days
    .find((d) => d.id === dayId)
    ?.exercises.find((e) => e.id === exId)
    ?.sets.find((s) => s.id === setId);

  // Sem a série não há o que registrar: gravar aqui produziria uma entrada com
  // exName vazio e setIndex 0, lixo que vai para o documento do aluno. Acontece
  // quando o treinador apaga um exercício enquanto o aluno digita nele.
  if (!set) return { days, history: previous };

  // Uma série editada várias vezes no mesmo dia deixa UMA entrada, não uma por tecla.
  const history = previous.filter((h) => !(h.setId === setId && h.dateKey === dateKey));
  history.push({
    dateKey,
    weekKey: weekKeyOf(dateKey),
    dayId,
    dayTitle,
    exId,
    exName,
    setId,
    setIndex,
    repsGoal: set?.repsGoal ?? "",
    repsDone: set?.repsDone ?? "",
    load: set?.load ?? "",
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
