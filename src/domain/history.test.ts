import { describe, it, expect } from "vitest";
import { applySetFieldChange, buildLastDoneIndex } from "./history";
import { todayKey, weekKeyOf } from "./week";
import type { Client, HistoryEntry } from "@/data/schema";

function makeClient(): Client {
  return {
    id: "c1",
    name: "Aluno",
    email: "a@x.com",
    goal: "",
    createdAt: 0,
    days: [
      {
        id: "d1",
        title: "Peito",
        exercises: [
          {
            id: "e1",
            name: "Supino",
            notes: "",
            sets: [
              { id: "s1", repsGoal: "10", repsDone: "", load: "", intensity: 0, rir: "", rirEnabled: false },
              { id: "s2", repsGoal: "10", repsDone: "", load: "", intensity: 0, rir: "", rirEnabled: false },
            ],
          },
        ],
      },
    ],
    history: [],
  };
}

describe("applySetFieldChange", () => {
  it("altera o campo da série alvo e não toca nas outras", () => {
    const { days } = applySetFieldChange(makeClient(), "d1", "e1", "s1", "repsDone", "9");
    expect(days[0].exercises[0].sets[0].repsDone).toBe("9");
    expect(days[0].exercises[0].sets[1].repsDone).toBe("");
  });

  it("grava entrada de histórico ao mudar repsDone", () => {
    const { history } = applySetFieldChange(makeClient(), "d1", "e1", "s1", "repsDone", "9");
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      dateKey: todayKey(),
      weekKey: weekKeyOf(todayKey()),
      dayId: "d1",
      dayTitle: "Peito",
      exId: "e1",
      exName: "Supino",
      setId: "s1",
      setIndex: 0,
      repsDone: "9",
    });
  });

  it("grava entrada de histórico ao mudar load", () => {
    const { history } = applySetFieldChange(makeClient(), "d1", "e1", "s2", "load", "40");
    expect(history).toHaveLength(1);
    expect(history[0].setIndex).toBe(1);
    expect(history[0].load).toBe("40");
  });

  it("não grava histórico para campos que não são reps nem carga", () => {
    const { history } = applySetFieldChange(makeClient(), "d1", "e1", "s1", "repsGoal", "12");
    expect(history).toHaveLength(0);
  });

  it("substitui a entrada do mesmo dia em vez de acumular", () => {
    const c = makeClient();
    const first = applySetFieldChange(c, "d1", "e1", "s1", "repsDone", "8");
    const second = applySetFieldChange(
      { ...c, days: first.days, history: first.history },
      "d1", "e1", "s1", "repsDone", "9",
    );
    expect(second.history).toHaveLength(1);
    expect(second.history[0].repsDone).toBe("9");
  });

  it("preserva entradas de outros dias", () => {
    const c = makeClient();
    c.history = [{
      dateKey: "2020-01-01", weekKey: "2019-12-30", dayId: "d1", dayTitle: "Peito",
      exId: "e1", exName: "Supino", setId: "s1", setIndex: 0,
      repsGoal: "10", repsDone: "7", load: "30",
    }];
    const { history } = applySetFieldChange(c, "d1", "e1", "s1", "repsDone", "9");
    expect(history).toHaveLength(2);
  });
});

describe("buildLastDoneIndex", () => {
  const entries: HistoryEntry[] = [
    { dateKey: "2026-09-07", weekKey: "2026-09-07", dayId: "d1", dayTitle: "Peito", exId: "e1", exName: "Supino", setId: "s1", setIndex: 0, repsGoal: "10", repsDone: "8", load: "30" },
    { dateKey: "2026-09-14", weekKey: "2026-09-14", dayId: "d1", dayTitle: "Peito", exId: "e1", exName: "Supino", setId: "s1", setIndex: 0, repsGoal: "10", repsDone: "9", load: "35" },
  ];

  it("guarda a entrada mais recente por exercício e índice de série", () => {
    const idx = buildLastDoneIndex(entries);
    expect(idx.get("Supino|0")?.load).toBe("35");
  });

  it("ignora o que aconteceu na semana do plano ou depois", () => {
    const idx = buildLastDoneIndex(entries, "2026-09-14");
    expect(idx.get("Supino|0")?.load).toBe("30");
  });

  it("ignora entradas sem nada registrado", () => {
    const vazia: HistoryEntry = { ...entries[0], dateKey: "2026-09-21", repsDone: "", load: "" };
    const idx = buildLastDoneIndex([...entries, vazia]);
    expect(idx.get("Supino|0")?.load).toBe("35");
  });

  it("devolve mapa vazio sem histórico", () => {
    expect(buildLastDoneIndex([]).size).toBe(0);
  });
});
