import { describe, it, expect } from "vitest";
import { splitHistoryForArchive, ARCHIVE_AFTER_WEEKS } from "./archive";
import { addWeeks } from "./week";
import type { HistoryEntry } from "@/data/schema";

const CURRENT = "2026-09-14";

function entry(weekKey: string, setId: string, dateKey = weekKey): HistoryEntry {
  return {
    dateKey, weekKey, dayId: "d1", dayTitle: "Peito", exId: "e1", exName: "Supino",
    setId, setIndex: 0, repsGoal: "10", repsDone: "9", load: "30",
  };
}

describe("splitHistoryForArchive", () => {
  it("mantém histórico recente no documento", () => {
    const recente = entry(addWeeks(CURRENT, -1), "s1");
    const { keep, archive } = splitHistoryForArchive([recente], CURRENT);
    expect(keep).toHaveLength(1);
    expect(archive.size).toBe(0);
  });

  it("arquiva o que passou do corte", () => {
    const antigo = entry(addWeeks(CURRENT, -(ARCHIVE_AFTER_WEEKS + 1)), "s1");
    const { keep, archive } = splitHistoryForArchive([antigo], CURRENT);
    expect(keep).toHaveLength(0);
    expect(archive.get(antigo.weekKey)).toEqual([antigo]);
  });

  it("mantém a semana exatamente no limite do corte", () => {
    const limite = entry(addWeeks(CURRENT, -ARCHIVE_AFTER_WEEKS), "s1");
    const { keep } = splitHistoryForArchive([limite], CURRENT);
    expect(keep).toHaveLength(1);
  });

  it("nunca parte uma semana entre documento e arquivo", () => {
    const wk = addWeeks(CURRENT, -(ARCHIVE_AFTER_WEEKS + 2));
    const { keep, archive } = splitHistoryForArchive(
      [entry(wk, "s1", wk), entry(wk, "s2", addWeeks(wk, 0))],
      CURRENT,
    );
    expect(keep).toHaveLength(0);
    expect(archive.get(wk)).toHaveLength(2);
  });

  it("agrupa cada semana em seu próprio documento", () => {
    const w1 = addWeeks(CURRENT, -(ARCHIVE_AFTER_WEEKS + 1));
    const w2 = addWeeks(CURRENT, -(ARCHIVE_AFTER_WEEKS + 2));
    const { archive } = splitHistoryForArchive([entry(w1, "s1"), entry(w2, "s2")], CURRENT);
    expect(archive.size).toBe(2);
  });

  it("descarta entrada sem weekKey em vez de arquivar errado", () => {
    const quebrada = { ...entry(CURRENT, "s1"), weekKey: "" };
    const { keep, archive } = splitHistoryForArchive([quebrada], CURRENT);
    expect(keep).toEqual([quebrada]);
    expect(archive.size).toBe(0);
  });

  it("não faz nada com histórico vazio", () => {
    const { keep, archive } = splitHistoryForArchive([], CURRENT);
    expect(keep).toHaveLength(0);
    expect(archive.size).toBe(0);
  });
});
