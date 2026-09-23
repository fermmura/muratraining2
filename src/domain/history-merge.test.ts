import { describe, it, expect } from "vitest";
import { mergeHistory } from "./history-merge";
import type { HistoryEntry } from "@/data/schema";

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    dateKey: "2026-09-15", weekKey: "2026-09-14", dayId: "d1", dayTitle: "Peito",
    exId: "e1", exName: "Supino", setId: "s1", setIndex: 0,
    repsGoal: "10", repsDone: "9", load: "30", ...over,
  };
}

describe("mergeHistory", () => {
  it("junta as duas origens", () => {
    const a = entry({ setId: "s1", dateKey: "2026-09-15" });
    const b = entry({ setId: "s2", dateKey: "2020-01-06", weekKey: "2020-01-06" });
    expect(mergeHistory([a], [b])).toHaveLength(2);
  });

  it("remove duplicata da mesma série no mesmo dia", () => {
    const a = entry({ load: "35" });
    const b = entry({ load: "30" });
    const r = mergeHistory([a], [b]);
    expect(r).toHaveLength(1);
  });

  it("na duplicata, o documento vence o arquivo", () => {
    // o documento é o que os dois apps escrevem hoje; o arquivo é cópia de ontem
    const doDocumento = entry({ load: "35" });
    const doArquivo = entry({ load: "30" });
    expect(mergeHistory([doDocumento], [doArquivo])[0].load).toBe("35");
  });

  it("mantém a mesma série em dias diferentes", () => {
    const a = entry({ dateKey: "2026-09-15" });
    const b = entry({ dateKey: "2026-09-17" });
    expect(mergeHistory([a], [b])).toHaveLength(2);
  });

  it("devolve em ordem crescente de data", () => {
    const antiga = entry({ setId: "s9", dateKey: "2020-01-06", weekKey: "2020-01-06" });
    const nova = entry({ setId: "s1", dateKey: "2026-09-15" });
    expect(mergeHistory([nova], [antiga]).map((h) => h.dateKey)).toEqual(["2020-01-06", "2026-09-15"]);
  });

  it("aceita arquivo vazio", () => {
    expect(mergeHistory([entry()], [])).toHaveLength(1);
  });

  it("aceita documento vazio", () => {
    expect(mergeHistory([], [entry()])).toHaveLength(1);
  });
});
