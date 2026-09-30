import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

/**
 * clients/{clientId}/photos/{exId} = { dataUrl }, o formato do 1.0. Cada foto
 * mora no próprio documento para não pesar no documento do aluno, que tem teto
 * de 1MB; o exercício só leva `hasPhoto: true`.
 */
function photoRef(clientId: string, exId: string) {
  return doc(db, "clients", clientId, "photos", exId);
}

/** null quando o documento não existe: exercício marcado com foto que se perdeu. */
export async function loadPhoto(clientId: string, exId: string): Promise<string | null> {
  const snap = await getDoc(photoRef(clientId, exId));
  const dataUrl = snap.data()?.dataUrl;
  return typeof dataUrl === "string" && dataUrl ? dataUrl : null;
}

/** Mesmo contrato de `saveClient`: offline a promessa só resolve quando sincronizar. */
export async function savePhoto(clientId: string, exId: string, dataUrl: string): Promise<void> {
  await setDoc(photoRef(clientId, exId), { dataUrl });
}

export async function deletePhoto(clientId: string, exId: string): Promise<void> {
  await deleteDoc(photoRef(clientId, exId));
}
