import { html, type TemplateResult } from "lit-html";
import { live } from "lit-html/directives/live.js";
import type { ExerciseSet } from "@/data/schema";

export interface SetRowHandlers {
  onField: (setId: string, field: "repsGoal" | "repsDone" | "load", value: string) => void;
  onRemove: (setId: string) => void;
}

export function setRow(
  s: ExerciseSet,
  index: number,
  editable: boolean,
  h: SetRowHandlers,
): TemplateResult {
  const field = (f: "repsGoal" | "repsDone" | "load") => (e: Event) =>
    h.onField(s.id, f, (e.target as HTMLInputElement).value);

  return html`
    <div class="set-row">
      <span class="set-idx">${index + 1}</span>

      <div class="stack">
        <div class="box meta">
          <input .value=${live(s.repsGoal ?? "")} @change=${field("repsGoal")}
                 ?readonly=${!editable} inputmode="numeric" />
        </div>
        <span class="unit">meta</span>
      </div>

      <div class="stack">
        <div class="box">
          <input class=${s.repsDone ? "" : "ghost-ref"}
                 .value=${live(s.repsDone ?? "")}
                 placeholder=${s.prevReps ?? ""}
                 @change=${field("repsDone")} inputmode="numeric" />
        </div>
        <span class="unit">feito</span>
      </div>

      <div class="stack">
        <div class="box kg">
          <input .value=${live(s.load ?? "")} @change=${field("load")} inputmode="decimal" />
        </div>
        <span class="unit">kg</span>
      </div>

      ${editable
        ? html`<button class="rm-x" @click=${() => h.onRemove(s.id)} aria-label="Remover série">
            <i class="ti ti-x"></i>
          </button>`
        : null}
    </div>
  `;
}
