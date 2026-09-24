import { describe, it, expect } from "vitest";
import { groupWeekByDay } from "./past-week";
import type { HistoryEntry } from "@/data/schema";

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    dateKey: "2026-09-15", weekKey: "2026-09-14", dayId: "d1", dayTitle: "Peito",
    exId: "e1", exName: "Supino", setId: "s1", setIndex: 0,
    repsGoal: "10", repsDone: "9", load: "30", ...over,
  };
}

describe("groupWeekByDay", () => {
  it("agrupa por dia de treino", () => {
    const result = groupWeekByDay(
      [entry(), entry({ dayTitle: "Costas", exName: "Remada", setId: "s2" })],
      "2026-09-14",
    );
    expect(result.map((d) => d.dayTitle)).toEqual(["Costas", "Peito"]);
  });

  it("agrupa exercícios dentro do dia", () => {
    const [day] = groupWeekByDay(
      [entry(), entry({ exName: "Crucifixo", setId: "s2" })],
      "2026-09-14",
    );
    expect(day.exercises.map((e) => e.exName)).toEqual(["Crucifixo", "Supino"]);
  });

  it("ordena as séries pelo índice", () => {
    const [day] = groupWeekByDay(
      [entry({ setIndex: 2, setId: "s3" }), entry({ setIndex: 0 }), entry({ setIndex: 1, setId: "s2" })],
      "2026-09-14",
    );
    expect(day.exercises[0].sets.map((s) => s.setIndex)).toEqual([0, 1, 2]);
  });

  it("ignora as outras semanas", () => {
    const result = groupWeekByDay([entry({ weekKey: "2026-09-07" })], "2026-09-14");
    expect(result).toEqual([]);
  });

  it("na mesma série, vence o registro de data mais recente", () => {
    const [day] = groupWeekByDay(
      [entry({ dateKey: "2026-09-15", load: "30" }), entry({ dateKey: "2026-09-17", load: "40" })],
      "2026-09-14",
    );
    expect(day.exercises[0].sets).toHaveLength(1);
    expect(day.exercises[0].sets[0].load).toBe("40");
  });

  it("usa um título genérico quando o dia não tem nome", () => {
    const [day] = groupWeekByDay([entry({ dayTitle: "" })], "2026-09-14");
    expect(day.dayTitle).toBe("Treino");
  });

  it("devolve lista vazia sem histórico", () => {
    expect(groupWeekByDay([], "2026-09-14")).toEqual([]);
  });

  it("ordena os dias pela data treinada, e não pelo título", () => {
    const result = groupWeekByDay(
      [
        entry({ dayTitle: "Cardio", dateKey: "2026-09-16", setId: "s9" }),
        entry({ dayTitle: "Lower1", dateKey: "2026-09-14", setId: "s8" }),
      ],
      "2026-09-14",
    );
    expect(result.map((d) => d.dayTitle)).toEqual(["Lower1", "Cardio"]);
  });

  it("um dia treinado em datas diferentes entra pela primeira delas", () => {
    const result = groupWeekByDay(
      [
        entry({ dayTitle: "Upper", dateKey: "2026-09-18", setId: "s1" }),
        entry({ dayTitle: "Upper", dateKey: "2026-09-15", setId: "s2", setIndex: 1 }),
        entry({ dayTitle: "Lower", dateKey: "2026-09-16", setId: "s3" }),
      ],
      "2026-09-14",
    );
    expect(result.map((d) => d.dayTitle)).toEqual(["Upper", "Lower"]);
  });

  it("desempata pelo título quando os dias têm a mesma data", () => {
    const result = groupWeekByDay(
      [
        entry({ dayTitle: "Peito", setId: "s1" }),
        entry({ dayTitle: "Costas", setId: "s2" }),
      ],
      "2026-09-14",
    );
    expect(result.map((d) => d.dayTitle)).toEqual(["Costas", "Peito"]);
  });
});
