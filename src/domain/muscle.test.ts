import { describe, it, expect } from "vitest";
import {
  MUSCLE_GROUPS, guessMuscle, guessSynergist, guessedMuscles,
  daySetCount, muscleVolume, formatVolume,
} from "./muscle";
import type { Day, Exercise, ExerciseSet } from "@/data/schema";

function set(repsDone = ""): ExerciseSet {
  return { id: "s", repsGoal: "10", repsDone, load: "", intensity: 0, rir: "", rirEnabled: false };
}

function ex(patch: Partial<Exercise>): Exercise {
  return { id: "e", name: "", notes: "", sets: [], ...patch };
}

function day(exercises: Exercise[]): Day {
  return { id: "d", title: "Treino", exercises };
}

describe("MUSCLE_GROUPS", () => {
  it("tem os 15 grupos do 1.0", () => {
    expect(MUSCLE_GROUPS).toHaveLength(15);
    expect(MUSCLE_GROUPS).toContain("Deltoide posterior");
  });
});

describe("guessMuscle", () => {
  it("reconhece pelo nome, sem diferenciar maiúscula", () => {
    expect(guessMuscle("SUPINO reto")).toBe("Peito");
    expect(guessMuscle("Rosca direta")).toBe("Bíceps");
    expect(guessMuscle("Tríceps testa")).toBe("Tríceps");
    expect(guessMuscle("Agachamento livre")).toBe("Quadríceps");
    expect(guessMuscle("Cadeira flexora")).toBe("Posterior de coxa");
    expect(guessMuscle("Hip thrust")).toBe("Glúteo");
    expect(guessMuscle("Elevação lateral")).toBe("Ombro");
  });

  it("confere o deltoide posterior antes do peito, porque 'crucifixo invertido' contém 'crucifixo'", () => {
    expect(guessMuscle("Crucifixo invertido")).toBe("Deltoide posterior");
  });

  it("rosca inversa de punho é antebraço, não bíceps", () => {
    expect(guessMuscle("Rosca inversa punho")).toBe("Antebraço");
  });

  it("devolve vazio quando não reconhece", () => {
    expect(guessMuscle("Burpee")).toBe("");
  });
});

describe("guessSynergist", () => {
  it("reconhece os compostos", () => {
    expect(guessSynergist("Supino inclinado")).toBe("Tríceps");
    expect(guessSynergist("Puxada alta")).toBe("Bíceps");
    expect(guessSynergist("Crucifixo invertido")).toBe("Trapézio");
    expect(guessSynergist("Agachamento")).toBe("Glúteo");
  });

  it("devolve vazio para isolado", () => {
    expect(guessSynergist("Rosca direta")).toBe("");
  });
});

describe("guessedMuscles", () => {
  it("preenche músculo e sinergista quando estão vazios", () => {
    expect(guessedMuscles(ex({}), "Supino reto")).toEqual({ muscle: "Peito", synergist: "Tríceps" });
  });

  it("nunca sobrescreve um músculo já escolhido", () => {
    expect(guessedMuscles(ex({ muscle: "Ombro" }), "Supino reto")).toEqual({});
  });

  it("mantém o sinergista já escolhido", () => {
    expect(guessedMuscles(ex({ synergist: "Ombro" }), "Supino reto")).toEqual({ muscle: "Peito" });
  });

  it("não devolve nada quando não reconhece", () => {
    expect(guessedMuscles(ex({}), "Burpee")).toEqual({});
  });
});

describe("daySetCount", () => {
  it("conta séries e as feitas", () => {
    const d = day([ex({ sets: [set("10"), set(""), set("8")] }), ex({ sets: [set("")] })]);
    expect(daySetCount(d)).toEqual({ done: 2, total: 4 });
  });
});

describe("muscleVolume", () => {
  it("conta uma série para o principal e meia para o sinergista", () => {
    const d = day([ex({ muscle: "Peito", synergist: "Tríceps", sets: [set("10"), set("")] })]);
    expect(muscleVolume([d])).toEqual([
      { muscle: "Peito", done: 1, total: 2 },
      { muscle: "Tríceps", done: 0.5, total: 1 },
    ]);
  });

  it("soma os dias e ordena do maior total para o menor", () => {
    const a = day([ex({ muscle: "Bíceps", sets: [set()] })]);
    const b = day([ex({ muscle: "Costas", sets: [set(), set(), set()] }), ex({ muscle: "Bíceps", sets: [set()] })]);
    expect(muscleVolume([a, b]).map((v) => [v.muscle, v.total])).toEqual([["Costas", 3], ["Bíceps", 2]]);
  });

  it("ignora exercício sem músculo", () => {
    expect(muscleVolume([day([ex({ sets: [set()] })])])).toEqual([]);
  });
});

describe("formatVolume", () => {
  it("escreve inteiro sem casa decimal e meia série com vírgula", () => {
    expect(formatVolume(3)).toBe("3");
    expect(formatVolume(2.5)).toBe("2,5");
    expect(formatVolume(0)).toBe("0");
  });
});
