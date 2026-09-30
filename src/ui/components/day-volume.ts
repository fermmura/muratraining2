import { html, type TemplateResult } from "lit-html";
import { daySetCount, formatVolume, muscleVolume } from "@/domain/muscle";
import type { Day } from "@/data/schema";

/** "x/y séries feitas" e uma etiqueta por grupo muscular, abaixo do título do dia. */
export function dayVolume(day: Day): TemplateResult | null {
  const count = daySetCount(day);
  if (count.total === 0) return null;
  const volumes = muscleVolume([day]);
  return html`
    <div class="day-volume ${count.done === count.total ? "complete" : ""}">
      ${count.done}/${count.total} séries feitas
    </div>
    ${volumes.length
      ? html`<div class="muscle-pills">
          ${volumes.map((v) => html`<span class="muscle-pill">${v.muscle}: <b>${formatVolume(v.done)}/${formatVolume(v.total)}</b></span>`)}
        </div>`
      : null}
  `;
}
