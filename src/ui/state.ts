import type { Client, HistoryEntry } from "@/data/schema";
import type { Session } from "@/auth/session";

export type View = "loading" | "gate" | "trainer" | "student";

/** Tela aberta dentro da área do aluno. `home` é a grade de treinos da fase 1. */
export type Screen = "home" | "calendar" | "pastWeek" | "progression";

/**
 * Onde a edição de treino grava. A mesma tela serve ao treino corrente e ao
 * plano de uma semana futura; só o destino muda.
 */
export type EditTarget = { kind: "current" } | { kind: "plan"; planId: string };

export interface AppState {
  view: View;
  session: Session | null;
  clients: Client[];
  client: Client | null;
  selectedClientId: string | null;
  activeDayId: string | null;
  /** Exercícios minimizados. Mora no estado, e não num Set solto, porque
      `setState` só redesenha quando alguma referência muda. */
  collapsedExercises: ReadonlySet<string>;
  error: string | null;
  screen: Screen;
  editTarget: EditTarget;
  /** Semana aberta na tela de leitura; null quando não há. */
  pastWeekKey: string | null;
  /** Entradas daquela semana, já resolvidas entre ficha e arquivo. */
  pastWeekEntries: HistoryEntry[] | null;
  progTab: "overall" | "table";
  /** Barra tocada no gráfico, para mostrar o número daquela semana. */
  progSelectedWeek: string | null;
  /** Histórico vindo de historyArchive; null enquanto ninguém pediu. */
  archivedHistory: HistoryEntry[] | null;
  archiveState: "idle" | "loading" | "loaded" | "error";
  /** Semana futura à espera da escolha entre copiar e começar do zero. */
  planChoiceWeekKey: string | null;
}

const INITIAL: AppState = {
  view: "loading",
  session: null,
  clients: [],
  client: null,
  selectedClientId: null,
  activeDayId: null,
  collapsedExercises: new Set<string>(),
  error: null,
  screen: "home",
  editTarget: { kind: "current" },
  pastWeekKey: null,
  pastWeekEntries: null,
  progTab: "overall",
  progSelectedWeek: null,
  archivedHistory: null,
  archiveState: "idle",
  planChoiceWeekKey: null,
};

let state: AppState = { ...INITIAL };
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  const changed = (Object.keys(patch) as (keyof AppState)[])
    .some((k) => patch[k] !== state[k]);
  if (!changed) return;
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Só para teste. */
export function resetState(): void {
  state = { ...INITIAL };
  listeners.clear();
}
