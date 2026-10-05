import { html, type TemplateResult } from "lit-html";
import { importSummary, setGroups, type SetGroup } from "@/domain/workout-import";
import type { Day } from "@/data/schema";

export interface ImportHandlers {
  onRead: (text: string) => void;
  onEdit: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "3× 8-12 · 40 kg · 2 RIR". Carga que não é número ("Placa 5", "corpo") sai como veio. */
function groupLabel(g: SetGroup): string {
  const parts = [`${g.count}×${g.repsGoal ? ` ${g.repsGoal}` : ""}`];
  if (g.load) parts.push(/^\d+(?:[.,]\d+)?$/.test(g.load) ? `${g.load} kg` : g.load);
  if (g.rir) parts.push(`${g.rir} RIR`);
  return parts.join(" · ");
}

function textStep(text: string, error: string | null, h: ImportHandlers): TemplateResult {
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onClose}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Importar treino</span>
    </div>
    <p class="muted-note import-hint">
      Cole o texto do treino no formato de dias da semana, nomes de exercício e linhas com
      "1x10-12r 20kg". Isso <b>adiciona</b> novos treinos sem apagar os que já existem.
    </p>
    <form @submit=${(e: Event) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      h.onRead((form.elements.namedItem("text") as HTMLTextAreaElement).value);
    }}>
      <textarea class="import-text" name="text" .value=${text}
        placeholder=${"Segunda-feira (...)\nNome do exercício\n-8r 10kg\n1x9-12r 26kg\n..."}></textarea>
      ${error ? html`<p class="import-error">${error}</p>` : null}
      <div class="import-actions">
        <button class="cta" type="submit">Ler</button>
      </div>
    </form>
  `;
}

function previewStep(days: Day[], h: ImportHandlers): TemplateResult {
  const sum = importSummary(days);
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onEdit}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Conferir</span>
    </div>
    <p class="muted-note import-hint">
      ${plural(sum.days, "dia", "dias")}, ${plural(sum.exercises, "exercício", "exercícios")},
      ${plural(sum.sets, "série", "séries")}. Serão adicionados aos treinos do aluno, sem apagar os que já existem.
    </p>
    ${days.map(
      (d) => html`
        <div class="import-day">
          <h3 class="display">${d.title}</h3>
          ${d.exercises.map(
            (ex) => html`
              <div class="import-ex">
                <div class="import-ex-name">
                  ${ex.name}
                  ${ex.muscle ? html`<span class="import-ex-muscle">${ex.muscle}</span>` : null}
                </div>
                ${setGroups(ex.sets).map((g) => html`<div class="import-sets">${groupLabel(g)}</div>`)}
                ${ex.notes ? html`<div class="import-notes">${ex.notes}</div>` : null}
              </div>`,
          )}
        </div>`,
    )}
    <div class="import-actions">
      <button class="cta" @click=${h.onConfirm}>Adicionar ao aluno</button>
      <button class="dashed-btn import-back" @click=${h.onEdit}>Voltar e corrigir</button>
    </div>
  `;
}

export function importView(
  text: string,
  preview: Day[] | null,
  error: string | null,
  h: ImportHandlers,
): TemplateResult {
  return preview ? previewStep(preview, h) : textStep(text, error, h);
}
