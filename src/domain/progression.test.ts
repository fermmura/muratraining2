import { describe, it, expect } from "vitest";
import {
  buildProgressionRows, progressionWeekKeys, weeklySetCounts, trendOf,
} from "./progression";
import type { HistoryEntry } from "@/data/schema";

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    dateKey: "2026-09-15", weekKey: "2026-09-14", dayId: "d1", dayTitle: "Peito",
    exId: "e1", exName: "Supino", setId: "s1", setIndex: 0,
    repsGoal: "10", repsDone: "9", load: "30", ...over,
  };
}

describe("buildProgressionRows", () => {
  it("agrupa a mesma série de semanas diferentes numa linha só", () => {
    // o defeito do 1.0: a virada de semana troca todos os setId, e agrupar por
    // setId quebrava cada série em uma linha por semana
    const rows = buildProgressionRows([
      entry({ weekKey: "2026-09-07", dateKey: "2026-09-08", setId: "antigo", load: "30" }),
      entry({ weekKey: "2026-09-14", dateKey: "2026-09-15", setId: "novo", load: "35" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].byWeek.get("2026-09-07")?.load).toBe("30");
    expect(rows[0].byWeek.get("2026-09-14")?.load).toBe("35");
  });

  it("separa índices de série diferentes do mesmo exercício", () => {
    const rows = buildProgressionRows([entry({ setIndex: 0 }), entry({ setIndex: 1, setId: "s2" })]);
    expect(rows).toHaveLength(2);
  });

  it("separa exercícios diferentes", () => {
    const rows = buildProgressionRows([entry(), entry({ exName: "Remada", setId: "s2" })]);
    expect(rows).toHaveLength(2);
  });

  it("rotula com nome do exercício e posição da série", () => {
    const [row] = buildProgressionRows([entry({ setIndex: 2 })]);
    expect(row.exName).toBe("Supino");
    expect(row.setIndex).toBe(2);
    expect(row.dayTitle).toBe("Peito");
  });

  it("na mesma semana, vence o registro de data mais recente", () => {
    const rows = buildProgressionRows([
      entry({ dateKey: "2026-09-15", load: "30" }),
      entry({ dateKey: "2026-09-17", load: "40" }),
    ]);
    expect(rows[0].byWeek.get("2026-09-14")?.load).toBe("40");
  });

  it("ignora entrada sem nome de exercício", () => {
    expect(buildProgressionRows([entry({ exName: "" })])).toHaveLength(0);
  });

  it("ignora entrada sem semana", () => {
    expect(buildProgressionRows([entry({ weekKey: "" })])).toHaveLength(0);
  });

  it("ordena por dia, exercício e índice de série", () => {
    const rows = buildProgressionRows([
      entry({ dayTitle: "Costas", exName: "Remada", setIndex: 1, setId: "a" }),
      entry({ dayTitle: "Costas", exName: "Remada", setIndex: 0, setId: "b" }),
      entry({ dayTitle: "Peito", exName: "Supino", setIndex: 0, setId: "c" }),
    ]);
    expect(rows.map((r) => `${r.dayTitle}|${r.exName}|${r.setIndex}`)).toEqual([
      "Costas|Remada|0", "Costas|Remada|1", "Peito|Supino|0",
    ]);
  });

  it("devolve lista vazia sem histórico", () => {
    expect(buildProgressionRows([])).toEqual([]);
  });
});

describe("progressionWeekKeys", () => {
  it("devolve as semanas sem repetir, da mais antiga para a mais nova", () => {
    const weeks = progressionWeekKeys([
      entry({ weekKey: "2026-09-14" }),
      entry({ weekKey: "2026-09-07", setId: "s2" }),
      entry({ weekKey: "2026-09-14", setId: "s3" }),
    ]);
    expect(weeks).toEqual(["2026-09-07", "2026-09-14"]);
  });

  it("ignora entrada sem semana", () => {
    expect(progressionWeekKeys([entry({ weekKey: "" })])).toEqual([]);
  });
});

describe("weeklySetCounts", () => {
  it("conta uma série feita por semana", () => {
    expect(weeklySetCounts([entry()])).toEqual([{ weekKey: "2026-09-14", count: 1 }]);
  });

  it("não conta série sem 'feito' preenchido", () => {
    // o treinador prescreveu carga, o aluno não treinou: não é série feita
    expect(weeklySetCounts([entry({ repsDone: "", load: "30" })])).toEqual([]);
  });

  it("conta a mesma série uma vez só por semana", () => {
    const r = weeklySetCounts([
      entry({ dateKey: "2026-09-15" }),
      entry({ dateKey: "2026-09-17" }),
    ]);
    expect(r).toEqual([{ weekKey: "2026-09-14", count: 1 }]);
  });

  it("separa as semanas e devolve em ordem", () => {
    const r = weeklySetCounts([
      entry({ weekKey: "2026-09-14", setId: "s1" }),
      entry({ weekKey: "2026-09-07", setId: "s2" }),
    ]);
    expect(r).toEqual([
      { weekKey: "2026-09-07", count: 1 },
      { weekKey: "2026-09-14", count: 1 },
    ]);
  });
});

describe("trendOf", () => {
  const cell = (load: string, repsDone = "9") =>
    ({ dateKey: "2026-09-15", repsGoal: "10", repsDone, load });

  it("sobe quando a carga aumenta", () => {
    expect(trendOf(cell("30"), cell("35"))).toBe("up");
  });

  it("desce quando a carga diminui", () => {
    expect(trendOf(cell("35"), cell("30"))).toBe("down");
  });

  it("fica igual quando a carga não muda", () => {
    expect(trendOf(cell("30"), cell("30"))).toBe("flat");
  });

  it("aceita vírgula como separador decimal", () => {
    expect(trendOf(cell("32,5"), cell("35"))).toBe("up");
  });

  it("compara reps quando não há carga nas duas", () => {
    expect(trendOf(cell("", "8"), cell("", "10"))).toBe("up");
  });

  it("não compara quando não há anterior", () => {
    expect(trendOf(null, cell("30"))).toBe("none");
  });

  it("não compara quando o valor não é número", () => {
    expect(trendOf(cell("meia série"), cell("30"))).toBe("none");
  });
});
