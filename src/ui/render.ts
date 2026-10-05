import { render, html, nothing, type TemplateResult } from "lit-html";
import { getState, subscribe } from "./state";
import { gateView } from "./views/gate";
import { trainerView } from "./views/trainer";
import { studentView } from "./views/student";
import { calendarView } from "./views/calendar";
import { pastWeekView } from "./views/past-week";
import { progressionView } from "./views/progression";
import { cardioView } from "./views/cardio";
import { feedbackView } from "./views/feedback";
import { muscleVolumeView } from "./views/muscle-volume";
import { importView } from "./views/import";
import { muscleVolume } from "@/domain/muscle";
import { dayView } from "./components/day";
import { errorBanner } from "./components/error-banner";
import { photoViewer } from "./components/photo-viewer";
import { updateBanner } from "./components/update-banner";
import { applyUpdate } from "@/pwa";
import { weekRangeLabel, todayKey, weekKeyOf } from "@/domain/week";
import { isWeekOutOfSync } from "@/domain/calendar";
import * as handlers from "./handlers";
import type { Client } from "@/data/schema";

const root = document.getElementById("app")!;

/** As telas fora da grade de treinos, comuns ao treinador e ao aluno. Devolve null na grade normal. */
function screenTemplate(client: Client, editable: boolean): TemplateResult | null {
  const s = getState();

  if (s.screen === "calendar") {
    return calendarView(
      handlers.screens.calendarWeeks(),
      isWeekOutOfSync(client, weekKeyOf(todayKey())),
      weekKeyOf(todayKey()),
      s.planChoiceWeekKey,
      editable,
      { ...handlers.screens, onBack: handlers.screens.onBackHome },
    );
  }

  if (s.screen === "pastWeek" && s.pastWeekKey) {
    return pastWeekView(s.pastWeekKey, handlers.screens.pastWeekDays(), handlers.screens.onOpenCalendar);
  }

  if (s.screen === "progression") {
    return progressionView(
      handlers.visibleHistory(),
      s.progTab,
      s.progSelectedWeek,
      s.archiveState,
      { ...handlers.screens, onBack: handlers.screens.onBackHome },
    );
  }

  if (s.screen === "cardio") {
    return cardioView(client.cardio ?? [], todayKey(), handlers.cardio);
  }

  if (s.screen === "feedback") {
    // só o treinador apaga mensagem, como no 1.0
    return feedbackView(client.feedback ?? [], handlers.me(), editable, handlers.feedback);
  }

  if (s.screen === "muscle") {
    // os dias do alvo de edição: com um plano aberto, é o volume do plano
    return muscleVolumeView(muscleVolume(handlers.editableDays(client)), handlers.screens.onCloseMuscle);
  }

  if (s.screen === "import" && editable) {
    return importView(s.importText, s.importPreview, s.importError, handlers.importer);
  }

  return null;
}

/** Grade de treinos ou o dia aberto, do treino corrente ou do plano em edição. */
function homeTemplate(client: Client, editable: boolean): TemplateResult {
  const s = getState();
  const target = s.editTarget;
  const plan =
    target.kind === "plan"
      ? (client.weekPlans ?? []).find((p) => p.id === target.planId) ?? null
      : null;

  if (target.kind === "plan" && !plan) {
    // o plano sumiu embaixo da tela: promovido pela virada de semana, ou apagado
    return html`<p class="muted-note">Esse plano não existe mais.</p>`;
  }

  const days = plan ? plan.days : client.days ?? [];
  const day = days.find((d) => d.id === s.activeDayId);
  const banner = plan
    ? html`<div class="plan-banner">Planejando ${weekRangeLabel(plan.weekKey)}</div>`
    : null;

  if (day) {
    return html`${banner}${dayView(day, s.collapsedExercises, editable, !plan, { ...handlers.day, ...handlers.photos })}`;
  }

  return html`
    ${banner}
    <div class="prog-tabs">
      <button class="dashed-btn" @click=${handlers.screens.onOpenCalendar}>
        <i class="ti ti-calendar-stats"></i> Calendário
      </button>
      <button class="dashed-btn" @click=${handlers.screens.onOpenProgression}>
        <i class="ti ti-chart-line"></i> Progressão
      </button>
      <button class="dashed-btn" @click=${handlers.cardio.onOpen}>
        <i class="ti ti-heart-rate-monitor"></i> Cardio
      </button>
      ${editable
        ? html`<button class="dashed-btn" @click=${handlers.screens.onOpenMuscle}>
            <i class="ti ti-chart-donut-3"></i> Volume muscular
          </button>`
        : null}
      ${editable && !plan
        ? html`<button class="dashed-btn" @click=${handlers.importer.onOpen}>
            <i class="ti ti-clipboard-text"></i> Importar treino
          </button>`
        : null}
      <button class="dashed-btn" @click=${handlers.feedback.onOpen}>
        <i class="ti ti-message-circle"></i> Feedbacks
        ${handlers.feedback.hasUnread() ? html`<span class="unread-dot" aria-label="mensagem nova"></span>` : null}
      </button>
    </div>
    <!-- os dias vêm do alvo de edição: do treino corrente ou do plano aberto -->
    ${editable
      ? handlers.clientSummary({ ...client, days })
      : studentView({ ...client, days }, handlers.student)}
  `;
}

function viewTemplate() {
  const s = getState();
  switch (s.view) {
    case "loading":
      return html`<p class="muted-note" style="text-align:center;padding-top:60px;">Carregando…</p>`;
    case "gate":
      return gateView(s.error, handlers.gate);
    case "trainer": {
      const client = s.clients.find((c) => c.id === s.selectedClientId) ?? null;
      const body = client ? screenTemplate(client, true) ?? homeTemplate(client, true) : null;
      return trainerView(s.clients, s.selectedClientId, body, s.error, handlers.trainer);
    }
    case "student": {
      if (!s.client) return nothing;
      // editable=false: o treinador prescreve a estrutura do treino; o aluno
      // registra. "feito" e "kg" continuam editáveis porque set-row não os
      // condiciona a `editable`.
      return html`
        ${errorBanner(s.error, handlers.student.onDismissError)}
        ${screenTemplate(s.client, false) ?? homeTemplate(s.client, false)}
      `;
    }
  }
}

/** Camadas por cima de qualquer tela. */
function template() {
  const s = getState();
  return html`
    ${updateBanner(s.updateReady, applyUpdate)}
    ${viewTemplate()}
    ${photoViewer(s.photoViewer, handlers.photos.onClosePhoto)}
  `;
}

export function renderApp(): void {
  render(template(), root);
}

subscribe(renderApp);
