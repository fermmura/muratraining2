import type { FeedbackAuthor, FeedbackEntry } from "@/data/schema";

export function authorOf(isTrainer: boolean): FeedbackAuthor {
  return isTrainer ? "treinador" : "aluno";
}

/** Cada mensagem tem um só destinatário: quem não a escreveu. */
function unreadFor(m: FeedbackEntry, me: FeedbackAuthor): boolean {
  return m.from !== me && !m.read;
}

export function hasUnreadFor(entries: FeedbackEntry[], me: FeedbackAuthor): boolean {
  return (entries ?? []).some((m) => unreadFor(m, me));
}

/**
 * Marca como lidas as mensagens do outro lado. Devolve null quando não há
 * nenhuma, para quem chama não gravar à toa.
 */
export function markReadFor(entries: FeedbackEntry[], me: FeedbackAuthor): FeedbackEntry[] | null {
  if (!hasUnreadFor(entries, me)) return null;
  return entries.map((m) => (unreadFor(m, me) ? { ...m, read: true } : m));
}

/** A mensagem só guarda o dia; a ordenação estável mantém a ordem de gravação dentro dele. */
export function oldestFirst(entries: FeedbackEntry[]): FeedbackEntry[] {
  return [...(entries ?? [])].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}
