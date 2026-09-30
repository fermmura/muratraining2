import { html, type TemplateResult } from "lit-html";

export function photoViewer(src: string | null, onClose: () => void): TemplateResult | null {
  if (!src) return null;
  return html`
    <div class="photo-viewer" @click=${onClose} role="dialog" aria-label="Foto do exercício">
      <img src=${src} alt="Foto do exercício em tela cheia" />
      <button class="photo-viewer-close" aria-label="Fechar"><i class="ti ti-x"></i></button>
    </div>
  `;
}
