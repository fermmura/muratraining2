/**
 * Contrato do Firestore compartilhado com o MuraTraining 1.0, que continua no ar
 * lendo e escrevendo estes mesmos documentos. Só é permitido ADICIONAR campos.
 * Renomear, remover ou mudar tipo quebra o app de quem está treinando agora.
 */

export interface ExerciseSet {
  id: string;
  repsGoal: string;
  repsDone: string;
  load: string;
  intensity: number;
  rir: string;
  rirEnabled: boolean;
  /** Carga prescrita pelo treinador: para de ser sobrescrita pela do último treino. */
  loadSetByTrainer?: boolean;
  /** Reps do último treino feito, mostrado esmaecido como referência. */
  prevReps?: string;
}

export interface Exercise {
  id: string;
  name: string;
  notes: string;
  sets: ExerciseSet[];
  muscle?: string;
  synergist?: string;
  photoUrl?: string;
  hasPhoto?: boolean;
  videoUrl?: string;
  studentNote?: string;
  studentNoteAt?: number;
}

export interface Day {
  id: string;
  title: string;
  exercises: Exercise[];
  /** Epoch ms de quando o cronômetro daquele dia começou. Estado de sessão, não do treino. */
  timerStartedAt?: number;
}

export interface WeekPlan {
  id: string;
  weekKey: string;
  days: Day[];
}

export interface HistoryEntry {
  dateKey: string;
  weekKey: string;
  dayId: string;
  dayTitle: string;
  exId: string;
  exName: string;
  setId: string;
  setIndex: number;
  repsGoal: string;
  repsDone: string;
  load: string;
}

export interface CardioEntry {
  id: string;
  dateKey: string;
  minutes: number;
  zone: string;
  note: string;
}

export interface Client {
  /** Id do documento, que é o UID do Firebase Auth. Não é campo gravado. */
  id: string;
  name: string;
  email: string;
  goal: string;
  createdAt: number;
  lastSeen?: number;
  activeWeekKey?: string;
  days: Day[];
  weekPlans?: WeekPlan[];
  history?: HistoryEntry[];
  cardio?: CardioEntry[];
  feedback?: unknown[];
  workoutSessions?: unknown[];
}

/** Introduzido pelo 2.0. O 1.0 ignora, por isso é aditivo e seguro. */
export interface HistoryArchiveDoc {
  weekKey: string;
  entries: HistoryEntry[];
}

/** Campos que o aluno pode alterar no próprio documento. Espelha firestore.rules. */
export const STUDENT_WRITABLE_FIELDS = [
  "days",
  "history",
  "cardio",
  "feedback",
  "workoutSessions",
  "lastSeen",
  "activeWeekKey",
  "weekPlans",
] as const;
