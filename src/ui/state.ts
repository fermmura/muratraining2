import type { Client } from "@/data/schema";
import type { Session } from "@/auth/session";

export type View = "loading" | "gate" | "trainer" | "student";

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
