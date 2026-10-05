import { getState, setState } from "../state";
import { publishTheme } from "@/data/theme-repo";
import { DEFAULT_THEME, type ColorKey, type Theme } from "@/domain/theme";
import { resetScreen } from "./trainer";

type FontKey = "fontDisplay" | "fontBody";

function edit(patch: Partial<Theme>): void {
  const draft = getState().themeDraft;
  if (draft) setState({ themeDraft: { ...draft, ...patch }, themeStatus: "idle" });
}

async function publish(t: Theme): Promise<void> {
  setState({ themeStatus: "saving" });
  try {
    await publishTheme(t);
    setState({ theme: t, themeStatus: "saved" });
  } catch {
    setState({ themeStatus: "error" });
  }
}

export const theme = {
  // o rascunho parte sempre do publicado: não há modo prévia guardado entre sessões
  onOpen: () => setState({ screen: "theme", activeDayId: null, themeDraft: getState().theme, themeStatus: "idle" }),
  onColor: (key: ColorKey, value: string) => edit({ [key]: value }),
  onFont: (key: FontKey, value: string) => edit({ [key]: value }),

  onPublish: () => {
    const draft = getState().themeDraft;
    if (draft && getState().themeStatus !== "saving") void publish(draft);
  },

  onDiscard: () => setState({ themeDraft: getState().theme, themeStatus: "idle" }),

  onReset: () => {
    if (!confirm("Voltar ao visual padrão? Vale na hora para todos os alunos.")) return;
    setState({ themeDraft: DEFAULT_THEME });
    void publish(DEFAULT_THEME);
  },

  // a volta ao tema publicado acontece em startThemeSync, ao sair da tela
  onClose: () => resetScreen(),
};
