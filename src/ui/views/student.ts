import { html, type TemplateResult } from "lit-html";
import type { Client } from "@/data/schema";

export interface StudentHandlers {
  onOpenDay: (dayId: string) => void;
  onLogout: () => void;
}

export function studentView(client: Client, h: StudentHandlers): TemplateResult {
  return html`
    <div class="topbar">
      <span class="name display">${client.name}</span>
      <button class="logout" @click=${h.onLogout}>Sair</button>
    </div>

    <div class="grid stacked">
      ${(client.days ?? []).map(
        (d) => html`
          <div class="sq" @click=${() => h.onOpenDay(d.id)}>
            <div>
              <div class="title display">${d.title}</div>
              <div class="count">${(d.exercises ?? []).length} exercícios</div>
            </div>
          </div>`,
      )}
    </div>
  `;
}
