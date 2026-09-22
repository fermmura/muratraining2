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
