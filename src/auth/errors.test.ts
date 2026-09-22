import { describe, it, expect } from "vitest";
import { translateAuthError } from "./errors";

describe("translateAuthError", () => {
  it("não distingue email inexistente de senha errada", () => {
    // distinguir permitiria descobrir quais emails têm conta
    const a = translateAuthError("auth/user-not-found");
    const b = translateAuthError("auth/wrong-password");
    expect(a).toBe(b);
  });

  it("traduz email inválido", () => {
    expect(translateAuthError("auth/invalid-email")).toBe("Email inválido");
  });

  it("traduz excesso de tentativas", () => {
    expect(translateAuthError("auth/too-many-requests")).toMatch(/tentativas/i);
  });

  it("traduz email já cadastrado", () => {
    expect(translateAuthError("auth/email-already-in-use")).toMatch(/já tem uma conta/i);
  });

  it("devolve mensagem genérica para código desconhecido", () => {
    expect(translateAuthError("auth/coisa-nova")).toBe("Não foi possível completar. Tente de novo.");
  });

  it("nunca vaza o código bruto ao usuário", () => {
    expect(translateAuthError("auth/internal-error-xyz")).not.toContain("auth/");
  });
});
