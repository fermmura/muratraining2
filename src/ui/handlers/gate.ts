import { setState } from "../state";
import { signIn, sendPasswordSetup } from "@/auth/session";
import { translateAuthError } from "@/auth/errors";
import { authErrorCode } from "./target";

export const gate = {
  onSubmit: async (email: string, password: string) => {
    setState({ error: null });
    try {
      await signIn(email, password);
    } catch (e) {
      setState({ error: translateAuthError(authErrorCode(e)) });
    }
  },
  onForgot: async (email: string) => {
    if (!email) { setState({ error: "Digite seu email primeiro." }); return; }
    try {
      await sendPasswordSetup(email);
      setState({ error: "Enviamos um email para você criar uma senha nova." });
    } catch (e) {
      setState({ error: translateAuthError(authErrorCode(e)) });
    }
  },
};
