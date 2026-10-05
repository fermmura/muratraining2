import { getState, setState } from "../state";
import { loadPublishedTheme, publishTheme } from "@/data/theme-repo";
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
    // só diz "publicado" se ninguém mexeu de novo enquanto gravava
    setState({ theme: t, themeStatus: getState().themeDraft === t ? "saved" : "idle" });
  } catch {
    setState({ themeStatus: "error" });
  }
}

export const theme = {
  // relê o publicado ao abrir: o rascunho nunca parte de um tema que ainda não
  // chegou, senão publicar trocaria o visual de todos os alunos pelo padrão
  onOpen: () => {
    setState({ screen: "theme", activeDayId: null, themeDraft: null, themeStatus: "loading" });
    loadPublishedTheme().then(
      (t) => {
        const s = getState();
        if (s.screen === "theme" && !s.themeDraft) setState({ theme: t, themeDraft: t, themeStatus: "idle" });
      },
      () => {
        if (getState().screen === "theme") setState({ themeStatus: "loadError" });
      },
    );
  },
  onColor: (key: ColorKey, value: string) => edit({ [key]: value }),
  onFont: (key: FontKey, value: string) => edit({ [key]: value }),

  onPublish: () => {
    const draft = getState().themeDraft;
    if (draft && getState().themeStatus !== "saving") void publish(draft);
  },

  onDiscard: () => setState({ themeDraft: getState().theme, themeStatus: "idle" }),

  onReset: () => {
    if (getState().themeStatus === "saving") return;
    if (!confirm("Voltar ao visual padrão? Vale na hora para todos os alunos.")) return;
    setState({ themeDraft: DEFAULT_THEME });
    void publish(DEFAULT_THEME);
  },

  // a volta ao tema publicado acontece em startThemeSync, ao sair da tela
  onClose: () => resetScreen(),
};
