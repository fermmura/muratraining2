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
    const dias = groupWeekByDay(
      [entry(), entry({ dayTitle: "Costas", exName: "Remada", setId: "s2" })],
      "2026-09-14",
    );
    expect(dias.map((d) => d.dayTitle)).toEqual(["Costas", "Peito"]);
  });

  it("agrupa exercícios dentro do dia", () => {
    const [dia] = groupWeekByDay(
      [entry(), entry({ exName: "Crucifixo", setId: "s2" })],
      "2026-09-14",
    );
    expect(dia.exercises.map((e) => e.exName)).toEqual(["Crucifixo", "Supino"]);
  });

  it("ordena as séries pelo índice", () => {
    const [dia] = groupWeekByDay(
      [entry({ setIndex: 2, setId: "s3" }), entry({ setIndex: 0 }), entry({ setIndex: 1, setId: "s2" })],
      "2026-09-14",
    );
    expect(dia.exercises[0].sets.map((s) => s.setIndex)).toEqual([0, 1, 2]);
  });

  it("ignora as outras semanas", () => {
    const dias = groupWeekByDay([entry({ weekKey: "2026-09-07" })], "2026-09-14");
    expect(dias).toEqual([]);
  });

  it("na mesma série, vence o registro de data mais recente", () => {
    const [dia] = groupWeekByDay(
      [entry({ dateKey: "2026-09-15", load: "30" }), entry({ dateKey: "2026-09-17", load: "40" })],
      "2026-09-14",
    );
    expect(dia.exercises[0].sets).toHaveLength(1);
    expect(dia.exercises[0].sets[0].load).toBe("40");
  });

  it("usa um título genérico quando o dia não tem nome", () => {
    const [dia] = groupWeekByDay([entry({ dayTitle: "" })], "2026-09-14");
    expect(dia.dayTitle).toBe("Treino");
  });

  it("devolve lista vazia sem histórico", () => {
    expect(groupWeekByDay([], "2026-09-14")).toEqual([]);
  });
});
