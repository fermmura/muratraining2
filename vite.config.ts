// defineConfig vem de "vitest/config", e não de "vite": a versão do vite não
// conhece a chave `test` e o tsc reprova o arquivo.
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  base: "./",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
