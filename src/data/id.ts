const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Ids opacos para dias, exercícios e séries dentro do documento do aluno.
 * O 1.0 usava Math.random(), que colide com frequência ao clonar uma semana
 * inteira de uma vez. Aqui a entropia vem do CSPRNG e o id é mais longo.
 */
export function uid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
