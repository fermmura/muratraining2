import {
  onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import { auth, TRAINER_EMAIL } from "@/firebase";

export interface Session {
  uid: string;
  email: string;
  isTrainer: boolean;
}

export function watchSession(onChange: (s: Session | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (!user?.email) {
      onChange(null);
      return;
    }
    const email = user.email.toLowerCase();
    onChange({ uid: user.uid, email, isTrainer: email === TRAINER_EMAIL });
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export function signOutNow(): Promise<void> {
  return signOut(auth);
}

/** Email do Firebase para o aluno definir a própria senha. Serve para convite e para "esqueci a senha". */
export async function sendPasswordSetup(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}
