import { html, svg, type TemplateResult } from "lit-html";
import { weekLabel } from "@/domain/week";

export const CHART_HEIGHT = 160;
const CHART_WIDTH = 320;
/** Respiro entre barras, em unidades do viewBox. Mantém as barras separadas sem linha divisória. */
const GAP = 6;

export interface BarGeometry {
  weekKey: string;
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Geometria das barras dentro do viewBox. Fica separada do desenho para poder
 * ser testada: erro de escala é o defeito clássico de gráfico feito à mão, e
 * não aparece como exceção, só como número errado na tela.
 */
export function layoutBars(
  counts: { weekKey: string; count: number }[],
  width: number,
  height: number,
): BarGeometry[] {
  if (!counts.length) return [];
  const max = Math.max(...counts.map((c) => c.count));
  const slot = width / counts.length;
  const barWidth = Math.max(1, slot - GAP);

  return counts.map((c, i) => {
    // tudo zero: nenhuma barra sobe, e nada divide por zero
    const barHeight = max > 0 ? (c.count / max) * height : 0;
    return {
      weekKey: c.weekKey,
      count: c.count,
      x: i * slot + GAP / 2,
      y: height - barHeight,
      width: barWidth,
      height: barHeight,
    };
  });
}

/**
 * Barras de séries feitas por semana. Uma série de dados só: uma cor só e sem
 * legenda — o título da aba já diz o que é. Tocar numa barra mostra o número
 * daquela semana, que é a alternativa ao tooltip de mouse no celular.
 */
export function weekBars(
  counts: { weekKey: string; count: number }[],
  selectedWeek: string | null,
  onSelect: (weekKey: string) => void,
): TemplateResult {
  const bars = layoutBars(counts, CHART_WIDTH, CHART_HEIGHT);
  const selected = bars.find((b) => b.weekKey === selectedWeek) ?? null;

  return html`
    <div class="chart">
      <svg viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 18}" role="img"
           aria-label="Séries feitas por semana">
        <line x1="0" y1=${CHART_HEIGHT} x2=${CHART_WIDTH} y2=${CHART_HEIGHT} class="chart-axis" />
        ${bars.map(
          (b) => svg`
            <rect class="chart-bar ${b.weekKey === selectedWeek ? "selected" : ""}"
                  x=${b.x} y=${b.y} width=${b.width} height=${b.height}
                  rx="3" @click=${() => onSelect(b.weekKey)}>
              <title>${weekLabel(b.weekKey)}: ${b.count} séries</title>
            </rect>
            <!-- alvo de toque inteiro, para a barra baixa não ser impossível de acertar -->
            <rect class="chart-hit" x=${b.x} y="0" width=${b.width} height=${CHART_HEIGHT}
                  @click=${() => onSelect(b.weekKey)}></rect>`,
        )}
        ${bars.length
          ? svg`
              <text x="0" y=${CHART_HEIGHT + 14} class="chart-tick">${weekLabel(bars[0].weekKey)}</text>
              <text x=${CHART_WIDTH} y=${CHART_HEIGHT + 14} text-anchor="end" class="chart-tick">
                ${weekLabel(bars[bars.length - 1].weekKey)}
              </text>`
          : null}
      </svg>
      <p class="chart-readout">
        ${selected
          ? `${weekLabel(selected.weekKey)}: ${selected.count} séries`
          : "Toque numa barra para ver a semana"}
      </p>
    </div>
  `;
}
