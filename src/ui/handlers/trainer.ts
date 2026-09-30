import { html, type TemplateResult } from "lit-html";
import { setState } from "../state";
import { createClient, type NewClient } from "@/data/client-repo";
import { todayKey, weekKeyOf } from "@/domain/week";
import { uid } from "@/data/id";
import { signOutNow, sendPasswordSetup } from "@/auth/session";
import { createStudentAccount } from "@/auth/invite";
import { translateAuthError } from "@/auth/errors";
import { mutateDays, authErrorCode } from "./target";
import type { Client } from "@/data/schema";

/** Volta a tela para a grade do treino corrente. Usado ao trocar de aluno e ao sair de uma tela. */
export function resetScreen(): void {
  setState({
    screen: "home",
    activeDayId: null,
    editTarget: { kind: "current" },
    pastWeekKey: null,
    pastWeekEntries: null,
    planChoiceWeekKey: null,
  });
}

export const trainer = {
  onSelect: (clientId: string) => {
    setState({ selectedClientId: clientId, archivedHistory: null, archiveState: "idle" });
    resetScreen();
  },
  onLogout: () => void signOutNow(),
  onResendSetup: (email: string) => void sendPasswordSetup(email),
  onInvite: async (name: string, email: string) => {
    setState({ error: null });
    try {
      // a conta nasce primeiro: o id do documento é o UID do Auth
      const studentUid = await createStudentAccount(email);
      const newClient: NewClient = {
        name, email: email.toLowerCase(), goal: "",
        createdAt: Date.now(), days: [], history: [], weekPlans: [],
        // Sem semear activeWeekKey o aluno nunca vira de semana: planPromotion
        // faz `activeKey = client.activeWeekKey ?? currentWeekKey`, e a guarda
        // `currentWeekKey <= activeKey` passa a ser sempre verdadeira. No 1.0 o
        // campo é semeado pelo calendário, que só chega na fase 2 — aqui ele
        // precisa nascer com a ficha.
        activeWeekKey: weekKeyOf(todayKey()),
      };
      await createClient(studentUid, newClient);
    } catch (e) {
      setState({ error: translateAuthError(authErrorCode(e)) });
    }
  },
};

export const student = {
  onOpenDay: (dayId: string) => setState({ activeDayId: dayId }),
  onLogout: () => void signOutNow(),
  onDismissError: () => setState({ error: null }),
};

export function clientSummary(client: Client): TemplateResult {
  return html`
    <div class="grid">
      ${(client.days ?? []).map(
        (d) => html`
          <div class="sq" @click=${() => setState({ activeDayId: d.id })}>
            <div class="title display">${d.title}</div>
            <div class="count">${(d.exercises ?? []).length} exercícios</div>
          </div>`,
      )}
      <!-- mutateDays, e não persist: quando um plano de semana futura está
           aberto, o treino novo precisa nascer DENTRO do plano, e não no
           treino corrente do aluno -->
      <div class="sq add" @click=${() =>
        mutateDays((days) => [...days, { id: uid(), title: "Novo treino", exercises: [] }])}>
        <i class="ti ti-plus"></i>
      </div>
    </div>
  `;
}
