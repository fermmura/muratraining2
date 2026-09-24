import { describe, it, expect } from "vitest";
import { cellLabel } from "./progression";
import type { ProgressionCell } from "@/domain/progression";

function cell(patch: Partial<ProgressionCell>): ProgressionCell {
  return { dateKey: "2026-09-21", repsGoal: "", repsDone: "", load: "", ...patch };
}

/**
 * Reps e carga são campos livres: o aluno escreve "corpo" na carga e o treinador
 * escreve a meta já com o "r" ("6-10r"). Concatenar a unidade sem olhar produzia
 * "corpokg" e "6-10rr" na tabela.
 */
describe("cellLabel", () => {
  it("acrescenta a unidade quando o valor é só número", () => {
    expect(cellLabel(cell({ repsDone: "9", load: "40" }))).toBe("9r · 40kg");
  });

  it("não repete o r quando as reps já terminam em r", () => {
    expect(cellLabel(cell({ repsGoal: "6-10r", load: "40" }))).toBe("6-10r · 40kg");
  });

  it("não põe kg em carga escrita por extenso", () => {
    expect(cellLabel(cell({ repsDone: "10", load: "corpo" }))).toBe("10r · corpo");
  });

  it("aceita carga decimal, com ponto ou vírgula", () => {
    expect(cellLabel(cell({ repsDone: "8", load: "42,5" }))).toBe("8r · 42,5kg");
    expect(cellLabel(cell({ repsDone: "8", load: "42.5" }))).toBe("8r · 42.5kg");
  });

  it("mostra só as reps quando não há carga", () => {
    expect(cellLabel(cell({ repsDone: "8" }))).toBe("8r");
  });

  it("prefere o que foi feito à meta", () => {
    expect(cellLabel(cell({ repsGoal: "12r", repsDone: "10" }))).toBe("10r");
  });

  it("mostra só a carga quando não há reps", () => {
    expect(cellLabel(cell({ load: "40" }))).toBe("40kg");
  });

  it("vira travessão quando a célula está vazia", () => {
    expect(cellLabel(cell({}))).toBe("—");
  });
});
