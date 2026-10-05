import { describe, it, expect } from "vitest";
import { DEFAULT_THEME, THEME_COLORS, mergeTheme, fontHref } from "./theme";

describe("THEME_COLORS", () => {
  it("tem as 10 cores do 1.0, sem as fontes", () => {
    expect(THEME_COLORS.map((c) => c.key)).toEqual([
      "bg", "panel", "panelAlt", "line", "chalk", "muted", "red", "redDim", "steel", "plate",
    ]);
  });
});

describe("mergeTheme", () => {
  it("devolve o padrão sem documento", () => {
    expect(mergeTheme(undefined)).toEqual(DEFAULT_THEME);
    expect(mergeTheme(null)).toEqual(DEFAULT_THEME);
    expect(mergeTheme("lixo")).toEqual(DEFAULT_THEME);
    expect(mergeTheme({})).toEqual(DEFAULT_THEME);
  });

  it("aceita um tema completo e válido", () => {
    const t = { ...DEFAULT_THEME, bg: "#000000", red: "#00ff00", fontDisplay: "Oswald", fontBody: "Roboto" };
    expect(mergeTheme(t)).toEqual(t);
  });

  it("completa os campos que faltam com o padrão", () => {
    expect(mergeTheme({ bg: "#101010" })).toEqual({ ...DEFAULT_THEME, bg: "#101010" });
  });

  it("descarta cor inválida, campo a campo", () => {
    const t = mergeTheme({ bg: "red", panel: "#12345", line: 42, chalk: "#ABCDEF" });
    expect(t.bg).toBe(DEFAULT_THEME.bg);
    expect(t.panel).toBe(DEFAULT_THEME.panel);
    expect(t.line).toBe(DEFAULT_THEME.line);
    expect(t.chalk).toBe("#ABCDEF");
  });

  it("descarta fonte fora da lista", () => {
    const t = mergeTheme({ fontDisplay: "Comic Sans MS", fontBody: "Poppins" });
    expect(t.fontDisplay).toBe("Anton");
    expect(t.fontBody).toBe("Poppins");
  });

  it("ignora campos desconhecidos", () => {
    expect(mergeTheme({ extra: "#000000" })).toEqual(DEFAULT_THEME);
  });
});

describe("fontHref", () => {
  it("pede os pesos de 400 a 700", () => {
    expect(fontHref("Work Sans")).toBe(
      "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap",
    );
  });

  it("não pede pesos de fonte que só tem um", () => {
    expect(fontHref("Bebas Neue")).toBe("https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap");
  });
});
