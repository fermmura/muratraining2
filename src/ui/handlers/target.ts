import { getState, setState } from "../state";
import { saveClient } from "@/data/client-repo";
import { replacePlanDays } from "@/domain/plan-edit";
import type { Client, Day } from "@/data/schema";

/** O aluno em edição: o próprio, ou o selecionado quando quem está logado é o treinador. */
export function currentClient(): Client | null {
  const s = getState();
  return s.view === "student" ? s.client : s.clients.find((c) => c.id === s.selectedClientId) ?? null;
}

/**
 * Grava sem bloquear a tela. A promessa fica pendente enquanto estiver offline
 * (ver saveClient), então nunca é aguardada; mas uma rejeição — regra negada,
 * documento apagado — precisa aparecer, senão o treino some sem aviso.
 */
export function persist(clientId: string, patch: Partial<Client>): void {
  saveClient(clientId, patch).catch(() => {
    setState({ error: "Não foi possível salvar. Recarregue a página e tente de novo." });
  });
}

/** Os dias que a tela está editando: os do treino corrente ou os do plano aberto. */
export function editableDays(client: Client): Day[] {
  const t = getState().editTarget;
  if (t.kind === "current") return client.days ?? [];
  return (client.weekPlans ?? []).find((p) => p.id === t.planId)?.days ?? [];
}

/**
 * Aplica uma transformação aos dias do alvo atual e grava no campo certo:
 * `days` para o treino corrente, `weekPlans` para um plano de semana futura.
 */
export function mutateDays(fn: (days: Day[]) => Day[]): void {
  const c = currentClient();
  if (!c) return;
  const t = getState().editTarget;
  if (t.kind === "current") {
    persist(c.id, { days: fn(c.days ?? []) });
    return;
  }
  const plans = c.weekPlans ?? [];
  const plan = plans.find((p) => p.id === t.planId);
  if (!plan) return;
  persist(c.id, { weekPlans: replacePlanDays(plans, t.planId, fn(plan.days ?? [])) });
}

export function authErrorCode(e: unknown): string {
  return (e as { code?: string }).code ?? "";
}
