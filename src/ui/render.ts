import { render, html, nothing } from "lit-html";
import { getState, subscribe } from "./state";
import { gateView } from "./views/gate";
import { trainerView } from "./views/trainer";
import { studentView } from "./views/student";
import { dayView } from "./components/day";
import * as handlers from "./handlers";

const root = document.getElementById("app")!;

function template() {
  const s = getState();
  switch (s.view) {
    case "loading":
      return html`<p class="muted-note" style="text-align:center;padding-top:60px;">Carregando…</p>`;
    case "gate":
      return gateView(s.error, handlers.gate);
    case "trainer": {
      const client = s.clients.find((c) => c.id === s.selectedClientId) ?? null;
      const day = client?.days?.find((d) => d.id === s.activeDayId);
      const body = day
        ? dayView(day, s.collapsedExercises, true, handlers.day)
        : client
          ? handlers.clientSummary(client)
          : null;
      return trainerView(s.clients, s.selectedClientId, body, s.error, handlers.trainer);
    }
    case "student": {
      if (!s.client) return nothing;
      const day = s.client.days?.find((d) => d.id === s.activeDayId);
      // editable=false: o treinador prescreve a estrutura do treino; o aluno
      // registra. "feito" e "kg" continuam editáveis porque set-row não os
      // condiciona a `editable` — é exatamente essa a divisão de papéis.
      return day
        ? dayView(day, s.collapsedExercises, false, handlers.day)
        : studentView(s.client, handlers.student);
    }
  }
}

export function renderApp(): void {
  render(template(), root);
}

subscribe(renderApp);
