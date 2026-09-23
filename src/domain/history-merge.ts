import type { HistoryEntry } from "@/data/schema";

/**
 * Junta o histórico que está no documento do aluno com o que veio da subcoleção
 * historyArchive.
 *
 * A fase 1 arquiva gravando o documento de arquivo ANTES de limpar o array, de
 * propósito: se a segunda operação falhar, a entrada existe nos dois lugares —
 * duplicata, recuperável — em vez de sumir. Aqui essa duplicata é desfeita.
 *
 * A chave é `setId` + `dateKey`, e não o objeto inteiro: a mesma série no mesmo
 * dia é o mesmo registro mesmo que a carga tenha sido corrigida entre a cópia
 * arquivada e a atual. O documento vence porque é o que os dois apps escrevem.
 */
export function mergeHistory(
  fromDoc: HistoryEntry[],
  fromArchive: HistoryEntry[],
): HistoryEntry[] {
  const byKey = new Map<string, HistoryEntry>();
  for (const h of fromArchive) byKey.set(`${h.setId}|${h.dateKey}`, h);
  for (const h of fromDoc) byKey.set(`${h.setId}|${h.dateKey}`, h);
  return [...byKey.values()].sort((a, b) => (a.dateKey ?? "").localeCompare(b.dateKey ?? ""));
}
