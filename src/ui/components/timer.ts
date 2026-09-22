import { html, type TemplateResult } from "lit-html";

/** Um treino nunca dura mais que algumas horas; passado isso, tratamos como não iniciado. */
export const MAX_WORKOUT_MS = 6 * 60 * 60 * 1000;

export function isTimerRunning(startedAt?: number): boolean {
  if (!startedAt) return false;
  return Date.now() - startedAt < MAX_WORKOUT_MS;
}

export function formatElapsed(startedAt: number, now: number = Date.now()): string {
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function timerButton(
  startedAt: number | undefined,
  onToggle: () => void,
): TemplateResult {
  const running = isTimerRunning(startedAt);
  return html`
    <button class="dashed-btn" @click=${onToggle}>
      <i class="ti ${running ? "ti-player-stop" : "ti-player-play"}"></i>
      ${running && startedAt ? formatElapsed(startedAt) : "iniciar treino"}
    </button>
  `;
}
