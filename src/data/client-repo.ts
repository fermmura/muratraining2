import { collection, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";
import type { Client } from "./schema";

const CLIENTS = "clients";

/** Ficha nova: o id do documento é o UID do Auth, e não um campo de dentro dela. */
export type NewClient = Omit<Client, "id">;

/** O campo `password` existe em documentos antigos do 1.0 e é descartado na leitura. */
function toClient(id: string, data: Record<string, unknown>): Client {
  const { password: _drop, ...rest } = data;
  return { ...(rest as Omit<Client, "id">), id };
}

export function subscribeToClient(
  clientId: string,
  onChange: (client: Client) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, CLIENTS, clientId),
    (snap) => {
      const data = snap.data();
      if (data) onChange(toClient(snap.id, data));
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

export async function saveClient(id: string, patch: Partial<Client>): Promise<void> {
  // `id` é o id do documento, não um campo gravado; se escapar para o patch,
  // o 1.0 passa a ver um campo que não espera
  const { id: _drop, ...fields } = patch as Partial<Client> & { id?: string };
  await updateDoc(doc(db, CLIENTS, id), fields);
}

export async function createClient(clientId: string, data: NewClient): Promise<void> {
  await setDoc(doc(db, CLIENTS, clientId), data);
}
