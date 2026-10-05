import { describe, it, expect } from "vitest";
import { parseWorkoutText, importSummary, setGroups } from "./workout-import";
import type { Day, ExerciseSet } from "@/data/schema";

// Os valores esperados saíram do parser do próprio 1.0 rodado sobre os mesmos
// textos: o 2.0 tem de ler igual enquanto os dois convivem.

/** Tira os ids, que são aleatórios, para comparar só a estrutura. */
function shape(days: Day[]) {
  return days.map((d) => ({
    title: d.title,
    exercises: d.exercises.map(({ id: _id, sets, ...e }) => ({
      ...e,
      sets: sets.map(({ id: _sid, ...s }) => s),
    })),
  }));
}

function set(repsGoal: string, load = "", rir = "") {
  return { repsGoal, repsDone: "", load, intensity: 0, rir, rirEnabled: false };
}

describe("parseWorkoutText", () => {
  it("lê dia, exercício e séries com carga e RIR", () => {
    const days = parseWorkoutText("Segunda-feira\nSupino reto\n3x8-12r 40kg 2rir");
    expect(shape(days)).toEqual([
      {
        title: "Segunda-feira",
        exercises: [{
          name: "Supino reto", muscle: "Peito", synergist: "Tríceps", notes: "",
          sets: [set("8-12", "40", "2"), set("8-12", "40", "2"), set("8-12", "40", "2")],
        }],
      },
    ]);
  });

  it("ignora as linhas antes do primeiro dia", () => {
    const days = parseWorkoutText("Ficha do João\nObjetivo: hipertrofia\nTerça\nRosca direta\n2x10r");
    expect(shape(days)).toEqual([
      {
        title: "Terça",
        exercises: [{ name: "Rosca direta", muscle: "Bíceps", notes: "", sets: [set("10"), set("10")] }],
      },
    ]);
  });

  it("devolve vazio sem nenhum dia da semana", () => {
    expect(parseWorkoutText("Supino reto\n3x10r")).toEqual([]);
    expect(parseWorkoutText("")).toEqual([]);
  });

  it("tira asteriscos do dia, dois-pontos do nome e não confunde placa com repetição", () => {
    const days = parseWorkoutText("**Quarta-feira**\nAgachamento livre:\n4x6-8r placa 5\n3x placa 4 12r");
    const [ex] = days[0].exercises;
    expect(days[0].title).toBe("Quarta-feira");
    expect(ex.name).toBe("Agachamento livre");
    expect(ex.sets.map((s) => [s.repsGoal, s.load])).toEqual([
      ["6-8", "Placa 5"], ["6-8", "Placa 5"], ["6-8", "Placa 5"], ["6-8", "Placa 5"],
      ["12", "Placa 4"], ["12", "Placa 4"], ["12", "Placa 4"],
    ]);
    // o 1.0 deixa o "12r" do formato solto como nota da última série
    expect(ex.notes).toBe("(série 7) 12r");
  });

  it("lê peso do corpo, zerada e sem peso", () => {
    const days = parseWorkoutText(
      "Quinta\nFlexão\n3x10r peso do corpo\nAbdominal\n2x15r zerada\nPrancha\n1x 30s sem peso",
    );
    expect(shape(days)[0].exercises).toEqual([
      { name: "Flexão", notes: "", sets: [set("10", "corpo"), set("10", "corpo"), set("10", "corpo")] },
      { name: "Abdominal", muscle: "Abdômen", notes: "", sets: [set("15", "0"), set("15", "0")] },
      { name: "Prancha", muscle: "Abdômen", notes: "(série 1) 30s", sets: [set("", "0")] },
    ]);
  });

  it("junta as notas e cria o aquecimento quando a nota vem antes de qualquer exercício", () => {
    const days = parseWorkoutText(
      "Sexta\nDescanso no máximo 1m30\nRemada curvada\n- segurar 2s\n(sem strap)\n*foco na escápula*\n12r 20kg\n3x10r 50kg cluster",
    );
    expect(shape(days)[0].exercises).toEqual([
      { name: "Aquecimento / Mobilidade", notes: "Descanso no máximo 1m30", sets: [] },
      {
        name: "Remada curvada", muscle: "Costas", synergist: "Bíceps",
        notes: "segurar 2s; sem strap; foco na escápula; 12r 20kg; (série 3) cluster",
        sets: [set("10", "50"), set("10", "50"), set("10", "50")],
      },
    ]);
  });

  it("separa vários dias e dá id próprio a cada dia, exercício e série", () => {
    const days = parseWorkoutText(
      "Segunda\nSupino\n2x10r\n\nQuarta\nLeg press\n3x12r 100kg\nCadeira extensora\n2x15r",
    );
    expect(days.map((d) => d.title)).toEqual(["Segunda", "Quarta"]);
    expect(days[1].exercises.map((e) => e.name)).toEqual(["Leg press", "Cadeira extensora"]);
    const ids = days.flatMap((d) => [d.id, ...d.exercises.flatMap((e) => [e.id, ...e.sets.map((s) => s.id)])]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("importSummary", () => {
  it("conta dias, exercícios e séries", () => {
    const days = parseWorkoutText(
      "Segunda\nSupino\n2x10r\n\nQuarta\nLeg press\n3x12r 100kg\nCadeira extensora\n2x15r",
    );
    expect(importSummary(days)).toEqual({ days: 2, exercises: 3, sets: 7 });
    expect(importSummary([])).toEqual({ days: 0, exercises: 0, sets: 0 });
  });
});

describe("setGroups", () => {
  const s = (repsGoal: string, load: string, rir = ""): ExerciseSet => ({
    id: "x", repsGoal, repsDone: "", load, intensity: 0, rir, rirEnabled: false,
  });

  it("agrupa só séries iguais e seguidas", () => {
    expect(setGroups([s("10", "40"), s("10", "40"), s("8", "45"), s("10", "40")])).toEqual([
      { count: 2, repsGoal: "10", load: "40", rir: "" },
      { count: 1, repsGoal: "8", load: "45", rir: "" },
      { count: 1, repsGoal: "10", load: "40", rir: "" },
    ]);
  });

  it("separa pelo RIR", () => {
    expect(setGroups([s("10", "40", "2"), s("10", "40", "1")])).toHaveLength(2);
  });

  it("devolve vazio sem séries", () => {
    expect(setGroups([])).toEqual([]);
  });
});
