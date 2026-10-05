import { html, type TemplateResult } from "lit-html";
import { FONT_BODY_OPTIONS, FONT_DISPLAY_OPTIONS, THEME_COLORS, type ColorKey, type Theme } from "@/domain/theme";
import type { ThemeStatus } from "../state";

export interface ThemeHandlers {
  onColor: (key: ColorKey, value: string) => void;
  onFont: (key: "fontDisplay" | "fontBody", value: string) => void;
  onPublish: () => void;
  onDiscard: () => void;
  onReset: () => void;
  onClose: () => void;
}

const STATUS: Record<ThemeStatus, string> = {
  idle: "",
  saving: "Publicando…",
  saved: "Publicado para os alunos.",
  error: "Não foi possível publicar. Tente de novo.",
  loading: "",
  loadError: "",
};

function fontRow(
  label: string, key: "fontDisplay" | "fontBody", options: string[], value: string, h: ThemeHandlers,
): TemplateResult {
  return html`
    <div class="theme-row">
      <label for="tf-${key}">${label}</label>
      <select id="tf-${key}" @change=${(e: Event) => h.onFont(key, (e.target as HTMLSelectElement).value)}>
        ${options.map((f) => html`<option value=${f} ?selected=${f === value}>${f}</option>`)}
      </select>
    </div>`;
}

export function themeView(draft: Theme, status: ThemeStatus, h: ThemeHandlers): TemplateResult {
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onClose}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Personalização</span>
    </div>
    <div class="theme-panel">
      <p class="muted-note theme-intro">
        As mudanças aparecem só para você até publicar. Sair desta tela sem publicar desfaz.
      </p>

      <p class="theme-section">Cores</p>
      ${THEME_COLORS.map(
        (c) => html`
          <div class="theme-row">
            <label for="tc-${c.key}">${c.label}</label>
            <input id="tc-${c.key}" type="color" .value=${draft[c.key]}
              @input=${(e: Event) => h.onColor(c.key, (e.target as HTMLInputElement).value)} />
          </div>`,
      )}

      <p class="theme-section">Fontes</p>
      ${fontRow("Títulos", "fontDisplay", FONT_DISPLAY_OPTIONS, draft.fontDisplay, h)}
      ${fontRow("Texto", "fontBody", FONT_BODY_OPTIONS, draft.fontBody, h)}

      <div class="theme-actions">
        <button class="cta" ?disabled=${status === "saving"} @click=${h.onPublish}>Publicar para os alunos</button>
        ${STATUS[status] ? html`<p class="theme-status">${STATUS[status]}</p>` : null}
        <button class="dashed-btn" @click=${h.onDiscard}>Descartar alterações</button>
        <button class="dashed-btn theme-danger" @click=${h.onReset}>
          <i class="ti ti-refresh"></i> Restaurar padrão (aplica na hora)
        </button>
      </div>
    </div>
  `;
}

/** Enquanto o tema publicado não chega, ou quando a leitura falhou. */
export function themeLoadingView(failed: boolean, onClose: () => void): TemplateResult {
  return html`
    <div class="day-head">
      <button class="back" @click=${onClose}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Personalização</span>
    </div>
    <p class="muted-note">
      ${failed
        ? "Não foi possível carregar o visual publicado. Volte e abra de novo quando tiver conexão."
        : "Carregando o visual publicado…"}
    </p>
  `;
}
