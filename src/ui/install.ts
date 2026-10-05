import { setState, type InstallKind } from "./state";

// a mesma chave do 1.0: quem já dispensou lá não vê de novo aqui
const DISMISS_KEY = "install-banner-dismissed";
const IOS_DELAY = 1500;

/** O evento do Chrome que guarda o prompt nativo de instalação. Não está nos tipos do DOM. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<unknown>;
}

export interface InstallEnv {
  standalone: boolean;
  ios: boolean;
  dismissed: boolean;
}

/** Que banner cabe agora. `promptReady`: o navegador já ofereceu o prompt nativo. */
export function installKindFor(env: InstallEnv, promptReady: boolean): InstallKind {
  if (env.standalone || env.dismissed) return null;
  if (promptReady) return "android";
  return env.ios ? "ios" : null;
}

let deferred: InstallPromptEvent | null = null;

function isDismissed(): boolean {
  // em aba anônima ou com dados bloqueados, o acesso ao localStorage pode lançar
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function currentEnv(): InstallEnv {
  return {
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true,
    ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
    dismissed: isDismissed(),
  };
}

export function startInstall(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    setState({ installKind: installKindFor(currentEnv(), true) });
  });
  window.addEventListener("appinstalled", () => setState({ installKind: null }));
  // o Safari do iPhone não tem prompt: só a instrução, depois que a tela assentou
  setTimeout(() => setState({ installKind: installKindFor(currentEnv(), deferred !== null) }), IOS_DELAY);
}

/** Abre o prompt nativo. Sem marcar como dispensado, como no 1.0: quem recusa vê de novo noutra visita. */
export async function promptInstall(): Promise<void> {
  setState({ installKind: null });
  const e = deferred;
  deferred = null;
  if (!e) return;
  await e.prompt();
  await e.userChoice;
}

export function dismissInstall(): void {
  setState({ installKind: null });
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // sem armazenamento, o banner volta na próxima visita; nada a fazer
  }
}
