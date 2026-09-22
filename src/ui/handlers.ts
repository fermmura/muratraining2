import { html, type TemplateResult } from "lit-html";
import { getState, setState } from "./state";
import { saveClient, createClient, type NewClient } from "@/data/client-repo";
import { applySetFieldChange } from "@/domain/history";
import { todayKey, weekKeyOf } from "@/domain/week";
import { uid } from "@/data/id";
import { signIn, signOutNow, sendPasswordSetup } from "@/auth/session";
import { createStudentAccount } from "@/auth/invite";
import { translateAuthError } from "@/auth/errors";
import { isTimerRunning } from "./components/timer";
import type { Client, Day } from "@/data/schema";

/** O aluno em edição: o próprio, ou o selecionado quando quem está logado é o treinador. */
function current(): Client | null {
  const s = getState();
  return s.view === "student" ? s.client : s.clients.find((c) => c.id === s.selectedClientId) ?? null;
}

/**
 * Grava sem bloquear a tela. A promessa fica pendente enquanto estiver offline
 * (ver saveClient), então nunca é aguardada; mas uma rejeição — regra negada,
 * documento apagado — precisa aparecer, senão o treino some sem aviso.
 */
function persist(clientId: string, patch: Partial<Client>): void {
  saveClient(clientId, patch).catch(() => {
    setState({ error: "Não foi possível salvar. Recarregue a página e tente de novo." });
  });
}

function mutateDays(fn: (days: Day[]) => Day[]): void {
  const c = current();
  if (!c) return;
  persist(c.id, { days: fn(c.days ?? []) });
}

function code(e: unknown): string {
  return (e as { code?: string }).code ?? "";
}

export const gate = {
  onSubmit: async (email: string, password: string) => {
    setState({ error: null });
    try {
      await signIn(email, password);
    } catch (e) {
      setState({ error: translateAuthError(code(e)) });
    }
  },
  onForgot: async (email: string) => {
    if (!email) { setState({ error: "Digite seu email primeiro." }); return; }
    try {
      await sendPasswordSetup(email);
      setState({ error: "Enviamos um email para você criar uma senha nova." });
    } catch (e) {
      setState({ error: translateAuthError(code(e)) });
    }
  },
};

export const trainer = {
  onSelect: (clientId: string) => setState({ selectedClientId: clientId, activeDayId: null }),
  onLogout: () => void signOutNow(),
  onResendSetup: (email: string) => void sendPasswordSetup(email),
  onInvite: async (name: string, email: string) => {
    setState({ error: null });
    try {
      // a conta nasce primeiro: o id do documento é o UID do Auth
      const studentUid = await createStudentAccount(email);
      const novo: NewClient = {
        name, email: email.toLowerCase(), goal: "",
        createdAt: Date.now(), days: [], history: [], weekPlans: [],
        // Sem semear activeWeekKey o aluno nunca vira de semana: planPromotion
        // faz `activeKey = client.activeWeekKey ?? currentWeekKey`, e a guarda
        // `currentWeekKey <= activeKey` passa a ser sempre verdadeira. No 1.0 o
        // campo é semeado pelo calendário, que só chega na fase 2 — aqui ele
        // precisa nascer com a ficha.
        activeWeekKey: weekKeyOf(todayKey()),
      };
      await createClient(studentUid, novo);
    } catch (e) {
      setState({ error: translateAuthError(code(e)) });
    }
  },
};

export const student = {
  onOpenDay: (dayId: string) => setState({ activeDayId: dayId }),
  onLogout: () => void signOutNow(),
};

export const day = {
  onBack: () => setState({ activeDayId: null }),

  onToggle: (exId: string) => {
    // Set novo a cada vez: mutar o existente não mudaria a referência, e
    // setState só redesenha quando algum valor muda.
    const next = new Set(getState().collapsedExercises);
    if (!next.delete(exId)) next.add(exId);
    setState({ collapsedExercises: next });
  },

  onToggleTimer: (dayId: string) =>
    mutateDays((days) =>
      days.map((d) =>
        d.id === dayId
          ? { ...d, timerStartedAt: isTimerRunning(d.timerStartedAt) ? undefined : Date.now() }
          : d,
      ),
    ),

  onAddExercise: (dayId: string) =>
    mutateDays((days) =>
      days.map((d) =>
        d.id === dayId
          ? { ...d, exercises: [...(d.exercises ?? []), {
              id: uid(), name: "", notes: "",
              sets: [{ id: uid(), repsGoal: "10", repsDone: "", load: "", intensity: 0, rir: "", rirEnabled: false }],
            }] }
          : d,
      ),
    ),

  onRemoveExercise: (exId: string) =>
    mutateDays((days) =>
      days.map((d) => ({ ...d, exercises: (d.exercises ?? []).filter((e) => e.id !== exId) })),
    ),

  onRename: (exId: string, name: string) =>
    mutateDays((days) =>
      days.map((d) => ({
        ...d,
        exercises: (d.exercises ?? []).map((e) => (e.id === exId ? { ...e, name } : e)),
      })),
    ),

  onNotes: (exId: string, notes: string) =>
    mutateDays((days) =>
      days.map((d) => ({
        ...d,
        exercises: (d.exercises ?? []).map((e) => (e.id === exId ? { ...e, notes } : e)),
      })),
    ),

  onAddSet: (exId: string) =>
    mutateDays((days) =>
      days.map((d) => ({
        ...d,
        exercises: (d.exercises ?? []).map((e) =>
          e.id === exId
            ? { ...e, sets: [...(e.sets ?? []), {
                id: uid(), repsGoal: "10", repsDone: "", load: "", intensity: 0, rir: "", rirEnabled: false,
              }] }
            : e,
        ),
      })),
    ),

  onRemove: (setId: string) =>
    mutateDays((days) =>
      days.map((d) => ({
        ...d,
        exercises: (d.exercises ?? []).map((e) => ({
          ...e, sets: (e.sets ?? []).filter((s) => s.id !== setId),
        })),
      })),
    ),

  /** Reps e carga passam por applySetFieldChange porque também geram histórico. */
  onField: (setId: string, field: "repsGoal" | "repsDone" | "load", value: string) => {
    const c = current();
    const dayId = getState().activeDayId;
    if (!c || !dayId) return;
    const ex = c.days?.find((d) => d.id === dayId)?.exercises.find((e) => e.sets.some((s) => s.id === setId));
    if (!ex) return;
    const { days, history } = applySetFieldChange(c, dayId, ex.id, setId, field, value);
    persist(c.id, field === "repsGoal" ? { days } : { days, history });
  },
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
      <div class="sq add" @click=${() => {
        persist(client.id, {
          days: [...(client.days ?? []), { id: uid(), title: "Novo treino", exercises: [] }],
        });
      }}>
        <i class="ti ti-plus"></i>
      </div>
    </div>
  `;
}
