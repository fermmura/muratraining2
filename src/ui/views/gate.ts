import { html, type TemplateResult } from "lit-html";

export interface GateHandlers {
  onSubmit: (email: string, password: string) => void;
  onForgot: (email: string) => void;
}

export function gateView(error: string | null, h: GateHandlers): TemplateResult {
  const read = () => ({
    email: (document.getElementById("gate-email") as HTMLInputElement).value,
    password: (document.getElementById("gate-pass") as HTMLInputElement).value,
  });

  return html`
    <form class="gate" @submit=${(e: Event) => { e.preventDefault(); const v = read(); h.onSubmit(v.email, v.password); }}>
      <h1 class="display">Meu Treino</h1>
      <input id="gate-email" type="email" autocomplete="email" placeholder="Email" required />
      <input id="gate-pass" type="password" autocomplete="current-password" placeholder="Senha" required />
      ${error ? html`<div class="error">${error}</div>` : null}
      <button class="primary" type="submit">Entrar</button>
      <button type="button" class="switch" @click=${() => h.onForgot(read().email)}>
        Esqueci minha senha
      </button>
    </form>
  `;
}
