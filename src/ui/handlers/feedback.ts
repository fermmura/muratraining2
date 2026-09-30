import { getState, setState } from "../state";
import { uid } from "@/data/id";
import { authorOf, hasUnreadFor, markReadFor } from "@/domain/feedback";
import { todayKey } from "@/domain/week";
import { currentClient, persist } from "./target";
import { resetScreen } from "./trainer";
import type { FeedbackAuthor, FeedbackEntry } from "@/data/schema";

/** Quem está escrevendo, no valor que o 1.0 grava em `from`. */
export function me(): FeedbackAuthor {
  return authorOf(getState().view === "trainer");
}

/** Não grava nada quando não há mensagem do outro lado por ler. */
function markRead(): void {
  const c = currentClient();
  if (!c) return;
  const next = markReadFor(c.feedback ?? [], me());
  if (next) persist(c.id, { feedback: next });
}

export const feedback = {
  onOpen: () => {
    markRead();
    setState({ screen: "feedback", activeDayId: null });
  },

  // marca de novo ao sair: cobre o que chegou enquanto a conversa estava aberta
  onBack: () => {
    markRead();
    resetScreen();
  },

  /** Devolve true quando gravou, para a tela limpar a caixa de texto. */
  onSend: (text: string): boolean => {
    const c = currentClient();
    const trimmed = text.trim();
    if (!c || !trimmed) return false;
    const entry: FeedbackEntry = { id: uid(), dateKey: todayKey(), from: me(), text: trimmed, read: false };
    persist(c.id, { feedback: [...(c.feedback ?? []), entry] });
    return true;
  },

  onRemove: (id: string) => {
    const c = currentClient();
    if (!c || !confirm("Remover essa mensagem?")) return;
    persist(c.id, { feedback: (c.feedback ?? []).filter((m) => m.id !== id) });
  },

  hasUnread: (): boolean => {
    const c = currentClient();
    return c ? hasUnreadFor(c.feedback ?? [], me()) : false;
  },
};
