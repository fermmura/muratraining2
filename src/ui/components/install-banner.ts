import { html, type TemplateResult } from "lit-html";
import type { InstallKind } from "../state";

/** Rodapé fixo; o estilo `#install-banner` está em styles.css. Textos do 1.0. */
export function installBanner(
  kind: InstallKind,
  onInstall: () => void,
  onDismiss: () => void,
): TemplateResult | null {
  if (!kind) return null;
  return html`
    <div id="install-banner" role="status">
      ${kind === "android"
        ? html`<span>Instale este app no seu celular pra acesso rápido, direto da tela inicial.</span>
            <button id="ib-install" @click=${onInstall}>Instalar</button>`
        : html`<span>Toque em <b>Compartilhar</b> (⬆️) e depois em <b>"Adicionar à Tela de Início"</b> pra instalar o app.</span>`}
      <button id="ib-dismiss" aria-label="Dispensar" @click=${onDismiss}><i class="ti ti-x"></i></button>
    </div>
  `;
}
