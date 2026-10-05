/*
 * Tema do app: as 10 cores e as 2 fontes do 1.0 (app.js:24-32), no mesmo
 * documento `settings/theme = { draft, published }`. Os dois apps leem e
 * gravam o mesmo formato enquanto convivem.
 */

export interface Theme {
  bg: string;
  panel: string;
  panelAlt: string;
  line: string;
  chalk: string;
  muted: string;
  red: string;
  redDim: string;
  steel: string;
  plate: string;
  fontDisplay: string;
  fontBody: string;
}

export type ColorKey = Exclude<keyof Theme, "fontDisplay" | "fontBody">;

export const DEFAULT_THEME: Theme = {
  bg: "#17161A", panel: "#211F25", panelAlt: "#2A2830", line: "#3A3742",
  chalk: "#F3EFE6", muted: "#9A94A6", red: "#FF4433", redDim: "#5C2620",
  steel: "#4C86B4", plate: "#E8B94A",
  fontDisplay: "Anton", fontBody: "Inter",
};

/** Na ordem e com os rótulos da tela do 1.0. */
export const THEME_COLORS: { key: ColorKey; label: string }[] = [
  { key: "bg", label: "Fundo" },
  { key: "panel", label: "Painel" },
  { key: "panelAlt", label: "Painel (alt)" },
  { key: "line", label: "Bordas" },
  { key: "chalk", label: "Texto principal" },
  { key: "muted", label: "Texto secundário" },
  { key: "red", label: "Destaque (botões)" },
  { key: "redDim", label: "Destaque escuro" },
  { key: "steel", label: "Cor do kg" },
  { key: "plate", label: "Cor da meta" },
];

export const FONT_DISPLAY_OPTIONS = ["Anton", "Bebas Neue", "Oswald", "Poppins", "Montserrat"];
export const FONT_BODY_OPTIONS = ["Inter", "Roboto", "Work Sans", "Nunito Sans", "Poppins"];

/** Fontes que o Google Fonts só tem num peso: pedir 500-700 delas falha. */
const SINGLE_WEIGHT = new Set(["Anton", "Bebas Neue"]);

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * O tema salvo, completado com o padrão campo a campo. Cor fora de `#rrggbb`
 * e fonte fora da lista caem no padrão: um documento estragado nunca deixa o
 * app ilegível.
 */
export function mergeTheme(saved: unknown): Theme {
  const t: Theme = { ...DEFAULT_THEME };
  if (!saved || typeof saved !== "object") return t;
  const s = saved as Record<string, unknown>;
  for (const { key } of THEME_COLORS) {
    const v = s[key];
    if (typeof v === "string" && HEX.test(v)) t[key] = v;
  }
  if (typeof s.fontDisplay === "string" && FONT_DISPLAY_OPTIONS.includes(s.fontDisplay)) t.fontDisplay = s.fontDisplay;
  if (typeof s.fontBody === "string" && FONT_BODY_OPTIONS.includes(s.fontBody)) t.fontBody = s.fontBody;
  return t;
}

/** Endereço do Google Fonts para uma família só. */
export function fontHref(family: string): string {
  const name = family.replace(/ /g, "+");
  const weights = SINGLE_WEIGHT.has(family) ? "" : ":wght@400;500;600;700";
  return `https://fonts.googleapis.com/css2?family=${name}${weights}&display=swap`;
}
