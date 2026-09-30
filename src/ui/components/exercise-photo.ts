import { html, type TemplateResult } from "lit-html";
import type { Exercise } from "@/data/schema";

export interface PhotoHandlers {
  photoOf: (ex: Exercise) => string | null | undefined;
  onAddPhoto: (exId: string, file: File) => void;
  onRemovePhoto: (exId: string) => void;
  onViewPhoto: (src: string) => void;
}

function onPick(e: Event, exId: string, h: PhotoHandlers): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  // limpa para que escolher o mesmo arquivo de novo também dispare
  input.value = "";
  if (file) h.onAddPhoto(exId, file);
}

/**
 * Foto do exercício. `hasPhoto` sem documento chega aqui como null e vira "sem
 * foto": o aluno não vê quadro vazio e o treinador pode enviar de novo.
 */
export function exercisePhoto(ex: Exercise, editable: boolean, h: PhotoHandlers): TemplateResult | null {
  const src = h.photoOf(ex);
  if (src === undefined) return html`<div class="ex-photo-loading muted-note">carregando foto…</div>`;
  if (src) {
    return html`
      <div class="ex-photo">
        <img src=${src} alt="Foto do exercício ${ex.name}" @click=${() => h.onViewPhoto(src)} />
        ${editable
          ? html`<button class="ex-photo-remove" @click=${() => h.onRemovePhoto(ex.id)} aria-label="Remover foto">
              <i class="ti ti-x"></i>
            </button>`
          : null}
      </div>
    `;
  }
  if (!editable) return null;
  return html`
    <label class="dashed-btn photo-add">
      <i class="ti ti-photo-plus"></i> Adicionar foto
      <input type="file" accept="image/*" class="hidden" @change=${(e: Event) => onPick(e, ex.id, h)} />
    </label>
  `;
}
