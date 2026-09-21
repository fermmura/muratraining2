import { describe, it, expect } from "vitest";
import { uid } from "./id";

describe("uid", () => {
  it("gera id no formato esperado", () => {
    expect(uid()).toMatch(/^[0-9a-z]{12}$/);
  });

  it("não colide em volume", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50_000; i++) seen.add(uid());
    expect(seen.size).toBe(50_000);
  });
});
