// defineConfig vem de "vitest/config", e não de "vite": a versão do vite não
// conhece a chave `test` e o tsc reprova o arquivo.
import { defineConfig } from "vitest/config";
// `loadEnv` não é reexportado por "vitest/config", então vem do vite direto. Ele
// enxerga o `.env.local`, coisa que `process.env` sozinho não faz.
import { loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

process.env.TZ = "America/Sao_Paulo";

/** As sete variáveis lidas por src/firebase.ts. Sem qualquer uma delas o app não sobe. */
const REQUIRED_ENV = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_TRAINER_EMAIL",
] as const;

/**
 * O Vite inlina `import.meta.env` em tempo de build: se uma variável faltar, o
 * valor vira `undefined` dentro do bundle e o build passa sem erro nenhum. O
 * sintoma aparece só em produção, como tela branca em código minificado. Falhar
 * aqui, nomeando o que falta, troca esse diagnóstico caro por um barato.
 */
function assertRequiredEnv(mode: string): void {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const missing = REQUIRED_ENV.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente ausentes ou vazias: ${missing.join(", ")}. ` +
        "Copie .env.example para .env.local e preencha os valores do projeto Firebase.",
    );
  }
}

export default defineConfig(({ mode, command }) => {
  // só no build: rodar a suíte não deve exigir configuração do Firebase, porque
  // nada do que ela testa fala com a rede
  if (command === "build") assertRequiredEnv(mode);

  return {
    base: "./",
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});
