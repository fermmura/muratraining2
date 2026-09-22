import { html, type TemplateResult } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { setRow, type SetRowHandlers } from "./set-row";
import type { Exercise } from "@/data/schema";

export interface ExerciseHandlers extends SetRowHandlers {
  onRename: (exId: string, name: string) => void;
  onNotes: (exId: string, notes: string) => void;
  onAddSet: (exId: string) => void;
  onRemoveExercise: (exId: string) => void;
  onToggle: (exId: string) => void;
}

export function exerciseCard(
  ex: Exercise,
  collapsed: boolean,
  editable: boolean,
  h: ExerciseHandlers,
): TemplateResult {
  const scoped: SetRowHandlers = {
    onField: (setId, field, value) => h.onField(setId, field, value),
    onRemove: (setId) => h.onRemove(setId),
  };

  return html`
    <div class="ex-card">
      <div class="ex-top">
        <input class="ex-name" .value=${live(ex.name ?? "")}
               @change=${(e: Event) => h.onRename(ex.id, (e.target as HTMLInputElement).value)}
               ?readonly=${!editable} placeholder="Nome do exercício" />
        <button class="ex-toggle ${collapsed ? "collapsed" : ""}"
                @click=${() => h.onToggle(ex.id)} aria-label="Abrir ou fechar exercício">
          <i class="ti ti-chevron-down"></i>
        </button>
      </div>

      <div class="ex-body ${collapsed ? "hidden" : ""}">
        ${ex.notes || editable
          ? html`<div class="notes-box">
              <label>Observações</label>
              <textarea .value=${live(ex.notes ?? "")} ?readonly=${!editable}
                        @change=${(e: Event) => h.onNotes(ex.id, (e.target as HTMLTextAreaElement).value)}></textarea>
            </div>`
          : null}

        ${(ex.sets ?? []).map((s, i) => setRow(s, i, editable, scoped))}

        ${editable
          ? html`
              <button class="dashed-btn" @click=${() => h.onAddSet(ex.id)}>
                <i class="ti ti-plus"></i> série
              </button>
              <button class="dashed-btn" @click=${() => h.onRemoveExercise(ex.id)}>
                <i class="ti ti-trash"></i> exercício
              </button>`
          : null}
      </div>
    </div>
  `;
}
