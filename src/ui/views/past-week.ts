import { html, type TemplateResult } from "lit-html";
import { weekRangeLabel } from "@/domain/week";
import type { PastDay } from "@/domain/past-week";

/** `days === null` significa que o arquivo daquela semana ainda está sendo buscado. */
export function pastWeekView(
  weekKey: string,
  days: PastDay[] | null,
  onBack: () => void,
): TemplateResult {
  return html`
    <div class="day-head">
      <button class="back" @click=${onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">${weekRangeLabel(weekKey)}</span>
    </div>

    ${days === null
      ? html`<p class="muted-note">Carregando…</p>`
      : days.length === 0
        ? html`<p class="muted-note">Nenhuma série registrada nesta semana.</p>`
        : days.map(
            (d) => html`
              <div class="past-day">
                <h3>${d.dayTitle}</h3>
                ${d.exercises.map(
                  (ex) => html`
                    <div class="past-ex">
                      <div class="past-name">${ex.exName}</div>
                      ${ex.sets.map(
                        (s) => html`
                          <div class="past-set">
                            <span class="past-idx">${s.setIndex + 1}</span>
                            <span>${s.repsDone || "—"} reps</span>
                            <span>${s.load ? `${s.load} kg` : ""}</span>
                            <span>meta ${s.repsGoal || "—"}</span>
                          </div>`,
                      )}
                    </div>`,
                )}
              </div>`,
          )}
  `;
}
