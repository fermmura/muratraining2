import { describe, it, expect } from "vitest";
import { layoutBars, weekBars, CHART_HEIGHT } from "./week-bars";

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

/**
 * Cada template do lit-html é parseado isolado: um `<rect>` escrito com o tag
 * `html` vira HTMLUnknownElement e não desenha nada, mesmo aninhado dentro do
 * `<svg>`. Só o tag `svg` dá o namespace certo. O defeito não gera exceção — o
 * gráfico simplesmente some —, então fica travado aqui.
 *
 * Sem DOM no ambiente de teste, a checagem é na marca que o lit põe no
 * template: `_$litType$` é 1 para html e 2 para svg.
 */
describe("weekBars", () => {
  interface LitTemplate { _$litType$: number; strings: readonly string[]; values: unknown[] }

  function isTemplate(v: unknown): v is LitTemplate {
    return typeof v === "object" && v !== null && "_$litType$" in v;
  }

  function collect(v: unknown, found: LitTemplate[] = []): LitTemplate[] {
    if (Array.isArray(v)) for (const item of v) collect(item, found);
    else if (isTemplate(v)) {
      found.push(v);
      for (const value of v.values) collect(value, found);
    }
    return found;
  }

  it("desenha rect e text com o tag svg, e não com o tag html", () => {
    const templates = collect(weekBars(counts, null, () => {}));
    const svgTags = templates.filter((t) => /<(rect|text)\b/.test(t.strings.join("")));

    expect(svgTags.length).toBeGreaterThan(0);
    for (const t of svgTags) expect(t._$litType$).toBe(2);
  });
});
