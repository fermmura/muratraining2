import { html, type TemplateResult } from "lit-html";
import { MUSCLE_GROUPS } from "@/domain/muscle";
import type { Exercise } from "@/data/schema";

export interface MuscleHandlers {
  onMuscle: (exId: string, field: "muscle" | "synergist", value: string) => void;
}

// `?selected` em cada opção, e não `.value` no select: as opções chegam por uma
// expressão filha e ainda não existem quando o valor do select seria aplicado
function options(selected: string | undefined, empty: string): TemplateResult {
  return html`
    <option value="" ?selected=${!selected}>${empty}</option>
    ${MUSCLE_GROUPS.map((m) => html`<option value=${m} ?selected=${selected === m}>${m}</option>`)}
  `;
}

/** Treinador escolhe; aluno vê as etiquetas. */
export function musclePicker(ex: Exercise, editable: boolean, h: MuscleHandlers): TemplateResult | null {
  if (editable) {
    const change = (field: "muscle" | "synergist") => (e: Event) =>
      h.onMuscle(ex.id, field, (e.target as HTMLSelectElement).value);
    return html`
      <div class="muscle-picker">
        <select @change=${change("muscle")} aria-label="Músculo principal">
          ${options(ex.muscle, "Músculo")}
        </select>
        <select class="synergist" @change=${change("synergist")}
                aria-label="Sinergista, conta meia série" title="Sinergista — conta como meia série">
          ${options(ex.synergist, "Sinergista (½)")}
        </select>
      </div>
    `;
  }
  if (!ex.muscle && !ex.synergist) return null;
  return html`
    <div class="muscle-tags">
      ${ex.muscle ? html`<span class="muscle-tag">${ex.muscle}</span>` : null}
      ${ex.synergist ? html`<span class="muscle-tag synergist">+½ ${ex.synergist}</span>` : null}
    </div>
  `;
}
