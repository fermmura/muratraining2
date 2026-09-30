import { registerSW } from "virtual:pwa-register";
import { setState } from "./ui/state";

const HOUR = 60 * 60 * 1000;

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

/**
 * Registra o service worker. `registerType: "prompt"` (vite.config.ts) existe
 * para nunca recarregar no meio de uma série; sem esta tela, porém, ninguém via
 * o prompt, e o app instalado podia rodar a versão antiga por dias.
 *
 * O app instalado fica em segundo plano sem navegar, e o navegador só procura
 * versão nova em navegação. Por isso a verificação de hora em hora.
 */
export function startPwa(): void {
  updateSW = registerSW({
    onNeedRefresh: () => setState({ updateReady: true }),
    onRegisteredSW: (_url, registration) => {
      if (registration) setInterval(() => void registration.update(), HOUR);
    },
  });
}

export function applyUpdate(): void {
  void updateSW?.(true);
}
