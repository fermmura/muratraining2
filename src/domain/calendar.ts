import { addWeeks, todayKey, weekKeyOf } from "./week";
import type { Client } from "@/data/schema";

export type WeekState = "past" | "current" | "planned" | "empty";

export interface CalendarWeek {
  weekKey: string;
  /** Deslocamento em relação à semana ativa: -1 é a semana passada. */
  offset: number;
  state: WeekState;
  /** Séries feitas: da semana atual, contadas no treino; das passadas, no histórico. */
  setsDone: number;
  /** Só faz sentido na semana atual; nas outras é 0. */
  setsTotal: number;
  planId: string | null;
}

/** Duas semanas para trás, a atual e três para a frente. */
export const CALENDAR_OFFSETS = [-2, -1, 0, 1, 2, 3] as const;

function countCurrentWeek(client: Client): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const d of client.days ?? []) {
    for (const ex of d.exercises ?? []) {
      for (const s of ex.sets ?? []) {
        total += 1;
        if (s.repsDone) done += 1;
      }
    }
  }
  return { done, total };
}

function countDoneInWeek(client: Client, weekKey: string): number {
  const doneKeys = new Set<string>();
  for (const h of client.history ?? []) {
    if (h.weekKey !== weekKey || !h.repsDone) continue;
    // inclui o dia: repetir o mesmo exercício em dias diferentes da semana é
    // rotina comum, e cada dia é uma série distinta feita
    doneKeys.add(`${h.dayTitle}|${h.exName}|${h.setIndex}`);
  }
  return doneKeys.size;
}

/**
 * As semanas do calendário, ancoradas na semana ATIVA e não na data de hoje: é
 * `activeWeekKey` que decide qual treino o aluno está fazendo, e as duas podem
 * divergir quando o aluno fica semanas sem abrir o app.
 */
export function buildCalendarWeeks(client: Client): CalendarWeek[] {
  // normaliza mesmo o valor armazenado: se activeWeekKey chegar num dia que
  // não é segunda, as semanas do calendário deixariam de bater com o weekKey
  // (sempre segunda) do histórico, zerando a contagem em silêncio
  const activeKey = weekKeyOf(client.activeWeekKey || todayKey());
  const plans = client.weekPlans ?? [];

  return CALENDAR_OFFSETS.map((offset) => {
    const weekKey = addWeeks(activeKey, offset);
    if (offset === 0) {
      const { done, total } = countCurrentWeek(client);
      return { weekKey, offset, state: "current" as const, setsDone: done, setsTotal: total, planId: null };
    }
    if (offset < 0) {
      return {
        weekKey, offset, state: "past" as const,
        setsDone: countDoneInWeek(client, weekKey), setsTotal: 0, planId: null,
      };
    }
    const plan = plans.find((p) => p.weekKey === weekKey);
    return {
      weekKey, offset,
      state: plan ? ("planned" as const) : ("empty" as const),
      setsDone: 0, setsTotal: 0, planId: plan?.id ?? null,
    };
  });
}

/**
 * A semana marcada como ativa não é a de hoje. Acontece com relógio errado no
 * aparelho ou com aluno que ficou semanas sem abrir o app. A tela oferece
 * corrigir, como no 1.0.
 */
export function isWeekOutOfSync(client: Client, currentWeekKey: string): boolean {
  if (!client.activeWeekKey) return false;
  return client.activeWeekKey !== currentWeekKey;
}
