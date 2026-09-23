import { cloneDaysWithNewIds } from "./week-promotion";
import { uid } from "@/data/id";
import type { Client, Day, WeekPlan } from "@/data/schema";

/**
 * Cria o plano de uma semana futura.
 *
 * `copy` parte do treino atual com ids novos, o feito zerado e o número da
 * semana que passou guardado como referência. `empty` nasce sem dias, para quem
 * vai montar um treino diferente.
 *
 * O 1.0 criava a cópia no toque, sem perguntar (app.js:3074-3086): um toque
 * errado virava um plano que seria promovido sozinho quando a semana chegasse.
 * Aqui a escolha é explícita e nada é gravado antes dela.
 *
 * Fotos de exercício são da fase 3 e por isso não são copiadas.
 */
export function createPlan(client: Client, weekKey: string, mode: "copy" | "empty"): WeekPlan {
  return {
    id: uid(),
    weekKey,
    days: mode === "copy" ? cloneDaysWithNewIds(client.days ?? [], { carryGhost: true }) : [],
  };
}

/** Troca os dias de um plano, devolvendo a lista inteira para gravar em `weekPlans`. */
export function replacePlanDays(plans: WeekPlan[], planId: string, days: Day[]): WeekPlan[] {
  return (plans ?? []).map((p) => (p.id === planId ? { ...p, days } : p));
}
