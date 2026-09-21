/// <reference types="vite/client" />

// Tipagem das variáveis de ambiente lidas em src/firebase.ts. Sem isto o tsc não
// conhece `import.meta.env` e o build falha.
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_TRAINER_EMAIL: string;
}
