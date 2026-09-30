import { html, type TemplateResult } from "lit-html";

/**
 * Aviso de erro para a tela do aluno. A do treinador já mostra o erro na barra
 * lateral; a do aluno não mostrava em lugar nenhum, e uma escrita recusada
 * sumia em silêncio.
 */
export function errorBanner(error: string | null, onDismiss: () => void): TemplateResult | null {
  if (!error) return null;
  return html`
    <div class="error-banner" role="alert">
      <span>${error}</span>
      <button @click=${onDismiss} aria-label="Fechar aviso"><i class="ti ti-x"></i></button>
    </div>
  `;
}
