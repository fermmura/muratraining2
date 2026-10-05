import { uid } from "@/data/id";
import { guessMuscle, guessSynergist } from "./muscle";
import type { Day, Exercise, ExerciseSet } from "@/data/schema";

/*
 * Leitura de treino colado como texto. Transcrição fiel do 1.0
 * (app.js:2357-2516): o mesmo texto precisa dar o mesmo treino nos dois apps
 * enquanto eles convivem. Corrigir uma regra daqui é mudança de comportamento,
 * fora desta fase.
 */

const WEEKDAY_RE = /\b(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)\b/i;
const WARMUP_NAME = "Aquecimento / Mobilidade";

interface SetLine {
  count: number;
  range: string;
  load: string;
  rir: string;
  extraNote: string;
}

export interface ImportSummary {
  days: number;
  exercises: number;
  sets: number;
}

/** Séries iguais e seguidas, para a prévia mostrar "3× 8-12" em vez de três linhas. */
export interface SetGroup {
  count: number;
  repsGoal: string;
  load: string;
  rir: string;
}

function stripStars(line: string): string {
  return line.replace(/^\*+/, "").replace(/\*+$/, "").trim();
}

/** RIR, carga e o que sobrar, do texto depois do "Nx" e do range de reps. */
function extractRest(count: number, range: string, rest: string): SetLine {
  let load = "";
  let rir = "";

  const rirMatch = rest.match(/(\d+)\s*rir\b/i);
  if (rirMatch) rir = rirMatch[1];

  const placaMatch = rest.match(/placa\s*(\d+)/i);
  const kgMatch = rest.match(/([\d]+(?:[.,]\d+)?)\s*kg/i);

  if (placaMatch) load = `Placa ${placaMatch[1]}`;
  else if (/zerada|sem peso/i.test(rest)) load = "0";
  else if (kgMatch) load = kgMatch[1];
  else if (/peso do corpo|\bcorpo\b/i.test(rest)) load = "corpo";

  // o que não virou range/kg/rir vira observação, para não perder informação
  let leftover = rest;
  for (const m of [rirMatch, placaMatch, kgMatch]) {
    if (m) leftover = leftover.replace(m[0], "");
  }
  leftover = leftover.replace(/zerada|sem peso|peso do corpo|\bkg\b/gi, "");
  leftover = leftover.replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, "").trim();

  return { count, range, load, rir, extraNote: leftover };
}

function parseWorkLine(line: string): SetLine | null {
  // formato limpo: "NxRANGEr resto"
  const clean = line.match(/^(\d+)\s*x\s*(\d+)(?:[-\s]+(\d+))?\s*r\b(.*)$/i);
  if (clean) {
    const count = parseInt(clean[1], 10) || 1;
    const range = clean[3] ? `${clean[2]}-${clean[3]}` : clean[2];
    return extractRest(count, range, clean[4] || "");
  }

  // formato solto: "Nx resto qualquer" (placa, cluster... sem range logo depois do x)
  const loose = line.match(/^(\d+)\s*x\s*(.*)$/i);
  if (loose) {
    const count = parseInt(loose[1], 10) || 1;
    const rest = loose[2] || "";
    const restForRange = rest.replace(/placa\s*\d+/i, ""); // o nº da placa não vira reps
    const rangeMatch = restForRange.match(/(\d+)(?:[-\s]+(\d+))?\s*r\b/i);
    const range = rangeMatch ? (rangeMatch[2] ? `${rangeMatch[1]}-${rangeMatch[2]}` : rangeMatch[1]) : "";
    return extractRest(count, range, rest);
  }

  return null;
}

/** Aquecimento sem "-" na frente, tipo "12r 0kg" ou "5 8r 40kg". */
function isPrepLine(line: string): boolean {
  return /^\d+(?:[-\s]+\d+)?\s*r\b/i.test(line) && !/^\d+\s*x/i.test(line);
}

/** Instrução geral, que não é exercício nem série. */
function looksLikeInstruction(line: string): boolean {
  return /^(descanso|obs|observa[cç][aã]o|dica)\b/i.test(line);
}

function newExercise(name: string): Exercise {
  const ex: Exercise = { id: uid(), name, notes: "", sets: [] };
  const muscle = guessMuscle(name);
  const synergist = guessSynergist(name);
  if (muscle) ex.muscle = muscle;
  if (synergist) ex.synergist = synergist;
  return ex;
}

function newSet(line: SetLine): ExerciseSet {
  return {
    id: uid(), repsGoal: line.range, repsDone: "", load: line.load,
    intensity: 0, rir: line.rir, rirEnabled: false,
  };
}

/**
 * Dias lidos do texto. Linhas antes do primeiro dia da semana são ignoradas
 * (título da ficha, nome do aluno). Sem nenhum dia, devolve [].
 */
export function parseWorkoutText(text: string): Day[] {
  const days: Day[] = [];
  const notes = new Map<Exercise, string[]>();
  let day: Day | null = null;
  let ex: Exercise | null = null;

  const current = (d: Day): Exercise => {
    if (!ex) {
      ex = { id: uid(), name: WARMUP_NAME, notes: "", sets: [] };
      d.exercises.push(ex);
    }
    return ex;
  };
  const note = (e: Exercise, s: string) => {
    const list = notes.get(e) ?? [];
    list.push(s);
    notes.set(e, list);
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    if (WEEKDAY_RE.test(line)) {
      day = { id: uid(), title: stripStars(line), exercises: [] };
      days.push(day);
      ex = null;
      continue;
    }
    if (!day) continue;

    if (line.startsWith("-")) {
      note(current(day), line.slice(1).trim());
      continue;
    }

    const work = parseWorkLine(line);
    if (work) {
      const e = current(day);
      for (let n = 0; n < work.count; n++) e.sets.push(newSet(work));
      if (work.extraNote) note(e, `(série ${e.sets.length}) ${work.extraNote}`);
      continue;
    }

    if (isPrepLine(line) || looksLikeInstruction(line)) {
      note(current(day), line);
      continue;
    }

    if (line.startsWith("*") || (line.startsWith("(") && line.endsWith(")"))) {
      note(current(day), stripStars(line).replace(/^\(|\)$/g, ""));
      continue;
    }

    // qualquer outra linha é um exercício novo
    ex = newExercise(line.replace(/:$/, ""));
    day.exercises.push(ex);
  }

  for (const [e, list] of notes) e.notes = list.join("; ");
  return days;
}

export function importSummary(days: Day[]): ImportSummary {
  const exercises = days.flatMap((d) => d.exercises);
  return {
    days: days.length,
    exercises: exercises.length,
    sets: exercises.reduce((n, e) => n + e.sets.length, 0),
  };
}

export function setGroups(sets: ExerciseSet[]): SetGroup[] {
  const groups: SetGroup[] = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && last.repsGoal === s.repsGoal && last.load === s.load && last.rir === s.rir) {
      last.count++;
    } else {
      groups.push({ count: 1, repsGoal: s.repsGoal, load: s.load, rir: s.rir });
    }
  }
  return groups;
}
