import { html, type TemplateResult } from "lit-html";
import {
  buildProgressionRows, progressionWeekKeys, trendOf, weeklySetCounts,
  type ProgressionCell,
} from "@/domain/progression";
import { weekLabel } from "@/domain/week";
import { weekBars } from "../components/week-bars";
import type { HistoryEntry } from "@/data/schema";

export interface ProgressionHandlers {
  onBack: () => void;
  onTab: (tab: "overall" | "table") => void;
  onSelectWeek: (weekKey: string) => void;
  onLoadArchive: () => void;
}

/** Quantas semanas cabem na tabela sem precisar rolar até o fim do mundo. */
const VISIBLE_WEEKS = 8;

function cellLabel(cell: ProgressionCell): string {
  const reps = cell.repsDone || cell.repsGoal || "-";
  return cell.load ? `${reps}r · ${cell.load}kg` : `${reps}r`;
}

function tableView(history: HistoryEntry[]): TemplateResult {
  const rows = buildProgressionRows(history);
  const weeks = progressionWeekKeys(history).slice(-VISIBLE_WEEKS);

  return html`
    <div class="prog-scroll">
      <table class="prog-table">
        <thead>
          <tr>
            <th class="row-head">Série</th>
            ${weeks.map((w) => html`<th>${weekLabel(w)}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            let prev: ProgressionCell | null = null;
            return html`
              <tr>
                <td class="row-head">${row.exName} · ${row.setIndex + 1}ª</td>
                ${weeks.map((w) => {
                  const cell = row.byWeek.get(w);
                  if (!cell) return html`<td class="empty-cell">—</td>`;
                  const trend = trendOf(prev, cell);
                  prev = cell;
                  return html`
                    <td>
                      ${cellLabel(cell)}
                      ${trend === "up" ? html`<i class="ti ti-arrow-up trend-up"></i>` : null}
                      ${trend === "down" ? html`<i class="ti ti-arrow-down trend-down"></i>` : null}
                    </td>`;
                })}
              </tr>`;
          })}
        </tbody>
      </table>
    </div>
  `;
}

export function progressionView(
  history: HistoryEntry[],
  tab: "overall" | "table",
  selectedWeek: string | null,
  archiveState: "idle" | "loading" | "loaded" | "error",
  h: ProgressionHandlers,
): TemplateResult {
  const isEmpty = history.length === 0;

  return html`
    <div class="day-head">
      <button class="back" @click=${h.onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Progressão</span>
    </div>

    <div class="prog-tabs">
      <button class="dashed-btn ${tab === "overall" ? "active" : ""}" @click=${() => h.onTab("overall")}>
        Treino inteiro
      </button>
      <button class="dashed-btn ${tab === "table" ? "active" : ""}" @click=${() => h.onTab("table")}>
        Tabela
      </button>
    </div>

    ${isEmpty
      ? html`<p class="muted-note">
          Ainda não há histórico. Assim que reps ou carga forem preenchidos, a progressão
          aparece aqui, semana a semana.
        </p>`
      : tab === "overall"
        ? html`
            <p class="muted-note">Séries feitas por semana, somando todos os exercícios.</p>
            ${weekBars(weeklySetCounts(history), selectedWeek, h.onSelectWeek)}`
        : tableView(history)}

    <div class="prog-footer">
      ${archiveState === "loaded"
        ? html`<span class="muted-note">Histórico completo carregado.</span>`
        : archiveState === "loading"
          ? html`<span class="muted-note">Carregando histórico…</span>`
          : html`
              <button class="dashed-btn" @click=${h.onLoadArchive}>
                <i class="ti ti-history"></i> carregar histórico completo
              </button>
              ${archiveState === "error"
                ? html`<span class="muted-note">Não foi possível carregar. Tente de novo.</span>`
                : null}`}
    </div>
  `;
}
