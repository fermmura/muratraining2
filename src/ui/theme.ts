import { getState, subscribe } from "./state";
import { DEFAULT_THEME, THEME_COLORS, fontHref, type Theme } from "@/domain/theme";

// index.html já carrega as duas fontes padrão
const loadedFonts = new Set([DEFAULT_THEME.fontDisplay, DEFAULT_THEME.fontBody]);

/** Baixa uma família só, na primeira vez que ela for usada. */
function loadFont(family: string): void {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = fontHref(family);
  document.head.appendChild(link);
}

export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  for (const { key } of THEME_COLORS) root.style.setProperty(`--${key}`, t[key]);
  loadFont(t.fontDisplay);
  loadFont(t.fontBody);
  root.style.setProperty("--font-display", `'${t.fontDisplay}', 'Inter', sans-serif`);
  root.style.setProperty("--font-body", `'${t.fontBody}', system-ui, sans-serif`);
}

/**
 * Mantém a tela com o tema certo: o rascunho enquanto o treinador está na
 * personalização, o publicado em qualquer outra tela. Sair da personalização
 * por qualquer caminho — voltar, escolher um aluno — reaplica o publicado sem
 * que cada saída precise lembrar disso.
 */
export function startThemeSync(): void {
  let applied: Theme | null = null;
  const sync = () => {
    const s = getState();
    const t = s.screen === "theme" && s.themeDraft ? s.themeDraft : s.theme;
    if (t === applied) return;
    applied = t;
    applyTheme(t);
  };
  subscribe(sync);
  sync();
}
