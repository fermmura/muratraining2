import { html, type TemplateResult } from "lit-html";
import { exerciseCard, type ExerciseHandlers } from "./exercise";
import { timerButton } from "./timer";
import { dayVolume } from "./day-volume";
import type { Day } from "@/data/schema";

export interface DayHandlers extends ExerciseHandlers {
  onBack: () => void;
  onToggleTimer: (dayId: string) => void;
  onAddExercise: (dayId: string) => void;
}

export function dayView(
  day: Day,
  collapsed: ReadonlySet<string>,
  editable: boolean,
  showTimer: boolean,
  h: DayHandlers,
): TemplateResult {
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">${day.title}</span>
      <!-- num plano de semana futura não há sessão de treino para cronometrar -->
      ${showTimer ? timerButton(day.timerStartedAt, () => h.onToggleTimer(day.id)) : null}
    </div>
    ${dayVolume(day)}

    ${(day.exercises ?? []).map((ex) => exerciseCard(ex, collapsed.has(ex.id), editable, h))}

    ${editable
      ? html`<button class="dashed-btn" @click=${() => h.onAddExercise(day.id)}>
          <i class="ti ti-plus"></i> exercício
        </button>`
      : null}
  `;
}
