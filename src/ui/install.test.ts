import { describe, it, expect } from "vitest";
import { installKindFor } from "./install";

const base = { standalone: false, ios: false, dismissed: false };

describe("installKindFor", () => {
  it("mostra o botão quando o navegador oferece o prompt", () => {
    expect(installKindFor(base, true)).toBe("android");
  });

  it("mostra a instrução no iPhone, que não tem prompt", () => {
    expect(installKindFor({ ...base, ios: true }, false)).toBe("ios");
  });

  it("não mostra nada sem prompt fora do iPhone", () => {
    expect(installKindFor(base, false)).toBeNull();
  });

  it("não mostra nada com o app já instalado", () => {
    expect(installKindFor({ ...base, standalone: true }, true)).toBeNull();
    expect(installKindFor({ ...base, standalone: true, ios: true }, false)).toBeNull();
  });

  it("não mostra nada depois de dispensado", () => {
    expect(installKindFor({ ...base, dismissed: true }, true)).toBeNull();
    expect(installKindFor({ ...base, dismissed: true, ios: true }, false)).toBeNull();
  });
});
