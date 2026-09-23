import { getState, setState } from "../state";
import { buildCalendarWeeks } from "@/domain/calendar";
import { createPlan } from "@/domain/plan-edit";
import { groupWeekByDay } from "@/domain/past-week";
import { mergeHistory } from "@/domain/history-merge";
import { todayKey, weekKeyOf } from "@/domain/week";
import { loadAllArchived, loadArchivedWeek } from "@/data/history-archive";
import { currentClient, persist } from "./target";
import { resetScreen } from "./trainer";
import type { CalendarWeek } from "@/domain/calendar";
import type { HistoryEntry } from "@/data/schema";

/** O histórico que as telas leem: o da ficha, mais o arquivo quando já foi carregado. */
export function visibleHistory(): HistoryEntry[] {
  const c = currentClient();
  if (!c) return [];
  const fromDoc = c.history ?? [];
  const fromArchive = getState().archivedHistory;
  return fromArchive ? mergeHistory(fromDoc, fromArchive) : fromDoc;
}

async function openPastWeek(weekKey: string): Promise<void> {
  const c = currentClient();
  if (!c) return;
  setState({ screen: "pastWeek", pastWeekKey: weekKey, pastWeekEntries: null });

  const inDoc = (c.history ?? []).filter((h) => h.weekKey === weekKey);
  if (inDoc.length) {
    setState({ pastWeekEntries: inDoc });
    return;
  }
  // nada na ficha: ou a semana é anterior ao corte de 26 semanas e está no
  // arquivo, ou não houve treino. Uma leitura dirigida responde aos dois casos.
  try {
    setState({ pastWeekEntries: await loadArchivedWeek(c.id, weekKey) });
  } catch {
    setState({ pastWeekEntries: [], error: "Não foi possível carregar essa semana." });
  }
}

export const screens = {
  onOpenCalendar: () => setState({ screen: "calendar", activeDayId: null, planChoiceWeekKey: null }),
  onOpenProgression: () => setState({ screen: "progression", activeDayId: null }),
  onBackHome: () => resetScreen(),

  onTab: (progTab: "overall" | "table") => setState({ progTab, progSelectedWeek: null }),
  onSelectWeek: (progSelectedWeek: string) => setState({ progSelectedWeek }),

  onLoadArchive: async () => {
    const c = currentClient();
    if (!c || getState().archiveState === "loading") return;
    setState({ archiveState: "loading" });
    try {
      setState({ archivedHistory: await loadAllArchived(c.id), archiveState: "loaded" });
    } catch {
      setState({ archiveState: "error" });
    }
  },

  onFixWeek: () => {
    const c = currentClient();
    if (c) persist(c.id, { activeWeekKey: weekKeyOf(todayKey()) });
  },

  onCancelChoice: () => setState({ planChoiceWeekKey: null }),

  /**
   * Abre uma semana do calendário. Passado abre em leitura; a atual volta para a
   * grade; futura abre o plano, ou pergunta como criá-lo quando ele não existe.
   */
  onOpenWeek: (week: CalendarWeek) => {
    if (week.state === "past") { void openPastWeek(week.weekKey); return; }
    if (week.state === "current") { resetScreen(); return; }
    if (week.planId) {
      setState({
        screen: "home",
        editTarget: { kind: "plan", planId: week.planId },
        activeDayId: null,
        planChoiceWeekKey: null,
      });
      return;
    }
    // só o treinador cria plano; para o aluno a linha não leva a lugar nenhum
    if (getState().view !== "trainer") return;
    setState({ planChoiceWeekKey: week.weekKey });
  },

  onChoosePlan: (weekKey: string, mode: "copy" | "empty") => {
    const c = currentClient();
    if (!c) return;
    const plan = createPlan(c, weekKey, mode);
    persist(c.id, { weekPlans: [...(c.weekPlans ?? []), plan] });
    setState({
      screen: "home",
      editTarget: { kind: "plan", planId: plan.id },
      activeDayId: null,
      planChoiceWeekKey: null,
    });
  },

  pastWeekDays: () => {
    const s = getState();
    if (!s.pastWeekKey || s.pastWeekEntries === null) return null;
    return groupWeekByDay(s.pastWeekEntries, s.pastWeekKey);
  },

  calendarWeeks: () => {
    const c = currentClient();
    return c ? buildCalendarWeeks(c) : [];
  },
};
