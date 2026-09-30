import { describe, it, expect } from "vitest";
import { CARDIO_ZONES, parseMinutes, cardioTotals, monthStartKey, newestFirst } from "./cardio";
import type { CardioEntry } from "@/data/schema";

function entry(patch: Partial<CardioEntry>): CardioEntry {
  return { id: "x", dateKey: "2026-09-29", minutes: 30, zone: "", note: "", ...patch };
}

describe("CARDIO_ZONES", () => {
  it("tem as cinco zonas do 1.0, em ordem", () => {
    expect(CARDIO_ZONES.map((z) => z.key)).toEqual(["Z1", "Z2", "Z3", "Z4", "Z5"]);
  });
});

describe("parseMinutes", () => {
  it("aceita inteiro positivo", () => {
    expect(parseMinutes("30")).toBe(30);
  });

  it("ignora espaço em volta", () => {
    expect(parseMinutes(" 45 ")).toBe(45);
  });

  it("recusa zero, vazio, texto, negativo e decimal", () => {
    for (const text of ["0", "", "abc", "-5", "30.5", "30,5"]) {
      expect(parseMinutes(text)).toBeNull();
    }
  });
});

describe("cardioTotals", () => {
  it("soma só a partir da data pedida", () => {
    const entries = [
      entry({ dateKey: "2026-09-27", minutes: 100 }),
      entry({ dateKey: "2026-09-28", minutes: 20 }),
      entry({ dateKey: "2026-09-29", minutes: 25 }),
    ];
    const totals = cardioTotals(entries, "2026-09-28");
    expect(totals.totalMin).toBe(45);
    expect(totals.count).toBe(2);
  });

  it("separa por zona e deixa de fora o registro sem zona", () => {
    const entries = [
      entry({ zone: "Z2", minutes: 20 }),
      entry({ zone: "Z2", minutes: 10 }),
      entry({ zone: "Z4", minutes: 15 }),
      entry({ zone: "", minutes: 40 }),
    ];
    const totals = cardioTotals(entries, "2026-09-28");
    expect(totals.byZone).toEqual({ Z2: 30, Z4: 15 });
    expect(totals.totalMin).toBe(85);
  });

  it("aceita minutos gravados como texto pelo 1.0 e ignora lixo", () => {
    const entries = [
      entry({ minutes: "20" as unknown as number }),
      entry({ minutes: "abc" as unknown as number }),
    ];
    expect(cardioTotals(entries, "2026-09-28").totalMin).toBe(20);
  });

  it("devolve zero quando não há registro", () => {
    expect(cardioTotals([], "2026-09-28")).toEqual({ totalMin: 0, byZone: {}, count: 0 });
  });
});

describe("monthStartKey", () => {
  it("devolve o dia 1 do mesmo mês", () => {
    expect(monthStartKey("2026-09-29")).toBe("2026-09-01");
  });
});

describe("newestFirst", () => {
  it("ordena do dia mais recente para o mais antigo", () => {
    const entries = [entry({ id: "a", dateKey: "2026-09-20" }), entry({ id: "b", dateKey: "2026-09-29" })];
    expect(newestFirst(entries).map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("no mesmo dia, o último registrado vem primeiro", () => {
    const entries = [entry({ id: "first" }), entry({ id: "second" })];
    expect(newestFirst(entries).map((e) => e.id)).toEqual(["second", "first"]);
  });

  it("não altera a lista recebida", () => {
    const entries = [entry({ id: "a", dateKey: "2026-09-20" }), entry({ id: "b", dateKey: "2026-09-29" })];
    newestFirst(entries);
    expect(entries.map((e) => e.id)).toEqual(["a", "b"]);
  });
});
