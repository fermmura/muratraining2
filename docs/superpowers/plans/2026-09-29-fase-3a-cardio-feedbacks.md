# MuraTraining 2.0 — Fase 3a (cardio e feedbacks) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as telas de cardio e de feedbacks (com o atalho do WhatsApp para o aluno), corrigindo o "lido" do 1.0 e fazendo o erro aparecer também para o aluno.

**Architecture:** Cálculo novo em `src/domain/` como função pura testada com Vitest: `cardio.ts` e `feedback.ts`. A interface ganha duas telas no mesmo mecanismo de `screen` da fase 2, com handlers por assunto em `src/ui/handlers/cardio.ts` e `src/ui/handlers/feedback.ts`. Os dois recursos gravam em campos que o 1.0 já usa (`cardio`, `feedback`), no mesmo formato.

**Tech Stack:** Vite 5, TypeScript 5, lit-html 3, Firebase JS SDK 10 (modular), Vitest 2. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-09-29-fase-3-cardio-feedback-volume-fotos-design.md` (parte 3a)

## Global Constraints

Valem para **todas** as tarefas. São as das fases 1 e 2, que continuam valendo porque o 1.0 continua em produção.

- **Compatibilidade de schema é obrigatória.** Nunca renomeie, remova ou mude o formato gravado de um campo. Só é permitido **adicionar**. Tipar melhor um campo que já existe (`feedback?: unknown[]` → `FeedbackEntry[]`) não muda o que é gravado e é permitido.
- **O campo `password` nunca é escrito**, nem lido, nem exibido.
- **Datas são sempre dia-calendário local, nunca UTC.** Use `todayKey()`; não use `toISOString()`.
- **`weekKey` é a data local da segunda-feira, formato `YYYY-MM-DD`.**
- **Plano Spark.** Sem Cloud Functions, sem Admin SDK.
- **Esta fase não altera `firestore.rules`.** O aluno já pode escrever `cardio` e `feedback`. Se alguma tarefa parecer exigir regra nova, pare e escale.
- **Nenhuma dependência nova** em `package.json`.
- Comentários e textos de interface em português. Identificadores de código em inglês — **inclusive variáveis locais e identificadores dentro dos testes**.
- **Nenhum arquivo de `src/` passa de ~250 linhas.** `src/ui/styles.css` já tem 275; os estilos novos vão para um arquivo próprio.
- **Formato gravado pelo 1.0, que o 2.0 respeita:**
  - `CardioEntry = { id, dateKey, minutes: number, zone: string, note: string }` — `zone` é `""` ou `"Z1"`…`"Z5"`.
  - `FeedbackEntry = { id, dateKey, from: "aluno" | "treinador", text, read: boolean }`.
- **Número do WhatsApp do treinador:** `5519993150750` (copiado de `app.js:3240` do 1.0).

## O que já existe

Assinaturas que as tarefas abaixo consomem sem redefinir:

```ts
// src/domain/week.ts
todayKey(): string
weekKeyOf(dateKey: string): string
weekLabel(weekKey: string): string   // "14/set" — formata qualquer dateKey, não só segunda-feira

// src/data/id.ts           uid(): string
// src/data/schema.ts       CardioEntry, Client (com cardio?: CardioEntry[])
// src/ui/state.ts          getState(), setState(patch), Screen, AppState
// src/ui/handlers/target.ts  currentClient(): Client | null; persist(clientId, patch): void
// src/ui/handlers/trainer.ts resetScreen(): void; student = { onOpenDay, onLogout }
```

`persist` grava sem bloquear e põe uma mensagem em `state.error` se a escrita for recusada.

---

### Task 1: `domain/cardio.ts` — zonas, minutos e somas

**Files:**
- Create: `src/domain/cardio.ts`
- Test: `src/domain/cardio.test.ts`

**Interfaces:**
- Consumes: `CardioEntry` de `src/data/schema.ts`.
- Produces:
  ```ts
  export interface CardioZone { key: string; label: string }
  export const CARDIO_ZONES: readonly CardioZone[]
  export function parseMinutes(text: string): number | null
  export interface CardioTotals { totalMin: number; byZone: Record<string, number>; count: number }
  export function cardioTotals(entries: CardioEntry[], sinceDateKey: string): CardioTotals
  export function monthStartKey(dateKey: string): string
  export function newestFirst(entries: CardioEntry[]): CardioEntry[]
  ```

- [ ] **Step 1: Escrever os testes que falham**

`src/domain/cardio.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CARDIO_ZONES, parseMinutes, cardioTotals, monthStartKey, newestFirst } from "./cardio";
import type { CardioEntry } from "@/data/schema";

function entry(patch: Partial<CardioEntry>): CardioEntry {
  return { id: "x", dateKey: "2026-09-29", minutes: 30, zone: "", note: "", ...patch };
}

describe("CARDIO_ZONES", () => {
  it("tem as cinco zonas do 1.0, em ordem", () => {
    expect(CARDIO_ZONES.map((z) => z.key)).toEqual(["Z1", "Z2", "Z3", "Z4", "Z5"]);
  });
});

describe("parseMinutes", () => {
  it("aceita inteiro positivo", () => {
    expect(parseMinutes("30")).toBe(30);
  });

  it("ignora espaço em volta", () => {
    expect(parseMinutes(" 45 ")).toBe(45);
  });

  it("recusa zero, vazio, texto, negativo e decimal", () => {
    for (const text of ["0", "", "abc", "-5", "30.5", "30,5"]) {
      expect(parseMinutes(text)).toBeNull();
    }
  });
});

describe("cardioTotals", () => {
  it("soma só a partir da data pedida", () => {
    const entries = [
      entry({ dateKey: "2026-09-27", minutes: 100 }),
      entry({ dateKey: "2026-09-28", minutes: 20 }),
      entry({ dateKey: "2026-09-29", minutes: 25 }),
    ];
    const totals = cardioTotals(entries, "2026-09-28");
    expect(totals.totalMin).toBe(45);
    expect(totals.count).toBe(2);
  });

  it("separa por zona e deixa de fora o registro sem zona", () => {
    const entries = [
      entry({ zone: "Z2", minutes: 20 }),
      entry({ zone: "Z2", minutes: 10 }),
      entry({ zone: "Z4", minutes: 15 }),
      entry({ zone: "", minutes: 40 }),
    ];
    const totals = cardioTotals(entries, "2026-09-28");
    expect(totals.byZone).toEqual({ Z2: 30, Z4: 15 });
    expect(totals.totalMin).toBe(85);
  });

  it("aceita minutos gravados como texto pelo 1.0 e ignora lixo", () => {
    const entries = [
      entry({ minutes: "20" as unknown as number }),
      entry({ minutes: "abc" as unknown as number }),
    ];
    expect(cardioTotals(entries, "2026-09-28").totalMin).toBe(20);
  });

  it("devolve zero quando não há registro", () => {
    expect(cardioTotals([], "2026-09-28")).toEqual({ totalMin: 0, byZone: {}, count: 0 });
  });
});

describe("monthStartKey", () => {
  it("devolve o dia 1 do mesmo mês", () => {
    expect(monthStartKey("2026-09-29")).toBe("2026-09-01");
  });
});

describe("newestFirst", () => {
  it("ordena do dia mais recente para o mais antigo", () => {
    const entries = [entry({ id: "a", dateKey: "2026-09-20" }), entry({ id: "b", dateKey: "2026-09-29" })];
    expect(newestFirst(entries).map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("no mesmo dia, o último registrado vem primeiro", () => {
    const entries = [entry({ id: "first" }), entry({ id: "second" })];
    expect(newestFirst(entries).map((e) => e.id)).toEqual(["second", "first"]);
  });

  it("não altera a lista recebida", () => {
    const entries = [entry({ id: "a", dateKey: "2026-09-20" }), entry({ id: "b", dateKey: "2026-09-29" })];
    newestFirst(entries);
    expect(entries.map((e) => e.id)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/domain/cardio.test.ts`
Expected: FAIL — `Failed to resolve import "./cardio"`.

- [ ] **Step 3: Implementar `src/domain/cardio.ts`**

```ts
import type { CardioEntry } from "@/data/schema";

export interface CardioZone {
  key: string;
  label: string;
}

/** As mesmas do 1.0 (app.js:3098-3104). A chave é o que fica gravado. */
export const CARDIO_ZONES: readonly CardioZone[] = [
  { key: "Z1", label: "Z1 · muito leve" },
  { key: "Z2", label: "Z2 · leve" },
  { key: "Z3", label: "Z3 · moderada" },
  { key: "Z4", label: "Z4 · intensa" },
  { key: "Z5", label: "Z5 · máxima" },
];

/** Minutos digitados no formulário: inteiro positivo, ou null. */
export function parseMinutes(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const minutes = Number(trimmed);
  return minutes > 0 ? minutes : null;
}

export interface CardioTotals {
  totalMin: number;
  byZone: Record<string, number>;
  count: number;
}

/** Soma os registros a partir de `sinceDateKey`, inclusive. */
export function cardioTotals(entries: CardioEntry[], sinceDateKey: string): CardioTotals {
  const totals: CardioTotals = { totalMin: 0, byZone: {}, count: 0 };
  for (const e of entries ?? []) {
    if (e.dateKey < sinceDateKey) continue;
    // o 1.0 pode ter gravado os minutos como texto
    const minutes = Number(e.minutes) || 0;
    totals.totalMin += minutes;
    totals.count++;
    if (e.zone) totals.byZone[e.zone] = (totals.byZone[e.zone] ?? 0) + minutes;
  }
  return totals;
}

export function monthStartKey(dateKey: string): string {
  return dateKey.slice(0, 7) + "-01";
}

/**
 * Mais recente primeiro. O registro só guarda o dia; dentro do mesmo dia, a
 * ordem do array é a de gravação, então inverter antes da ordenação estável
 * põe o último registrado no topo.
 */
export function newestFirst(entries: CardioEntry[]): CardioEntry[] {
  return [...(entries ?? [])].reverse().sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/domain/cardio.test.ts`
Expected: PASS, 12 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domain/cardio.ts src/domain/cardio.test.ts
git commit -m "feat: calcula somas e validação do cardio"
```

---

### Task 2: `domain/feedback.ts` e o tipo `FeedbackEntry`

**Files:**
- Modify: `src/data/schema.ts` (acrescentar `FeedbackAuthor` e `FeedbackEntry`; trocar `feedback?: unknown[]` por `feedback?: FeedbackEntry[]`)
- Create: `src/domain/feedback.ts`
- Test: `src/domain/feedback.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/data/schema.ts
  export type FeedbackAuthor = "aluno" | "treinador";
  export interface FeedbackEntry { id: string; dateKey: string; from: FeedbackAuthor; text: string; read: boolean }
  // src/domain/feedback.ts
  export function authorOf(isTrainer: boolean): FeedbackAuthor
  export function hasUnreadFor(entries: FeedbackEntry[], me: FeedbackAuthor): boolean
  export function markReadFor(entries: FeedbackEntry[], me: FeedbackAuthor): FeedbackEntry[] | null
  export function oldestFirst(entries: FeedbackEntry[]): FeedbackEntry[]
  ```

- [ ] **Step 1: Acrescentar os tipos em `src/data/schema.ts`**

Logo depois da interface `CardioEntry`:

```ts
export type FeedbackAuthor = "aluno" | "treinador";

export interface FeedbackEntry {
  id: string;
  dateKey: string;
  from: FeedbackAuthor;
  text: string;
  /** Lida pelo destinatário, que é sempre quem não escreveu a mensagem. */
  read: boolean;
}
```

E, em `Client`, trocar `feedback?: unknown[];` por `feedback?: FeedbackEntry[];`.

- [ ] **Step 2: Escrever os testes que falham**

`src/domain/feedback.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { authorOf, hasUnreadFor, markReadFor, oldestFirst } from "./feedback";
import type { FeedbackEntry } from "@/data/schema";

function msg(patch: Partial<FeedbackEntry>): FeedbackEntry {
  return { id: "x", dateKey: "2026-09-29", from: "aluno", text: "oi", read: false, ...patch };
}

describe("authorOf", () => {
  it("traduz a sessão no valor que o 1.0 grava", () => {
    expect(authorOf(true)).toBe("treinador");
    expect(authorOf(false)).toBe("aluno");
  });
});

/**
 * O 1.0 marcava TODAS as mensagens como lidas ao abrir a conversa
 * (app.js:1756-1759): o aluno reabria a tela e o aviso sumia antes de o
 * treinador ver. Cada mensagem tem um único destinatário, quem não a escreveu.
 */
describe("hasUnreadFor", () => {
  it("conta mensagem do outro lado ainda não lida", () => {
    expect(hasUnreadFor([msg({ from: "aluno" })], "treinador")).toBe(true);
  });

  it("não conta a própria mensagem, mesmo não lida", () => {
    expect(hasUnreadFor([msg({ from: "aluno" })], "aluno")).toBe(false);
  });

  it("não conta mensagem já lida", () => {
    expect(hasUnreadFor([msg({ from: "aluno", read: true })], "treinador")).toBe(false);
  });

  it("aceita lista ausente", () => {
    expect(hasUnreadFor(undefined as unknown as FeedbackEntry[], "aluno")).toBe(false);
  });
});

describe("markReadFor", () => {
  it("devolve null quando não há o que marcar, para não gerar escrita", () => {
    expect(markReadFor([msg({ from: "aluno" })], "aluno")).toBeNull();
    expect(markReadFor([], "aluno")).toBeNull();
  });

  it("marca só as mensagens do outro lado", () => {
    const entries = [msg({ id: "mine", from: "aluno" }), msg({ id: "theirs", from: "treinador" })];
    const next = markReadFor(entries, "aluno")!;
    expect(next.find((m) => m.id === "theirs")?.read).toBe(true);
    expect(next.find((m) => m.id === "mine")?.read).toBe(false);
  });

  it("não altera a lista recebida", () => {
    const entries = [msg({ from: "treinador" })];
    markReadFor(entries, "aluno");
    expect(entries[0].read).toBe(false);
  });
});

describe("oldestFirst", () => {
  it("ordena da mais antiga para a mais recente, mantendo a ordem de gravação no mesmo dia", () => {
    const entries = [
      msg({ id: "late", dateKey: "2026-09-29" }),
      msg({ id: "early", dateKey: "2026-09-20" }),
      msg({ id: "late2", dateKey: "2026-09-29" }),
    ];
    expect(oldestFirst(entries).map((m) => m.id)).toEqual(["early", "late", "late2"]);
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run src/domain/feedback.test.ts`
Expected: FAIL — `Failed to resolve import "./feedback"`.

- [ ] **Step 4: Implementar `src/domain/feedback.ts`**

```ts
import type { FeedbackAuthor, FeedbackEntry } from "@/data/schema";

export function authorOf(isTrainer: boolean): FeedbackAuthor {
  return isTrainer ? "treinador" : "aluno";
}

/** Cada mensagem tem um só destinatário: quem não a escreveu. */
function unreadFor(m: FeedbackEntry, me: FeedbackAuthor): boolean {
  return m.from !== me && !m.read;
}

export function hasUnreadFor(entries: FeedbackEntry[], me: FeedbackAuthor): boolean {
  return (entries ?? []).some((m) => unreadFor(m, me));
}

/**
 * Marca como lidas as mensagens do outro lado. Devolve null quando não há
 * nenhuma, para quem chama não gravar à toa.
 */
export function markReadFor(entries: FeedbackEntry[], me: FeedbackAuthor): FeedbackEntry[] | null {
  if (!hasUnreadFor(entries, me)) return null;
  return entries.map((m) => (unreadFor(m, me) ? { ...m, read: true } : m));
}

/** A mensagem só guarda o dia; a ordenação estável mantém a ordem de gravação dentro dele. */
export function oldestFirst(entries: FeedbackEntry[]): FeedbackEntry[] {
  return [...(entries ?? [])].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}
```

- [ ] **Step 5: Rodar os testes e o build**

Run: `npx vitest run src/domain/feedback.test.ts && npm run build`
Expected: PASS, 9 testes; build sem erro de TypeScript (a troca de `unknown[]` por `FeedbackEntry[]` não deve quebrar nada, porque nenhum código lê `feedback` ainda).

- [ ] **Step 6: Commit**

```bash
git add src/data/schema.ts src/domain/feedback.ts src/domain/feedback.test.ts
git commit -m "feat: marca como lida só a mensagem do outro lado"
```

---

### Task 3: telas novas no estado, handlers e erro que não some

**Files:**
- Modify: `src/ui/state.ts` (tipo `Screen`)
- Create: `src/ui/handlers/cardio.ts`
- Create: `src/ui/handlers/feedback.ts`
- Modify: `src/ui/handlers/trainer.ts` (`student.onDismissError`)
- Modify: `src/ui/handlers/index.ts`
- Modify: `src/main.ts` (não limpar o erro a cada snapshot)

**Interfaces:**
- Consumes: `parseMinutes` (Task 1); `authorOf`, `hasUnreadFor`, `markReadFor` (Task 2).
- Produces:
  ```ts
  // src/ui/state.ts
  export type Screen = "home" | "calendar" | "pastWeek" | "progression" | "cardio" | "feedback";
  // src/ui/handlers/cardio.ts
  export const cardio: {
    onOpen(): void; onBack(): void;
    onAdd(minutesText: string, zone: string, note: string): boolean;
    onRemove(id: string): void;
  }
  // src/ui/handlers/feedback.ts
  export function me(): FeedbackAuthor
  export const feedback: {
    onOpen(): void; onBack(): void;
    onSend(text: string): boolean;
    onRemove(id: string): void;
    hasUnread(): boolean;
  }
  // src/ui/handlers/trainer.ts
  student.onDismissError(): void
  ```

- [ ] **Step 1: Ampliar `Screen` em `src/ui/state.ts`**

```ts
/** Tela aberta dentro da área do aluno. `home` é a grade de treinos da fase 1. */
export type Screen = "home" | "calendar" | "pastWeek" | "progression" | "cardio" | "feedback";
```

- [ ] **Step 2: Criar `src/ui/handlers/cardio.ts`**

```ts
import { setState } from "../state";
import { uid } from "@/data/id";
import { parseMinutes } from "@/domain/cardio";
import { todayKey } from "@/domain/week";
import { currentClient, persist } from "./target";
import { resetScreen } from "./trainer";
import type { CardioEntry } from "@/data/schema";

export const cardio = {
  onOpen: () => setState({ screen: "cardio", activeDayId: null }),
  onBack: () => resetScreen(),

  /** Devolve true quando gravou, para a tela limpar o formulário. */
  onAdd: (minutesText: string, zone: string, note: string): boolean => {
    const c = currentClient();
    const minutes = parseMinutes(minutesText);
    if (!c || minutes === null) return false;
    const entry: CardioEntry = { id: uid(), dateKey: todayKey(), minutes, zone, note: note.trim() };
    persist(c.id, { cardio: [...(c.cardio ?? []), entry] });
    return true;
  },

  onRemove: (id: string) => {
    const c = currentClient();
    if (!c || !confirm("Remover esse registro de cardio?")) return;
    persist(c.id, { cardio: (c.cardio ?? []).filter((e) => e.id !== id) });
  },
};
```

- [ ] **Step 3: Criar `src/ui/handlers/feedback.ts`**

```ts
import { getState, setState } from "../state";
import { uid } from "@/data/id";
import { authorOf, hasUnreadFor, markReadFor } from "@/domain/feedback";
import { todayKey } from "@/domain/week";
import { currentClient, persist } from "./target";
import { resetScreen } from "./trainer";
import type { FeedbackAuthor, FeedbackEntry } from "@/data/schema";

/** Quem está escrevendo, no valor que o 1.0 grava em `from`. */
export function me(): FeedbackAuthor {
  return authorOf(getState().view === "trainer");
}

/** Não grava nada quando não há mensagem do outro lado por ler. */
function markRead(): void {
  const c = currentClient();
  if (!c) return;
  const next = markReadFor(c.feedback ?? [], me());
  if (next) persist(c.id, { feedback: next });
}

export const feedback = {
  onOpen: () => {
    markRead();
    setState({ screen: "feedback", activeDayId: null });
  },

  // marca de novo ao sair: cobre o que chegou enquanto a conversa estava aberta
  onBack: () => {
    markRead();
    resetScreen();
  },

  /** Devolve true quando gravou, para a tela limpar a caixa de texto. */
  onSend: (text: string): boolean => {
    const c = currentClient();
    const trimmed = text.trim();
    if (!c || !trimmed) return false;
    const entry: FeedbackEntry = { id: uid(), dateKey: todayKey(), from: me(), text: trimmed, read: false };
    persist(c.id, { feedback: [...(c.feedback ?? []), entry] });
    return true;
  },

  onRemove: (id: string) => {
    const c = currentClient();
    if (!c || !confirm("Remover essa mensagem?")) return;
    persist(c.id, { feedback: (c.feedback ?? []).filter((m) => m.id !== id) });
  },

  hasUnread: (): boolean => {
    const c = currentClient();
    return c ? hasUnreadFor(c.feedback ?? [], me()) : false;
  },
};
```

- [ ] **Step 4: Acrescentar `onDismissError` ao `student` em `src/ui/handlers/trainer.ts`**

```ts
export const student = {
  onOpenDay: (dayId: string) => setState({ activeDayId: dayId }),
  onLogout: () => void signOutNow(),
  onDismissError: () => setState({ error: null }),
};
```

- [ ] **Step 5: Exportar em `src/ui/handlers/index.ts`**

```ts
export { gate } from "./gate";
export { trainer, student, clientSummary, resetScreen } from "./trainer";
export { day } from "./workout";
export { screens, visibleHistory } from "./screens";
export { cardio } from "./cardio";
export { feedback, me } from "./feedback";
```

- [ ] **Step 6: Parar de limpar o erro a cada snapshot em `src/main.ts`**

Dentro de `subscribeToClient`, trocar `setState({ view: "student", client, error: null });` por:

```ts
      // Limpa o erro só na chegada à tela do aluno (o da ficha que não existia).
      // A cada snapshot, não: quando o servidor recusa uma escrita, o SDK desfaz
      // a alteração local e dispara um snapshot novo, que apagaria o aviso no
      // mesmo instante em que ele aparece.
      const arriving = getState().view !== "student";
      setState({ view: "student", client, ...(arriving ? { error: null } : {}) });
```

E trocar o import `import { setState } from "./ui/state";` por `import { getState, setState } from "./ui/state";`.

- [ ] **Step 7: Rodar a suíte e o build**

Run: `npm test && npm run build`
Expected: tudo verde. (Os handlers ainda não são usados pela tela; isso vem nas Tasks 4 e 5.)

- [ ] **Step 8: Commit**

```bash
git add src/ui/state.ts src/ui/handlers/cardio.ts src/ui/handlers/feedback.ts src/ui/handlers/trainer.ts src/ui/handlers/index.ts src/main.ts
git commit -m "feat: handlers de cardio e feedbacks; erro do aluno não some no snapshot"
```

---

### Task 4: telas de cardio e feedbacks, aviso de erro e estilos

**Files:**
- Create: `src/ui/views/cardio.ts`
- Create: `src/ui/views/feedback.ts`
- Create: `src/ui/components/error-banner.ts`
- Create: `src/ui/styles-cardio-feedback.css`
- Modify: `src/main.ts` (importar o CSS novo)

**Interfaces:**
- Consumes: `CARDIO_ZONES`, `cardioTotals`, `monthStartKey`, `newestFirst` (Task 1); `oldestFirst` (Task 2); `weekKeyOf`, `weekLabel`.
- Produces:
  ```ts
  // src/ui/views/cardio.ts
  export interface CardioHandlers { onBack(): void; onAdd(minutesText: string, zone: string, note: string): boolean; onRemove(id: string): void }
  export function cardioView(entries: CardioEntry[], today: string, h: CardioHandlers): TemplateResult
  // src/ui/views/feedback.ts
  export const WHATSAPP_NUMBER = "5519993150750";
  export interface FeedbackHandlers { onBack(): void; onSend(text: string): boolean; onRemove(id: string): void }
  export function feedbackView(entries: FeedbackEntry[], me: FeedbackAuthor, canDelete: boolean, h: FeedbackHandlers): TemplateResult
  // src/ui/components/error-banner.ts
  export function errorBanner(error: string | null, onDismiss: () => void): TemplateResult | null
  ```

- [ ] **Step 1: Criar `src/ui/views/cardio.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import { CARDIO_ZONES, cardioTotals, monthStartKey, newestFirst, type CardioTotals } from "@/domain/cardio";
import { weekKeyOf, weekLabel } from "@/domain/week";
import type { CardioEntry } from "@/data/schema";

export interface CardioHandlers {
  onBack: () => void;
  onAdd: (minutesText: string, zone: string, note: string) => boolean;
  onRemove: (id: string) => void;
}

function totalsBox(title: string, totals: CardioTotals): TemplateResult {
  // na ordem das zonas, e não na ordem em que apareceram nos registros
  const zones = CARDIO_ZONES.filter((z) => totals.byZone[z.key]);
  return html`
    <div class="cardio-box">
      <div class="cardio-box-title">${title}</div>
      <div class="display cardio-box-total">${totals.totalMin} min</div>
      ${zones.length
        ? html`<div class="cardio-zones">
            ${zones.map((z) => html`<span class="cardio-zone ${z.key}">${z.key} · ${totals.byZone[z.key]}min</span>`)}
          </div>`
        : null}
    </div>
  `;
}

function onSubmit(e: Event, h: CardioHandlers): void {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const minutes = form.elements.namedItem("minutes") as HTMLInputElement;
  const zone = (form.elements.namedItem("zone") as HTMLSelectElement).value;
  const note = (form.elements.namedItem("note") as HTMLTextAreaElement).value;
  if (h.onAdd(minutes.value, zone, note)) {
    form.reset();
    return;
  }
  minutes.setCustomValidity("Informe os minutos em número inteiro.");
  minutes.reportValidity();
}

export function cardioView(entries: CardioEntry[], today: string, h: CardioHandlers): TemplateResult {
  const list = newestFirst(entries);
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Cardio</span>
    </div>

    <div class="cardio-totals">
      ${totalsBox("Essa semana", cardioTotals(entries, weekKeyOf(today)))}
      ${totalsBox("Esse mês", cardioTotals(entries, monthStartKey(today)))}
    </div>

    <form class="cardio-form" @submit=${(e: Event) => onSubmit(e, h)}>
      <div class="cardio-form-row">
        <input name="minutes" type="number" min="1" step="1" inputmode="numeric" required
               placeholder="minutos"
               @input=${(e: Event) => (e.target as HTMLInputElement).setCustomValidity("")} />
        <select name="zone">
          <option value="">Zona (opcional)</option>
          ${CARDIO_ZONES.map((z) => html`<option value=${z.key}>${z.label}</option>`)}
        </select>
      </div>
      <textarea name="note" rows="2" placeholder="observações (opcional)"></textarea>
      <button class="dashed-btn" type="submit"><i class="ti ti-plus"></i> Registrar cardio</button>
    </form>

    <div class="section-label">Histórico</div>
    ${list.length === 0
      ? html`<p class="muted-note">Nenhum cardio registrado ainda.</p>`
      : list.map(
          (e) => html`
            <div class="cardio-row">
              <i class="ti ti-clock"></i>
              <div class="cardio-row-text">
                <div>${e.minutes} min${e.note ? ` · ${e.note}` : ""}</div>
                <!-- weekLabel formata qualquer dia, não só a segunda-feira -->
                <div class="cardio-row-date">${weekLabel(e.dateKey)}</div>
              </div>
              ${e.zone ? html`<span class="cardio-zone ${e.zone}">${e.zone}</span>` : null}
              <button class="rm-x" @click=${() => h.onRemove(e.id)} aria-label="Remover registro">
                <i class="ti ti-x"></i>
              </button>
            </div>`,
        )}
  `;
}
```

- [ ] **Step 2: Criar `src/ui/views/feedback.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import { oldestFirst } from "@/domain/feedback";
import { weekLabel } from "@/domain/week";
import type { FeedbackAuthor, FeedbackEntry } from "@/data/schema";

/** 55 (Brasil) + 19 (DDD) + número, sem espaços. O mesmo do 1.0 (app.js:3240). */
export const WHATSAPP_NUMBER = "5519993150750";

export interface FeedbackHandlers {
  onBack: () => void;
  onSend: (text: string) => boolean;
  onRemove: (id: string) => void;
}

function onSubmit(e: Event, h: FeedbackHandlers): void {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const text = form.elements.namedItem("text") as HTMLTextAreaElement;
  if (h.onSend(text.value)) form.reset();
}

export function feedbackView(
  entries: FeedbackEntry[],
  me: FeedbackAuthor,
  canDelete: boolean,
  h: FeedbackHandlers,
): TemplateResult {
  const list = oldestFirst(entries);
  const other = me === "aluno" ? "seu personal" : "o aluno";
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Feedbacks / Observações</span>
    </div>

    <!-- só para o aluno: para o treinador, o link abriria conversa com o próprio número -->
    ${me === "aluno"
      ? html`<a class="whatsapp-btn" href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener">
          <i class="ti ti-brand-whatsapp"></i> Falar direto no WhatsApp
        </a>`
      : null}

    <div class="chat">
      ${list.length === 0
        ? html`<p class="muted-note">Nenhuma mensagem ainda. Escreva o que quiser para ${other} aqui embaixo.</p>`
        : list.map(
            (m) => html`
              <div class="bubble ${m.from === me ? "mine" : "theirs"}">
                <div class="bubble-meta">${m.from === "aluno" ? "Aluno" : "Personal"} · ${weekLabel(m.dateKey)}</div>
                <div class="bubble-text">${m.text}</div>
                ${canDelete
                  ? html`<button class="rm-x" @click=${() => h.onRemove(m.id)} aria-label="Remover mensagem">
                      <i class="ti ti-trash"></i>
                    </button>`
                  : null}
              </div>`,
          )}
    </div>

    <form class="chat-form" @submit=${(e: Event) => onSubmit(e, h)}>
      <textarea name="text" rows="3" placeholder="Escreva à vontade…"></textarea>
      <button class="dashed-btn" type="submit"><i class="ti ti-send"></i> Enviar</button>
    </form>
  `;
}
```

- [ ] **Step 3: Criar `src/ui/components/error-banner.ts`**

```ts
import { html, type TemplateResult } from "lit-html";

/**
 * Aviso de erro para a tela do aluno. A do treinador já mostra o erro na barra
 * lateral; a do aluno não mostrava em lugar nenhum, e uma escrita recusada
 * sumia em silêncio.
 */
export function errorBanner(error: string | null, onDismiss: () => void): TemplateResult | null {
  if (!error) return null;
  return html`
    <div class="error-banner" role="alert">
      <span>${error}</span>
      <button @click=${onDismiss} aria-label="Fechar aviso"><i class="ti ti-x"></i></button>
    </div>
  `;
}
```

- [ ] **Step 4: Criar `src/ui/styles-cardio-feedback.css`**

```css
/* Fase 3a: cardio, feedbacks e o aviso de erro do aluno. Arquivo à parte porque
   styles.css já passou do limite de tamanho. */

.section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
  color: var(--muted); margin: 18px 0 8px; }

/* cardio */
.cardio-totals { display: flex; gap: 10px; margin-bottom: 16px; }
.cardio-box { flex: 1; background: var(--panelAlt); border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
.cardio-box-title { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
.cardio-box-total { font-size: 24px; margin-top: 2px; }
.cardio-zones { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.cardio-zone { font-size: 11px; border: 1px solid var(--line); border-radius: 20px; padding: 2px 8px; color: var(--muted); }
.cardio-zone.Z2 { color: var(--steel); }
.cardio-zone.Z3 { color: var(--plate); }
.cardio-zone.Z4 { color: #E8875A; }
.cardio-zone.Z5 { color: var(--red); }

.cardio-form, .chat-form { display: flex; flex-direction: column; gap: 8px; background: var(--panelAlt);
  border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
.cardio-form-row { display: flex; gap: 8px; }
.cardio-form input, .cardio-form select, .cardio-form textarea, .chat-form textarea {
  background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 8px; color: var(--chalk);
  font: inherit; font-size: 14px; }
.cardio-form input { width: 90px; text-align: center; }
.cardio-form select { flex: 1; min-width: 0; }
.cardio-form textarea, .chat-form textarea { resize: none; }
.cardio-form .dashed-btn, .chat-form .dashed-btn { justify-content: center; }

.cardio-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); }
.cardio-row > .ti { color: var(--muted); font-size: 16px; }
.cardio-row-text { flex: 1; min-width: 0; font-size: 13px; overflow-wrap: anywhere; }
.cardio-row-date { font-size: 11px; color: var(--muted); }

/* feedbacks */
.whatsapp-btn { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px;
  background: #1F3A26; border: 1px solid #2E7D46; color: #9BE3B0; border-radius: 10px; padding: 12px;
  text-decoration: none; font-weight: 600; }
.chat { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.bubble { max-width: 85%; border-radius: 12px; padding: 8px 12px; border: 1px solid var(--line); background: var(--panelAlt); }
.bubble.mine { align-self: flex-end; background: var(--redDim); border-color: var(--red); }
.bubble.theirs { align-self: flex-start; }
.bubble-meta { font-size: 10px; color: var(--muted); margin-bottom: 2px; text-transform: uppercase; letter-spacing: .03em; }
.bubble-text { font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
.bubble .rm-x { margin-top: 4px; font-size: 12px; }

/* ponto de mensagem não lida no botão de feedbacks */
.unread-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--red); display: inline-block; }

/* aviso de erro do aluno */
.error-banner { display: flex; align-items: flex-start; gap: 10px; background: var(--redDim);
  border: 1px solid var(--red); border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; font-size: 13px; }
.error-banner span { flex: 1; }
.error-banner button { color: var(--chalk); }
```

- [ ] **Step 5: Importar o CSS em `src/main.ts`**

Logo depois de `import "./ui/styles.css";`:

```ts
import "./ui/styles-cardio-feedback.css";
```

- [ ] **Step 6: Verificar que compila**

Run: `npm run build`
Expected: sem erro de TypeScript. As telas ainda não aparecem; a Task 5 liga.

- [ ] **Step 7: Commit**

```bash
git add src/ui/views/cardio.ts src/ui/views/feedback.ts src/ui/components/error-banner.ts src/ui/styles-cardio-feedback.css src/main.ts
git commit -m "feat: adiciona as telas de cardio e feedbacks e o aviso de erro do aluno"
```

---

### Task 5: ligar as telas — botões, roteamento e aviso de erro

**Files:**
- Modify: `src/ui/render.ts`

**Interfaces:**
- Consumes: `cardioView` e `feedbackView` e `errorBanner` (Task 4); `handlers.cardio`, `handlers.feedback`, `handlers.me`, `handlers.student.onDismissError` (Task 3).

- [ ] **Step 1: Imports em `src/ui/render.ts`**

Acrescentar junto dos outros imports de views e componentes:

```ts
import { cardioView } from "./views/cardio";
import { feedbackView } from "./views/feedback";
import { errorBanner } from "./components/error-banner";
```

- [ ] **Step 2: Rotas novas em `screenTemplate`**

Antes do `return null;` final de `screenTemplate`:

```ts
  if (s.screen === "cardio") {
    return cardioView(client.cardio ?? [], todayKey(), handlers.cardio);
  }

  if (s.screen === "feedback") {
    // só o treinador apaga mensagem, como no 1.0
    return feedbackView(client.feedback ?? [], handlers.me(), editable, handlers.feedback);
  }
```

E trocar o comentário da função para: `/** As telas fora da grade de treinos, comuns ao treinador e ao aluno. Devolve null na grade normal. */`

- [ ] **Step 3: Botões em `homeTemplate`**

Substituir o bloco `<div class="prog-tabs">…</div>` por:

```ts
    <div class="prog-tabs">
      <button class="dashed-btn" @click=${handlers.screens.onOpenCalendar}>
        <i class="ti ti-calendar-stats"></i> Calendário
      </button>
      <button class="dashed-btn" @click=${handlers.screens.onOpenProgression}>
        <i class="ti ti-chart-line"></i> Progressão
      </button>
      <button class="dashed-btn" @click=${handlers.cardio.onOpen}>
        <i class="ti ti-heart-rate-monitor"></i> Cardio
      </button>
      <button class="dashed-btn" @click=${handlers.feedback.onOpen}>
        <i class="ti ti-message-circle"></i> Feedbacks
        ${handlers.feedback.hasUnread() ? html`<span class="unread-dot" aria-label="mensagem nova"></span>` : null}
      </button>
    </div>
```

- [ ] **Step 4: Aviso de erro na tela do aluno**

No `case "student"` de `template()`, trocar o `return` por:

```ts
      return html`
        ${errorBanner(s.error, handlers.student.onDismissError)}
        ${screenTemplate(s.client, false) ?? homeTemplate(s.client, false)}
      `;
```

- [ ] **Step 5: Rodar a suíte e o build**

Run: `npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 6: Conferir no navegador**

Run: `npm run dev` e abrir o endereço que o Vite mostrar.

Como treinador, com um aluno selecionado:
1. A linha de botões mostra Calendário, Progressão, Cardio e Feedbacks.
2. Cardio: registrar 30 min em Z2 aparece no histórico e soma em "Essa semana" e "Esse mês", com "Z2 · 30min". Remover pede confirmação e some.
3. Feedbacks: enviar uma mensagem; ela aparece à direita, como "Personal". Não há botão de WhatsApp. Há lixeira em cada mensagem.

Como aluno (outra janela, anônima):
4. Feedbacks tem o ponto vermelho por causa da mensagem do treinador. Abrir a conversa e voltar: o ponto some.
5. Há o botão do WhatsApp; não há lixeira.
6. Enviar uma resposta. Voltar para a tela do treinador: o ponto aparece lá, e continua aparecendo depois de o **aluno** reabrir a conversa — esse era o defeito do 1.0.

Registrar o resultado. Se algo falhar, corrigir antes do commit.

- [ ] **Step 7: Commit**

```bash
git add src/ui/render.ts
git commit -m "feat: liga cardio, feedbacks e o aviso de erro do aluno"
```

---

### Task 6: publicar e verificar em produção

**Files:** nenhum arquivo novo.

- [ ] **Step 1: Rodar a suíte inteira e o build**

```bash
npm test && npm run build
```

Esperado: tudo verde.

- [ ] **Step 2: Publicar**

```bash
git push origin main
```

O workflow roda os testes antes de publicar. Acompanhar com o id do run mais recente:

```bash
gh run list --repo fermmura/muratraining2 --limit 1
gh run watch <id> --repo fermmura/muratraining2 --exit-status
```

- [ ] **Step 3: Verificar em https://fermmura.github.io/muratraining2/**

Repetir os itens 1 a 6 da Task 5, Step 6, agora em produção. Depois, no **1.0**:

7. O cardio registrado no 2.0 aparece na tela de cardio do 1.0, com a zona certa.
8. As mensagens trocadas no 2.0 aparecem nos feedbacks do 1.0, do lado certo.

- [ ] **Step 4: Commit de status**

```bash
git commit --allow-empty -m "chore: fase 3a no ar"
git push
```

---

## Verificação da fase

A fase 3a está pronta quando tudo abaixo for verdade:

- [ ] `npm test` passa, com os testes novos de `cardio` e `feedback`.
- [ ] `npm run build` passa sem erro de TypeScript.
- [ ] Nenhum arquivo de `src/` criado ou alterado nesta fase passa de ~250 linhas.
- [ ] Nenhuma dependência nova em `package.json`; `firestore.rules` intocado.
- [ ] Mensagem própria nunca acende o ponto de não lida, e abrir a conversa não marca como lida a mensagem que a própria pessoa escreveu.
- [ ] Abrir e fechar a conversa sem mensagem nova não grava nada.
- [ ] O botão do WhatsApp aparece só para o aluno.
- [ ] Um erro de gravação aparece na tela do aluno e fica até ser fechado.
- [ ] Cardio e feedbacks gravados no 2.0 aparecem no 1.0.

## O que fica para a 3b

Volume por grupo muscular e fotos de exercício, com plano próprio a partir do mesmo spec.
