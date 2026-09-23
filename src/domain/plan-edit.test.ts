import { describe, it, expect } from "vitest";
import { createPlan, replacePlanDays } from "./plan-edit";
import type { Client, Day, WeekPlan } from "@/data/schema";

function days(): Day[] {
  return [{
    id: "d1", title: "Peito", timerStartedAt: 1_700_000_000_000,
    exercises: [{
      id: "e1", name: "Supino", notes: "", sets: [
        { id: "s1", repsGoal: "10", repsDone: "9", load: "30", intensity: 0, rir: "", rirEnabled: false },
      ],
    }],
  }];
}

function client(over: Partial<Client> = {}): Client {
  return {
    id: "c1", name: "Aluno", email: "a@x.com", goal: "", createdAt: 0,
    days: days(), history: [], weekPlans: [], activeWeekKey: "2026-09-14", ...over,
  };
}

describe("createPlan", () => {
  it("guarda a semana pedida", () => {
    expect(createPlan(client(), "2026-09-21", "copy").weekKey).toBe("2026-09-21");
  });

  it("gera um id próprio para o plano", () => {
    const a = createPlan(client(), "2026-09-21", "copy");
    const b = createPlan(client(), "2026-09-28", "copy");
    expect(a.id).not.toBe(b.id);
  });

  it("copiando, traz os exercícios com ids novos", () => {
    const plano = createPlan(client(), "2026-09-21", "copy");
    expect(plano.days[0].exercises[0].name).toBe("Supino");
    expect(plano.days[0].id).not.toBe("d1");
    expect(plano.days[0].exercises[0].sets[0].id).not.toBe("s1");
  });

  it("copiando, zera o feito e guarda a referência da semana anterior", () => {
    const s = createPlan(client(), "2026-09-21", "copy").days[0].exercises[0].sets[0];
    expect(s.repsDone).toBe("");
    expect(s.prevReps).toBe("9");
  });

  it("copiando, nunca leva o cronômetro junto", () => {
    expect(createPlan(client(), "2026-09-21", "copy").days[0].timerStartedAt).toBeUndefined();
  });

  it("começando do zero, nasce sem nenhum dia", () => {
    expect(createPlan(client(), "2026-09-21", "empty").days).toEqual([]);
  });

  it("não altera o treino atual do aluno", () => {
    const c = client();
    createPlan(c, "2026-09-21", "copy");
    expect(c.days[0].id).toBe("d1");
  });
});

describe("replacePlanDays", () => {
  const plans: WeekPlan[] = [
    { id: "p1", weekKey: "2026-09-21", days: [] },
    { id: "p2", weekKey: "2026-09-28", days: [] },
  ];

  it("troca os dias do plano alvo", () => {
    const r = replacePlanDays(plans, "p1", days());
    expect(r.find((p) => p.id === "p1")?.days[0].title).toBe("Peito");
  });

  it("não toca nos outros planos", () => {
    const r = replacePlanDays(plans, "p1", days());
    expect(r.find((p) => p.id === "p2")?.days).toEqual([]);
  });

  it("mantém a quantidade de planos quando o id não existe", () => {
    expect(replacePlanDays(plans, "inexistente", days())).toHaveLength(2);
  });
});
