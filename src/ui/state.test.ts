import { describe, it, expect, vi, beforeEach } from "vitest";
import { getState, setState, subscribe, resetState } from "./state";

beforeEach(() => resetState());

describe("state", () => {
  it("começa carregando", () => {
    expect(getState().view).toBe("loading");
  });

  it("aplica patch parcial sem apagar o resto", () => {
    setState({ selectedClientId: "c1" });
    setState({ view: "trainer" });
    expect(getState().selectedClientId).toBe("c1");
    expect(getState().view).toBe("trainer");
  });

  it("avisa os inscritos a cada mudança", () => {
    const fn = vi.fn();
    subscribe(fn);
    setState({ view: "student" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("para de avisar depois do unsubscribe", () => {
    const fn = vi.fn();
    subscribe(fn)();
    setState({ view: "student" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("não avisa quando nada mudou de valor", () => {
    setState({ view: "student" });
    const fn = vi.fn();
    subscribe(fn);
    setState({ view: "student" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("redesenha quando o colapso de exercício muda", () => {
    // um Set mutado no lugar não mudaria a referência e não redesenharia
    const fn = vi.fn();
    subscribe(fn);
    setState({ collapsedExercises: new Set(["e1"]) });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("estado da fase 2", () => {
  it("começa na grade de treinos", () => {
    expect(getState().screen).toBe("home");
  });

  it("começa editando o treino atual", () => {
    expect(getState().editTarget).toEqual({ kind: "current" });
  });

  it("começa sem arquivo carregado", () => {
    expect(getState().archivedHistory).toBeNull();
    expect(getState().archiveState).toBe("idle");
  });

  it("troca o alvo de edição para um plano", () => {
    setState({ editTarget: { kind: "plan", planId: "p1" } });
    expect(getState().editTarget).toEqual({ kind: "plan", planId: "p1" });
  });

  it("volta ao estado inicial no reset", () => {
    setState({ screen: "progression", pastWeekKey: "2026-09-07" });
    resetState();
    expect(getState().screen).toBe("home");
    expect(getState().pastWeekKey).toBeNull();
  });
});
