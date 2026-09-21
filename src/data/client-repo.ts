import { collection, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";
import type { Client } from "./schema";

const CLIENTS = "clients";

/** Ficha nova: o id do documento é o UID do Auth, e não um campo de dentro dela. */
export type NewClient = Omit<Client, "id">;

/** O campo `password` existe em documentos antigos do 1.0 e é descartado na leitura. */
function toClient(id: string, data: Record<string, unknown>): Client {
  const { password: _drop, ...rest } = data;
  const c = rest as Omit<Client, "id">;
  // Documentos escritos pelo 1.0 podem não ter todos os campos que o schema
  // declara obrigatórios. Defaultar aqui, no único ponto de entrada, evita
  // estouro longe da causa lá na frente. Nada disso é gravado de volta.
  return {
    ...c,
    id,
    name: c.name ?? "",
    email: c.email ?? "",
    goal: c.goal ?? "",
    createdAt: c.createdAt ?? 0,
    days: c.days ?? [],
  };
}

export function subscribeToClient(
  clientId: string,
  onChange: (client: Client | null) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, CLIENTS, clientId),
    (snap) => {
      const data = snap.data();
      // `null` = conta existe no Auth mas não há ficha. Quem chama precisa
      // distinguir isso de "ainda carregando", senão a tela trava em silêncio.
      onChange(data ? toClient(snap.id, data) : null);
    },
    onError,
  );
}

export function subscribeToAllClients(
  onChange: (clients: Client[]) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, CLIENTS),
    (snap) => onChange(snap.docs.map((d) => toClient(d.id, d.data()))),
    onError,
  );
}

/**
 * Com o cache offline ligado, a promessa só resolve quando o SERVIDOR confirma.
 * A escrita já é durável assim que a chamada é feita — vai para o cache local e
 * é sincronizada sozinha depois. Offline, porém, a promessa fica pendente para
 * sempre: não resolve nem rejeita. Quem chama deve tratá-la como telemetria
 * opcional (log, métrica) e nunca bloquear a interface num `await` dela, senão a
 * tela trava para o aluno que está numa academia sem sinal.
 */
export async function saveClient(id: string, patch: Partial<Client>): Promise<void> {
  // `id` é o id do documento, não um campo gravado; se escapar para o patch,
  // o 1.0 passa a ver um campo que não espera
  const { id: _drop, ...fields } = patch as Partial<Client> & { id?: string };
  await updateDoc(doc(db, CLIENTS, id), fields);
}

/** Mesmo contrato de promessa de `saveClient`: resolver significa "o servidor confirmou". */
export async function createClient(clientId: string, data: NewClient): Promise<void> {
  await setDoc(doc(db, CLIENTS, clientId), data);
}
