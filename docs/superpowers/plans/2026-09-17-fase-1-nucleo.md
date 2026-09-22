# MuraTraining 2.0 — Fase 1 (núcleo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o núcleo do MuraTraining 2.0 no ar em paralelo ao 1.0 — login com convite seguro, treinos, séries, histórico, promoção de semana e cronômetro — sem quebrar quem já treina no 1.0.

**Architecture:** App estático em Vite + TypeScript, render com lit-html, dados no mesmo Firestore do 1.0 e no mesmo formato. Lógica pura isolada em `src/domain/` (sem DOM, sem rede) para ser testável com Vitest; acesso ao Firestore isolado em `src/data/`; interface em `src/ui/`. Nenhum backend: o plano Firebase é o Spark, então tudo roda no navegador.

**Tech Stack:** Vite 5, TypeScript 5, lit-html 3, Firebase JS SDK 10 (modular), Vitest 2, vite-plugin-pwa, GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-17-muratraining-2.0-design.md`

## Global Constraints

Estas valem para **todas** as tarefas. Violar qualquer uma delas quebra produção.

- **Compatibilidade de schema é obrigatória.** O 1.0 está no ar lendo e escrevendo os mesmos documentos. Nunca renomeie, remova ou mude o tipo de um campo listado em `src/data/schema.ts`. Só é permitido **adicionar** coisa nova.
- **O campo `password` nunca é escrito.** Ele existe nos documentos antigos e deve ser ignorado na leitura; jamais aparece em escrita, log, tela ou mensagem de erro.
- **Nunca grave senha em `localStorage`, `sessionStorage`, IndexedDB ou Firestore.** Em lugar nenhum, por motivo nenhum.
- **`weekKey` é a data local da segunda-feira, formato `YYYY-MM-DD`.** Não é número de semana ISO. Gerar diferente disso corrompe o histórico do 1.0.
- **Datas são sempre dia-calendário local, nunca UTC.** Não use `toISOString()` para derivar `dateKey` ou `weekKey`: no fuso do Brasil isso vira o dia seguinte a partir das 21h.
- **Plano Spark.** Sem Cloud Functions, sem Admin SDK. Se uma tarefa parecer exigir servidor, pare e escale.
- **Projeto Firebase:** `muratraining-7af9b` (o mesmo do 1.0).
- Comentários e textos de interface em português. Identificadores de código em inglês.

---

### Task 1: Scaffold do projeto

Cria o projeto Vite + TypeScript com Vitest rodando. Sem isso nenhuma outra tarefa tem onde executar teste.

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `src/main.ts`
- Test: `src/domain/smoke.test.ts` (removido na Task 2)

**Interfaces:**
- Consumes: nada.
- Produces: `npm test` e `npm run build` funcionando; alias `@/` apontando para `src/`.

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "muratraining",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "firebase": "^10.14.1",
    "lit-html": "^3.2.1"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vite-plugin-pwa": "^0.20.5",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Criar `tsconfig.json`**

`strict: true` não é opcional aqui: metade do valor de migrar para TypeScript está em `strictNullChecks` pegar os `undefined` que o 1.0 trata com `|| []` espalhado.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Criar `vite.config.ts`**

O `process.env.TZ` fixo é essencial: as funções de semana dependem do fuso local, e sem fixar isso os testes passam na sua máquina e falham no CI.

```ts
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
```

- [ ] **Step 4: Criar `.gitignore`**

```
node_modules/
dist/
dev-dist/
.DS_Store
*.local
```

- [ ] **Step 5: Criar `index.html` mínimo**

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
    <title>Meu Treino</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Criar `src/main.ts` mínimo**

```ts
const app = document.getElementById("app");
if (app) app.textContent = "MuraTraining 2.0";
```

- [ ] **Step 7: Criar teste de fumaça `src/domain/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("scaffold", () => {
  it("roda no fuso de São Paulo", () => {
    expect(new Date("2026-09-17T00:00:00").getFullYear()).toBe(2026);
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/Sao_Paulo");
  });
});
```

- [ ] **Step 8: Instalar e rodar**

```bash
npm install
npm test
```

Esperado: 1 teste passando.

- [ ] **Step 9: Verificar que o build funciona**

```bash
npm run build
```

Esperado: `dist/` gerado, sem erro de TypeScript.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts .gitignore index.html src/
git commit -m "chore: scaffold do projeto com Vite, TypeScript e Vitest"
```

---

### Task 2: `domain/week.ts` — datas e semanas

A função mais crítica do projeto para compatibilidade. Se `weekKeyOf` divergir do 1.0 em um único dia, o histórico do aluno passa a ser gravado na semana errada e a promoção de semana dispara na hora errada.

**Files:**
- Create: `src/domain/week.ts`, `src/domain/week.test.ts`
- Delete: `src/domain/smoke.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `localDateKey(d: Date): string` — `"YYYY-MM-DD"` pelos getters locais
  - `todayKey(): string`
  - `weekKeyOf(dateKey: string): string` — segunda-feira da semana daquele dia
  - `addWeeks(weekKey: string, count: number): string`

- [ ] **Step 1: Escrever os testes que falham**

Os casos de borda abaixo são os que o 1.0 errou e corrigiu; eles existem para travar a correção.

```ts
// src/domain/week.test.ts
import { describe, it, expect } from "vitest";
import { localDateKey, todayKey, weekKeyOf, addWeeks } from "./week";

describe("localDateKey", () => {
  it("formata como YYYY-MM-DD com zero à esquerda", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("usa o dia local, não o UTC", () => {
    // 22h no horário de Brasília já é o dia seguinte em UTC.
    // toISOString() daria 2026-09-18 — aqui tem que continuar sendo 17.
    expect(localDateKey(new Date(2026, 8, 17, 22, 0, 0))).toBe("2026-09-17");
  });
});

describe("weekKeyOf", () => {
  it("devolve a própria data quando já é segunda-feira", () => {
    expect(weekKeyOf("2026-09-14")).toBe("2026-09-14"); // segunda
  });

  it("volta para a segunda-feira no meio da semana", () => {
    expect(weekKeyOf("2026-09-17")).toBe("2026-09-14"); // quinta -> segunda
  });

  it("domingo pertence à semana que começou na segunda anterior", () => {
    // o caso que o 1.0 errava: getDay() do domingo é 0
    expect(weekKeyOf("2026-09-20")).toBe("2026-09-14");
  });

  it("atravessa virada de mês", () => {
    expect(weekKeyOf("2026-10-01")).toBe("2026-09-28"); // quinta -> segunda
  });

  it("atravessa virada de ano", () => {
    expect(weekKeyOf("2027-01-01")).toBe("2026-12-28"); // sexta -> segunda
  });
});

describe("addWeeks", () => {
  it("avança semanas", () => {
    expect(addWeeks("2026-09-14", 2)).toBe("2026-09-28");
  });

  it("volta semanas com contagem negativa", () => {
    expect(addWeeks("2026-09-14", -1)).toBe("2026-09-07");
  });

  it("atravessa o horário de verão sem perder o dia", () => {
    expect(addWeeks("2026-10-12", 4)).toBe("2026-11-09");
  });
});

describe("todayKey", () => {
  it("bate com localDateKey de agora", () => {
    expect(todayKey()).toBe(localDateKey(new Date()));
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm test -- src/domain/week.test.ts
```

Esperado: FAIL, `Failed to resolve import "./week"`.

- [ ] **Step 3: Implementar `src/domain/week.ts`**

```ts
/**
 * Datas aqui são sempre "dia calendário local", nunca um instante no tempo.
 * Passar por toISOString() converteria para UTC e, no fuso do Brasil, viraria
 * o dia seguinte a partir das 21h — jogando o treino na semana errada.
 */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return localDateKey(new Date());
}

/** Segunda-feira da semana a que `dateKey` pertence. Domingo conta para a semana que já começou. */
export function weekKeyOf(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return localDateKey(monday);
}

export function addWeeks(weekKey: string, count: number): string {
  const d = new Date(weekKey + "T00:00:00");
  d.setDate(d.getDate() + count * 7);
  return localDateKey(d);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test -- src/domain/week.test.ts
```

Esperado: PASS, 11 testes.

- [ ] **Step 5: Remover o teste de fumaça**

```bash
rm src/domain/smoke.test.ts
npm test
```

Esperado: PASS, 11 testes.

- [ ] **Step 6: Commit**

```bash
git add src/domain/week.ts src/domain/week.test.ts
git rm src/domain/smoke.test.ts
git commit -m "feat: adiciona cálculo de data e semana compatível com o 1.0"
```

---

### Task 3: `data/schema.ts` — o contrato

Os tipos do Firestore como o 1.0 os escreve. Este arquivo é o documento normativo do formato; as tarefas seguintes dependem dele.

**Files:**
- Create: `src/data/schema.ts`, `src/data/id.ts`, `src/data/id.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: tipos `Client`, `Day`, `Exercise`, `ExerciseSet`, `HistoryEntry`, `WeekPlan`, `CardioEntry`, `HistoryArchiveDoc`; função `uid(): string`.

- [ ] **Step 1: Criar `src/data/schema.ts`**

Campos opcionais estão marcados como opcionais de propósito: documentos antigos do 1.0 não têm todos eles.

```ts
/**
 * Contrato do Firestore compartilhado com o MuraTraining 1.0, que continua no ar
 * lendo e escrevendo estes mesmos documentos. Só é permitido ADICIONAR campos.
 * Renomear, remover ou mudar tipo quebra o app de quem está treinando agora.
 */

export interface ExerciseSet {
  id: string;
  repsGoal: string;
  repsDone: string;
  load: string;
  intensity: number;
  rir: string;
  rirEnabled: boolean;
  /** Carga prescrita pelo treinador: para de ser sobrescrita pela do último treino. */
  loadSetByTrainer?: boolean;
  /** Reps do último treino feito, mostrado esmaecido como referência. */
  prevReps?: string;
}

export interface Exercise {
  id: string;
  name: string;
  notes: string;
  sets: ExerciseSet[];
  muscle?: string;
  synergist?: string;
  photoUrl?: string;
  hasPhoto?: boolean;
  videoUrl?: string;
  studentNote?: string;
  studentNoteAt?: number;
}

export interface Day {
  id: string;
  title: string;
  exercises: Exercise[];
  /** Epoch ms de quando o cronômetro daquele dia começou. Estado de sessão, não do treino. */
  timerStartedAt?: number;
}

export interface WeekPlan {
  id: string;
  weekKey: string;
  days: Day[];
}

export interface HistoryEntry {
  dateKey: string;
  weekKey: string;
  dayId: string;
  dayTitle: string;
  exId: string;
  exName: string;
  setId: string;
  setIndex: number;
  repsGoal: string;
  repsDone: string;
  load: string;
}

export interface CardioEntry {
  id: string;
  dateKey: string;
  minutes: number;
  zone: string;
  note: string;
}

export interface Client {
  /** Id do documento, que é o UID do Firebase Auth. Não é campo gravado. */
  id: string;
  name: string;
  email: string;
  goal: string;
  createdAt: number;
  lastSeen?: number;
  activeWeekKey?: string;
  days: Day[];
  weekPlans?: WeekPlan[];
  history?: HistoryEntry[];
  cardio?: CardioEntry[];
  feedback?: unknown[];
  workoutSessions?: unknown[];
}

/** Introduzido pelo 2.0. O 1.0 ignora, por isso é aditivo e seguro. */
export interface HistoryArchiveDoc {
  weekKey: string;
  entries: HistoryEntry[];
}

/** Campos que o aluno pode alterar no próprio documento. Espelha firestore.rules. */
export const STUDENT_WRITABLE_FIELDS = [
  "days",
  "history",
  "cardio",
  "feedback",
  "workoutSessions",
  "lastSeen",
  "activeWeekKey",
  "weekPlans",
] as const;
```

- [ ] **Step 2: Escrever o teste de `uid`**

O 1.0 usa `Math.random().toString(36).slice(2, 10)`, que colide com frequência incômoda quando se clonam centenas de séries de uma vez.

```ts
// src/data/id.test.ts
import { describe, it, expect } from "vitest";
import { uid } from "./id";

describe("uid", () => {
  it("gera id no formato esperado", () => {
    expect(uid()).toMatch(/^[0-9a-z]{12}$/);
  });

  it("não colide em volume", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50_000; i++) seen.add(uid());
    expect(seen.size).toBe(50_000);
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

```bash
npm test -- src/data/id.test.ts
```

Esperado: FAIL, `Failed to resolve import "./id"`.

- [ ] **Step 4: Implementar `src/data/id.ts`**

```ts
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
```

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, 13 testes.

- [ ] **Step 6: Commit**

```bash
git add src/data/schema.ts src/data/id.ts src/data/id.test.ts
git commit -m "feat: declara o contrato de schema do Firestore e gerador de id"
```

---

### Task 4: `domain/history.ts` — gravação de histórico e última carga

Lógica pura que o 1.0 mantinha misturada com Firestore. Extraída, fica testável.

**Files:**
- Create: `src/domain/history.ts`, `src/domain/history.test.ts`

**Interfaces:**
- Consumes: `weekKeyOf`, `todayKey` (Task 2); `Client`, `Day`, `HistoryEntry` (Task 3).
- Produces:
  - `applySetFieldChange(client, dayId, exId, setId, field, value): { days: Day[]; history: HistoryEntry[] }`
  - `buildLastDoneIndex(history: HistoryEntry[], beforeWeekKey?: string): Map<string, HistoryEntry>`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/domain/history.test.ts
import { describe, it, expect } from "vitest";
import { applySetFieldChange, buildLastDoneIndex } from "./history";
import { todayKey, weekKeyOf } from "./week";
import type { Client, HistoryEntry } from "@/data/schema";

function makeClient(): Client {
  return {
    id: "c1",
    name: "Aluno",
    email: "a@x.com",
    goal: "",
    createdAt: 0,
    days: [
      {
        id: "d1",
        title: "Peito",
        exercises: [
          {
            id: "e1",
            name: "Supino",
            notes: "",
            sets: [
              { id: "s1", repsGoal: "10", repsDone: "", load: "", intensity: 0, rir: "", rirEnabled: false },
              { id: "s2", repsGoal: "10", repsDone: "", load: "", intensity: 0, rir: "", rirEnabled: false },
            ],
          },
        ],
      },
    ],
    history: [],
  };
}

describe("applySetFieldChange", () => {
  it("altera o campo da série alvo e não toca nas outras", () => {
    const { days } = applySetFieldChange(makeClient(), "d1", "e1", "s1", "repsDone", "9");
    expect(days[0].exercises[0].sets[0].repsDone).toBe("9");
    expect(days[0].exercises[0].sets[1].repsDone).toBe("");
  });

  it("grava entrada de histórico ao mudar repsDone", () => {
    const { history } = applySetFieldChange(makeClient(), "d1", "e1", "s1", "repsDone", "9");
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      dateKey: todayKey(),
      weekKey: weekKeyOf(todayKey()),
      dayId: "d1",
      dayTitle: "Peito",
      exId: "e1",
      exName: "Supino",
      setId: "s1",
      setIndex: 0,
      repsDone: "9",
    });
  });

  it("grava entrada de histórico ao mudar load", () => {
    const { history } = applySetFieldChange(makeClient(), "d1", "e1", "s2", "load", "40");
    expect(history).toHaveLength(1);
    expect(history[0].setIndex).toBe(1);
    expect(history[0].load).toBe("40");
  });

  it("não grava histórico para campos que não são reps nem carga", () => {
    const { history } = applySetFieldChange(makeClient(), "d1", "e1", "s1", "repsGoal", "12");
    expect(history).toHaveLength(0);
  });

  it("substitui a entrada do mesmo dia em vez de acumular", () => {
    const c = makeClient();
    const first = applySetFieldChange(c, "d1", "e1", "s1", "repsDone", "8");
    const second = applySetFieldChange(
      { ...c, days: first.days, history: first.history },
      "d1", "e1", "s1", "repsDone", "9",
    );
    expect(second.history).toHaveLength(1);
    expect(second.history[0].repsDone).toBe("9");
  });

  it("preserva entradas de outros dias", () => {
    const c = makeClient();
    c.history = [{
      dateKey: "2020-01-01", weekKey: "2019-12-30", dayId: "d1", dayTitle: "Peito",
      exId: "e1", exName: "Supino", setId: "s1", setIndex: 0,
      repsGoal: "10", repsDone: "7", load: "30",
    }];
    const { history } = applySetFieldChange(c, "d1", "e1", "s1", "repsDone", "9");
    expect(history).toHaveLength(2);
  });
});

describe("buildLastDoneIndex", () => {
  const entries: HistoryEntry[] = [
    { dateKey: "2026-09-07", weekKey: "2026-09-07", dayId: "d1", dayTitle: "Peito", exId: "e1", exName: "Supino", setId: "s1", setIndex: 0, repsGoal: "10", repsDone: "8", load: "30" },
    { dateKey: "2026-09-14", weekKey: "2026-09-14", dayId: "d1", dayTitle: "Peito", exId: "e1", exName: "Supino", setId: "s1", setIndex: 0, repsGoal: "10", repsDone: "9", load: "35" },
  ];

  it("guarda a entrada mais recente por exercício e índice de série", () => {
    const idx = buildLastDoneIndex(entries);
    expect(idx.get("Supino|0")?.load).toBe("35");
  });

  it("ignora o que aconteceu na semana do plano ou depois", () => {
    const idx = buildLastDoneIndex(entries, "2026-09-14");
    expect(idx.get("Supino|0")?.load).toBe("30");
  });

  it("ignora entradas sem nada registrado", () => {
    const vazia: HistoryEntry = { ...entries[0], dateKey: "2026-09-21", repsDone: "", load: "" };
    const idx = buildLastDoneIndex([...entries, vazia]);
    expect(idx.get("Supino|0")?.load).toBe("35");
  });

  it("devolve mapa vazio sem histórico", () => {
    expect(buildLastDoneIndex([]).size).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm test -- src/domain/history.test.ts
```

Esperado: FAIL, `Failed to resolve import "./history"`.

- [ ] **Step 3: Implementar `src/domain/history.ts`**

```ts
import { todayKey, weekKeyOf } from "./week";
import type { Client, Day, HistoryEntry } from "@/data/schema";

/** Campos de série cuja alteração vira registro de histórico. */
const TRACKED_FIELDS = new Set(["repsDone", "load"]);

export function applySetFieldChange(
  client: Client,
  dayId: string,
  exId: string,
  setId: string,
  field: string,
  value: string,
): { days: Day[]; history: HistoryEntry[] } {
  let dayTitle = "";
  let exName = "";
  let setIndex = 0;

  const days = (client.days ?? []).map((d) => {
    if (d.id !== dayId) return d;
    dayTitle = d.title;
    return {
      ...d,
      exercises: (d.exercises ?? []).map((ex) => {
        if (ex.id !== exId) return ex;
        exName = ex.name;
        return {
          ...ex,
          sets: (ex.sets ?? []).map((s, i) => {
            if (s.id !== setId) return s;
            setIndex = i;
            return { ...s, [field]: value };
          }),
        };
      }),
    };
  });

  const previous = client.history ?? [];
  if (!TRACKED_FIELDS.has(field)) return { days, history: previous };

  const dateKey = todayKey();
  const set = days
    .find((d) => d.id === dayId)
    ?.exercises.find((e) => e.id === exId)
    ?.sets.find((s) => s.id === setId);

  // Uma série editada várias vezes no mesmo dia deixa UMA entrada, não uma por tecla.
  const history = previous.filter((h) => !(h.setId === setId && h.dateKey === dateKey));
  history.push({
    dateKey,
    weekKey: weekKeyOf(dateKey),
    dayId,
    dayTitle,
    exId,
    exName,
    setId,
    setIndex,
    repsGoal: set?.repsGoal ?? "",
    repsDone: set?.repsDone ?? "",
    load: set?.load ?? "",
  });

  return { days, history };
}

/**
 * Última vez que o aluno REALMENTE fez cada série, indexado por "nome|índice".
 * `beforeWeekKey` limita a busca ao que aconteceu antes daquela semana, usado ao
 * montar o plano de uma semana futura.
 */
export function buildLastDoneIndex(
  history: HistoryEntry[],
  beforeWeekKey?: string,
): Map<string, HistoryEntry> {
  const map = new Map<string, HistoryEntry>();
  for (const h of history) {
    if (!h.exName) continue;
    if (beforeWeekKey && h.weekKey && h.weekKey >= beforeWeekKey) continue;
    if (!h.repsDone && !h.load) continue;
    const k = `${h.exName}|${h.setIndex}`;
    const cur = map.get(k);
    if (!cur || (h.dateKey ?? "") >= (cur.dateKey ?? "")) map.set(k, h);
  }
  return map;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, 23 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domain/history.ts src/domain/history.test.ts
git commit -m "feat: extrai gravação de histórico e índice de última carga"
```

---

### Task 5: `domain/archive.ts` — corte do histórico

O cálculo puro que desarma o estouro de 1MB. Só decide o que fica e o que sai; quem escreve no Firestore é a Task 8.

**Files:**
- Create: `src/domain/archive.ts`, `src/domain/archive.test.ts`

**Interfaces:**
- Consumes: `addWeeks` (Task 2); `HistoryEntry` (Task 3).
- Produces:
  - `ARCHIVE_AFTER_WEEKS: number` (26)
  - `splitHistoryForArchive(history, currentWeekKey): { keep: HistoryEntry[]; archive: Map<string, HistoryEntry[]> }`

A leitura reconciliada do arquivo (juntar arquivo + documento para os gráficos) é
da fase 2, junto com a tela de progressão que a consome. Na fase 1 ninguém lê
histórico arquivado: `buildLastDoneIndex` procura o treino MAIS RECENTE, que por
definição está dentro das 26 semanas que ficam no documento.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/domain/archive.test.ts
import { describe, it, expect } from "vitest";
import { splitHistoryForArchive, ARCHIVE_AFTER_WEEKS } from "./archive";
import { addWeeks } from "./week";
import type { HistoryEntry } from "@/data/schema";

const CURRENT = "2026-09-14";

function entry(weekKey: string, setId: string, dateKey = weekKey): HistoryEntry {
  return {
    dateKey, weekKey, dayId: "d1", dayTitle: "Peito", exId: "e1", exName: "Supino",
    setId, setIndex: 0, repsGoal: "10", repsDone: "9", load: "30",
  };
}

describe("splitHistoryForArchive", () => {
  it("mantém histórico recente no documento", () => {
    const recente = entry(addWeeks(CURRENT, -1), "s1");
    const { keep, archive } = splitHistoryForArchive([recente], CURRENT);
    expect(keep).toHaveLength(1);
    expect(archive.size).toBe(0);
  });

  it("arquiva o que passou do corte", () => {
    const antigo = entry(addWeeks(CURRENT, -(ARCHIVE_AFTER_WEEKS + 1)), "s1");
    const { keep, archive } = splitHistoryForArchive([antigo], CURRENT);
    expect(keep).toHaveLength(0);
    expect(archive.get(antigo.weekKey)).toEqual([antigo]);
  });

  it("mantém a semana exatamente no limite do corte", () => {
    const limite = entry(addWeeks(CURRENT, -ARCHIVE_AFTER_WEEKS), "s1");
    const { keep } = splitHistoryForArchive([limite], CURRENT);
    expect(keep).toHaveLength(1);
  });

  it("nunca parte uma semana entre documento e arquivo", () => {
    const wk = addWeeks(CURRENT, -(ARCHIVE_AFTER_WEEKS + 2));
    const { keep, archive } = splitHistoryForArchive(
      [entry(wk, "s1", wk), entry(wk, "s2", addWeeks(wk, 0))],
      CURRENT,
    );
    expect(keep).toHaveLength(0);
    expect(archive.get(wk)).toHaveLength(2);
  });

  it("agrupa cada semana em seu próprio documento", () => {
    const w1 = addWeeks(CURRENT, -(ARCHIVE_AFTER_WEEKS + 1));
    const w2 = addWeeks(CURRENT, -(ARCHIVE_AFTER_WEEKS + 2));
    const { archive } = splitHistoryForArchive([entry(w1, "s1"), entry(w2, "s2")], CURRENT);
    expect(archive.size).toBe(2);
  });

  it("descarta entrada sem weekKey em vez de arquivar errado", () => {
    const quebrada = { ...entry(CURRENT, "s1"), weekKey: "" };
    const { keep, archive } = splitHistoryForArchive([quebrada], CURRENT);
    expect(keep).toEqual([quebrada]);
    expect(archive.size).toBe(0);
  });

  it("não faz nada com histórico vazio", () => {
    const { keep, archive } = splitHistoryForArchive([], CURRENT);
    expect(keep).toHaveLength(0);
    expect(archive.size).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm test -- src/domain/archive.test.ts
```

Esperado: FAIL, `Failed to resolve import "./archive"`.

- [ ] **Step 3: Implementar `src/domain/archive.ts`**

```ts
import { addWeeks } from "./week";
import type { HistoryEntry } from "@/data/schema";

/**
 * Histórico com mais de 26 semanas sai do documento do aluno e vai para a
 * subcoleção historyArchive. Sem isso o documento cresce sem limite e encosta
 * no teto de 1MB do Firestore em pouco mais de um ano de uso, e a partir daí
 * TODO salvamento daquele aluno passa a falhar.
 *
 * O corte é por weekKey, e não por data absoluta, para que uma semana nunca
 * fique dividida entre o documento e o arquivo.
 */
export const ARCHIVE_AFTER_WEEKS = 26;

export function splitHistoryForArchive(
  history: HistoryEntry[],
  currentWeekKey: string,
): { keep: HistoryEntry[]; archive: Map<string, HistoryEntry[]> } {
  const cutoff = addWeeks(currentWeekKey, -ARCHIVE_AFTER_WEEKS);
  const keep: HistoryEntry[] = [];
  const archive = new Map<string, HistoryEntry[]>();

  for (const h of history) {
    // entrada sem weekKey não tem como ser arquivada em segurança: fica onde está
    if (!h.weekKey || h.weekKey >= cutoff) {
      keep.push(h);
      continue;
    }
    const bucket = archive.get(h.weekKey);
    if (bucket) bucket.push(h);
    else archive.set(h.weekKey, [h]);
  }

  return { keep, archive };
}

```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, 30 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domain/archive.ts src/domain/archive.test.ts
git commit -m "feat: adiciona corte de histórico que desarma o estouro de 1MB"
```

---

### Task 6: `domain/week-promotion.ts` — virada de semana

Quando a semana muda, o plano daquela semana vira o treino ativo. Roda no aparelho do aluno.

**Files:**
- Create: `src/domain/week-promotion.ts`, `src/domain/week-promotion.test.ts`

**Interfaces:**
- Consumes: `buildLastDoneIndex` (Task 4); `uid` (Task 3); `Client`, `Day`, `WeekPlan` (Task 3).
- Produces:
  - `cloneDaysWithNewIds(days, opts?): Day[]`
  - `planPromotion(client, currentWeekKey): { days: Day[]; activeWeekKey: string; weekPlans: WeekPlan[] } | null`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/domain/week-promotion.test.ts
import { describe, it, expect } from "vitest";
import { cloneDaysWithNewIds, planPromotion } from "./week-promotion";
import type { Client, Day } from "@/data/schema";

function days(): Day[] {
  return [{
    id: "d1", title: "Peito", timerStartedAt: 1_700_000_000_000,
    exercises: [{
      id: "e1", name: "Supino", notes: "", sets: [
        { id: "s1", repsGoal: "10", repsDone: "9", load: "30", intensity: 0, rir: "", rirEnabled: false },
      ],
    }],
  }];
}

function client(over: Partial<Client> = {}): Client {
  return {
    id: "c1", name: "Aluno", email: "a@x.com", goal: "", createdAt: 0,
    days: days(), history: [], activeWeekKey: "2026-09-07", weekPlans: [], ...over,
  };
}

describe("cloneDaysWithNewIds", () => {
  it("gera ids novos para dia, exercício e série", () => {
    const [d] = cloneDaysWithNewIds(days());
    expect(d.id).not.toBe("d1");
    expect(d.exercises[0].id).not.toBe("e1");
    expect(d.exercises[0].sets[0].id).not.toBe("s1");
  });

  it("nunca carrega o cronômetro para a cópia", () => {
    expect(cloneDaysWithNewIds(days())[0].timerStartedAt).toBeUndefined();
  });

  it("zera o feito", () => {
    expect(cloneDaysWithNewIds(days())[0].exercises[0].sets[0].repsDone).toBe("");
  });

  it("preserva a meta e a carga", () => {
    const s = cloneDaysWithNewIds(days())[0].exercises[0].sets[0];
    expect(s.repsGoal).toBe("10");
    expect(s.load).toBe("30");
  });

  it("guarda o feito anterior em prevReps quando pedido", () => {
    const s = cloneDaysWithNewIds(days(), { carryGhost: true })[0].exercises[0].sets[0];
    expect(s.prevReps).toBe("9");
    expect(s.repsDone).toBe("");
  });

  it("mantém a referência antiga quando a série não foi feita", () => {
    const base = days();
    base[0].exercises[0].sets[0] = { ...base[0].exercises[0].sets[0], repsDone: "", prevReps: "7" };
    expect(cloneDaysWithNewIds(base, { carryGhost: true })[0].exercises[0].sets[0].prevReps).toBe("7");
  });
});

describe("planPromotion", () => {
  it("não faz nada quando a semana ativa já é a atual", () => {
    expect(planPromotion(client({ activeWeekKey: "2026-09-14" }), "2026-09-14")).toBeNull();
  });

  it("nunca volta para uma semana anterior", () => {
    expect(planPromotion(client({ activeWeekKey: "2026-09-21" }), "2026-09-14")).toBeNull();
  });

  it("só avança a semana ativa quando não há plano", () => {
    const r = planPromotion(client(), "2026-09-14");
    expect(r?.activeWeekKey).toBe("2026-09-14");
    expect(r?.days[0].id).toBe("d1"); // treino atual segue igual
  });

  it("promove o plano da semana e o remove da fila", () => {
    const plano = { id: "p1", weekKey: "2026-09-14", days: days() };
    const r = planPromotion(client({ weekPlans: [plano] }), "2026-09-14");
    expect(r?.weekPlans).toHaveLength(0);
    expect(r?.days[0].id).not.toBe("d1"); // ids novos
    expect(r?.days[0].timerStartedAt).toBeUndefined();
  });

  it("aplica a última carga feita sobre as séries do plano", () => {
    const plano = { id: "p1", weekKey: "2026-09-14", days: days() };
    const c = client({
      weekPlans: [plano],
      history: [{
        dateKey: "2026-09-10", weekKey: "2026-09-07", dayId: "d1", dayTitle: "Peito",
        exId: "e1", exName: "Supino", setId: "s1", setIndex: 0,
        repsGoal: "10", repsDone: "9", load: "45",
      }],
    });
    expect(planPromotion(c, "2026-09-14")?.days[0].exercises[0].sets[0].load).toBe("45");
  });

  it("respeita a carga prescrita pelo treinador", () => {
    const base = days();
    base[0].exercises[0].sets[0] = { ...base[0].exercises[0].sets[0], loadSetByTrainer: true };
    const c = client({
      weekPlans: [{ id: "p1", weekKey: "2026-09-14", days: base }],
      history: [{
        dateKey: "2026-09-10", weekKey: "2026-09-07", dayId: "d1", dayTitle: "Peito",
        exId: "e1", exName: "Supino", setId: "s1", setIndex: 0,
        repsGoal: "10", repsDone: "9", load: "45",
      }],
    });
    expect(planPromotion(c, "2026-09-14")?.days[0].exercises[0].sets[0].load).toBe("30");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm test -- src/domain/week-promotion.test.ts
```

Esperado: FAIL, `Failed to resolve import "./week-promotion"`.

- [ ] **Step 3: Implementar `src/domain/week-promotion.ts`**

```ts
import { buildLastDoneIndex } from "./history";
import { uid } from "@/data/id";
import type { Client, Day, WeekPlan } from "@/data/schema";

interface CloneOptions {
  /**
   * Guarda o feito da semana que passou em prevReps, para aparecer esmaecido
   * como referência. Usado quando a cópia é a semana seguinte do mesmo aluno.
   */
  carryGhost?: boolean;
}

export function cloneDaysWithNewIds(days: Day[], opts: CloneOptions = {}): Day[] {
  return (days ?? []).map((d) => {
    // timerStartedAt é estado da sessão daquele dia. Se viajar junto, a semana
    // nova nasce marcada como "em andamento", contando desde outro dia.
    const { timerStartedAt: _drop, ...rest } = d;
    return {
      ...rest,
      id: uid(),
      exercises: (d.exercises ?? []).map((ex) => ({
        ...ex,
        id: uid(),
        sets: (ex.sets ?? []).map((s) => ({
          ...s,
          id: uid(),
          repsDone: "",
          ...(opts.carryGhost ? { prevReps: s.repsDone || s.prevReps || "" } : {}),
        })),
      })),
    };
  });
}

/** Aplica a última carga realmente feita sobre as séries do plano. */
function withRefLoads(client: Client, planDays: Day[], planWeekKey: string): Day[] {
  const idx = buildLastDoneIndex(client.history ?? [], planWeekKey);
  if (!idx.size) return planDays;
  return planDays.map((d) => ({
    ...d,
    exercises: (d.exercises ?? []).map((ex) => ({
      ...ex,
      sets: (ex.sets ?? []).map((s, i) => {
        if (s.loadSetByTrainer) return s; // prescrição do treinador manda
        const ref = idx.get(`${ex.name ?? ""}|${i}`);
        return ref?.load ? { ...s, load: ref.load } : s;
      }),
    })),
  }));
}

/**
 * Calcula a virada de semana. Devolve null quando não há nada a fazer —
 * inclusive quando a semana atual é anterior à ativa, que seria um relógio
 * errado no aparelho e nunca deve fazer o aluno "voltar no tempo".
 */
export function planPromotion(
  client: Client,
  currentWeekKey: string,
): { days: Day[]; activeWeekKey: string; weekPlans: WeekPlan[] } | null {
  const activeKey = client.activeWeekKey ?? currentWeekKey;
  if (currentWeekKey <= activeKey) return null;

  const plans = client.weekPlans ?? [];
  const plan = plans.find((p) => p.weekKey === currentWeekKey);
  if (!plan) {
    return { days: client.days ?? [], activeWeekKey: currentWeekKey, weekPlans: plans };
  }

  return {
    days: withRefLoads(client, cloneDaysWithNewIds(plan.days, { carryGhost: true }), plan.weekKey),
    activeWeekKey: currentWeekKey,
    weekPlans: plans.filter((p) => p.id !== plan.id),
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, 42 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domain/week-promotion.ts src/domain/week-promotion.test.ts
git commit -m "feat: adiciona promoção de semana e clonagem de treino"
```

---

### Task 7: `firebase.ts` e `data/client-repo.ts`

Primeira tarefa que fala com a rede. Isola o SDK para que o resto do app não importe Firebase diretamente.

**Files:**
- Create: `src/firebase.ts`, `src/data/client-repo.ts`, `.env.local`, `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `Client`, `STUDENT_WRITABLE_FIELDS` (Task 3).
- Produces:
  - `auth`, `db` exportados de `src/firebase.ts`
  - `subscribeToClient(clientId, onChange, onError): () => void`
  - `subscribeToAllClients(onChange, onError): () => void`
  - `saveClient(id, patch: Partial<Client>): Promise<void>`
  - `createClient(clientId: string, data: NewClient): Promise<void>` com `NewClient = Omit<Client, "id">`

- [ ] **Step 1: Mover a configuração do Firebase para variáveis de ambiente**

A configuração web do Firebase não é segredo — quem protege os dados são as regras do Firestore. Ainda assim ela sai do código para que apontar o app para um projeto de teste seja trocar um arquivo, e não editar fonte.

Criar `.env.example` (versionado):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_TRAINER_EMAIL=
```

Criar `.env.local` (NÃO versionado) com os valores reais do projeto `muratraining-7af9b`, copiados de `firebase-config.js` do 1.0.

- [ ] **Step 2: Adicionar `.env.local` ao `.gitignore`**

```
node_modules/
dist/
dev-dist/
.DS_Store
*.local
.env.local
```

- [ ] **Step 3: Criar `src/firebase.ts`**

```ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfig = config;
export const TRAINER_EMAIL = import.meta.env.VITE_TRAINER_EMAIL.toLowerCase();

export const app = initializeApp(config);
export const auth = getAuth(app);

// cache offline: o aluno treina em academia com sinal ruim e precisa registrar série
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
```

- [ ] **Step 4: Criar `src/data/client-repo.ts`**

```ts
import { collection, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";
import type { Client } from "./schema";

const CLIENTS = "clients";

/** Ficha nova: o id do documento é o UID do Auth, e não um campo de dentro dela. */
export type NewClient = Omit<Client, "id">;

/** O campo `password` existe em documentos antigos do 1.0 e é descartado na leitura. */
function toClient(id: string, data: Record<string, unknown>): Client {
  const { password: _drop, ...rest } = data;
  return { ...(rest as Omit<Client, "id">), id };
}

export function subscribeToClient(
  clientId: string,
  onChange: (client: Client) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, CLIENTS, clientId),
    (snap) => {
      const data = snap.data();
      if (data) onChange(toClient(snap.id, data));
    },
    onError,
  );
}

export function subscribeToAllClients(
  onChange: (clients: Client[]) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, CLIENTS),
    (snap) => onChange(snap.docs.map((d) => toClient(d.id, d.data()))),
    onError,
  );
}

export async function saveClient(id: string, patch: Partial<Client>): Promise<void> {
  // `id` é o id do documento, não um campo gravado; se escapar para o patch,
  // o 1.0 passa a ver um campo que não espera
  const { id: _drop, ...fields } = patch as Partial<Client> & { id?: string };
  await updateDoc(doc(db, CLIENTS, id), fields);
}

export async function createClient(clientId: string, data: NewClient): Promise<void> {
  await setDoc(doc(db, CLIENTS, clientId), data);
}
```

- [ ] **Step 5: Verificar que compila**

```bash
npm run build
```

Esperado: build sem erro de TypeScript.

- [ ] **Step 6: Commit**

```bash
git add src/firebase.ts src/data/client-repo.ts .env.example .gitignore
git commit -m "feat: adiciona camada de acesso ao Firestore"
```

---

### Task 8: `data/history-archive.ts` — arquivamento no Firestore

Aplica o corte da Task 5 contra o banco. A ordem das escritas importa e está explicada no código.

**Files:**
- Create: `src/data/history-archive.ts`

**Interfaces:**
- Consumes: `splitHistoryForArchive` (Task 5); `weekKeyOf`, `todayKey` (Task 2); `saveClient` (Task 7).
- Produces: `archiveOldHistory(client): Promise<void>`

- [ ] **Step 1: Criar `src/data/history-archive.ts`**

```ts
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { splitHistoryForArchive } from "@/domain/archive";
import { todayKey, weekKeyOf } from "@/domain/week";
import { saveClient } from "./client-repo";
import type { Client, HistoryArchiveDoc } from "./schema";

const ARCHIVE = "historyArchive";

/** Roda no máximo uma vez por aluno por sessão. */
const archivedThisSession = new Set<string>();

/**
 * Move histórico antigo do documento do aluno para a subcoleção.
 *
 * A ordem é deliberada: grava o arquivo PRIMEIRO, limpa o array DEPOIS. Se a
 * segunda operação falhar, o pior caso é a entrada existir nos dois lugares —
 * duplicata, recuperável. A ordem inversa perderia histórico de treino de forma
 * irrecuperável. Na fase 1 a duplicata é inofensiva: quem lê histórico é
 * `buildLastDoneIndex`, que procura a entrada mais recente. A leitura que junta
 * arquivo e documento, com a reconciliação por setId+dateKey, nasce na fase 2
 * junto com a tela de progressão.
 */
export async function archiveOldHistory(client: Client): Promise<void> {
  if (archivedThisSession.has(client.id)) return;
  archivedThisSession.add(client.id);

  const history = client.history ?? [];
  if (!history.length) return;

  const { keep, archive } = splitHistoryForArchive(history, weekKeyOf(todayKey()));
  if (!archive.size) return;

  try {
    for (const [weekKey, entries] of archive) {
      const payload: HistoryArchiveDoc = { weekKey, entries };
      await setDoc(doc(db, "clients", client.id, ARCHIVE, weekKey), payload);
    }
    await saveClient(client.id, { history: keep });
  } catch {
    // libera para tentar de novo na próxima sessão; nada foi perdido
    archivedThisSession.delete(client.id);
  }
}
```

A leitura do arquivo não entra aqui: na fase 1 nada lê histórico arquivado, e
escrever um leitor sem consumidor seria código não exercitado. Ele nasce na fase
2, junto com a tela de progressão que o usa.

- [ ] **Step 2: Verificar que compila**

```bash
npm run build
```

Esperado: build sem erro.

- [ ] **Step 3: Commit**

```bash
git add src/data/history-archive.ts
git commit -m "feat: arquiva histórico antigo em subcoleção"
```

---

### Task 9: `firestore.rules` — regras corrigidas

As duas correções de segurança do lado do servidor. Esta tarefa **não** faz deploy; ela prepara o arquivo e o comando.

**Files:**
- Create: `firestore.rules`, `firebase.json`, `.firebaserc`

**Interfaces:**
- Consumes: `STUDENT_WRITABLE_FIELDS` (Task 3) — a lista aqui precisa ser idêntica.
- Produces: regras prontas para `firebase deploy --only firestore:rules`.

- [ ] **Step 1: Criar `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isTrainer() {
      return request.auth != null
             && request.auth.token.email == "fermmura@gmail.com";
    }

    function isOwner(clientId) {
      return request.auth != null && request.auth.uid == clientId;
    }

    match /clients/{clientId} {
      allow read, write: if isTrainer();

      // `read` são DUAS operações: `get` (um documento) e `list` (consulta na
      // coleção). Elas precisam de regras diferentes porque os dois apps leem
      // de formas diferentes, e regra de consulta é avaliada contra as
      // RESTRIÇÕES DA CONSULTA, não contra os documentos devolvidos.
      //
      // O 2.0 lê por id: doc(db, "clients", uid) — satisfeito pelo UID.
      // O 1.0 lê por consulta: collection("clients").where("email","==",...)
      // (app.js:103-106). Numa consulta o `clientId` do caminho não está
      // vinculado a nada, então uma regra por UID é INSATISFAZÍVEL e derruba
      // todo aluno do 1.0. A regra de `list` continua atrelada ao campo email,
      // que é exatamente o que a consulta restringe — e exatamente o que as
      // regras de produção já concedem hoje, sem afrouxar nada.
      allow get:  if isOwner(clientId);
      allow list: if request.auth != null
                  && request.auth.token.email == resource.data.email;

      // Lista explícita do que o aluno pode alterar; o resto fica negado por
      // padrão. activeWeekKey e weekPlans entram porque a promoção de semana
      // roda no aparelho do aluno. name, email, goal e createdAt ficam de fora.
      // `password` não está na lista e não é mais escrito por nenhum app.
      allow update: if isOwner(clientId)
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['days','history','cardio','feedback',
                       'workoutSessions','lastSeen','activeWeekKey','weekPlans']);

      // O 1.0 fazia get() do documento do aluno aqui, o que gera uma leitura
      // cobrada extra por foto exibida. Como o documento é indexado pelo UID
      // do Auth, comparar com o caminho dá o mesmo resultado sem custo.
      match /photos/{exId} {
        allow read: if isTrainer() || isOwner(clientId);
        allow write: if isTrainer();
      }

      // Arquivo de histórico: o aluno escreve na própria porque o
      // arquivamento roda no aparelho dele.
      match /historyArchive/{weekKey} {
        allow read, write: if isTrainer() || isOwner(clientId);
      }
    }

    match /settings/{doc} {
      allow read: if request.auth != null;
      allow write: if isTrainer();
    }
  }
}
```

- [ ] **Step 2: Criar `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

- [ ] **Step 3: Criar `.firebaserc`**

```json
{
  "projects": {
    "default": "muratraining-7af9b"
  }
}
```

- [ ] **Step 4: Conferir a diferença contra as regras do 1.0**

```bash
diff /c/dev/MuraTraining/firestore.rules firestore.rules
```

Confirmar que as mudanças são exatamente: `isOwner` por UID, lista de campos no update, `/settings` exigindo login, `historyArchive` adicionada, `photos` sem `get()`.

- [ ] **Step 5: NÃO fazer deploy ainda**

O deploy destas regras afeta o 1.0 em produção na hora. Ele acontece na Task 15, depois da verificação manual. Deixar o arquivo pronto e commitado.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firebase.json .firebaserc
git commit -m "feat: corrige regras do Firestore com lista explícita de campos"
```

---

### Task 10: `auth/` — sessão, login e convite

A correção da falha crítica nº 1. Nenhuma senha é exibida, registrada ou armazenada em ponto algum.

**Files:**
- Create: `src/auth/session.ts`, `src/auth/invite.ts`, `src/auth/errors.ts`, `src/auth/errors.test.ts`

**Interfaces:**
- Consumes: `auth`, `firebaseConfig`, `TRAINER_EMAIL` (Task 7); `uid` (Task 3).
- Produces:
  - `watchSession(onChange: (s: Session | null) => void): () => void` com `Session = { uid: string; email: string; isTrainer: boolean }`
  - `signIn(email, password): Promise<void>`, `signOutNow(): Promise<void>`
  - `sendPasswordSetup(email): Promise<void>`
  - `createStudentAccount(email): Promise<string>` — devolve o UID
  - `translateAuthError(code: string): string`

- [ ] **Step 1: Escrever o teste de tradução de erro**

```ts
// src/auth/errors.test.ts
import { describe, it, expect } from "vitest";
import { translateAuthError } from "./errors";

describe("translateAuthError", () => {
  it("não distingue email inexistente de senha errada", () => {
    // distinguir permitiria descobrir quais emails têm conta
    const a = translateAuthError("auth/user-not-found");
    const b = translateAuthError("auth/wrong-password");
    expect(a).toBe(b);
  });

  it("traduz email inválido", () => {
    expect(translateAuthError("auth/invalid-email")).toBe("Email inválido");
  });

  it("traduz excesso de tentativas", () => {
    expect(translateAuthError("auth/too-many-requests")).toMatch(/tentativas/i);
  });

  it("traduz email já cadastrado", () => {
    expect(translateAuthError("auth/email-already-in-use")).toMatch(/já tem uma conta/i);
  });

  it("devolve mensagem genérica para código desconhecido", () => {
    expect(translateAuthError("auth/coisa-nova")).toBe("Não foi possível completar. Tente de novo.");
  });

  it("nunca vaza o código bruto ao usuário", () => {
    expect(translateAuthError("auth/internal-error-xyz")).not.toContain("auth/");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm test -- src/auth/errors.test.ts
```

Esperado: FAIL, `Failed to resolve import "./errors"`.

- [ ] **Step 3: Implementar `src/auth/errors.ts`**

```ts
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
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, 48 testes.

- [ ] **Step 5: Implementar `src/auth/session.ts`**

```ts
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
```

- [ ] **Step 6: Implementar `src/auth/invite.ts`**

```ts
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
```

- [ ] **Step 7: Verificar que compila e que nenhuma senha é persistida**

```bash
npm run build
grep -rn "localStorage\|sessionStorage" src/ || echo "OK: nenhum armazenamento local de credencial"
grep -rn "password" src/ | grep -v "\.test\.ts"
```

Esperado: build limpo; nenhum uso de `localStorage`; ocorrências de `password` apenas em `throwawayPassword`, no parâmetro de `signIn` e no descarte do campo antigo em `client-repo.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/auth/
git commit -m "feat: adiciona sessão e convite sem armazenar senha"
```

---

### Task 11: `ui/state.ts` — estado da aplicação

Um ponto de entrada único para mudança de estado, no lugar das quinze globais mutáveis do 1.0.

**Files:**
- Create: `src/ui/state.ts`, `src/ui/state.test.ts`

**Interfaces:**
- Consumes: `Client` (Task 3); `Session` (Task 10).
- Produces:
  - `getState(): AppState`
  - `setState(patch: Partial<AppState>): void`
  - `subscribe(fn: () => void): () => void`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/ui/state.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getState, setState, subscribe, resetState } from "./state";

beforeEach(() => resetState());

describe("state", () => {
  it("começa carregando", () => {
    expect(getState().view).toBe("loading");
  });

  it("aplica patch parcial sem apagar o resto", () => {
    setState({ selectedClientId: "c1" });
    setState({ view: "trainer" });
    expect(getState().selectedClientId).toBe("c1");
    expect(getState().view).toBe("trainer");
  });

  it("avisa os inscritos a cada mudança", () => {
    const fn = vi.fn();
    subscribe(fn);
    setState({ view: "student" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("para de avisar depois do unsubscribe", () => {
    const fn = vi.fn();
    subscribe(fn)();
    setState({ view: "student" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("não avisa quando nada mudou de valor", () => {
    setState({ view: "student" });
    const fn = vi.fn();
    subscribe(fn);
    setState({ view: "student" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("redesenha quando o colapso de exercício muda", () => {
    // um Set mutado no lugar não mudaria a referência e não redesenharia
    const fn = vi.fn();
    subscribe(fn);
    setState({ collapsedExercises: new Set(["e1"]) });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm test -- src/ui/state.test.ts
```

Esperado: FAIL, `Failed to resolve import "./state"`.

- [ ] **Step 3: Implementar `src/ui/state.ts`**

```ts
import type { Client } from "@/data/schema";
import type { Session } from "@/auth/session";

export type View = "loading" | "gate" | "trainer" | "student";

export interface AppState {
  view: View;
  session: Session | null;
  clients: Client[];
  client: Client | null;
  selectedClientId: string | null;
  activeDayId: string | null;
  /** Exercícios minimizados. Mora no estado, e não num Set solto, porque
      `setState` só redesenha quando alguma referência muda. */
  collapsedExercises: ReadonlySet<string>;
  error: string | null;
}

const INITIAL: AppState = {
  view: "loading",
  session: null,
  clients: [],
  client: null,
  selectedClientId: null,
  activeDayId: null,
  collapsedExercises: new Set<string>(),
  error: null,
};

let state: AppState = { ...INITIAL };
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  const changed = (Object.keys(patch) as (keyof AppState)[])
    .some((k) => patch[k] !== state[k]);
  if (!changed) return;
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Só para teste. */
export function resetState(): void {
  state = { ...INITIAL };
  listeners.clear();
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, 54 testes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/state.ts src/ui/state.test.ts
git commit -m "feat: adiciona estado central da aplicação"
```

---

### Task 12: Interface — estilos e componentes de treino

Os componentes que desenham o treino em si, mais os estilos. Eles não tocam em estado, dados nem rede: recebem o que desenhar e devolvem template. É isso que permite revisá-los isoladamente, e é a metade da interface que dá para cobrir com teste.

**Files:**
- Create: `src/ui/styles.css`, `src/ui/components/set-row.ts`, `src/ui/components/exercise.ts`, `src/ui/components/timer.ts`
- Test: `src/ui/components/timer.test.ts`
- Modify: `index.html`

**Interfaces:**
- Consumes: tipos de `src/data/schema.ts` (Task 3).
- Produces:
  - `setRow(s, index, editable, h): TemplateResult` e a interface `SetRowHandlers`
  - `exerciseCard(ex, collapsed, editable, h): TemplateResult` e a interface `ExerciseHandlers` (estende `SetRowHandlers`)
  - `timerButton(startedAt, onToggle): TemplateResult`
  - `isTimerRunning(startedAt?): boolean`, `formatElapsed(startedAt, now?): string`, `MAX_WORKOUT_MS`

- [ ] **Step 1: Copiar os estilos do 1.0**

Copiar o conteúdo da tag `<style>` de `/c/dev/MuraTraining/index.html` (linhas 16-236) para `src/ui/styles.css`, sem alterar valor nenhum. A identidade visual não muda nesta fase; mudança de design é decisão separada, registrada como fora de escopo na spec.

Trocar as duas linhas `@import` do topo por `<link>` no `index.html`, porque `@import` dentro de CSS bloqueia a renderização em cascata:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/3.46.0/tabler-icons.min.css" />
```

- [ ] **Step 2: Criar `src/ui/components/set-row.ts`**

O `live()` do lit-html é o detalhe que resolve o bug de foco: sem ele, o valor do input é comparado com o último render em vez do DOM real, e o campo é reescrito enquanto a pessoa digita.

```ts
import { html, type TemplateResult } from "lit-html";
import { live } from "lit-html/directives/live.js";
import type { ExerciseSet } from "@/data/schema";

export interface SetRowHandlers {
  onField: (setId: string, field: "repsGoal" | "repsDone" | "load", value: string) => void;
  onRemove: (setId: string) => void;
}

export function setRow(
  s: ExerciseSet,
  index: number,
  editable: boolean,
  h: SetRowHandlers,
): TemplateResult {
  const field = (f: "repsGoal" | "repsDone" | "load") => (e: Event) =>
    h.onField(s.id, f, (e.target as HTMLInputElement).value);

  return html`
    <div class="set-row">
      <span class="set-idx">${index + 1}</span>

      <div class="stack">
        <div class="box meta">
          <input .value=${live(s.repsGoal ?? "")} @change=${field("repsGoal")}
                 ?readonly=${!editable} inputmode="numeric" />
        </div>
        <span class="unit">meta</span>
      </div>

      <div class="stack">
        <div class="box">
          <input class=${s.repsDone ? "" : "ghost-ref"}
                 .value=${live(s.repsDone ?? "")}
                 placeholder=${s.prevReps ?? ""}
                 @change=${field("repsDone")} inputmode="numeric" />
        </div>
        <span class="unit">feito</span>
      </div>

      <div class="stack">
        <div class="box kg">
          <input .value=${live(s.load ?? "")} @change=${field("load")} inputmode="decimal" />
        </div>
        <span class="unit">kg</span>
      </div>

      ${editable
        ? html`<button class="rm-x" @click=${() => h.onRemove(s.id)} aria-label="Remover série">
            <i class="ti ti-x"></i>
          </button>`
        : null}
    </div>
  `;
}
```

- [ ] **Step 3: Criar `src/ui/components/exercise.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { setRow, type SetRowHandlers } from "./set-row";
import type { Exercise } from "@/data/schema";

export interface ExerciseHandlers extends SetRowHandlers {
  onRename: (exId: string, name: string) => void;
  onNotes: (exId: string, notes: string) => void;
  onAddSet: (exId: string) => void;
  onRemoveExercise: (exId: string) => void;
  onToggle: (exId: string) => void;
}

export function exerciseCard(
  ex: Exercise,
  collapsed: boolean,
  editable: boolean,
  h: ExerciseHandlers,
): TemplateResult {
  const scoped: SetRowHandlers = {
    onField: (setId, field, value) => h.onField(setId, field, value),
    onRemove: (setId) => h.onRemove(setId),
  };

  return html`
    <div class="ex-card">
      <div class="ex-top">
        <input class="ex-name" .value=${live(ex.name ?? "")}
               @change=${(e: Event) => h.onRename(ex.id, (e.target as HTMLInputElement).value)}
               ?readonly=${!editable} placeholder="Nome do exercício" />
        <button class="ex-toggle ${collapsed ? "collapsed" : ""}"
                @click=${() => h.onToggle(ex.id)} aria-label="Abrir ou fechar exercício">
          <i class="ti ti-chevron-down"></i>
        </button>
      </div>

      <div class="ex-body ${collapsed ? "hidden" : ""}">
        ${ex.notes || editable
          ? html`<div class="notes-box">
              <label>Observações</label>
              <textarea .value=${live(ex.notes ?? "")} ?readonly=${!editable}
                        @change=${(e: Event) => h.onNotes(ex.id, (e.target as HTMLTextAreaElement).value)}></textarea>
            </div>`
          : null}

        ${(ex.sets ?? []).map((s, i) => setRow(s, i, editable, scoped))}

        ${editable
          ? html`
              <button class="dashed-btn" @click=${() => h.onAddSet(ex.id)}>
                <i class="ti ti-plus"></i> série
              </button>
              <button class="dashed-btn" @click=${() => h.onRemoveExercise(ex.id)}>
                <i class="ti ti-trash"></i> exercício
              </button>`
          : null}
      </div>
    </div>
  `;
}
```

- [ ] **Step 4: Criar `src/ui/components/timer.ts`**

```ts
import { html, type TemplateResult } from "lit-html";

/** Um treino nunca dura mais que algumas horas; passado isso, tratamos como não iniciado. */
export const MAX_WORKOUT_MS = 6 * 60 * 60 * 1000;

export function isTimerRunning(startedAt?: number): boolean {
  if (!startedAt) return false;
  return Date.now() - startedAt < MAX_WORKOUT_MS;
}

export function formatElapsed(startedAt: number, now: number = Date.now()): string {
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function timerButton(
  startedAt: number | undefined,
  onToggle: () => void,
): TemplateResult {
  const running = isTimerRunning(startedAt);
  return html`
    <button class="dashed-btn" @click=${onToggle}>
      <i class="ti ${running ? "ti-player-stop" : "ti-player-play"}"></i>
      ${running && startedAt ? formatElapsed(startedAt) : "iniciar treino"}
    </button>
  `;
}
```

- [ ] **Step 5: Escrever o teste do cronômetro**

```ts
// src/ui/components/timer.test.ts
import { describe, it, expect } from "vitest";
import { isTimerRunning, formatElapsed, MAX_WORKOUT_MS } from "./timer";

describe("isTimerRunning", () => {
  it("está parado sem início", () => {
    expect(isTimerRunning(undefined)).toBe(false);
  });

  it("está rodando logo depois de iniciar", () => {
    expect(isTimerRunning(Date.now() - 60_000)).toBe(true);
  });

  it("trata cronômetro esquecido como parado", () => {
    expect(isTimerRunning(Date.now() - MAX_WORKOUT_MS - 1)).toBe(false);
  });
});

describe("formatElapsed", () => {
  it("mostra minutos e segundos abaixo de uma hora", () => {
    expect(formatElapsed(0, 5 * 60_000 + 7_000)).toBe("05:07");
  });

  it("inclui horas quando passa de uma hora", () => {
    expect(formatElapsed(0, 3_600_000 + 2 * 60_000 + 3_000)).toBe("1:02:03");
  });

  it("nunca mostra tempo negativo", () => {
    expect(formatElapsed(1000, 0)).toBe("00:00");
  });
});
```

- [ ] **Step 6: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, 6 testes novos de `timer.test.ts` somados aos já existentes.

- [ ] **Step 7: Commit**

```bash
git add src/ui/styles.css src/ui/components/ index.html
git commit -m "feat: adiciona estilos e componentes de treino com lit-html"
```

---

### Task 13: Interface — telas e ligação com os dados

A metade que liga tudo: as telas, o render raiz, os handlers que falam com o Firestore, e o `main.ts` que amarra sessão, dados e desenho. É aqui que se verifica no navegador o comportamento que motivou a troca de lit-html: digitar em um campo não pode mais tirar o foco dele.

**Files:**
- Create: `src/ui/render.ts`, `src/ui/handlers.ts`, `src/ui/views/gate.ts`, `src/ui/views/trainer.ts`, `src/ui/views/student.ts`, `src/ui/components/day.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: os componentes da Task 12; `getState`/`setState`/`subscribe` e `AppState` (Task 11); `saveClient`/`createClient`/`subscribeToClient`/`subscribeToAllClients` (Task 7); `watchSession`/`signIn`/`signOutNow`/`sendPasswordSetup`/`createStudentAccount`/`translateAuthError` (Task 10); `applySetFieldChange` (Task 4); `planPromotion` (Task 6); `archiveOldHistory` (Task 8); `uid` (Task 3).
- Produces: `renderApp(): void` em `src/ui/render.ts`; app funcionando de ponta a ponta.

- [ ] **Step 1: Criar `src/ui/views/gate.ts`**

```ts
import { html, type TemplateResult } from "lit-html";

export interface GateHandlers {
  onSubmit: (email: string, password: string) => void;
  onForgot: (email: string) => void;
}

export function gateView(error: string | null, h: GateHandlers): TemplateResult {
  const read = () => ({
    email: (document.getElementById("gate-email") as HTMLInputElement).value,
    password: (document.getElementById("gate-pass") as HTMLInputElement).value,
  });

  return html`
    <form class="gate" @submit=${(e: Event) => { e.preventDefault(); const v = read(); h.onSubmit(v.email, v.password); }}>
      <h1 class="display">Meu Treino</h1>
      <input id="gate-email" type="email" autocomplete="email" placeholder="Email" required />
      <input id="gate-pass" type="password" autocomplete="current-password" placeholder="Senha" required />
      ${error ? html`<div class="error">${error}</div>` : null}
      <button class="primary" type="submit">Entrar</button>
      <button type="button" class="switch" @click=${() => h.onForgot(read().email)}>
        Esqueci minha senha
      </button>
    </form>
  `;
}
```

- [ ] **Step 2: Criar `src/ui/views/trainer.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import type { Client } from "@/data/schema";

export interface TrainerHandlers {
  onSelect: (clientId: string) => void;
  onInvite: (name: string, email: string) => void;
  onResendSetup: (email: string) => void;
  onLogout: () => void;
}

export function trainerView(
  clients: Client[],
  selectedId: string | null,
  body: TemplateResult | null,
  h: TrainerHandlers,
): TemplateResult {
  return html`
    <div class="topbar">
      <span class="name display">Alunos</span>
      <button class="logout" @click=${h.onLogout}>Sair</button>
    </div>

    <div class="layout">
      <aside class="sidebar">
        ${clients.map(
          (c) => html`
            <div class="client-row ${c.id === selectedId ? "active" : ""}"
                 @click=${() => h.onSelect(c.id)}>
              <span class="cn">${c.name}</span>
              <span class="ce">${c.email}</span>
            </div>`,
        )}

        <form @submit=${(e: Event) => {
          e.preventDefault();
          const form = e.target as HTMLFormElement;
          const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
          const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
          if (name && email) { h.onInvite(name, email); form.reset(); }
        }}>
          <input name="name" placeholder="Nome do aluno" required />
          <input name="email" type="email" placeholder="Email do aluno" required />
          <button class="dashed-btn" type="submit"><i class="ti ti-plus"></i> convidar</button>
        </form>
        <p class="muted-note">
          O aluno recebe um email para criar a própria senha. Você não vê nem guarda a senha dele.
        </p>
      </aside>

      <main class="main">${body ?? html`<p class="muted-note">Escolha um aluno.</p>`}</main>
    </div>
  `;
}
```

- [ ] **Step 3: Criar `src/ui/views/student.ts` e `src/ui/components/day.ts`**

`day.ts`:

```ts
import { html, type TemplateResult } from "lit-html";
import { exerciseCard, type ExerciseHandlers } from "./exercise";
import { timerButton } from "./timer";
import type { Day } from "@/data/schema";

export interface DayHandlers extends ExerciseHandlers {
  onBack: () => void;
  onToggleTimer: (dayId: string) => void;
  onAddExercise: (dayId: string) => void;
}

export function dayView(
  day: Day,
  collapsed: ReadonlySet<string>,
  editable: boolean,
  h: DayHandlers,
): TemplateResult {
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">${day.title}</span>
      ${timerButton(day.timerStartedAt, () => h.onToggleTimer(day.id))}
    </div>

    ${(day.exercises ?? []).map((ex) => exerciseCard(ex, collapsed.has(ex.id), editable, h))}

    ${editable
      ? html`<button class="dashed-btn" @click=${() => h.onAddExercise(day.id)}>
          <i class="ti ti-plus"></i> exercício
        </button>`
      : null}
  `;
}
```

`student.ts`:

```ts
import { html, type TemplateResult } from "lit-html";
import type { Client } from "@/data/schema";

export interface StudentHandlers {
  onOpenDay: (dayId: string) => void;
  onLogout: () => void;
}

export function studentView(client: Client, h: StudentHandlers): TemplateResult {
  return html`
    <div class="topbar">
      <span class="name display">${client.name}</span>
      <button class="logout" @click=${h.onLogout}>Sair</button>
    </div>

    <div class="grid stacked">
      ${(client.days ?? []).map(
        (d) => html`
          <div class="sq" @click=${() => h.onOpenDay(d.id)}>
            <div>
              <div class="title display">${d.title}</div>
              <div class="count">${(d.exercises ?? []).length} exercícios</div>
            </div>
          </div>`,
      )}
    </div>
  `;
}
```

- [ ] **Step 4: Criar `src/ui/render.ts`**

```ts
import { render, html, nothing } from "lit-html";
import { getState, subscribe } from "./state";
import { gateView } from "./views/gate";
import { trainerView } from "./views/trainer";
import { studentView } from "./views/student";
import { dayView } from "./components/day";
import * as handlers from "./handlers";

const root = document.getElementById("app")!;

function template() {
  const s = getState();
  switch (s.view) {
    case "loading":
      return html`<p class="muted-note" style="text-align:center;padding-top:60px;">Carregando…</p>`;
    case "gate":
      return gateView(s.error, handlers.gate);
    case "trainer": {
      const client = s.clients.find((c) => c.id === s.selectedClientId) ?? null;
      const day = client?.days?.find((d) => d.id === s.activeDayId);
      const body = day
        ? dayView(day, s.collapsedExercises, true, handlers.day)
        : client
          ? handlers.clientSummary(client)
          : null;
      return trainerView(s.clients, s.selectedClientId, body, handlers.trainer);
    }
    case "student": {
      if (!s.client) return nothing;
      const day = s.client.days?.find((d) => d.id === s.activeDayId);
      // editable=false: o treinador prescreve a estrutura do treino; o aluno
      // registra. "feito" e "kg" continuam editáveis porque set-row não os
      // condiciona a `editable` — é exatamente essa a divisão de papéis.
      return day
        ? dayView(day, s.collapsedExercises, false, handlers.day)
        : studentView(s.client, handlers.student);
    }
  }
}

export function renderApp(): void {
  render(template(), root);
}

subscribe(renderApp);
```

- [ ] **Step 5: Criar `src/ui/handlers.ts`**

Este módulo liga a interface aos dados. Ele existe para que as views permaneçam sem dependência de Firebase.

```ts
import { html, type TemplateResult } from "lit-html";
import { getState, setState } from "./state";
import { saveClient, createClient, type NewClient } from "@/data/client-repo";
import { applySetFieldChange } from "@/domain/history";
import { todayKey, weekKeyOf } from "@/domain/week";
import { uid } from "@/data/id";
import { signIn, signOutNow, sendPasswordSetup } from "@/auth/session";
import { createStudentAccount } from "@/auth/invite";
import { translateAuthError } from "@/auth/errors";
import { isTimerRunning } from "./components/timer";
import type { Client, Day } from "@/data/schema";

/** O aluno em edição: o próprio, ou o selecionado quando quem está logado é o treinador. */
function current(): Client | null {
  const s = getState();
  return s.view === "student" ? s.client : s.clients.find((c) => c.id === s.selectedClientId) ?? null;
}

function mutateDays(fn: (days: Day[]) => Day[]): void {
  const c = current();
  if (!c) return;
  void saveClient(c.id, { days: fn(c.days ?? []) });
}

function code(e: unknown): string {
  return (e as { code?: string }).code ?? "";
}

export const gate = {
  onSubmit: async (email: string, password: string) => {
    setState({ error: null });
    try {
      await signIn(email, password);
    } catch (e) {
      setState({ error: translateAuthError(code(e)) });
    }
  },
  onForgot: async (email: string) => {
    if (!email) { setState({ error: "Digite seu email primeiro." }); return; }
    try {
      await sendPasswordSetup(email);
      setState({ error: "Enviamos um email para você criar uma senha nova." });
    } catch (e) {
      setState({ error: translateAuthError(code(e)) });
    }
  },
};

export const trainer = {
  onSelect: (clientId: string) => setState({ selectedClientId: clientId, activeDayId: null }),
  onLogout: () => void signOutNow(),
  onResendSetup: (email: string) => void sendPasswordSetup(email),
  onInvite: async (name: string, email: string) => {
    try {
      // a conta nasce primeiro: o id do documento é o UID do Auth
      const studentUid = await createStudentAccount(email);
      const novo: NewClient = {
        name, email: email.toLowerCase(), goal: "",
        createdAt: Date.now(), days: [], history: [], weekPlans: [],
        // Sem semear activeWeekKey o aluno nunca vira de semana: planPromotion
        // faz `activeKey = client.activeWeekKey ?? currentWeekKey`, e a guarda
        // `currentWeekKey <= activeKey` passa a ser sempre verdadeira. No 1.0 o
        // campo é semeado pelo calendário, que só chega na fase 2 — aqui ele
        // precisa nascer com a ficha.
        activeWeekKey: weekKeyOf(todayKey()),
      };
      await createClient(studentUid, novo);
    } catch (e) {
      setState({ error: translateAuthError(code(e)) });
    }
  },
};

export const student = {
  onOpenDay: (dayId: string) => setState({ activeDayId: dayId }),
  onLogout: () => void signOutNow(),
};

export const day = {
  onBack: () => setState({ activeDayId: null }),

  onToggle: (exId: string) => {
    // Set novo a cada vez: mutar o existente não mudaria a referência, e
    // setState só redesenha quando algum valor muda.
    const next = new Set(getState().collapsedExercises);
    if (!next.delete(exId)) next.add(exId);
    setState({ collapsedExercises: next });
  },

  onToggleTimer: (dayId: string) =>
    mutateDays((days) =>
      days.map((d) =>
        d.id === dayId
          ? { ...d, timerStartedAt: isTimerRunning(d.timerStartedAt) ? undefined : Date.now() }
          : d,
      ),
    ),

  onAddExercise: (dayId: string) =>
    mutateDays((days) =>
      days.map((d) =>
        d.id === dayId
          ? { ...d, exercises: [...(d.exercises ?? []), {
              id: uid(), name: "", notes: "",
              sets: [{ id: uid(), repsGoal: "10", repsDone: "", load: "", intensity: 0, rir: "", rirEnabled: false }],
            }] }
          : d,
      ),
    ),

  onRemoveExercise: (exId: string) =>
    mutateDays((days) =>
      days.map((d) => ({ ...d, exercises: (d.exercises ?? []).filter((e) => e.id !== exId) })),
    ),

  onRename: (exId: string, name: string) =>
    mutateDays((days) =>
      days.map((d) => ({
        ...d,
        exercises: (d.exercises ?? []).map((e) => (e.id === exId ? { ...e, name } : e)),
      })),
    ),

  onNotes: (exId: string, notes: string) =>
    mutateDays((days) =>
      days.map((d) => ({
        ...d,
        exercises: (d.exercises ?? []).map((e) => (e.id === exId ? { ...e, notes } : e)),
      })),
    ),

  onAddSet: (exId: string) =>
    mutateDays((days) =>
      days.map((d) => ({
        ...d,
        exercises: (d.exercises ?? []).map((e) =>
          e.id === exId
            ? { ...e, sets: [...(e.sets ?? []), {
                id: uid(), repsGoal: "10", repsDone: "", load: "", intensity: 0, rir: "", rirEnabled: false,
              }] }
            : e,
        ),
      })),
    ),

  onRemove: (setId: string) =>
    mutateDays((days) =>
      days.map((d) => ({
        ...d,
        exercises: (d.exercises ?? []).map((e) => ({
          ...e, sets: (e.sets ?? []).filter((s) => s.id !== setId),
        })),
      })),
    ),

  /** Reps e carga passam por applySetFieldChange porque também geram histórico. */
  onField: (setId: string, field: "repsGoal" | "repsDone" | "load", value: string) => {
    const c = current();
    const dayId = getState().activeDayId;
    if (!c || !dayId) return;
    const ex = c.days?.find((d) => d.id === dayId)?.exercises.find((e) => e.sets.some((s) => s.id === setId));
    if (!ex) return;
    const { days, history } = applySetFieldChange(c, dayId, ex.id, setId, field, value);
    void saveClient(c.id, field === "repsGoal" ? { days } : { days, history });
  },
};

export function clientSummary(client: Client): TemplateResult {
  return html`
    <div class="grid">
      ${(client.days ?? []).map(
        (d) => html`
          <div class="sq" @click=${() => setState({ activeDayId: d.id })}>
            <div class="title display">${d.title}</div>
            <div class="count">${(d.exercises ?? []).length} exercícios</div>
          </div>`,
      )}
      <div class="sq add" @click=${() => {
        void saveClient(client.id, {
          days: [...(client.days ?? []), { id: uid(), title: "Novo treino", exercises: [] }],
        });
      }}>
        <i class="ti ti-plus"></i>
      </div>
    </div>
  `;
}
```

- [ ] **Step 6: Reescrever `src/main.ts` para ligar tudo**

```ts
import "./ui/styles.css";
import { renderApp } from "./ui/render";
import { setState } from "./ui/state";
import { watchSession } from "./auth/session";
import { subscribeToAllClients, subscribeToClient, saveClient } from "./data/client-repo";
import { archiveOldHistory } from "./data/history-archive";
import { planPromotion } from "./domain/week-promotion";
import { todayKey, weekKeyOf } from "./domain/week";
import type { Client } from "./data/schema";

let unsubscribeData: (() => void) | null = null;

/**
 * Virada de semana e arquivamento rodam depois de ler o aluno, nunca durante
 * um salvamento.
 *
 * Só no aparelho do ALUNO, e não no do treinador: o treinador assina todos os
 * alunos de uma vez, e arquivar todos no carregamento dispararia uma rajada de
 * escritas. Cada aluno abre o próprio app com frequência muito maior do que a
 * necessária para manter o documento abaixo do limite.
 */
async function onClientLoaded(client: Client): Promise<void> {
  const promotion = planPromotion(client, weekKeyOf(todayKey()));
  if (promotion) await saveClient(client.id, promotion);
  await archiveOldHistory(client);
}

watchSession((session) => {
  unsubscribeData?.();
  unsubscribeData = null;

  if (!session) {
    setState({ view: "gate", session: null, client: null, clients: [], activeDayId: null });
    return;
  }

  setState({ session, error: null });

  if (session.isTrainer) {
    unsubscribeData = subscribeToAllClients(
      (clients) => setState({ view: "trainer", clients }),
      (e) => setState({ error: e.message }),
    );
    return;
  }

  unsubscribeData = subscribeToClient(
    session.uid,
    (client) => {
      // `null` = a conta existe no Auth mas não há ficha. Acontece se a criação
      // da ficha falhar depois da conta ter sido criada. Sem tratar isso, o
      // aluno fica em "Carregando…" para sempre, sem erro e sem diagnóstico.
      if (!client) {
        setState({
          view: "gate",
          client: null,
          error: "Sua conta existe mas a ficha ainda não foi criada. Fale com seu personal.",
        });
        return;
      }
      setState({ view: "student", client, error: null });
      void onClientLoaded(client);
    },
    (e) => setState({ error: e.message }),
  );
});

renderApp();
```

- [ ] **Step 7: Rodar o app e verificar o bug de foco**

```bash
npm run dev
```

No navegador, logar como aluno, abrir um treino e digitar no campo "feito" **sem sair do campo**. Verificar:
1. O cursor permanece no campo enquanto o valor sincroniza.
2. Ao sair do campo, o valor persiste (recarregar a página confirma).
3. Abrir a mesma conta em outra aba: a mudança aparece, e digitar em uma aba não apaga o que está sendo digitado na outra.

Este é o comportamento que o 1.0 não conseguia entregar sem os helpers `commitFocusedField` e `isTypingInApp`.

- [ ] **Step 8: Rodar a suíte e o build**

```bash
npm test && npm run build
```

Esperado: suíte inteira passando, build limpo.

- [ ] **Step 9: Commit**

```bash
git add src/ui/ src/main.ts
git commit -m "feat: liga telas, estado e dados com lit-html"
```

---

### Task 14: PWA e deploy automático

Fecha o app como instalável e coloca no ar em paralelo ao 1.0.

**Files:**
- Create: `public/manifest.webmanifest`, `.github/workflows/deploy.yml`
- Copy: `public/icon-192.png`, `public/icon-512.png` (de `/c/dev/MuraTraining/`)
- Modify: `vite.config.ts`, `index.html`

**Interfaces:**
- Consumes: build da Task 1.
- Produces: `dist/` publicado no GitHub Pages a cada push na `main`.

- [ ] **Step 1: Copiar os ícones**

```bash
mkdir -p public
cp /c/dev/MuraTraining/icon-192.png /c/dev/MuraTraining/icon-512.png public/
```

- [ ] **Step 2: Adicionar `vite-plugin-pwa` ao `vite.config.ts`**

`registerType: "prompt"` é deliberado: `autoUpdate` recarrega a página sozinho, e recarregar no meio de uma série apaga o que o aluno estava digitando.

```ts
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  base: "./",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        id: "/muratraining2/",
        name: "Meu Treino",
        short_name: "Treino",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#17161A",
        theme_color: "#17161A",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,woff2}"],
        // O SDK do Firebase cuida do próprio cache offline; interceptar as
        // chamadas dele aqui atrapalharia a sincronização.
        navigateFallbackDenylist: [/^\/__/, /firestore\.googleapis\.com/],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Criar `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      # O build falha sozinho se algum secret estiver ausente ou vazio: a
      # verificação mora em vite.config.ts (Task 7), que cobre tanto este
      # workflow quanto o `npm run build` de quem roda na própria máquina.
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_TRAINER_EMAIL: ${{ secrets.VITE_TRAINER_EMAIL }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

O build roda os testes antes de publicar: uma quebra nas funções de semana não pode chegar em produção.

- [ ] **Step 4: Verificar o build de produção localmente**

```bash
npm run build && npm run preview
```

Abrir o endereço mostrado, confirmar no DevTools em Application > Manifest que o app é instalável, e em Service Workers que há um registrado.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts public/ .github/
git commit -m "feat: adiciona PWA e publicação automática no Pages"
```

---

### Task 15: Colocar no ar e verificar em produção

Última tarefa. Envolve ações que afetam produção, então cada passo é verificado antes do próximo.

**Files:** nenhum arquivo novo.

**Interfaces:**
- Consumes: tudo.
- Produces: 2.0 no ar em paralelo ao 1.0, com regras novas aplicadas.

- [ ] **Step 1: Criar o repositório e enviar**

```bash
git remote add origin https://github.com/fermmura/muratraining2.git
git push -u origin main
```

- [ ] **Step 2: Cadastrar os secrets no GitHub**

Em Settings > Secrets and variables > Actions, criar os sete secrets com os mesmos valores do `.env.local`.

- [ ] **Step 3: Ativar o Pages**

Em Settings > Pages, definir Source como "GitHub Actions". Rodar o workflow e confirmar que ele conclui.

- [ ] **Step 4: Autorizar o domínio no Firebase**

No Console do Firebase, em Authentication > Settings > Authorized domains, adicionar o domínio do Pages. Sem isso o login falha com `auth/unauthorized-domain`.

- [ ] **Step 5: Testar o 2.0 antes de tocar nas regras**

Com as regras antigas ainda valendo, abrir o 2.0 e verificar, usando a própria conta de treinador:
1. Login funciona.
2. A lista de alunos aparece com os dados reais.
3. Abrir um aluno mostra os treinos que já existem.
4. Editar uma série salva, e a mudança aparece no 1.0 aberto em outra aba.

Se qualquer item falhar, parar aqui: as regras novas não devem ser aplicadas sobre um app que ainda não lê corretamente.

- [ ] **Step 5b: Auditar os ids dos documentos ANTES de aplicar as regras**

A regra de `get` do aluno assume que o id do documento é o UID da conta no Firebase Auth.
O código do 1.0 sempre criou assim (`app.js:247` e `app.js:406`, ambos `doc(cred.user.uid)`),
mas as regras vão valer para dados escritos por toda versão histórica do app — e a leitura
do 1.0 (`app.js:108`, `snap.docs[0]`) tolera id arbitrário, então uma divergência nunca
apareceu.

Para cada documento em `clients`, confirmar no Console que o id aparece em
Authentication > Users. Um documento cujo id não seja o UID do dono deixa aquele aluno sem
`get`, sem `update` e sem leitura de foto no 2.0 — e o treinador continuaria enxergando
tudo, fazendo o defeito parecer específico daquele aluno e difícil de diagnosticar.

Se houver divergência, migrar antes do deploy: copiar para `doc(uid)` e apagar o antigo.
O `resetStudentLogin` do 1.0 (`app.js:399-411`) já tem exatamente essa forma e serve de
modelo.

- [ ] **Step 6: Aplicar as regras novas**

Este passo afeta o 1.0 em produção imediatamente.

```bash
npx firebase-tools deploy --only firestore:rules
```

- [ ] **Step 7: Verificar que o 1.0 continua funcionando**

Abrir o 1.0 com a conta de treinador e com uma conta de aluno. Confirmar que ambos ainda leem e salvam. As regras novas foram desenhadas para não quebrá-lo, mas isso precisa ser observado, não presumido.

**Uma mudança visível esperada, que não é defeito.** O 1.0 carrega o tema publicado em
`app.js:55`, no carregamento do módulo — ou seja, antes de qualquer login. Com `/settings`
passando a exigir autenticação, essa leitura é negada enquanto ninguém está logado, e o
`try/catch` de `app.js:51` cai no tema padrão. Efeito: **a tela de login do 1.0 passa a
aparecer com as cores padrão** em vez das personalizadas. Depois do login tudo volta ao
normal. Se as cores nunca foram personalizadas, não há diferença nenhuma.

Isso é o preço de fechar uma leitura pública sem autenticação, e vale a pena: `allow read:
if true` valeria para qualquer documento que viesse a existir em `/settings`, não só o tema.
A forma certa de ter login personalizado no 2.0 é embutir o tema no build, não reabrir o
banco — decisão da fase 4, quando a personalização de tema chegar.

Se o aluno não conseguir salvar, reverter na hora:

```bash
cd /c/dev/MuraTraining && npx firebase-tools deploy --only firestore:rules
```

- [ ] **Step 8: Testar o convite de aluno de ponta a ponta**

No 2.0, convidar um aluno usando um email seu de teste. Verificar:
1. O email de definição de senha chega.
2. O link permite criar a senha.
3. O login com a senha nova funciona.
4. O aluno vê a própria ficha e só a dela.
5. No documento criado no Firestore, **não existe campo `password`**.

- [ ] **Step 9: Verificar o arquivamento de histórico**

Abrir a ficha do aluno mais antigo pelo 2.0. No Console do Firestore, confirmar que a subcoleção `historyArchive` foi criada e que o array `history` do documento encolheu.

- [ ] **Step 10: Commit da documentação de status**

```bash
git commit --allow-empty -m "chore: fase 1 no ar em paralelo ao 1.0"
git push
```

---

## Verificação da fase

A fase 1 está pronta quando tudo abaixo for verdade:

- [ ] `npm test` passa com 60 testes.
- [ ] `npm run build` passa sem erro de TypeScript.
- [ ] `grep -rn "localStorage\|sessionStorage" src/` não retorna nada.
- [ ] Nenhum documento novo em `clients/` tem campo `password`.
- [ ] Digitar no campo "feito" não tira o foco do campo.
- [ ] O 1.0 continua funcionando para treinador e aluno depois das regras novas.
- [ ] Um aluno convidado pelo 2.0 consegue definir senha e entrar.
- [ ] A subcoleção `historyArchive` é criada para alunos com histórico antigo.

## O que fica para as fases seguintes

Registrado aqui para não ser confundido com lacuna do plano: progressão com tabelas e gráficos, calendário de semanas, semanas passadas, planejamento de semana futura, cardio, volume por grupo muscular, feedbacks e WhatsApp, fotos de exercício, importação de treino por texto, personalização de cores e fontes, página de dados com backup e exportação Excel, e banner de instalação. Cada uma ganha seu próprio design e plano.
