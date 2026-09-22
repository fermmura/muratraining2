import { html, type TemplateResult } from "lit-html";
import type { Client } from "@/data/schema";

export interface TrainerHandlers {
  onSelect: (clientId: string) => void;
  onInvite: (name: string, email: string) => void;
  onResendSetup: (email: string) => void;
  onLogout: () => void;
}

export function trainerView(
  clients: Client[],
  selectedId: string | null,
  body: TemplateResult | null,
  error: string | null,
  h: TrainerHandlers,
): TemplateResult {
  return html`
    <div class="topbar">
      <span class="name display">Alunos</span>
      <button class="logout" @click=${h.onLogout}>Sair</button>
    </div>

    <div class="layout">
      <aside class="sidebar">
        ${clients.map(
          (c) => html`
            <div class="client-row ${c.id === selectedId ? "active" : ""}"
                 @click=${() => h.onSelect(c.id)}>
              <span class="cn">${c.name}</span>
              <span class="ce">${c.email}</span>
            </div>`,
        )}

        <form @submit=${(e: Event) => {
          e.preventDefault();
          const form = e.target as HTMLFormElement;
          const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
          const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
          if (name && email) { h.onInvite(name, email); form.reset(); }
        }}>
          <input name="name" placeholder="Nome do aluno" required />
          <input name="email" type="email" placeholder="Email do aluno" required />
          <button class="dashed-btn" type="submit"><i class="ti ti-plus"></i> convidar</button>
        </form>
        ${error ? html`<div class="error">${error}</div>` : null}
        <p class="muted-note">
          O aluno recebe um email para criar a própria senha. Você não vê nem guarda a senha dele.
        </p>
      </aside>

      <main class="main">${body ?? html`<p class="muted-note">Escolha um aluno.</p>`}</main>
    </div>
  `;
}
