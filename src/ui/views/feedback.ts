import { html, type TemplateResult } from "lit-html";
import { oldestFirst } from "@/domain/feedback";
import { weekLabel } from "@/domain/week";
import type { FeedbackAuthor, FeedbackEntry } from "@/data/schema";

/** 55 (Brasil) + 19 (DDD) + número, sem espaços. O mesmo do 1.0 (app.js:3240). */
export const WHATSAPP_NUMBER = "5519993150750";

export interface FeedbackHandlers {
  onBack: () => void;
  onSend: (text: string) => boolean;
  onRemove: (id: string) => void;
}

function onSubmit(e: Event, h: FeedbackHandlers): void {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const text = form.elements.namedItem("text") as HTMLTextAreaElement;
  if (h.onSend(text.value)) form.reset();
}

export function feedbackView(
  entries: FeedbackEntry[],
  me: FeedbackAuthor,
  canDelete: boolean,
  h: FeedbackHandlers,
): TemplateResult {
  const list = oldestFirst(entries);
  const other = me === "aluno" ? "seu personal" : "o aluno";
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Feedbacks / Observações</span>
    </div>

    <!-- só para o aluno: para o treinador, o link abriria conversa com o próprio número -->
    ${me === "aluno"
      ? html`<a class="whatsapp-btn" href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener">
          <i class="ti ti-brand-whatsapp"></i> Falar direto no WhatsApp
        </a>`
      : null}

    <div class="chat">
      ${list.length === 0
        ? html`<p class="muted-note">Nenhuma mensagem ainda. Escreva o que quiser para ${other} aqui embaixo.</p>`
        : list.map(
            (m) => html`
              <div class="bubble ${m.from === me ? "mine" : "theirs"}">
                <div class="bubble-meta">${m.from === "aluno" ? "Aluno" : "Personal"} · ${weekLabel(m.dateKey)}</div>
                <div class="bubble-text">${m.text}</div>
                ${canDelete
                  ? html`<button class="rm-x" @click=${() => h.onRemove(m.id)} aria-label="Remover mensagem">
                      <i class="ti ti-trash"></i>
                    </button>`
                  : null}
              </div>`,
          )}
    </div>

    <form class="chat-form" @submit=${(e: Event) => onSubmit(e, h)}>
      <textarea name="text" rows="3" placeholder="Escreva à vontade…"></textarea>
      <button class="dashed-btn" type="submit"><i class="ti ti-send"></i> Enviar</button>
    </form>
  `;
}
