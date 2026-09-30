import { html, type TemplateResult } from "lit-html";
import { formatVolume, type MuscleVolume } from "@/domain/muscle";

export function muscleVolumeView(volumes: MuscleVolume[], onBack: () => void): TemplateResult {
  const max = volumes[0]?.total || 1;
  const pct = (n: number) => `${Math.round((n / max) * 100)}%`;
  return html`
    <div class="day-head">
      <button class="back" @click=${onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Volume muscular</span>
    </div>
    <p class="muted-note volume-intro">
      Séries por grupo muscular, somando todos os treinos da semana. A parte colorida mostra o que já
      foi feito. O sinergista de um exercício composto conta meia série (supino soma ½ para o tríceps).
    </p>
    ${volumes.length === 0
      ? html`<p class="muted-note">
          Nenhum exercício com grupo muscular ainda. O grupo é adivinhado pelo nome ao renomear o
          exercício, ou escolhido no próprio cartão.
        </p>`
      : html`<div class="volume-list">
          ${volumes.map(
            (v) => html`
              <div>
                <div class="volume-row-head">
                  <span>${v.muscle}</span>
                  <span class="muted-note">${formatVolume(v.done)}/${formatVolume(v.total)} séries</span>
                </div>
                <div class="volume-bar">
                  <div class="volume-bar-total" style="width:${pct(v.total)}"></div>
                  <div class="volume-bar-done" style="width:${pct(v.done)}"></div>
                </div>
              </div>`,
          )}
        </div>`}
  `;
}
