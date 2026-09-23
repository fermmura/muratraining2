import { getState, setState } from "../state";
import { applySetFieldChange, setFieldInDays } from "@/domain/history";
import { uid } from "@/data/id";
import { isTimerRunning } from "../components/timer";
import { currentClient, editableDays, mutateDays, persist } from "./target";

function newSet() {
  return { id: uid(), repsGoal: "10", repsDone: "", load: "", intensity: 0, rir: "", rirEnabled: false };
}

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
          ? { ...d, exercises: [...(d.exercises ?? []), { id: uid(), name: "", notes: "", sets: [newSet()] }] }
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
          e.id === exId ? { ...e, sets: [...(e.sets ?? []), newSet()] } : e,
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

  /**
   * Reps e carga no treino corrente passam por applySetFieldChange porque também
   * geram histórico. Num PLANO de semana futura, não: planejar não é treinar, e
   * gravar histórico de uma semana que não aconteceu envenenaria a progressão.
   */
  onField: (setId: string, field: "repsGoal" | "repsDone" | "load", value: string) => {
    const c = currentClient();
    const dayId = getState().activeDayId;
    if (!c || !dayId) return;

    const targetDays = editableDays(c);
    const ex = targetDays.find((d) => d.id === dayId)?.exercises.find((e) => e.sets.some((s) => s.id === setId));
    if (!ex) return;

    if (getState().editTarget.kind === "plan") {
      mutateDays((days) => setFieldInDays(days, dayId, ex.id, setId, field, value));
      return;
    }

    const { days, history } = applySetFieldChange(c, dayId, ex.id, setId, field, value);
    persist(c.id, field === "repsGoal" ? { days } : { days, history });
  },
};
