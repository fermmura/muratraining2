import { initializeApp, deleteApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { firebaseConfig } from "@/firebase";
import { sendPasswordSetup } from "./session";

/**
 * Senha descartável usada só para materializar a conta no Firebase Auth.
 * Ela não é exibida, não é devolvida, não é registrada e não é reutilizada:
 * o aluno define a senha real pelo email que sai logo em seguida.
 *
 * Isto substitui o fluxo do 1.0, em que o treinador escolhia a senha e ela era
 * gravada em texto puro no documento do aluno.
 */
function throwawayPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Cria a conta do aluno sem derrubar a sessão do treinador, usando uma
 * instância secundária do Firebase. Necessário porque o plano Spark não tem
 * Cloud Functions e portanto não há Admin SDK disponível.
 */
export async function createStudentAccount(email: string): Promise<string> {
  const secondary = initializeApp(firebaseConfig, `invite-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      email.trim().toLowerCase(),
      throwawayPassword(),
    );
    await signOut(secondaryAuth);
    await sendPasswordSetup(email);
    return cred.user.uid;
  } finally {
    await deleteApp(secondary);
  }
}
