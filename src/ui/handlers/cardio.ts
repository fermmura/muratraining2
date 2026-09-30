import { setState } from "../state";
import { uid } from "@/data/id";
import { parseMinutes } from "@/domain/cardio";
import { todayKey } from "@/domain/week";
import { currentClient, persist } from "./target";
import { resetScreen } from "./trainer";
import type { CardioEntry } from "@/data/schema";

export const cardio = {
  onOpen: () => setState({ screen: "cardio", activeDayId: null }),
  onBack: () => resetScreen(),

  /** Devolve true quando gravou, para a tela limpar o formulário. */
  onAdd: (minutesText: string, zone: string, note: string): boolean => {
    const c = currentClient();
    const minutes = parseMinutes(minutesText);
    if (!c || minutes === null) return false;
    const entry: CardioEntry = { id: uid(), dateKey: todayKey(), minutes, zone, note: note.trim() };
    persist(c.id, { cardio: [...(c.cardio ?? []), entry] });
    return true;
  },

  onRemove: (id: string) => {
    const c = currentClient();
    if (!c || !confirm("Remover esse registro de cardio?")) return;
    persist(c.id, { cardio: (c.cardio ?? []).filter((e) => e.id !== id) });
  },
};
