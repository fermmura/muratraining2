import { html, type TemplateResult } from "lit-html";
import { weekRangeLabel } from "@/domain/week";
import type { CalendarWeek } from "@/domain/calendar";

export interface CalendarHandlers {
  onBack: () => void;
  onOpenWeek: (week: CalendarWeek) => void;
  onFixWeek: () => void;
  onChoosePlan: (weekKey: string, mode: "copy" | "empty") => void;
  onCancelChoice: () => void;
}

const ICONS: Record<CalendarWeek["state"], string> = {
  past: "ti-check",
  current: "ti-flame",
  planned: "ti-calendar-event",
  empty: "ti-calendar",
};

function stateLabel(week: CalendarWeek, editable: boolean): string {
  switch (week.state) {
    case "past":
      return week.setsDone ? `Concluída · ${week.setsDone} séries registradas` : "Sem registros";
    case "current":
      return `Semana atual · ${week.setsDone}/${week.setsTotal} séries`;
    case "planned":
      return "Planejada";
    case "empty":
      return editable ? "Ainda não planejada" : "Ainda não disponível";
  }
}

export function calendarView(
  weeks: CalendarWeek[],
  outOfSync: boolean,
  currentWeekKey: string,
  choiceWeekKey: string | null,
  editable: boolean,
  h: CalendarHandlers,
): TemplateResult {
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Calendário</span>
    </div>

    ${outOfSync && editable
      ? html`
          <div class="cal-warning">
            A semana marcada como atual não bate com a data de hoje.
            <button @click=${h.onFixWeek}>
              Corrigir para a semana de hoje (${weekRangeLabel(currentWeekKey)})
            </button>
          </div>`
      : null}

    ${choiceWeekKey
      ? html`
          <div class="plan-choice">
            <p>Como montar o treino de ${weekRangeLabel(choiceWeekKey)}?</p>
            <button class="dashed-btn" @click=${() => h.onChoosePlan(choiceWeekKey, "copy")}>
              <i class="ti ti-copy"></i> copiar o treino desta semana
            </button>
            <button class="dashed-btn" @click=${() => h.onChoosePlan(choiceWeekKey, "empty")}>
              <i class="ti ti-plus"></i> começar do zero
            </button>
            <button class="dashed-btn" @click=${h.onCancelChoice}>cancelar</button>
          </div>`
      : null}

    <div class="cal-list">
      ${weeks.map(
        (w) => html`
          <div class="cal-row ${w.state}" @click=${() => h.onOpenWeek(w)}>
            <i class="ti ${ICONS[w.state]} cal-icon"></i>
            <div style="flex:1;">
              <div class="cal-range">${weekRangeLabel(w.weekKey)}</div>
              <div class="cal-state">${stateLabel(w, editable)}</div>
            </div>
            <i class="ti ti-chevron-right cal-icon" style="font-size:15px;"></i>
          </div>`,
      )}
    </div>
  `;
}
