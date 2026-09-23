import { describe, it, expect } from "vitest";
import { layoutBars, CHART_HEIGHT } from "./week-bars";

const counts = [
  { weekKey: "2026-09-07", count: 10 },
  { weekKey: "2026-09-14", count: 20 },
];

describe("layoutBars", () => {
  it("devolve uma barra por semana", () => {
    expect(layoutBars(counts, 300, CHART_HEIGHT)).toHaveLength(2);
  });

  it("a maior contagem ocupa a altura útil inteira", () => {
    const [, biggest] = layoutBars(counts, 300, CHART_HEIGHT);
    expect(biggest.height).toBeGreaterThan(0);
    expect(biggest.y + biggest.height).toBeCloseTo(CHART_HEIGHT, 5);
  });

  it("a altura é proporcional à contagem", () => {
    const [smallest, biggest] = layoutBars(counts, 300, CHART_HEIGHT);
    expect(biggest.height).toBeCloseTo(smallest.height * 2, 5);
  });

  it("as barras não se sobrepõem e ficam dentro da largura", () => {
    const bars = layoutBars(counts, 300, CHART_HEIGHT);
    expect(bars[0].x + bars[0].width).toBeLessThanOrEqual(bars[1].x);
    expect(bars[1].x + bars[1].width).toBeLessThanOrEqual(300);
  });

  it("semana sem série feita vira barra de altura zero, não some", () => {
    const bars = layoutBars([{ weekKey: "2026-09-07", count: 0 }, ...counts], 300, CHART_HEIGHT);
    expect(bars).toHaveLength(3);
    expect(bars[0].height).toBe(0);
  });

  it("aceita lista vazia", () => {
    expect(layoutBars([], 300, CHART_HEIGHT)).toEqual([]);
  });

  it("não quebra quando todas as contagens são zero", () => {
    const bars = layoutBars([{ weekKey: "2026-09-07", count: 0 }], 300, CHART_HEIGHT);
    expect(bars[0].height).toBe(0);
    expect(Number.isNaN(bars[0].y)).toBe(false);
  });
});
