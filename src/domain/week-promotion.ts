import { buildLastDoneIndex } from "./history";
import { uid } from "@/data/id";
import type { Client, Day, WeekPlan } from "@/data/schema";

interface CloneOptions {
  /**
   * Guarda o feito da semana que passou em prevReps, para aparecer esmaecido
   * como referência. Usado quando a cópia é a semana seguinte do mesmo aluno.
   */
  carryGhost?: boolean;
}

export function cloneDaysWithNewIds(days: Day[], opts: CloneOptions = {}): Day[] {
  return (days ?? []).map((d) => {
    // timerStartedAt é estado da sessão daquele dia. Se viajar junto, a semana
    // nova nasce marcada como "em andamento", contando desde outro dia.
    const { timerStartedAt: _drop, ...rest } = d;
    return {
      ...rest,
      id: uid(),
      exercises: (d.exercises ?? []).map((ex) => ({
        ...ex,
        id: uid(),
        sets: (ex.sets ?? []).map((s) => ({
          ...s,
          id: uid(),
          repsDone: "",
          ...(opts.carryGhost ? { prevReps: s.repsDone || s.prevReps || "" } : {}),
        })),
      })),
    };
  });
}

/** Aplica a última carga realmente feita sobre as séries do plano. */
function withRefLoads(client: Client, planDays: Day[], planWeekKey: string): Day[] {
  const idx = buildLastDoneIndex(client.history ?? [], planWeekKey);
  if (!idx.size) return planDays;
  return planDays.map((d) => ({
    ...d,
    exercises: (d.exercises ?? []).map((ex) => ({
      ...ex,
      sets: (ex.sets ?? []).map((s, i) => {
        if (s.loadSetByTrainer) return s; // prescrição do treinador manda
        const ref = idx.get(`${ex.name ?? ""}|${i}`);
        return ref?.load ? { ...s, load: ref.load } : s;
      }),
    })),
  }));
}

/**
 * Calcula a virada de semana. Devolve null quando não há nada a fazer —
 * inclusive quando a semana atual é anterior à ativa, que seria um relógio
 * errado no aparelho e nunca deve fazer o aluno "voltar no tempo".
 */
export function planPromotion(
  client: Client,
  currentWeekKey: string,
): { days: Day[]; activeWeekKey: string; weekPlans: WeekPlan[] } | null {
  const activeKey = client.activeWeekKey ?? currentWeekKey;
  if (currentWeekKey <= activeKey) return null;

  const plans = client.weekPlans ?? [];
  const plan = plans.find((p) => p.weekKey === currentWeekKey);
  if (!plan) {
    return { days: client.days ?? [], activeWeekKey: currentWeekKey, weekPlans: plans };
  }

  return {
    days: withRefLoads(client, cloneDaysWithNewIds(plan.days, { carryGhost: true }), plan.weekKey),
    activeWeekKey: currentWeekKey,
    weekPlans: plans.filter((p) => p.id !== plan.id),
  };
}
