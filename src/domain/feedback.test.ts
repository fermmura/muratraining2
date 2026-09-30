import { describe, it, expect } from "vitest";
import { authorOf, hasUnreadFor, markReadFor, oldestFirst } from "./feedback";
import type { FeedbackEntry } from "@/data/schema";

function msg(patch: Partial<FeedbackEntry>): FeedbackEntry {
  return { id: "x", dateKey: "2026-09-29", from: "aluno", text: "oi", read: false, ...patch };
}

describe("authorOf", () => {
  it("traduz a sessão no valor que o 1.0 grava", () => {
    expect(authorOf(true)).toBe("treinador");
    expect(authorOf(false)).toBe("aluno");
  });
});

/**
 * O 1.0 marcava TODAS as mensagens como lidas ao abrir a conversa
 * (app.js:1756-1759): o aluno reabria a tela e o aviso sumia antes de o
 * treinador ver. Cada mensagem tem um único destinatário, quem não a escreveu.
 */
describe("hasUnreadFor", () => {
  it("conta mensagem do outro lado ainda não lida", () => {
    expect(hasUnreadFor([msg({ from: "aluno" })], "treinador")).toBe(true);
  });

  it("não conta a própria mensagem, mesmo não lida", () => {
    expect(hasUnreadFor([msg({ from: "aluno" })], "aluno")).toBe(false);
  });

  it("não conta mensagem já lida", () => {
    expect(hasUnreadFor([msg({ from: "aluno", read: true })], "treinador")).toBe(false);
  });

  it("aceita lista ausente", () => {
    expect(hasUnreadFor(undefined as unknown as FeedbackEntry[], "aluno")).toBe(false);
  });
});

describe("markReadFor", () => {
  it("devolve null quando não há o que marcar, para não gerar escrita", () => {
    expect(markReadFor([msg({ from: "aluno" })], "aluno")).toBeNull();
    expect(markReadFor([], "aluno")).toBeNull();
  });

  it("marca só as mensagens do outro lado", () => {
    const entries = [msg({ id: "mine", from: "aluno" }), msg({ id: "theirs", from: "treinador" })];
    const next = markReadFor(entries, "aluno")!;
    expect(next.find((m) => m.id === "theirs")?.read).toBe(true);
    expect(next.find((m) => m.id === "mine")?.read).toBe(false);
  });

  it("não altera a lista recebida", () => {
    const entries = [msg({ from: "treinador" })];
    markReadFor(entries, "aluno");
    expect(entries[0].read).toBe(false);
  });
});

describe("oldestFirst", () => {
  it("ordena da mais antiga para a mais recente, mantendo a ordem de gravação no mesmo dia", () => {
    const entries = [
      msg({ id: "late", dateKey: "2026-09-29" }),
      msg({ id: "early", dateKey: "2026-09-20" }),
      msg({ id: "late2", dateKey: "2026-09-29" }),
    ];
    expect(oldestFirst(entries).map((m) => m.id)).toEqual(["early", "late", "late2"]);
  });
});
