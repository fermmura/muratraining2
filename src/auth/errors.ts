const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Email inválido",
  "auth/user-not-found": "Email ou senha incorretos",
  "auth/wrong-password": "Email ou senha incorretos",
  "auth/invalid-credential": "Email ou senha incorretos",
  "auth/too-many-requests": "Muitas tentativas. Tente de novo em instantes.",
  "auth/email-already-in-use": "Esse email já tem uma conta",
  "auth/weak-password": "Senha muito curta (mínimo 6 caracteres)",
  "auth/network-request-failed": "Sem conexão. Verifique a internet.",
};

/**
 * O código bruto nunca chega ao usuário: além de ser ilegível, alguns deles
 * revelam se um email tem conta no sistema.
 */
export function translateAuthError(code: string): string {
  return MESSAGES[code] ?? "Não foi possível completar. Tente de novo.";
}
