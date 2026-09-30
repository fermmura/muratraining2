import { html, type TemplateResult } from "lit-html";
import { CARDIO_ZONES, cardioTotals, monthStartKey, newestFirst, type CardioTotals } from "@/domain/cardio";
import { weekKeyOf, weekLabel } from "@/domain/week";
import type { CardioEntry } from "@/data/schema";

export interface CardioHandlers {
  onBack: () => void;
  onAdd: (minutesText: string, zone: string, note: string) => boolean;
  onRemove: (id: string) => void;
}

function totalsBox(title: string, totals: CardioTotals): TemplateResult {
  // na ordem das zonas, e não na ordem em que apareceram nos registros
  const zones = CARDIO_ZONES.filter((z) => totals.byZone[z.key]);
  return html`
    <div class="cardio-box">
      <div class="cardio-box-title">${title}</div>
      <div class="display cardio-box-total">${totals.totalMin} min</div>
      ${zones.length
        ? html`<div class="cardio-zones">
            ${zones.map((z) => html`<span class="cardio-zone ${z.key}">${z.key} · ${totals.byZone[z.key]}min</span>`)}
          </div>`
        : null}
    </div>
  `;
}

function onSubmit(e: Event, h: CardioHandlers): void {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const minutes = form.elements.namedItem("minutes") as HTMLInputElement;
  const zone = (form.elements.namedItem("zone") as HTMLSelectElement).value;
  const note = (form.elements.namedItem("note") as HTMLTextAreaElement).value;
  if (h.onAdd(minutes.value, zone, note)) {
    form.reset();
    return;
  }
  minutes.setCustomValidity("Informe os minutos em número inteiro.");
  minutes.reportValidity();
}

export function cardioView(entries: CardioEntry[], today: string, h: CardioHandlers): TemplateResult {
  const list = newestFirst(entries);
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Cardio</span>
    </div>

    <div class="cardio-totals">
      ${totalsBox("Essa semana", cardioTotals(entries, weekKeyOf(today)))}
      ${totalsBox("Esse mês", cardioTotals(entries, monthStartKey(today)))}
    </div>

    <form class="cardio-form" @submit=${(e: Event) => onSubmit(e, h)}>
      <div class="cardio-form-row">
        <input name="minutes" type="number" min="1" step="1" inputmode="numeric" required
               placeholder="minutos"
               @input=${(e: Event) => (e.target as HTMLInputElement).setCustomValidity("")} />
        <select name="zone">
          <option value="">Zona (opcional)</option>
          ${CARDIO_ZONES.map((z) => html`<option value=${z.key}>${z.label}</option>`)}
        </select>
      </div>
      <textarea name="note" rows="2" placeholder="observações (opcional)"></textarea>
      <button class="dashed-btn" type="submit"><i class="ti ti-plus"></i> Registrar cardio</button>
    </form>

    <div class="section-label">Histórico</div>
    ${list.length === 0
      ? html`<p class="muted-note">Nenhum cardio registrado ainda.</p>`
      : list.map(
          (e) => html`
            <div class="cardio-row">
              <i class="ti ti-clock"></i>
              <div class="cardio-row-text">
                <div>${e.minutes} min${e.note ? ` · ${e.note}` : ""}</div>
                <!-- weekLabel formata qualquer dia, não só a segunda-feira -->
                <div class="cardio-row-date">${weekLabel(e.dateKey)}</div>
              </div>
              ${e.zone ? html`<span class="cardio-zone ${e.zone}">${e.zone}</span>` : null}
              <button class="rm-x" @click=${() => h.onRemove(e.id)} aria-label="Remover registro">
                <i class="ti ti-x"></i>
              </button>
            </div>`,
        )}
  `;
}
