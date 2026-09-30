import { html, type TemplateResult } from "lit-html";

export function updateBanner(ready: boolean, onUpdate: () => void): TemplateResult | null {
  if (!ready) return null;
  return html`
    <div class="update-banner" role="status">
      <span>Nova versão disponível.</span>
      <button @click=${onUpdate}>Atualizar</button>
    </div>
  `;
}
