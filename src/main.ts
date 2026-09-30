import "./ui/styles.css";
import "./ui/styles-cardio-feedback.css";
import "./ui/styles-muscle-photo.css";
import { renderApp } from "./ui/render";
import { getState, setState } from "./ui/state";
import { watchSession } from "./auth/session";
import { subscribeToAllClients, subscribeToClient, saveClient } from "./data/client-repo";
import { archiveOldHistory } from "./data/history-archive";
import { planPromotion } from "./domain/week-promotion";
import { todayKey, weekKeyOf } from "./domain/week";
import type { Client } from "./data/schema";

let unsubscribeData: (() => void) | null = null;

/**
 * Virada de semana e arquivamento rodam depois de ler o aluno, nunca durante
 * um salvamento.
 *
 * Só no aparelho do ALUNO, e não no do treinador: o treinador assina todos os
 * alunos de uma vez, e arquivar todos no carregamento dispararia uma rajada de
 * escritas. Cada aluno abre o próprio app com frequência muito maior do que a
 * necessária para manter o documento abaixo do limite.
 */
async function onClientLoaded(client: Client): Promise<void> {
  const promotion = planPromotion(client, weekKeyOf(todayKey()));
  if (promotion) await saveClient(client.id, promotion);
  await archiveOldHistory(client);
}

watchSession((session) => {
  unsubscribeData?.();
  unsubscribeData = null;

  if (!session) {
    setState({ view: "gate", session: null, client: null, clients: [], activeDayId: null });
    return;
  }

  setState({ session, error: null });

  if (session.isTrainer) {
    unsubscribeData = subscribeToAllClients(
      (clients) => setState({ view: "trainer", clients }),
      (e) => setState({ error: e.message }),
    );
    return;
  }

  unsubscribeData = subscribeToClient(
    session.uid,
    (client) => {
      // `null` = a conta existe no Auth mas não há ficha. Acontece se a criação
      // da ficha falhar depois da conta ter sido criada. Sem tratar isso, o
      // aluno fica em "Carregando…" para sempre, sem erro e sem diagnóstico.
      if (!client) {
        setState({
          view: "gate",
          client: null,
          error: "Sua conta existe mas a ficha ainda não foi criada. Fale com seu personal.",
        });
        return;
      }
      // Limpa o erro só na chegada à tela do aluno (o da ficha que não existia).
      // A cada snapshot, não: quando o servidor recusa uma escrita, o SDK desfaz
      // a alteração local e dispara um snapshot novo, que apagaria o aviso no
      // mesmo instante em que ele aparece.
      const arriving = getState().view !== "student";
      setState({ view: "student", client, ...(arriving ? { error: null } : {}) });
      // virada de semana e arquivo tentam de novo no próximo carregamento
      onClientLoaded(client).catch(() => {});
    },
    (e) => setState({ error: e.message }),
  );
});

renderApp();
