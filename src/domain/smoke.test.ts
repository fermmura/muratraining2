import { describe, it, expect } from "vitest";

describe("scaffold", () => {
  it("roda no fuso de São Paulo", () => {
    expect(new Date("2026-09-17T00:00:00").getFullYear()).toBe(2026);
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/Sao_Paulo");
  });
});
