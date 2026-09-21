// src/domain/week-promotion.test.ts
import { describe, it, expect } from "vitest";
import { cloneDaysWithNewIds, planPromotion } from "./week-promotion";
import type { Client, Day } from "@/data/schema";

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
    days: days(), history: [], activeWeekKey: "2026-09-07", weekPlans: [], ...over,
  };
}

describe("cloneDaysWithNewIds", () => {
  it("gera ids novos para dia, exercício e série", () => {
    const [d] = cloneDaysWithNewIds(days());
    expect(d.id).not.toBe("d1");
    expect(d.exercises[0].id).not.toBe("e1");
    expect(d.exercises[0].sets[0].id).not.toBe("s1");
  });

  it("nunca carrega o cronômetro para a cópia", () => {
    expect(cloneDaysWithNewIds(days())[0].timerStartedAt).toBeUndefined();
  });

  it("zera o feito", () => {
    expect(cloneDaysWithNewIds(days())[0].exercises[0].sets[0].repsDone).toBe("");
  });

  it("preserva a meta e a carga", () => {
    const s = cloneDaysWithNewIds(days())[0].exercises[0].sets[0];
    expect(s.repsGoal).toBe("10");
    expect(s.load).toBe("30");
  });

  it("guarda o feito anterior em prevReps quando pedido", () => {
    const s = cloneDaysWithNewIds(days(), { carryGhost: true })[0].exercises[0].sets[0];
    expect(s.prevReps).toBe("9");
    expect(s.repsDone).toBe("");
  });

  it("mantém a referência antiga quando a série não foi feita", () => {
    const base = days();
    base[0].exercises[0].sets[0] = { ...base[0].exercises[0].sets[0], repsDone: "", prevReps: "7" };
    expect(cloneDaysWithNewIds(base, { carryGhost: true })[0].exercises[0].sets[0].prevReps).toBe("7");
  });
});

describe("planPromotion", () => {
  it("não faz nada quando a semana ativa já é a atual", () => {
    expect(planPromotion(client({ activeWeekKey: "2026-09-14" }), "2026-09-14")).toBeNull();
  });

  it("nunca volta para uma semana anterior", () => {
    expect(planPromotion(client({ activeWeekKey: "2026-09-21" }), "2026-09-14")).toBeNull();
  });

  it("só avança a semana ativa quando não há plano", () => {
    const r = planPromotion(client(), "2026-09-14");
    expect(r?.activeWeekKey).toBe("2026-09-14");
    expect(r?.days[0].id).toBe("d1"); // treino atual segue igual
  });

  it("promove o plano da semana e o remove da fila", () => {
    const plano = { id: "p1", weekKey: "2026-09-14", days: days() };
    const r = planPromotion(client({ weekPlans: [plano] }), "2026-09-14");
    expect(r?.weekPlans).toHaveLength(0);
    expect(r?.days[0].id).not.toBe("d1"); // ids novos
    expect(r?.days[0].timerStartedAt).toBeUndefined();
  });

  it("aplica a última carga feita sobre as séries do plano", () => {
    const plano = { id: "p1", weekKey: "2026-09-14", days: days() };
    const c = client({
      weekPlans: [plano],
      history: [{
        dateKey: "2026-09-10", weekKey: "2026-09-07", dayId: "d1", dayTitle: "Peito",
        exId: "e1", exName: "Supino", setId: "s1", setIndex: 0,
        repsGoal: "10", repsDone: "9", load: "45",
      }],
    });
    expect(planPromotion(c, "2026-09-14")?.days[0].exercises[0].sets[0].load).toBe("45");
  });

  it("respeita a carga prescrita pelo treinador", () => {
    const base = days();
    base[0].exercises[0].sets[0] = { ...base[0].exercises[0].sets[0], loadSetByTrainer: true };
    const c = client({
      weekPlans: [{ id: "p1", weekKey: "2026-09-14", days: base }],
      history: [{
        dateKey: "2026-09-10", weekKey: "2026-09-07", dayId: "d1", dayTitle: "Peito",
        exId: "e1", exName: "Supino", setId: "s1", setIndex: 0,
        repsGoal: "10", repsDone: "9", load: "45",
      }],
    });
    expect(planPromotion(c, "2026-09-14")?.days[0].exercises[0].sets[0].load).toBe("30");
  });
});
