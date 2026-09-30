import type { Day, Exercise } from "@/data/schema";

/** Os mesmos do 1.0 (app.js:1251-1254). O nome é o que fica gravado. */
export const MUSCLE_GROUPS: readonly string[] = [
  "Peito", "Costas", "Ombro", "Deltoide posterior", "Trapézio", "Bíceps", "Tríceps", "Antebraço",
  "Quadríceps", "Posterior de coxa", "Glúteo", "Adutores", "Panturrilha", "Abdômen", "Lombar",
];

function matcher(name: string): (...words: string[]) => boolean {
  const n = (name ?? "").toLowerCase();
  return (...words) => words.some((w) => n.includes(w));
}

/**
 * Adivinha o músculo pelo nome, com as palavras do 1.0 (app.js:1283-1302).
 * A ordem importa: "crucifixo invertido" precisa ser visto antes de "crucifixo".
 */
export function guessMuscle(name: string): string {
  const has = matcher(name);
  if (has("crucifixo invertido", "crucifixo inverso", "face pull", "remada alta", "elevação posterior", "elevacao posterior", "peck deck invertido", "peckdeck invertido")) return "Deltoide posterior";
  if (has("supino", "peck deck", "peckdeck", "crucifixo", "cross over", "crossover", "voador")) return "Peito";
  if (has("puxada", "remada", "pulldown", "barra fixa", "pull-up", "pulley costas", "levantamento terra", "terra convencional")) return "Costas";
  if (has("desenvolvimento", "elevação lateral", "elevacao lateral", "elevação frontal", "arnold")) return "Ombro";
  if (has("encolhimento", "trapézio", "trapezio")) return "Trapézio";
  if (has("rosca") && !has("rosca inversa punho")) return "Bíceps";
  if (has("tríceps", "triceps", "jm press", "francês", "frances", "testa")) return "Tríceps";
  if (has("punho", "antebraço", "antebraco")) return "Antebraço";
  if (has("panturrilha", "flexão plantar", "flexao plantar")) return "Panturrilha";
  if (has("agachamento", "leg press", "cadeira extensora", "hack", "avanço", "avanco", "afundo")) return "Quadríceps";
  if (has("stiff", "cadeira flexora", "mesa flexora", "flexão de joelho", "flexao de joelho", "flexão nórdica", "flexao nordica")) return "Posterior de coxa";
  if (has("glúteo", "gluteo", "hip thrust", "elevação pélvica", "elevacao pelvica", "coice")) return "Glúteo";
  if (has("adutora", "adutor")) return "Adutores";
  if (has("abdominal", "abs supra", "abs infra", "prancha", "abdômen", "abdomen")) return "Abdômen";
  if (has("lombar", "extensão de tronco", "extensao de tronco", "hiperextensão", "hiperextensao")) return "Lombar";
  return "";
}

/**
 * Exercícios compostos recrutam um segundo músculo. A série conta meia para ele:
 * é o método que melhor prevê hipertrofia segundo Pelland et al., 2025, Sports
 * Medicine — a mesma escolha do 1.0 (app.js:1304-1318).
 */
export function guessSynergist(name: string): string {
  const has = matcher(name);
  if (has("crucifixo invertido", "crucifixo inverso", "face pull", "remada alta", "elevação posterior", "elevacao posterior")) return "Trapézio";
  if (has("supino", "crucifixo", "cross over", "crossover", "voador") && !has("máquina peito isolad")) return "Tríceps";
  if (has("puxada", "remada", "pulldown", "barra fixa", "pull-up", "pulley costas")) return "Bíceps";
  if (has("desenvolvimento", "arnold")) return "Tríceps";
  if (has("levantamento terra", "terra convencional", "stiff", "hip thrust", "elevação pélvica", "elevacao pelvica")) return "Posterior de coxa";
  if (has("agachamento", "leg press", "hack", "avanço", "avanco", "afundo")) return "Glúteo";
  return "";
}

/**
 * O que adivinhar ao renomear. Só age quando o músculo ainda não foi escolhido,
 * e nunca troca o sinergista que alguém já escolheu.
 */
export function guessedMuscles(ex: Exercise, name: string): { muscle?: string; synergist?: string } {
  if (ex.muscle) return {};
  const patch: { muscle?: string; synergist?: string } = {};
  const muscle = guessMuscle(name);
  if (muscle) patch.muscle = muscle;
  if (!ex.synergist) {
    const synergist = guessSynergist(name);
    if (synergist) patch.synergist = synergist;
  }
  return patch;
}

export interface SetCount {
  done: number;
  total: number;
}

export function daySetCount(day: Day): SetCount {
  const count: SetCount = { done: 0, total: 0 };
  for (const e of day.exercises ?? []) {
    for (const s of e.sets ?? []) {
      count.total++;
      if (s.repsDone) count.done++;
    }
  }
  return count;
}

export interface MuscleVolume {
  muscle: string;
  done: number;
  total: number;
}

/** Séries por grupo nos dias dados: uma para o principal, meia para o sinergista. Maior total primeiro. */
export function muscleVolume(days: Day[]): MuscleVolume[] {
  const byMuscle = new Map<string, MuscleVolume>();
  const add = (muscle: string | undefined, weight: number, done: boolean) => {
    if (!muscle) return;
    const v = byMuscle.get(muscle) ?? { muscle, done: 0, total: 0 };
    v.total += weight;
    if (done) v.done += weight;
    byMuscle.set(muscle, v);
  };
  for (const d of days ?? []) {
    for (const e of d.exercises ?? []) {
      for (const s of e.sets ?? []) {
        add(e.muscle, 1, !!s.repsDone);
        add(e.synergist, 0.5, !!s.repsDone);
      }
    }
  }
  return [...byMuscle.values()].sort((a, b) => b.total - a.total);
}

/** "3", "2,5". Os valores são múltiplos de meia série; o arredondamento é só por segurança. */
export function formatVolume(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}
