import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { mergeTheme, type Theme } from "@/domain/theme";

/** O mesmo documento do 1.0: `settings/theme = { draft, published }`. */
const themeDoc = () => doc(db, "settings", "theme");

/** O tema que os alunos veem. Sem documento, o padrão. */
export async function loadPublishedTheme(): Promise<Theme> {
  const snap = await getDoc(themeDoc());
  return mergeTheme(snap.exists() ? snap.data().published : undefined);
}

/**
 * Publica para todos. Grava o mesmo tema em `draft` e `published`, como o 1.0
 * faz ao publicar, para os dois apps continuarem mostrando o mesmo visual.
 */
export async function publishTheme(theme: Theme): Promise<void> {
  await setDoc(themeDoc(), { draft: theme, published: theme }, { merge: true });
}
