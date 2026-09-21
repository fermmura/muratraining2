import { addWeeks } from "./week";
import type { HistoryEntry } from "@/data/schema";

/**
 * Histórico com mais de 26 semanas sai do documento do aluno e vai para a
 * subcoleção historyArchive. Sem isso o documento cresce sem limite e encosta
 * no teto de 1MB do Firestore em pouco mais de um ano de uso, e a partir daí
 * TODO salvamento daquele aluno passa a falhar.
 *
 * O corte é por weekKey, e não por data absoluta, para que uma semana nunca
 * fique dividida entre o documento e o arquivo.
 */
export const ARCHIVE_AFTER_WEEKS = 26;

export function splitHistoryForArchive(
  history: HistoryEntry[],
  currentWeekKey: string,
): { keep: HistoryEntry[]; archive: Map<string, HistoryEntry[]> } {
  const cutoff = addWeeks(currentWeekKey, -ARCHIVE_AFTER_WEEKS);
  const keep: HistoryEntry[] = [];
  const archive = new Map<string, HistoryEntry[]>();

  for (const h of history) {
    // entrada sem weekKey não tem como ser arquivada em segurança: fica onde está
    if (!h.weekKey || h.weekKey >= cutoff) {
      keep.push(h);
      continue;
    }
    const bucket = archive.get(h.weekKey);
    if (bucket) bucket.push(h);
    else archive.set(h.weekKey, [h]);
  }

  return { keep, archive };
}
