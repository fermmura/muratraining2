import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { splitHistoryForArchive } from "@/domain/archive";
import { todayKey, weekKeyOf } from "@/domain/week";
import { saveClient } from "./client-repo";
import type { Client, HistoryArchiveDoc } from "./schema";

const ARCHIVE = "historyArchive";

/** Roda no máximo uma vez por aluno por sessão. */
const archivedThisSession = new Set<string>();

/**
 * Move histórico antigo do documento do aluno para a subcoleção.
 *
 * A ordem é deliberada: grava o arquivo PRIMEIRO, limpa o array DEPOIS. Se a
 * segunda operação falhar, o pior caso é a entrada existir nos dois lugares —
 * duplicata, recuperável. A ordem inversa perderia histórico de treino de
 * forma irrecuperável.
 */
export async function archiveOldHistory(client: Client): Promise<void> {
  if (archivedThisSession.has(client.id)) return;
  archivedThisSession.add(client.id);

  const history = client.history ?? [];
  if (!history.length) return;

  const { keep, archive } = splitHistoryForArchive(history, weekKeyOf(todayKey()));
  if (!archive.size) return;

  try {
    for (const [weekKey, entries] of archive) {
      const payload: HistoryArchiveDoc = { weekKey, entries };
      await setDoc(doc(db, "clients", client.id, ARCHIVE, weekKey), payload);
    }
    await saveClient(client.id, { history: keep });
  } catch {
    // libera para tentar de novo na próxima sessão; nada foi perdido
    archivedThisSession.delete(client.id);
  }
}
