# MuraTraining 2.0 — Fase 2 (progressão e calendário) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar progressão (tabela de evolução e gráfico de constância), calendário de semanas, leitura de semana passada e planejamento de semana futura — lendo pela primeira vez o histórico arquivado que a fase 1 criou.

**Architecture:** Todo cálculo novo entra em `src/domain/` como função pura, testada com Vitest. A leitura do arquivo entra em `src/data/history-archive.ts`, que hoje só escreve. A interface reaproveita os componentes de treino da fase 1; a novidade é o **alvo de edição** no estado, que decide se uma alteração vai para o treino atual ou para um plano de semana futura. `src/ui/handlers.ts` se divide por assunto porque esta fase o levaria muito além do limite de tamanho.

**Tech Stack:** Vite 5, TypeScript 5, lit-html 3, Firebase JS SDK 10 (modular), Vitest 2. Nenhuma dependência nova — o gráfico é SVG escrito à mão.

**Spec:** `docs/superpowers/specs/2026-09-22-fase-2-progressao-calendario-design.md`

## Global Constraints

Valem para **todas** as tarefas. São as mesmas da fase 1, que continuam valendo porque o 1.0 continua em produção.

- **Compatibilidade de schema é obrigatória.** Nunca renomeie, remova ou mude o tipo de um campo de `src/data/schema.ts`. Só é permitido **adicionar**.
- **O campo `password` nunca é escrito**, nem lido, nem exibido.
- **Nunca grave senha em `localStorage`, `sessionStorage`, IndexedDB ou Firestore.**
- **`weekKey` é a data local da segunda-feira, formato `YYYY-MM-DD`.** Não é semana ISO.
- **Datas são sempre dia-calendário local, nunca UTC.** Não use `toISOString()` para derivar `dateKey` ou `weekKey`.
- **Plano Spark.** Sem Cloud Functions, sem Admin SDK.
- **Projeto Firebase:** `muratraining-7af9b` (o mesmo do 1.0).
- **Esta fase não altera `firestore.rules`.** As regras da fase 1 já permitem que dono e treinador leiam `historyArchive`. Se alguma tarefa parecer exigir regra nova, pare e escale.
- **Nenhuma dependência nova** em `package.json`.
- Comentários e textos de interface em português. Identificadores de código em inglês.
- **Nenhum arquivo passa de ~250 linhas.** Se passar, divida por assunto.

## O que já existe da fase 1

Assinaturas que as tarefas abaixo consomem sem redefinir:

```ts
// src/domain/week.ts
localDateKey(d: Date): string
todayKey(): string
weekKeyOf(dateKey: string): string
addWeeks(weekKey: string, count: number): string

// src/domain/history.ts
applySetFieldChange(client, dayId, exId, setId, field, value): { days: Day[]; history: HistoryEntry[] }
buildLastDoneIndex(history: HistoryEntry[], beforeWeekKey?: string): Map<string, HistoryEntry>

// src/domain/week-promotion.ts
cloneDaysWithNewIds(days: Day[], opts?: { carryGhost?: boolean }): Day[]
planPromotion(client, currentWeekKey): { days; activeWeekKey; weekPlans } | null

// src/data/id.ts        uid(): string
// src/data/client-repo.ts  saveClient(id, patch): Promise<void>
// src/ui/state.ts       getState(), setState(patch), subscribe(fn), resetState()
```

---

### Task 1: `domain/week.ts` — rótulos de semana

Formatação de data é onde nascem erros de fuso. Fica em `domain/`, com teste, e não espalhada pela interface.

**Files:**
- Modify: `src/domain/week.ts`
- Modify: `src/domain/week.test.ts`

**Interfaces:**
- Consumes: `addWeeks` (fase 1).
- Produces:
  - `weekLabel(weekKey: string): string` — `"14/set"`
  - `weekRangeLabel(weekKey: string): string` — `"14/set a 20/set"`

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao final de `src/domain/week.test.ts`, e incluir `weekLabel, weekRangeLabel` no `import` existente do topo do arquivo:

```ts
describe("weekLabel", () => {
  it("formata dia e mês abreviado em português", () => {
    expect(weekLabel("2026-09-14")).toBe("14/set");
  });

  it("mantém o zero à esquerda no dia", () => {
    expect(weekLabel("2026-10-05")).toBe("05/out");
  });

  it("usa o dia local, não o UTC", () => {
    // sem o T00:00:00 local, 01/01 vira 31/12 do ano anterior no fuso do Brasil
    expect(weekLabel("2027-01-01")).toBe("01/jan");
  });
});

describe("weekRangeLabel", () => {
  it("vai da segunda ao domingo da mesma semana", () => {
    expect(weekRangeLabel("2026-09-14")).toBe("14/set a 20/set");
  });

  it("atravessa virada de mês", () => {
    expect(weekRangeLabel("2026-09-28")).toBe("28/set a 04/out");
  });

  it("atravessa virada de ano", () => {
    expect(weekRangeLabel("2026-12-28")).toBe("28/dez a 03/jan");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm test -- src/domain/week.test.ts
```

Esperado: FAIL, `weekLabel is not a function` ou erro de importação.

- [ ] **Step 3: Implementar em `src/domain/week.ts`**

Acrescentar ao final do arquivo:

```ts
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "14/set". O `T00:00:00` força interpretação local; sem ele a data vira UTC. */
export function weekLabel(weekKey: string): string {
  const d = new Date(weekKey + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${MONTHS[d.getMonth()]}`;
}

/** "14/set a 20/set": da segunda ao domingo daquela semana. */
export function weekRangeLabel(weekKey: string): string {
  const end = new Date(weekKey + "T00:00:00");
  end.setDate(end.getDate() + 6);
  return `${weekLabel(weekKey)} a ${weekLabel(localDateKey(end))}`;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, toda a suíte, incluindo os 6 testes novos.

- [ ] **Step 5: Commit**

```bash
git add src/domain/week.ts src/domain/week.test.ts
git commit -m "feat: adiciona rótulos de semana"
```

---

### Task 2: `domain/history-merge.ts` — juntar ficha e arquivo

A fase 1 gravou o arquivo primeiro e limpou o array depois, aceitando de propósito o risco de uma entrada existir nos dois lugares. Esta é a função que impede a duplicata de aparecer na tela.

**Files:**
- Create: `src/domain/history-merge.ts`, `src/domain/history-merge.test.ts`

**Interfaces:**
- Consumes: `HistoryEntry` (fase 1).
- Produces: `mergeHistory(fromDoc: HistoryEntry[], fromArchive: HistoryEntry[]): HistoryEntry[]`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/domain/history-merge.test.ts
import { describe, it, expect } from "vitest";
import { mergeHistory } from "./history-merge";
import type { HistoryEntry } from "@/data/schema";

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    dateKey: "2026-09-15", weekKey: "2026-09-14", dayId: "d1", dayTitle: "Peito",
    exId: "e1", exName: "Supino", setId: "s1", setIndex: 0,
    repsGoal: "10", repsDone: "9", load: "30", ...over,
  };
}

describe("mergeHistory", () => {
  it("junta as duas origens", () => {
    const a = entry({ setId: "s1", dateKey: "2026-09-15" });
    const b = entry({ setId: "s2", dateKey: "2020-01-06", weekKey: "2020-01-06" });
    expect(mergeHistory([a], [b])).toHaveLength(2);
  });

  it("remove duplicata da mesma série no mesmo dia", () => {
    const a = entry({ load: "35" });
    const b = entry({ load: "30" });
    const r = mergeHistory([a], [b]);
    expect(r).toHaveLength(1);
  });

  it("na duplicata, o documento vence o arquivo", () => {
    // o documento é o que os dois apps escrevem hoje; o arquivo é cópia de ontem
    const doDocumento = entry({ load: "35" });
    const doArquivo = entry({ load: "30" });
    expect(mergeHistory([doDocumento], [doArquivo])[0].load).toBe("35");
  });

  it("mantém a mesma série em dias diferentes", () => {
    const a = entry({ dateKey: "2026-09-15" });
    const b = entry({ dateKey: "2026-09-17" });
    expect(mergeHistory([a], [b])).toHaveLength(2);
  });

  it("devolve em ordem crescente de data", () => {
    const antiga = entry({ setId: "s9", dateKey: "2020-01-06", weekKey: "2020-01-06" });
    const nova = entry({ setId: "s1", dateKey: "2026-09-15" });
    expect(mergeHistory([nova], [antiga]).map((h) => h.dateKey)).toEqual(["2020-01-06", "2026-09-15"]);
  });

  it("aceita arquivo vazio", () => {
    expect(mergeHistory([entry()], [])).toHaveLength(1);
  });

  it("aceita documento vazio", () => {
    expect(mergeHistory([], [entry()])).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm test -- src/domain/history-merge.test.ts
```

Esperado: FAIL, `Failed to resolve import "./history-merge"`.

- [ ] **Step 3: Implementar `src/domain/history-merge.ts`**

```ts
import type { HistoryEntry } from "@/data/schema";

/**
 * Junta o histórico que está no documento do aluno com o que veio da subcoleção
 * historyArchive.
 *
 * A fase 1 arquiva gravando o documento de arquivo ANTES de limpar o array, de
 * propósito: se a segunda operação falhar, a entrada existe nos dois lugares —
 * duplicata, recuperável — em vez de sumir. Aqui essa duplicata é desfeita.
 *
 * A chave é `setId` + `dateKey`, e não o objeto inteiro: a mesma série no mesmo
 * dia é o mesmo registro mesmo que a carga tenha sido corrigida entre a cópia
 * arquivada e a atual. O documento vence porque é o que os dois apps escrevem.
 */
export function mergeHistory(
  fromDoc: HistoryEntry[],
  fromArchive: HistoryEntry[],
): HistoryEntry[] {
  const byKey = new Map<string, HistoryEntry>();
  for (const h of fromArchive) byKey.set(`${h.setId}|${h.dateKey}`, h);
  for (const h of fromDoc) byKey.set(`${h.setId}|${h.dateKey}`, h);
  return [...byKey.values()].sort((a, b) => (a.dateKey ?? "").localeCompare(b.dateKey ?? ""));
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, com os 7 testes novos.

- [ ] **Step 5: Commit**

```bash
git add src/domain/history-merge.ts src/domain/history-merge.test.ts
git commit -m "feat: junta histórico da ficha com o arquivado sem duplicar"
```

---

### Task 3: `domain/progression.ts` — as linhas e as barras

O núcleo da fase. Corrige o defeito que motivou o redesenho: o 1.0 agrupa por `setId`, que muda toda virada de semana, e por isso nunca mostrou evolução.

**Files:**
- Create: `src/domain/progression.ts`, `src/domain/progression.test.ts`

**Interfaces:**
- Consumes: `HistoryEntry` (fase 1).
- Produces:
  - `interface ProgressionCell { dateKey: string; repsGoal: string; repsDone: string; load: string }`
  - `interface ProgressionRow { key: string; exName: string; setIndex: number; dayTitle: string; byWeek: Map<string, ProgressionCell> }`
  - `buildProgressionRows(history: HistoryEntry[]): ProgressionRow[]`
  - `progressionWeekKeys(history: HistoryEntry[]): string[]`
  - `weeklySetCounts(history: HistoryEntry[]): { weekKey: string; count: number }[]`
  - `type Trend = "up" | "down" | "flat" | "none"`
  - `trendOf(prev: ProgressionCell | null, cur: ProgressionCell): Trend`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/domain/progression.test.ts
import { describe, it, expect } from "vitest";
import {
  buildProgressionRows, progressionWeekKeys, weeklySetCounts, trendOf,
} from "./progression";
import type { HistoryEntry } from "@/data/schema";

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    dateKey: "2026-09-15", weekKey: "2026-09-14", dayId: "d1", dayTitle: "Peito",
    exId: "e1", exName: "Supino", setId: "s1", setIndex: 0,
    repsGoal: "10", repsDone: "9", load: "30", ...over,
  };
}

describe("buildProgressionRows", () => {
  it("agrupa a mesma série de semanas diferentes numa linha só", () => {
    // o defeito do 1.0: a virada de semana troca todos os setId, e agrupar por
    // setId quebrava cada série em uma linha por semana
    const rows = buildProgressionRows([
      entry({ weekKey: "2026-09-07", dateKey: "2026-09-08", setId: "antigo", load: "30" }),
      entry({ weekKey: "2026-09-14", dateKey: "2026-09-15", setId: "novo", load: "35" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].byWeek.get("2026-09-07")?.load).toBe("30");
    expect(rows[0].byWeek.get("2026-09-14")?.load).toBe("35");
  });

  it("separa índices de série diferentes do mesmo exercício", () => {
    const rows = buildProgressionRows([entry({ setIndex: 0 }), entry({ setIndex: 1, setId: "s2" })]);
    expect(rows).toHaveLength(2);
  });

  it("separa exercícios diferentes", () => {
    const rows = buildProgressionRows([entry(), entry({ exName: "Remada", setId: "s2" })]);
    expect(rows).toHaveLength(2);
  });

  it("rotula com nome do exercício e posição da série", () => {
    const [row] = buildProgressionRows([entry({ setIndex: 2 })]);
    expect(row.exName).toBe("Supino");
    expect(row.setIndex).toBe(2);
    expect(row.dayTitle).toBe("Peito");
  });

  it("na mesma semana, vence o registro de data mais recente", () => {
    const rows = buildProgressionRows([
      entry({ dateKey: "2026-09-15", load: "30" }),
      entry({ dateKey: "2026-09-17", load: "40" }),
    ]);
    expect(rows[0].byWeek.get("2026-09-14")?.load).toBe("40");
  });

  it("ignora entrada sem nome de exercício", () => {
    expect(buildProgressionRows([entry({ exName: "" })])).toHaveLength(0);
  });

  it("ignora entrada sem semana", () => {
    expect(buildProgressionRows([entry({ weekKey: "" })])).toHaveLength(0);
  });

  it("ordena por dia, exercício e índice de série", () => {
    const rows = buildProgressionRows([
      entry({ dayTitle: "Costas", exName: "Remada", setIndex: 1, setId: "a" }),
      entry({ dayTitle: "Costas", exName: "Remada", setIndex: 0, setId: "b" }),
      entry({ dayTitle: "Peito", exName: "Supino", setIndex: 0, setId: "c" }),
    ]);
    expect(rows.map((r) => `${r.dayTitle}|${r.exName}|${r.setIndex}`)).toEqual([
      "Costas|Remada|0", "Costas|Remada|1", "Peito|Supino|0",
    ]);
  });

  it("devolve lista vazia sem histórico", () => {
    expect(buildProgressionRows([])).toEqual([]);
  });
});

describe("progressionWeekKeys", () => {
  it("devolve as semanas sem repetir, da mais antiga para a mais nova", () => {
    const weeks = progressionWeekKeys([
      entry({ weekKey: "2026-09-14" }),
      entry({ weekKey: "2026-09-07", setId: "s2" }),
      entry({ weekKey: "2026-09-14", setId: "s3" }),
    ]);
    expect(weeks).toEqual(["2026-09-07", "2026-09-14"]);
  });

  it("ignora entrada sem semana", () => {
    expect(progressionWeekKeys([entry({ weekKey: "" })])).toEqual([]);
  });
});

describe("weeklySetCounts", () => {
  it("conta uma série feita por semana", () => {
    expect(weeklySetCounts([entry()])).toEqual([{ weekKey: "2026-09-14", count: 1 }]);
  });

  it("não conta série sem 'feito' preenchido", () => {
    // o treinador prescreveu carga, o aluno não treinou: não é série feita
    expect(weeklySetCounts([entry({ repsDone: "", load: "30" })])).toEqual([]);
  });

  it("conta a mesma série uma vez só por semana", () => {
    const r = weeklySetCounts([
      entry({ dateKey: "2026-09-15" }),
      entry({ dateKey: "2026-09-17" }),
    ]);
    expect(r).toEqual([{ weekKey: "2026-09-14", count: 1 }]);
  });

  it("separa as semanas e devolve em ordem", () => {
    const r = weeklySetCounts([
      entry({ weekKey: "2026-09-14", setId: "s1" }),
      entry({ weekKey: "2026-09-07", setId: "s2" }),
    ]);
    expect(r).toEqual([
      { weekKey: "2026-09-07", count: 1 },
      { weekKey: "2026-09-14", count: 1 },
    ]);
  });
});

describe("trendOf", () => {
  const cell = (load: string, repsDone = "9") =>
    ({ dateKey: "2026-09-15", repsGoal: "10", repsDone, load });

  it("sobe quando a carga aumenta", () => {
    expect(trendOf(cell("30"), cell("35"))).toBe("up");
  });

  it("desce quando a carga diminui", () => {
    expect(trendOf(cell("35"), cell("30"))).toBe("down");
  });

  it("fica igual quando a carga não muda", () => {
    expect(trendOf(cell("30"), cell("30"))).toBe("flat");
  });

  it("aceita vírgula como separador decimal", () => {
    expect(trendOf(cell("32,5"), cell("35"))).toBe("up");
  });

  it("compara reps quando não há carga nas duas", () => {
    expect(trendOf(cell("", "8"), cell("", "10"))).toBe("up");
  });

  it("não compara quando não há anterior", () => {
    expect(trendOf(null, cell("30"))).toBe("none");
  });

  it("não compara quando o valor não é número", () => {
    expect(trendOf(cell("meia série"), cell("30"))).toBe("none");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm test -- src/domain/progression.test.ts
```

Esperado: FAIL, `Failed to resolve import "./progression"`.

- [ ] **Step 3: Implementar `src/domain/progression.ts`**

```ts
import type { HistoryEntry } from "@/data/schema";

export interface ProgressionCell {
  dateKey: string;
  repsGoal: string;
  repsDone: string;
  load: string;
}

export interface ProgressionRow {
  /** `nome|índice` — a chave de agrupamento, estável entre semanas. */
  key: string;
  exName: string;
  setIndex: number;
  dayTitle: string;
  byWeek: Map<string, ProgressionCell>;
}

/**
 * Uma linha por exercício e posição de série, com uma coluna por semana.
 *
 * O 1.0 agrupava por `setId` (app.js:2707). Como a virada de semana gera ids
 * novos para dia, exercício e série (app.js:278-303), cada semana produzia uma
 * linha nova com um valor só — a tela prometia comparar semanas e mostrava uma
 * diagonal de valores soltos. Agrupar por `nome|índice` é a mesma chave que
 * `buildLastDoneIndex` usa desde a fase 1, justamente por sobreviver à troca
 * de ids.
 *
 * O preço, aceito no design: renomear um exercício cria uma linha nova e deixa
 * o histórico antigo na linha do nome antigo.
 */
export function buildProgressionRows(history: HistoryEntry[]): ProgressionRow[] {
  const rows = new Map<string, ProgressionRow>();

  for (const h of history) {
    if (!h.exName || !h.weekKey) continue;
    const key = `${h.exName}|${h.setIndex}`;
    let row = rows.get(key);
    if (!row) {
      row = { key, exName: h.exName, setIndex: h.setIndex, dayTitle: h.dayTitle ?? "", byWeek: new Map() };
      rows.set(key, row);
    }
    const atual = row.byWeek.get(h.weekKey);
    // treinou duas vezes na semana, ou corrigiu o número: vale o mais recente
    if (!atual || (h.dateKey ?? "") >= atual.dateKey) {
      row.byWeek.set(h.weekKey, {
        dateKey: h.dateKey ?? "",
        repsGoal: h.repsGoal ?? "",
        repsDone: h.repsDone ?? "",
        load: h.load ?? "",
      });
    }
  }

  return [...rows.values()].sort(
    (a, b) =>
      a.dayTitle.localeCompare(b.dayTitle) ||
      a.exName.localeCompare(b.exName) ||
      a.setIndex - b.setIndex,
  );
}

/** As semanas com registro, da mais antiga para a mais nova. São as colunas da tabela. */
export function progressionWeekKeys(history: HistoryEntry[]): string[] {
  const weeks = new Set<string>();
  for (const h of history) if (h.weekKey) weeks.add(h.weekKey);
  return [...weeks].sort();
}

/**
 * Séries efetivamente feitas por semana — as barras do gráfico "treino inteiro".
 *
 * Conta série distinta, e não registro: editar o mesmo campo duas vezes no mesmo
 * dia, ou treinar o mesmo dia duas vezes na semana, não infla o número. Série sem
 * `repsDone` não conta: carga prescrita pelo treinador não é treino feito.
 */
export function weeklySetCounts(history: HistoryEntry[]): { weekKey: string; count: number }[] {
  const porSemana = new Map<string, Set<string>>();
  for (const h of history) {
    if (!h.weekKey || !h.repsDone) continue;
    const chave = `${h.exName}|${h.setIndex}`;
    const set = porSemana.get(h.weekKey);
    if (set) set.add(chave);
    else porSemana.set(h.weekKey, new Set([chave]));
  }
  return [...porSemana.entries()]
    .map(([weekKey, series]) => ({ weekKey, count: series.size }))
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey));
}

export type Trend = "up" | "down" | "flat" | "none";

function numberOf(cell: ProgressionCell): number {
  // carga manda; sem carga, a evolução visível é a de repetições
  const raw = cell.load || cell.repsDone || "";
  return parseFloat(String(raw).replace(",", "."));
}

/** Direção da seta entre a semana anterior preenchida e a atual. */
export function trendOf(prev: ProgressionCell | null, cur: ProgressionCell): Trend {
  if (!prev) return "none";
  const a = numberOf(prev);
  const b = numberOf(cur);
  if (Number.isNaN(a) || Number.isNaN(b)) return "none";
  if (b > a) return "up";
  if (b < a) return "down";
  return "flat";
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, com os 22 testes novos.

- [ ] **Step 5: Commit**

```bash
git add src/domain/progression.ts src/domain/progression.test.ts
git commit -m "feat: calcula progressão agrupando por exercício e índice de série"
```

---

### Task 4: `domain/past-week.ts` — reconstruir uma semana encerrada

**Files:**
- Create: `src/domain/past-week.ts`, `src/domain/past-week.test.ts`

**Interfaces:**
- Consumes: `HistoryEntry` (fase 1).
- Produces:
  - `interface PastSet { setIndex: number; repsGoal: string; repsDone: string; load: string }`
  - `interface PastExercise { exName: string; sets: PastSet[] }`
  - `interface PastDay { dayTitle: string; exercises: PastExercise[] }`
  - `groupWeekByDay(history: HistoryEntry[], weekKey: string): PastDay[]`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/domain/past-week.test.ts
import { describe, it, expect } from "vitest";
import { groupWeekByDay } from "./past-week";
import type { HistoryEntry } from "@/data/schema";

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    dateKey: "2026-09-15", weekKey: "2026-09-14", dayId: "d1", dayTitle: "Peito",
    exId: "e1", exName: "Supino", setId: "s1", setIndex: 0,
    repsGoal: "10", repsDone: "9", load: "30", ...over,
  };
}

describe("groupWeekByDay", () => {
  it("agrupa por dia de treino", () => {
    const dias = groupWeekByDay(
      [entry(), entry({ dayTitle: "Costas", exName: "Remada", setId: "s2" })],
      "2026-09-14",
    );
    expect(dias.map((d) => d.dayTitle)).toEqual(["Costas", "Peito"]);
  });

  it("agrupa exercícios dentro do dia", () => {
    const [dia] = groupWeekByDay(
      [entry(), entry({ exName: "Crucifixo", setId: "s2" })],
      "2026-09-14",
    );
    expect(dia.exercises.map((e) => e.exName)).toEqual(["Crucifixo", "Supino"]);
  });

  it("ordena as séries pelo índice", () => {
    const [dia] = groupWeekByDay(
      [entry({ setIndex: 2, setId: "s3" }), entry({ setIndex: 0 }), entry({ setIndex: 1, setId: "s2" })],
      "2026-09-14",
    );
    expect(dia.exercises[0].sets.map((s) => s.setIndex)).toEqual([0, 1, 2]);
  });

  it("ignora as outras semanas", () => {
    const dias = groupWeekByDay([entry({ weekKey: "2026-09-07" })], "2026-09-14");
    expect(dias).toEqual([]);
  });

  it("na mesma série, vence o registro de data mais recente", () => {
    const [dia] = groupWeekByDay(
      [entry({ dateKey: "2026-09-15", load: "30" }), entry({ dateKey: "2026-09-17", load: "40" })],
      "2026-09-14",
    );
    expect(dia.exercises[0].sets).toHaveLength(1);
    expect(dia.exercises[0].sets[0].load).toBe("40");
  });

  it("usa um título genérico quando o dia não tem nome", () => {
    const [dia] = groupWeekByDay([entry({ dayTitle: "" })], "2026-09-14");
    expect(dia.dayTitle).toBe("Treino");
  });

  it("devolve lista vazia sem histórico", () => {
    expect(groupWeekByDay([], "2026-09-14")).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm test -- src/domain/past-week.test.ts
```

Esperado: FAIL, `Failed to resolve import "./past-week"`.

- [ ] **Step 3: Implementar `src/domain/past-week.ts`**

```ts
import type { HistoryEntry } from "@/data/schema";

export interface PastSet {
  setIndex: number;
  repsGoal: string;
  repsDone: string;
  load: string;
}

export interface PastExercise {
  exName: string;
  sets: PastSet[];
}

export interface PastDay {
  dayTitle: string;
  exercises: PastExercise[];
}

/**
 * Reconstrói uma semana encerrada a partir do histórico.
 *
 * Não usa `days`: aquele array guarda o treino CORRENTE, que já foi sobrescrito
 * pela promoção de semana. O histórico é o único registro do que foi feito.
 *
 * Agrupa por título do dia e nome do exercício, e não pelos ids: os ids mudam a
 * cada virada de semana, então dois registros da mesma semana têm ids coerentes
 * entre si, mas o nome é o que continua legível para quem lê a tela.
 */
export function groupWeekByDay(history: HistoryEntry[], weekKey: string): PastDay[] {
  const dias = new Map<string, Map<string, Map<number, HistoryEntry>>>();

  for (const h of history) {
    if (h.weekKey !== weekKey) continue;
    const dayTitle = h.dayTitle || "Treino";
    const exName = h.exName || "Exercício";

    let exercicios = dias.get(dayTitle);
    if (!exercicios) dias.set(dayTitle, (exercicios = new Map()));

    let series = exercicios.get(exName);
    if (!series) exercicios.set(exName, (series = new Map()));

    const atual = series.get(h.setIndex);
    if (!atual || (h.dateKey ?? "") >= (atual.dateKey ?? "")) series.set(h.setIndex, h);
  }

  return [...dias.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayTitle, exercicios]) => ({
      dayTitle,
      exercises: [...exercicios.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([exName, series]) => ({
          exName,
          sets: [...series.values()]
            .sort((a, b) => a.setIndex - b.setIndex)
            .map((h) => ({
              setIndex: h.setIndex,
              repsGoal: h.repsGoal ?? "",
              repsDone: h.repsDone ?? "",
              load: h.load ?? "",
            })),
        })),
    }));
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, com os 7 testes novos.

- [ ] **Step 5: Commit**

```bash
git add src/domain/past-week.ts src/domain/past-week.test.ts
git commit -m "feat: reconstrói semana encerrada a partir do histórico"
```

---

### Task 5: `domain/calendar.ts` — as semanas e seus estados

**Files:**
- Create: `src/domain/calendar.ts`, `src/domain/calendar.test.ts`

**Interfaces:**
- Consumes: `addWeeks`, `weekKeyOf`, `todayKey` (fase 1); `Client` (fase 1).
- Produces:
  - `type WeekState = "past" | "current" | "planned" | "empty"`
  - `interface CalendarWeek { weekKey: string; offset: number; state: WeekState; setsDone: number; setsTotal: number; planId: string | null }`
  - `CALENDAR_OFFSETS: readonly number[]` (`[-2, -1, 0, 1, 2, 3]`)
  - `buildCalendarWeeks(client: Client): CalendarWeek[]`
  - `isWeekOutOfSync(client: Client, currentWeekKey: string): boolean`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/domain/calendar.test.ts
import { describe, it, expect } from "vitest";
import { buildCalendarWeeks, isWeekOutOfSync, CALENDAR_OFFSETS } from "./calendar";
import type { Client, Day, HistoryEntry } from "@/data/schema";

function days(): Day[] {
  return [{
    id: "d1", title: "Peito",
    exercises: [{
      id: "e1", name: "Supino", notes: "", sets: [
        { id: "s1", repsGoal: "10", repsDone: "9", load: "30", intensity: 0, rir: "", rirEnabled: false },
        { id: "s2", repsGoal: "10", repsDone: "", load: "30", intensity: 0, rir: "", rirEnabled: false },
      ],
    }],
  }];
}

function client(over: Partial<Client> = {}): Client {
  return {
    id: "c1", name: "Aluno", email: "a@x.com", goal: "", createdAt: 0,
    days: days(), history: [], weekPlans: [], activeWeekKey: "2026-09-14", ...over,
  };
}

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    dateKey: "2026-09-08", weekKey: "2026-09-07", dayId: "d1", dayTitle: "Peito",
    exId: "e1", exName: "Supino", setId: "s1", setIndex: 0,
    repsGoal: "10", repsDone: "9", load: "30", ...over,
  };
}

describe("buildCalendarWeeks", () => {
  it("devolve uma linha por deslocamento configurado", () => {
    expect(buildCalendarWeeks(client())).toHaveLength(CALENDAR_OFFSETS.length);
  });

  it("ancora na semana ativa, não na data de hoje", () => {
    // é activeWeekKey que decide qual treino o aluno está fazendo
    const semanas = buildCalendarWeeks(client({ activeWeekKey: "2026-09-14" }));
    expect(semanas.find((w) => w.offset === 0)?.weekKey).toBe("2026-09-14");
    expect(semanas.find((w) => w.offset === -1)?.weekKey).toBe("2026-09-07");
    expect(semanas.find((w) => w.offset === 1)?.weekKey).toBe("2026-09-21");
  });

  it("marca a semana ativa como atual", () => {
    expect(buildCalendarWeeks(client()).find((w) => w.offset === 0)?.state).toBe("current");
  });

  it("conta séries feitas e totais da semana atual", () => {
    const atual = buildCalendarWeeks(client()).find((w) => w.offset === 0);
    expect(atual?.setsDone).toBe(1);
    expect(atual?.setsTotal).toBe(2);
  });

  it("marca semana anterior com registro como concluída e conta as séries", () => {
    const c = client({ history: [entry(), entry({ setId: "s2", setIndex: 1 })] });
    const passada = buildCalendarWeeks(c).find((w) => w.offset === -1);
    expect(passada?.state).toBe("past");
    expect(passada?.setsDone).toBe(2);
  });

  it("marca semana anterior sem registro como concluída sem séries", () => {
    const passada = buildCalendarWeeks(client()).find((w) => w.offset === -1);
    expect(passada?.state).toBe("past");
    expect(passada?.setsDone).toBe(0);
  });

  it("marca semana futura com plano como planejada e informa o plano", () => {
    const c = client({ weekPlans: [{ id: "p1", weekKey: "2026-09-21", days: days() }] });
    const futura = buildCalendarWeeks(c).find((w) => w.offset === 1);
    expect(futura?.state).toBe("planned");
    expect(futura?.planId).toBe("p1");
  });

  it("marca semana futura sem plano como vazia", () => {
    const futura = buildCalendarWeeks(client()).find((w) => w.offset === 1);
    expect(futura?.state).toBe("empty");
    expect(futura?.planId).toBeNull();
  });

  it("não conta série sem 'feito' como feita na semana passada", () => {
    const c = client({ history: [entry({ repsDone: "" })] });
    expect(buildCalendarWeeks(c).find((w) => w.offset === -1)?.setsDone).toBe(0);
  });

  it("funciona sem activeWeekKey usando a semana de hoje", () => {
    const c = client({ activeWeekKey: undefined });
    expect(buildCalendarWeeks(c).find((w) => w.offset === 0)?.state).toBe("current");
  });
});

describe("isWeekOutOfSync", () => {
  it("acusa quando a semana ativa não é a de hoje", () => {
    expect(isWeekOutOfSync(client({ activeWeekKey: "2026-09-07" }), "2026-09-14")).toBe(true);
  });

  it("não acusa quando bate", () => {
    expect(isWeekOutOfSync(client({ activeWeekKey: "2026-09-14" }), "2026-09-14")).toBe(false);
  });

  it("não acusa quando não há semana ativa", () => {
    expect(isWeekOutOfSync(client({ activeWeekKey: undefined }), "2026-09-14")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm test -- src/domain/calendar.test.ts
```

Esperado: FAIL, `Failed to resolve import "./calendar"`.

- [ ] **Step 3: Implementar `src/domain/calendar.ts`**

```ts
import { addWeeks, todayKey, weekKeyOf } from "./week";
import type { Client } from "@/data/schema";

export type WeekState = "past" | "current" | "planned" | "empty";

export interface CalendarWeek {
  weekKey: string;
  /** Deslocamento em relação à semana ativa: -1 é a semana passada. */
  offset: number;
  state: WeekState;
  /** Séries feitas: da semana atual, contadas no treino; das passadas, no histórico. */
  setsDone: number;
  /** Só faz sentido na semana atual; nas outras é 0. */
  setsTotal: number;
  planId: string | null;
}

/** Duas semanas para trás, a atual e três para a frente. */
export const CALENDAR_OFFSETS = [-2, -1, 0, 1, 2, 3] as const;

function countCurrentWeek(client: Client): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const d of client.days ?? []) {
    for (const ex of d.exercises ?? []) {
      for (const s of ex.sets ?? []) {
        total += 1;
        if (s.repsDone) done += 1;
      }
    }
  }
  return { done, total };
}

function countDoneInWeek(client: Client, weekKey: string): number {
  const feitas = new Set<string>();
  for (const h of client.history ?? []) {
    if (h.weekKey !== weekKey || !h.repsDone) continue;
    feitas.add(`${h.exName}|${h.setIndex}`);
  }
  return feitas.size;
}

/**
 * As semanas do calendário, ancoradas na semana ATIVA e não na data de hoje: é
 * `activeWeekKey` que decide qual treino o aluno está fazendo, e as duas podem
 * divergir quando o aluno fica semanas sem abrir o app.
 */
export function buildCalendarWeeks(client: Client): CalendarWeek[] {
  const activeKey = client.activeWeekKey || weekKeyOf(todayKey());
  const plans = client.weekPlans ?? [];

  return CALENDAR_OFFSETS.map((offset) => {
    const weekKey = addWeeks(activeKey, offset);
    if (offset === 0) {
      const { done, total } = countCurrentWeek(client);
      return { weekKey, offset, state: "current" as const, setsDone: done, setsTotal: total, planId: null };
    }
    if (offset < 0) {
      return {
        weekKey, offset, state: "past" as const,
        setsDone: countDoneInWeek(client, weekKey), setsTotal: 0, planId: null,
      };
    }
    const plan = plans.find((p) => p.weekKey === weekKey);
    return {
      weekKey, offset,
      state: plan ? ("planned" as const) : ("empty" as const),
      setsDone: 0, setsTotal: 0, planId: plan?.id ?? null,
    };
  });
}

/**
 * A semana marcada como ativa não é a de hoje. Acontece com relógio errado no
 * aparelho ou com aluno que ficou semanas sem abrir o app. A tela oferece
 * corrigir, como no 1.0.
 */
export function isWeekOutOfSync(client: Client, currentWeekKey: string): boolean {
  if (!client.activeWeekKey) return false;
  return client.activeWeekKey !== currentWeekKey;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, com os 13 testes novos.

- [ ] **Step 5: Commit**

```bash
git add src/domain/calendar.ts src/domain/calendar.test.ts
git commit -m "feat: monta as semanas do calendário com seus estados"
```

---

### Task 6: `domain/plan-edit.ts` — criar e editar plano de semana futura

Também extrai de `history.ts` o mapeamento de campo de série, para que a edição de plano reaproveite a mesma função **sem** gerar histórico. Editar um plano não é treinar.

**Files:**
- Create: `src/domain/plan-edit.ts`, `src/domain/plan-edit.test.ts`
- Modify: `src/domain/history.ts`

**Interfaces:**
- Consumes: `cloneDaysWithNewIds` (fase 1); `uid` (fase 1); `Client`, `Day`, `WeekPlan` (fase 1).
- Produces:
  - `setFieldInDays(days: Day[], dayId: string, exId: string, setId: string, field: string, value: string): Day[]` (exportado de `domain/history.ts`)
  - `createPlan(client: Client, weekKey: string, mode: "copy" | "empty"): WeekPlan`
  - `replacePlanDays(plans: WeekPlan[], planId: string, days: Day[]): WeekPlan[]`

- [ ] **Step 1: Extrair `setFieldInDays` em `src/domain/history.ts`**

Substituir o corpo de `applySetFieldChange` que faz o mapeamento por uma função exportada, preservando o comportamento. O arquivo passa a ter:

```ts
/**
 * Troca um campo de uma série dentro do array de dias, sem tocar em histórico.
 * Exportada porque a edição de plano de semana futura usa o mesmo mapeamento e
 * NÃO deve gerar histórico: planejar não é treinar.
 */
export function setFieldInDays(
  days: Day[],
  dayId: string,
  exId: string,
  setId: string,
  field: string,
  value: string,
): Day[] {
  return (days ?? []).map((d) => {
    if (d.id !== dayId) return d;
    return {
      ...d,
      exercises: (d.exercises ?? []).map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: (ex.sets ?? []).map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
        };
      }),
    };
  });
}
```

E `applySetFieldChange` passa a usá-la, mantendo a assinatura e o retorno atuais:

```ts
export function applySetFieldChange(
  client: Client,
  dayId: string,
  exId: string,
  setId: string,
  field: string,
  value: string,
): { days: Day[]; history: HistoryEntry[] } {
  const days = setFieldInDays(client.days ?? [], dayId, exId, setId, field, value);

  const previous = client.history ?? [];
  if (!TRACKED_FIELDS.has(field)) return { days, history: previous };

  const day = days.find((d) => d.id === dayId);
  const ex = day?.exercises.find((e) => e.id === exId);
  const setIndex = ex?.sets.findIndex((s) => s.id === setId) ?? -1;
  const set = setIndex >= 0 ? ex?.sets[setIndex] : undefined;
  // série não encontrada: não inventa entrada de histórico fantasma
  if (!day || !ex || !set) return { days, history: previous };

  const dateKey = todayKey();
  // Uma série editada várias vezes no mesmo dia deixa UMA entrada, não uma por tecla.
  const history = previous.filter((h) => !(h.setId === setId && h.dateKey === dateKey));
  history.push({
    dateKey,
    weekKey: weekKeyOf(dateKey),
    dayId,
    dayTitle: day.title,
    exId,
    exName: ex.name,
    setId,
    setIndex,
    repsGoal: set.repsGoal ?? "",
    repsDone: set.repsDone ?? "",
    load: set.load ?? "",
  });

  return { days, history };
}
```

- [ ] **Step 2: Rodar a suíte e confirmar que nada quebrou**

```bash
npm test -- src/domain/history.test.ts
```

Esperado: PASS, os mesmos testes de antes. Esta extração é refatoração: se algum teste falhar, o comportamento mudou e precisa voltar.

- [ ] **Step 3: Escrever os testes que falham de `plan-edit`**

```ts
// src/domain/plan-edit.test.ts
import { describe, it, expect } from "vitest";
import { createPlan, replacePlanDays } from "./plan-edit";
import type { Client, Day, WeekPlan } from "@/data/schema";

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
    days: days(), history: [], weekPlans: [], activeWeekKey: "2026-09-14", ...over,
  };
}

describe("createPlan", () => {
  it("guarda a semana pedida", () => {
    expect(createPlan(client(), "2026-09-21", "copy").weekKey).toBe("2026-09-21");
  });

  it("gera um id próprio para o plano", () => {
    const a = createPlan(client(), "2026-09-21", "copy");
    const b = createPlan(client(), "2026-09-28", "copy");
    expect(a.id).not.toBe(b.id);
  });

  it("copiando, traz os exercícios com ids novos", () => {
    const plano = createPlan(client(), "2026-09-21", "copy");
    expect(plano.days[0].exercises[0].name).toBe("Supino");
    expect(plano.days[0].id).not.toBe("d1");
    expect(plano.days[0].exercises[0].sets[0].id).not.toBe("s1");
  });

  it("copiando, zera o feito e guarda a referência da semana anterior", () => {
    const s = createPlan(client(), "2026-09-21", "copy").days[0].exercises[0].sets[0];
    expect(s.repsDone).toBe("");
    expect(s.prevReps).toBe("9");
  });

  it("copiando, nunca leva o cronômetro junto", () => {
    expect(createPlan(client(), "2026-09-21", "copy").days[0].timerStartedAt).toBeUndefined();
  });

  it("começando do zero, nasce sem nenhum dia", () => {
    expect(createPlan(client(), "2026-09-21", "empty").days).toEqual([]);
  });

  it("não altera o treino atual do aluno", () => {
    const c = client();
    createPlan(c, "2026-09-21", "copy");
    expect(c.days[0].id).toBe("d1");
  });
});

describe("replacePlanDays", () => {
  const plans: WeekPlan[] = [
    { id: "p1", weekKey: "2026-09-21", days: [] },
    { id: "p2", weekKey: "2026-09-28", days: [] },
  ];

  it("troca os dias do plano alvo", () => {
    const r = replacePlanDays(plans, "p1", days());
    expect(r.find((p) => p.id === "p1")?.days[0].title).toBe("Peito");
  });

  it("não toca nos outros planos", () => {
    const r = replacePlanDays(plans, "p1", days());
    expect(r.find((p) => p.id === "p2")?.days).toEqual([]);
  });

  it("mantém a quantidade de planos quando o id não existe", () => {
    expect(replacePlanDays(plans, "inexistente", days())).toHaveLength(2);
  });
});
```

- [ ] **Step 4: Rodar e confirmar que falha**

```bash
npm test -- src/domain/plan-edit.test.ts
```

Esperado: FAIL, `Failed to resolve import "./plan-edit"`.

- [ ] **Step 5: Implementar `src/domain/plan-edit.ts`**

```ts
import { cloneDaysWithNewIds } from "./week-promotion";
import { uid } from "@/data/id";
import type { Client, Day, WeekPlan } from "@/data/schema";

/**
 * Cria o plano de uma semana futura.
 *
 * `copy` parte do treino atual com ids novos, o feito zerado e o número da
 * semana que passou guardado como referência. `empty` nasce sem dias, para quem
 * vai montar um treino diferente.
 *
 * O 1.0 criava a cópia no toque, sem perguntar (app.js:3074-3086): um toque
 * errado virava um plano que seria promovido sozinho quando a semana chegasse.
 * Aqui a escolha é explícita e nada é gravado antes dela.
 *
 * Fotos de exercício são da fase 3 e por isso não são copiadas.
 */
export function createPlan(client: Client, weekKey: string, mode: "copy" | "empty"): WeekPlan {
  return {
    id: uid(),
    weekKey,
    days: mode === "copy" ? cloneDaysWithNewIds(client.days ?? [], { carryGhost: true }) : [],
  };
}

/** Troca os dias de um plano, devolvendo a lista inteira para gravar em `weekPlans`. */
export function replacePlanDays(plans: WeekPlan[], planId: string, days: Day[]): WeekPlan[] {
  return (plans ?? []).map((p) => (p.id === planId ? { ...p, days } : p));
}
```

- [ ] **Step 6: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, com os 10 testes novos e os de `history.test.ts` intactos.

- [ ] **Step 7: Commit**

```bash
git add src/domain/plan-edit.ts src/domain/plan-edit.test.ts src/domain/history.ts
git commit -m "feat: cria e edita plano de semana futura sem gerar histórico"
```

---

### Task 7: `data/history-archive.ts` — leitura do arquivo

O módulo hoje só escreve. Ganha as duas leituras que a fase 1 deixou anotadas como pendência.

**Files:**
- Modify: `src/data/history-archive.ts`

**Interfaces:**
- Consumes: `db` (fase 1); `HistoryArchiveDoc`, `HistoryEntry` (fase 1).
- Produces:
  - `loadArchivedWeek(clientId: string, weekKey: string): Promise<HistoryEntry[]>`
  - `loadAllArchived(clientId: string): Promise<HistoryEntry[]>`

- [ ] **Step 1: Acrescentar as leituras**

No topo do arquivo, ampliar o import do Firestore:

```ts
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
```

E acrescentar ao final do arquivo:

```ts
/**
 * Uma semana do arquivo. Usada pela tela de semana passada, que sabe exatamente
 * qual semana quer: uma leitura dirigida, e não a coleção inteira.
 */
export async function loadArchivedWeek(clientId: string, weekKey: string): Promise<HistoryEntry[]> {
  const snap = await getDoc(doc(db, "clients", clientId, ARCHIVE, weekKey));
  const data = snap.data() as HistoryArchiveDoc | undefined;
  return data?.entries ?? [];
}

/**
 * Todo o arquivo do aluno. Custa uma leitura por semana arquivada — para quem usa
 * há dois anos, perto de oitenta. Por isso fica atrás de um botão na progressão e
 * nunca roda na abertura de tela.
 */
export async function loadAllArchived(clientId: string): Promise<HistoryEntry[]> {
  const snap = await getDocs(collection(db, "clients", clientId, ARCHIVE));
  return snap.docs.flatMap((d) => (d.data() as HistoryArchiveDoc).entries ?? []);
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npm run build
```

Esperado: build sem erro de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/data/history-archive.ts
git commit -m "feat: lê o histórico arquivado por semana e por inteiro"
```

---

### Task 8: `ui/state.ts` — tela aberta e alvo de edição

**Files:**
- Modify: `src/ui/state.ts`, `src/ui/state.test.ts`

**Interfaces:**
- Consumes: `Client`, `HistoryEntry` (fase 1); `Session` (fase 1).
- Produces, acrescentados a `AppState`:
  - `type Screen = "home" | "calendar" | "pastWeek" | "progression"`
  - `type EditTarget = { kind: "current" } | { kind: "plan"; planId: string }`
  - campos `screen`, `editTarget`, `pastWeekKey`, `pastWeekEntries`, `progTab`, `progSelectedWeek`, `archivedHistory`, `archiveState`, `planChoiceWeekKey`

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao final de `src/ui/state.test.ts`:

```ts
describe("estado da fase 2", () => {
  it("começa na grade de treinos", () => {
    expect(getState().screen).toBe("home");
  });

  it("começa editando o treino atual", () => {
    expect(getState().editTarget).toEqual({ kind: "current" });
  });

  it("começa sem arquivo carregado", () => {
    expect(getState().archivedHistory).toBeNull();
    expect(getState().archiveState).toBe("idle");
  });

  it("troca o alvo de edição para um plano", () => {
    setState({ editTarget: { kind: "plan", planId: "p1" } });
    expect(getState().editTarget).toEqual({ kind: "plan", planId: "p1" });
  });

  it("volta ao estado inicial no reset", () => {
    setState({ screen: "progression", pastWeekKey: "2026-09-07" });
    resetState();
    expect(getState().screen).toBe("home");
    expect(getState().pastWeekKey).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm test -- src/ui/state.test.ts
```

Esperado: FAIL, `expected undefined to be 'home'`.

- [ ] **Step 3: Ampliar `src/ui/state.ts`**

Acrescentar os tipos antes de `AppState`:

```ts
import type { HistoryEntry } from "@/data/schema";

/** Tela aberta dentro da área do aluno. `home` é a grade de treinos da fase 1. */
export type Screen = "home" | "calendar" | "pastWeek" | "progression";

/**
 * Onde a edição de treino grava. A mesma tela serve ao treino corrente e ao
 * plano de uma semana futura; só o destino muda.
 */
export type EditTarget = { kind: "current" } | { kind: "plan"; planId: string };
```

Acrescentar a `AppState`:

```ts
  screen: Screen;
  editTarget: EditTarget;
  /** Semana aberta na tela de leitura; null quando não há. */
  pastWeekKey: string | null;
  /** Entradas daquela semana, já resolvidas entre ficha e arquivo. */
  pastWeekEntries: HistoryEntry[] | null;
  progTab: "overall" | "table";
  /** Barra tocada no gráfico, para mostrar o número daquela semana. */
  progSelectedWeek: string | null;
  /** Histórico vindo de historyArchive; null enquanto ninguém pediu. */
  archivedHistory: HistoryEntry[] | null;
  archiveState: "idle" | "loading" | "loaded" | "error";
  /** Semana futura à espera da escolha entre copiar e começar do zero. */
  planChoiceWeekKey: string | null;
```

E a `INITIAL`:

```ts
  screen: "home",
  editTarget: { kind: "current" },
  pastWeekKey: null,
  pastWeekEntries: null,
  progTab: "overall",
  progSelectedWeek: null,
  archivedHistory: null,
  archiveState: "idle",
  planChoiceWeekKey: null,
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test && npm run build
```

Esperado: PASS com os 5 testes novos; build limpo.

- [ ] **Step 5: Commit**

```bash
git add src/ui/state.ts src/ui/state.test.ts
git commit -m "feat: acrescenta tela aberta e alvo de edição ao estado"
```

---

### Task 9: dividir `ui/handlers.ts` e ensinar o alvo de edição

O arquivo tem cerca de 190 linhas e esta fase acrescentaria calendário, plano e progressão. Divide-se por assunto, e no caminho aprende a gravar no plano.

**Files:**
- Create: `src/ui/handlers/index.ts`, `src/ui/handlers/target.ts`, `src/ui/handlers/gate.ts`, `src/ui/handlers/trainer.ts`, `src/ui/handlers/workout.ts`
- Delete: `src/ui/handlers.ts`
- Modify: `src/ui/render.ts` (só o caminho do import)

**Interfaces:**
- Consumes: `setFieldInDays`, `applySetFieldChange` (Task 6); `replacePlanDays` (Task 6); `getState`, `setState`, `EditTarget` (Task 8); `saveClient`, `createClient` (fase 1).
- Produces:
  - `currentClient(): Client | null` e `persist(clientId, patch)` em `target.ts`
  - `editableDays(client: Client): Day[]` — os dias do alvo atual
  - `mutateDays(fn: (days: Day[]) => Day[]): void`
  - `gate`, `trainer`, `student`, `day`, `clientSummary` reexportados por `index.ts`, com os mesmos nomes de hoje

- [ ] **Step 1: Criar `src/ui/handlers/target.ts`**

```ts
import { getState, setState } from "../state";
import { saveClient } from "@/data/client-repo";
import { replacePlanDays } from "@/domain/plan-edit";
import type { Client, Day } from "@/data/schema";

/** O aluno em edição: o próprio, ou o selecionado quando quem está logado é o treinador. */
export function currentClient(): Client | null {
  const s = getState();
  return s.view === "student" ? s.client : s.clients.find((c) => c.id === s.selectedClientId) ?? null;
}

/**
 * Grava sem bloquear a tela. A promessa fica pendente enquanto estiver offline
 * (ver saveClient), então nunca é aguardada; mas uma rejeição — regra negada,
 * documento apagado — precisa aparecer, senão o treino some sem aviso.
 */
export function persist(clientId: string, patch: Partial<Client>): void {
  saveClient(clientId, patch).catch(() => {
    setState({ error: "Não foi possível salvar. Recarregue a página e tente de novo." });
  });
}

/** Os dias que a tela está editando: os do treino corrente ou os do plano aberto. */
export function editableDays(client: Client): Day[] {
  const t = getState().editTarget;
  if (t.kind === "current") return client.days ?? [];
  return (client.weekPlans ?? []).find((p) => p.id === t.planId)?.days ?? [];
}

/**
 * Aplica uma transformação aos dias do alvo atual e grava no campo certo:
 * `days` para o treino corrente, `weekPlans` para um plano de semana futura.
 */
export function mutateDays(fn: (days: Day[]) => Day[]): void {
  const c = currentClient();
  if (!c) return;
  const t = getState().editTarget;
  if (t.kind === "current") {
    persist(c.id, { days: fn(c.days ?? []) });
    return;
  }
  const plans = c.weekPlans ?? [];
  const plan = plans.find((p) => p.id === t.planId);
  if (!plan) return;
  persist(c.id, { weekPlans: replacePlanDays(plans, t.planId, fn(plan.days ?? [])) });
}

export function authErrorCode(e: unknown): string {
  return (e as { code?: string }).code ?? "";
}
```

- [ ] **Step 2: Criar `src/ui/handlers/gate.ts`**

Move o objeto `gate` do arquivo atual, trocando os helpers locais pelos de `target.ts`:

```ts
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
```

- [ ] **Step 3: Criar `src/ui/handlers/trainer.ts`**

Move `trainer`, `student` e `clientSummary` do arquivo atual sem mudança de comportamento, importando `persist` e `authErrorCode` de `./target`, e acrescentando ao `student` e ao `trainer` a volta ao estado inicial de tela:

```ts
import { html, type TemplateResult } from "lit-html";
import { setState } from "../state";
import { createClient, type NewClient } from "@/data/client-repo";
import { todayKey, weekKeyOf } from "@/domain/week";
import { uid } from "@/data/id";
import { signOutNow, sendPasswordSetup } from "@/auth/session";
import { createStudentAccount } from "@/auth/invite";
import { translateAuthError } from "@/auth/errors";
import { mutateDays, authErrorCode } from "./target";
import type { Client } from "@/data/schema";

/** Volta a tela para a grade do treino corrente. Usado ao trocar de aluno e ao sair de uma tela. */
export function resetScreen(): void {
  setState({
    screen: "home",
    activeDayId: null,
    editTarget: { kind: "current" },
    pastWeekKey: null,
    pastWeekEntries: null,
    planChoiceWeekKey: null,
  });
}

export const trainer = {
  onSelect: (clientId: string) => {
    setState({ selectedClientId: clientId, archivedHistory: null, archiveState: "idle" });
    resetScreen();
  },
  onLogout: () => void signOutNow(),
  onResendSetup: (email: string) => void sendPasswordSetup(email),
  onInvite: async (name: string, email: string) => {
    setState({ error: null });
    try {
      // a conta nasce primeiro: o id do documento é o UID do Auth
      const studentUid = await createStudentAccount(email);
      const novo: NewClient = {
        name, email: email.toLowerCase(), goal: "",
        createdAt: Date.now(), days: [], history: [], weekPlans: [],
        // Sem semear activeWeekKey o aluno nunca vira de semana.
        activeWeekKey: weekKeyOf(todayKey()),
      };
      await createClient(studentUid, novo);
    } catch (e) {
      setState({ error: translateAuthError(authErrorCode(e)) });
    }
  },
};

export const student = {
  onOpenDay: (dayId: string) => setState({ activeDayId: dayId }),
  onLogout: () => void signOutNow(),
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
      <!-- mutateDays, e não persist: quando um plano de semana futura está
           aberto, o treino novo precisa nascer DENTRO do plano, e não no
           treino corrente do aluno -->
      <div class="sq add" @click=${() =>
        mutateDays((days) => [...days, { id: uid(), title: "Novo treino", exercises: [] }])}>
        <i class="ti ti-plus"></i>
      </div>
    </div>
  `;
}
```

- [ ] **Step 4: Criar `src/ui/handlers/workout.ts`**

Move o objeto `day`, com uma mudança de comportamento: quando o alvo é um plano, a alteração de campo **não** gera histórico.

```ts
import { getState, setState } from "../state";
import { applySetFieldChange, setFieldInDays } from "@/domain/history";
import { uid } from "@/data/id";
import { isTimerRunning } from "../components/timer";
import { currentClient, editableDays, mutateDays, persist } from "./target";

function novaSerie() {
  return { id: uid(), repsGoal: "10", repsDone: "", load: "", intensity: 0, rir: "", rirEnabled: false };
}

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
          ? { ...d, exercises: [...(d.exercises ?? []), { id: uid(), name: "", notes: "", sets: [novaSerie()] }] }
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
          e.id === exId ? { ...e, sets: [...(e.sets ?? []), novaSerie()] } : e,
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

  /**
   * Reps e carga no treino corrente passam por applySetFieldChange porque também
   * geram histórico. Num PLANO de semana futura, não: planejar não é treinar, e
   * gravar histórico de uma semana que não aconteceu envenenaria a progressão.
   */
  onField: (setId: string, field: "repsGoal" | "repsDone" | "load", value: string) => {
    const c = currentClient();
    const dayId = getState().activeDayId;
    if (!c || !dayId) return;

    const dias = editableDays(c);
    const ex = dias.find((d) => d.id === dayId)?.exercises.find((e) => e.sets.some((s) => s.id === setId));
    if (!ex) return;

    if (getState().editTarget.kind === "plan") {
      mutateDays((days) => setFieldInDays(days, dayId, ex.id, setId, field, value));
      return;
    }

    const { days, history } = applySetFieldChange(c, dayId, ex.id, setId, field, value);
    persist(c.id, field === "repsGoal" ? { days } : { days, history });
  },
};
```

- [ ] **Step 5: Criar `src/ui/handlers/index.ts`**

```ts
export { gate } from "./gate";
export { trainer, student, clientSummary, resetScreen } from "./trainer";
export { day } from "./workout";
```

- [ ] **Step 6: Apagar o arquivo antigo e corrigir o import**

```bash
git rm src/ui/handlers.ts
```

Em `src/ui/render.ts`, o import continua funcionando sem mudança de texto, porque `./handlers` passa a resolver para `./handlers/index.ts`. Confirme lendo a linha:

```bash
grep -n "handlers" src/ui/render.ts
```

- [ ] **Step 7: Rodar a suíte e o build**

```bash
npm test && npm run build
```

Esperado: PASS e build limpo. Nenhum teste novo aqui: esta tarefa move código e acrescenta uma ramificação já coberta pelos testes de `domain/`.

- [ ] **Step 8: Commit**

```bash
git add src/ui/handlers src/ui/render.ts
git commit -m "refactor: divide handlers por assunto e ensina o alvo de edição"
```

---

### Task 10: `ui/components/week-bars.ts` — o gráfico em SVG

Uma série só de dados, então: uma cor só, sem legenda — o título nomeia a série —, rótulo ao tocar e eixo discreto. Sem biblioteca.

**Files:**
- Create: `src/ui/components/week-bars.ts`, `src/ui/components/week-bars.test.ts`

**Interfaces:**
- Consumes: `weekLabel` (Task 1).
- Produces:
  - `interface BarGeometry { weekKey: string; count: number; x: number; y: number; width: number; height: number }`
  - `layoutBars(counts: { weekKey: string; count: number }[], width: number, height: number): BarGeometry[]`
  - `weekBars(counts, selectedWeek: string | null, onSelect: (weekKey: string) => void): TemplateResult`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/ui/components/week-bars.test.ts
import { describe, it, expect } from "vitest";
import { layoutBars, CHART_HEIGHT } from "./week-bars";

const counts = [
  { weekKey: "2026-09-07", count: 10 },
  { weekKey: "2026-09-14", count: 20 },
];

describe("layoutBars", () => {
  it("devolve uma barra por semana", () => {
    expect(layoutBars(counts, 300, CHART_HEIGHT)).toHaveLength(2);
  });

  it("a maior contagem ocupa a altura útil inteira", () => {
    const [, maior] = layoutBars(counts, 300, CHART_HEIGHT);
    expect(maior.height).toBeGreaterThan(0);
    expect(maior.y + maior.height).toBeCloseTo(CHART_HEIGHT, 5);
  });

  it("a altura é proporcional à contagem", () => {
    const [menor, maior] = layoutBars(counts, 300, CHART_HEIGHT);
    expect(maior.height).toBeCloseTo(menor.height * 2, 5);
  });

  it("as barras não se sobrepõem e ficam dentro da largura", () => {
    const barras = layoutBars(counts, 300, CHART_HEIGHT);
    expect(barras[0].x + barras[0].width).toBeLessThanOrEqual(barras[1].x);
    expect(barras[1].x + barras[1].width).toBeLessThanOrEqual(300);
  });

  it("semana sem série feita vira barra de altura zero, não some", () => {
    const barras = layoutBars([{ weekKey: "2026-09-07", count: 0 }, ...counts], 300, CHART_HEIGHT);
    expect(barras).toHaveLength(3);
    expect(barras[0].height).toBe(0);
  });

  it("aceita lista vazia", () => {
    expect(layoutBars([], 300, CHART_HEIGHT)).toEqual([]);
  });

  it("não quebra quando todas as contagens são zero", () => {
    const barras = layoutBars([{ weekKey: "2026-09-07", count: 0 }], 300, CHART_HEIGHT);
    expect(barras[0].height).toBe(0);
    expect(Number.isNaN(barras[0].y)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm test -- src/ui/components/week-bars.test.ts
```

Esperado: FAIL, `Failed to resolve import "./week-bars"`.

- [ ] **Step 3: Implementar `src/ui/components/week-bars.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import { weekLabel } from "@/domain/week";

export const CHART_HEIGHT = 160;
const CHART_WIDTH = 320;
/** Respiro entre barras, em unidades do viewBox. Mantém as barras separadas sem linha divisória. */
const GAP = 6;

export interface BarGeometry {
  weekKey: string;
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Geometria das barras dentro do viewBox. Fica separada do desenho para poder
 * ser testada: erro de escala é o defeito clássico de gráfico feito à mão, e
 * não aparece como exceção, só como número errado na tela.
 */
export function layoutBars(
  counts: { weekKey: string; count: number }[],
  width: number,
  height: number,
): BarGeometry[] {
  if (!counts.length) return [];
  const max = Math.max(...counts.map((c) => c.count));
  const slot = width / counts.length;
  const barWidth = Math.max(1, slot - GAP);

  return counts.map((c, i) => {
    // tudo zero: nenhuma barra sobe, e nada divide por zero
    const barHeight = max > 0 ? (c.count / max) * height : 0;
    return {
      weekKey: c.weekKey,
      count: c.count,
      x: i * slot + GAP / 2,
      y: height - barHeight,
      width: barWidth,
      height: barHeight,
    };
  });
}

/**
 * Barras de séries feitas por semana. Uma série de dados só: uma cor só e sem
 * legenda — o título da aba já diz o que é. Tocar numa barra mostra o número
 * daquela semana, que é a alternativa ao tooltip de mouse no celular.
 */
export function weekBars(
  counts: { weekKey: string; count: number }[],
  selectedWeek: string | null,
  onSelect: (weekKey: string) => void,
): TemplateResult {
  const bars = layoutBars(counts, CHART_WIDTH, CHART_HEIGHT);
  const selected = bars.find((b) => b.weekKey === selectedWeek) ?? null;

  return html`
    <div class="chart">
      <svg viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 18}" role="img"
           aria-label="Séries feitas por semana">
        <line x1="0" y1=${CHART_HEIGHT} x2=${CHART_WIDTH} y2=${CHART_HEIGHT} class="chart-axis" />
        ${bars.map(
          (b) => html`
            <rect class="chart-bar ${b.weekKey === selectedWeek ? "selected" : ""}"
                  x=${b.x} y=${b.y} width=${b.width} height=${b.height}
                  rx="3" @click=${() => onSelect(b.weekKey)}>
              <title>${weekLabel(b.weekKey)}: ${b.count} séries</title>
            </rect>
            <!-- alvo de toque inteiro, para a barra baixa não ser impossível de acertar -->
            <rect class="chart-hit" x=${b.x} y="0" width=${b.width} height=${CHART_HEIGHT}
                  @click=${() => onSelect(b.weekKey)}></rect>`,
        )}
        ${bars.length
          ? html`
              <text x="0" y=${CHART_HEIGHT + 14} class="chart-tick">${weekLabel(bars[0].weekKey)}</text>
              <text x=${CHART_WIDTH} y=${CHART_HEIGHT + 14} text-anchor="end" class="chart-tick">
                ${weekLabel(bars[bars.length - 1].weekKey)}
              </text>`
          : null}
      </svg>
      <p class="chart-readout">
        ${selected
          ? `${weekLabel(selected.weekKey)}: ${selected.count} séries`
          : "Toque numa barra para ver a semana"}
      </p>
    </div>
  `;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test
```

Esperado: PASS, com os 7 testes novos.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/week-bars.ts src/ui/components/week-bars.test.ts
git commit -m "feat: desenha o gráfico de séries por semana em SVG"
```

---

### Task 11: estilos das telas novas

Os estilos do 1.0 para estas telas moram em atributos `style` espalhados pelo HTML gerado. Aqui viram classes, no mesmo arquivo que a fase 1 copiou.

**Files:**
- Modify: `src/ui/styles.css`

**Interfaces:**
- Consumes: as variáveis de cor já definidas em `:root`.
- Produces: classes `.cal-row`, `.cal-row.current`, `.cal-row.past`, `.prog-tabs`, `.prog-table`, `.chart`, `.chart-bar`, `.chart-axis`, `.chart-tick`, `.chart-readout`, `.trend-up`, `.trend-down`, `.past-day`, `.past-set`, `.plan-banner`, `.plan-choice`.

- [ ] **Step 1: Acrescentar ao final de `src/ui/styles.css`**

```css
/* ----- fase 2: calendário ----- */
.cal-list { display: flex; flex-direction: column; gap: 8px; }
.cal-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer;
  background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }
.cal-row .cal-icon { font-size: 18px; color: var(--steel); }
.cal-row .cal-range { font-size: 13px; color: var(--chalk); }
.cal-row .cal-state { font-size: 11px; color: var(--muted); }
.cal-row.past { opacity: .65; }
.cal-row.past .cal-icon { color: var(--green); }
.cal-row.current { background: #2A2018; border-color: var(--red); }
.cal-row.current .cal-icon { color: var(--red); }
.cal-row.current .cal-range { font-weight: 600; }
.cal-row.planned .cal-icon { color: var(--plate); }
.cal-warning { background: var(--redDim); border: 1px solid var(--red); border-radius: 10px;
  padding: 10px 12px; margin-bottom: 12px; font-size: 12px; color: var(--chalk); }
.cal-warning button { display: block; margin-top: 6px; color: var(--plate); text-decoration: underline;
  background: none; border: 0; padding: 0; font: inherit; cursor: pointer; }

/* escolha entre copiar a semana atual e começar do zero */
.plan-choice { background: var(--panelAlt); border: 1px solid var(--line); border-radius: 10px;
  padding: 12px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px; }
.plan-choice p { margin: 0; font-size: 13px; color: var(--chalk); }
.plan-banner { background: var(--panelAlt); border: 1px solid var(--plate); border-radius: 10px;
  padding: 8px 12px; margin-bottom: 12px; font-size: 12px; color: var(--plate); }

/* ----- fase 2: progressão ----- */
.prog-tabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.prog-tabs .dashed-btn.active { border-style: solid; color: var(--chalk); }
.prog-scroll { overflow-x: auto; }
.prog-table { border-collapse: collapse; width: 100%; font-size: 12px; }
.prog-table th { padding: 6px 10px; color: var(--muted); font-weight: 600; white-space: nowrap; }
.prog-table td { padding: 6px 10px; text-align: center; white-space: nowrap; color: var(--chalk); }
.prog-table tbody tr { border-top: 1px solid var(--line); }
.prog-table .row-head { text-align: left; position: sticky; left: 0; background: var(--bg); }
.prog-table thead .row-head { background: var(--panel); }
.prog-table .empty-cell { color: var(--line); }
.trend-up { color: var(--green); }
.trend-down { color: var(--red); }
.prog-footer { margin-top: 14px; display: flex; justify-content: center; }

/* gráfico: uma série de dados, portanto uma cor só e sem legenda */
.chart svg { width: 100%; height: auto; display: block; }
.chart-bar { fill: var(--steel); }
.chart-bar.selected { fill: var(--plate); }
.chart-hit { fill: transparent; cursor: pointer; }
.chart-axis { stroke: var(--line); stroke-width: 1; }
.chart-tick { fill: var(--muted); font-size: 10px; }
.chart-readout { text-align: center; font-size: 12px; color: var(--muted); margin: 8px 0 0; }

/* ----- fase 2: semana passada ----- */
.past-day { margin-bottom: 18px; }
.past-day h3 { font-family: var(--font-display); font-size: 16px; margin: 0 0 8px; color: var(--chalk); }
.past-ex { background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
  padding: 10px 12px; margin-bottom: 8px; }
.past-ex .past-name { font-size: 13px; color: var(--chalk); margin-bottom: 6px; }
.past-set { display: flex; gap: 8px; font-size: 12px; color: var(--muted); }
.past-set .past-idx { width: 18px; color: var(--line); }
```

- [ ] **Step 2: Verificar que o build embute o CSS**

```bash
npm run build
```

Esperado: build limpo e `dist/assets/*.css` maior que antes.

- [ ] **Step 3: Commit**

```bash
git add src/ui/styles.css
git commit -m "feat: adiciona estilos de calendário, progressão e semana passada"
```

---

### Task 12: `ui/views/progression.ts` — a tela de progressão

**Files:**
- Create: `src/ui/views/progression.ts`

**Interfaces:**
- Consumes: `buildProgressionRows`, `progressionWeekKeys`, `weeklySetCounts`, `trendOf` (Task 3); `weekLabel` (Task 1); `weekBars` (Task 10); `HistoryEntry` (fase 1).
- Produces:
  - `interface ProgressionHandlers { onBack: () => void; onTab: (tab: "overall" | "table") => void; onSelectWeek: (weekKey: string) => void; onLoadArchive: () => void }`
  - `progressionView(history, tab, selectedWeek, archiveState, h): TemplateResult`

- [ ] **Step 1: Criar `src/ui/views/progression.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import {
  buildProgressionRows, progressionWeekKeys, trendOf, weeklySetCounts,
  type ProgressionCell,
} from "@/domain/progression";
import { weekLabel } from "@/domain/week";
import { weekBars } from "../components/week-bars";
import type { HistoryEntry } from "@/data/schema";

export interface ProgressionHandlers {
  onBack: () => void;
  onTab: (tab: "overall" | "table") => void;
  onSelectWeek: (weekKey: string) => void;
  onLoadArchive: () => void;
}

/** Quantas semanas cabem na tabela sem precisar rolar até o fim do mundo. */
const VISIBLE_WEEKS = 8;

function cellLabel(cell: ProgressionCell): string {
  const reps = cell.repsDone || cell.repsGoal || "-";
  return cell.load ? `${reps}r · ${cell.load}kg` : `${reps}r`;
}

function tableView(history: HistoryEntry[]): TemplateResult {
  const rows = buildProgressionRows(history);
  const weeks = progressionWeekKeys(history).slice(-VISIBLE_WEEKS);

  return html`
    <div class="prog-scroll">
      <table class="prog-table">
        <thead>
          <tr>
            <th class="row-head">Série</th>
            ${weeks.map((w) => html`<th>${weekLabel(w)}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            let anterior: ProgressionCell | null = null;
            return html`
              <tr>
                <td class="row-head">${row.exName} · ${row.setIndex + 1}ª</td>
                ${weeks.map((w) => {
                  const cell = row.byWeek.get(w);
                  if (!cell) return html`<td class="empty-cell">—</td>`;
                  const trend = trendOf(anterior, cell);
                  anterior = cell;
                  return html`
                    <td>
                      ${cellLabel(cell)}
                      ${trend === "up" ? html`<i class="ti ti-arrow-up trend-up"></i>` : null}
                      ${trend === "down" ? html`<i class="ti ti-arrow-down trend-down"></i>` : null}
                    </td>`;
                })}
              </tr>`;
          })}
        </tbody>
      </table>
    </div>
  `;
}

export function progressionView(
  history: HistoryEntry[],
  tab: "overall" | "table",
  selectedWeek: string | null,
  archiveState: "idle" | "loading" | "loaded" | "error",
  h: ProgressionHandlers,
): TemplateResult {
  const vazio = history.length === 0;

  return html`
    <div class="day-head">
      <button class="back" @click=${h.onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Progressão</span>
    </div>

    <div class="prog-tabs">
      <button class="dashed-btn ${tab === "overall" ? "active" : ""}" @click=${() => h.onTab("overall")}>
        Treino inteiro
      </button>
      <button class="dashed-btn ${tab === "table" ? "active" : ""}" @click=${() => h.onTab("table")}>
        Tabela
      </button>
    </div>

    ${vazio
      ? html`<p class="muted-note">
          Ainda não há histórico. Assim que reps ou carga forem preenchidos, a progressão
          aparece aqui, semana a semana.
        </p>`
      : tab === "overall"
        ? html`
            <p class="muted-note">Séries feitas por semana, somando todos os exercícios.</p>
            ${weekBars(weeklySetCounts(history), selectedWeek, h.onSelectWeek)}`
        : tableView(history)}

    <div class="prog-footer">
      ${archiveState === "loaded"
        ? html`<span class="muted-note">Histórico completo carregado.</span>`
        : archiveState === "loading"
          ? html`<span class="muted-note">Carregando histórico…</span>`
          : html`
              <button class="dashed-btn" @click=${h.onLoadArchive}>
                <i class="ti ti-history"></i> carregar histórico completo
              </button>
              ${archiveState === "error"
                ? html`<span class="muted-note">Não foi possível carregar. Tente de novo.</span>`
                : null}`}
    </div>
  `;
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npm run build
```

Esperado: build limpo. A tela ainda não está ligada a nada; isso é a Task 14.

- [ ] **Step 3: Commit**

```bash
git add src/ui/views/progression.ts
git commit -m "feat: adiciona a tela de progressão"
```

---

### Task 13: `ui/views/calendar.ts` e `ui/views/past-week.ts`

**Files:**
- Create: `src/ui/views/calendar.ts`, `src/ui/views/past-week.ts`
- Modify: `src/ui/components/day.ts`

**Interfaces:**
- Consumes: `CalendarWeek` (Task 5); `weekRangeLabel` (Task 1); `PastDay` (Task 4).
- Produces:
  - `interface CalendarHandlers { onBack; onOpenWeek: (w: CalendarWeek) => void; onFixWeek: () => void; onChoosePlan: (weekKey: string, mode: "copy" | "empty") => void; onCancelChoice: () => void }`
  - `calendarView(weeks, outOfSync, currentWeekKey, choiceWeekKey, editable, h): TemplateResult`
  - `pastWeekView(weekKey: string, days: PastDay[] | null, onBack: () => void): TemplateResult`
  - `dayView` ganha o parâmetro `showTimer: boolean`

- [ ] **Step 1: Criar `src/ui/views/calendar.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import { weekRangeLabel } from "@/domain/week";
import type { CalendarWeek } from "@/domain/calendar";

export interface CalendarHandlers {
  onBack: () => void;
  onOpenWeek: (week: CalendarWeek) => void;
  onFixWeek: () => void;
  onChoosePlan: (weekKey: string, mode: "copy" | "empty") => void;
  onCancelChoice: () => void;
}

const ICONS: Record<CalendarWeek["state"], string> = {
  past: "ti-check",
  current: "ti-flame",
  planned: "ti-calendar-event",
  empty: "ti-calendar",
};

function stateLabel(week: CalendarWeek, editable: boolean): string {
  switch (week.state) {
    case "past":
      return week.setsDone ? `Concluída · ${week.setsDone} séries registradas` : "Sem registros";
    case "current":
      return `Semana atual · ${week.setsDone}/${week.setsTotal} séries`;
    case "planned":
      return "Planejada";
    case "empty":
      return editable ? "Ainda não planejada" : "Ainda não disponível";
  }
}

export function calendarView(
  weeks: CalendarWeek[],
  outOfSync: boolean,
  currentWeekKey: string,
  choiceWeekKey: string | null,
  editable: boolean,
  h: CalendarHandlers,
): TemplateResult {
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Calendário</span>
    </div>

    ${outOfSync && editable
      ? html`
          <div class="cal-warning">
            A semana marcada como atual não bate com a data de hoje.
            <button @click=${h.onFixWeek}>
              Corrigir para a semana de hoje (${weekRangeLabel(currentWeekKey)})
            </button>
          </div>`
      : null}

    ${choiceWeekKey
      ? html`
          <div class="plan-choice">
            <p>Como montar o treino de ${weekRangeLabel(choiceWeekKey)}?</p>
            <button class="dashed-btn" @click=${() => h.onChoosePlan(choiceWeekKey, "copy")}>
              <i class="ti ti-copy"></i> copiar o treino desta semana
            </button>
            <button class="dashed-btn" @click=${() => h.onChoosePlan(choiceWeekKey, "empty")}>
              <i class="ti ti-plus"></i> começar do zero
            </button>
            <button class="dashed-btn" @click=${h.onCancelChoice}>cancelar</button>
          </div>`
      : null}

    <div class="cal-list">
      ${weeks.map(
        (w) => html`
          <div class="cal-row ${w.state}" @click=${() => h.onOpenWeek(w)}>
            <i class="ti ${ICONS[w.state]} cal-icon"></i>
            <div style="flex:1;">
              <div class="cal-range">${weekRangeLabel(w.weekKey)}</div>
              <div class="cal-state">${stateLabel(w, editable)}</div>
            </div>
            <i class="ti ti-chevron-right cal-icon" style="font-size:15px;"></i>
          </div>`,
      )}
    </div>
  `;
}
```

- [ ] **Step 2: Criar `src/ui/views/past-week.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import { weekRangeLabel } from "@/domain/week";
import type { PastDay } from "@/domain/past-week";

/** `days === null` significa que o arquivo daquela semana ainda está sendo buscado. */
export function pastWeekView(
  weekKey: string,
  days: PastDay[] | null,
  onBack: () => void,
): TemplateResult {
  return html`
    <div class="day-head">
      <button class="back" @click=${onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">${weekRangeLabel(weekKey)}</span>
    </div>

    ${days === null
      ? html`<p class="muted-note">Carregando…</p>`
      : days.length === 0
        ? html`<p class="muted-note">Nenhuma série registrada nesta semana.</p>`
        : days.map(
            (d) => html`
              <div class="past-day">
                <h3>${d.dayTitle}</h3>
                ${d.exercises.map(
                  (ex) => html`
                    <div class="past-ex">
                      <div class="past-name">${ex.exName}</div>
                      ${ex.sets.map(
                        (s) => html`
                          <div class="past-set">
                            <span class="past-idx">${s.setIndex + 1}</span>
                            <span>${s.repsDone || "—"} reps</span>
                            <span>${s.load ? `${s.load} kg` : ""}</span>
                            <span>meta ${s.repsGoal || "—"}</span>
                          </div>`,
                      )}
                    </div>`,
                )}
              </div>`,
          )}
  `;
}
```

- [ ] **Step 3: Dar ao `dayView` a opção de esconder o cronômetro**

Em `src/ui/components/day.ts`, trocar a assinatura e o uso do botão:

```ts
export function dayView(
  day: Day,
  collapsed: ReadonlySet<string>,
  editable: boolean,
  showTimer: boolean,
  h: DayHandlers,
): TemplateResult {
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">${day.title}</span>
      <!-- num plano de semana futura não há sessão de treino para cronometrar -->
      ${showTimer ? timerButton(day.timerStartedAt, () => h.onToggleTimer(day.id)) : null}
    </div>
```

O resto da função continua igual.

- [ ] **Step 4: Verificar que compila**

```bash
npm run build
```

Esperado: FAIL, porque `src/ui/render.ts` ainda chama `dayView` com quatro argumentos. Corrigir as duas chamadas em `render.ts` acrescentando `true` na posição de `showTimer` — a Task 14 reescreve esse arquivo, e esta correção é só para manter a árvore compilando.

```bash
npm run build
```

Esperado: build limpo.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/calendar.ts src/ui/views/past-week.ts src/ui/components/day.ts src/ui/render.ts
git commit -m "feat: adiciona telas de calendário e semana passada"
```

---

### Task 14: ligar as telas — roteamento, handlers de navegação e botões

A tarefa que amarra tudo: roteamento em `render.ts`, os handlers de calendário e progressão, e os botões que abrem as telas novas.

**Files:**
- Create: `src/ui/handlers/screens.ts`
- Modify: `src/ui/handlers/index.ts`, `src/ui/render.ts`

**Interfaces:**
- Consumes: tudo das tarefas anteriores.
- Produces:
  - `screens` — objeto com os handlers de navegação, calendário e progressão
  - `render.ts` roteando `screen` e resolvendo os dias do alvo de edição

- [ ] **Step 1: Criar `src/ui/handlers/screens.ts`**

```ts
import { getState, setState } from "../state";
import { buildCalendarWeeks } from "@/domain/calendar";
import { createPlan } from "@/domain/plan-edit";
import { groupWeekByDay } from "@/domain/past-week";
import { mergeHistory } from "@/domain/history-merge";
import { todayKey, weekKeyOf } from "@/domain/week";
import { loadAllArchived, loadArchivedWeek } from "@/data/history-archive";
import { currentClient, persist } from "./target";
import { resetScreen } from "./trainer";
import type { CalendarWeek } from "@/domain/calendar";
import type { HistoryEntry } from "@/data/schema";

/** O histórico que as telas leem: o da ficha, mais o arquivo quando já foi carregado. */
export function visibleHistory(): HistoryEntry[] {
  const c = currentClient();
  if (!c) return [];
  const doDocumento = c.history ?? [];
  const arquivado = getState().archivedHistory;
  return arquivado ? mergeHistory(doDocumento, arquivado) : doDocumento;
}

async function openPastWeek(weekKey: string): Promise<void> {
  const c = currentClient();
  if (!c) return;
  setState({ screen: "pastWeek", pastWeekKey: weekKey, pastWeekEntries: null });

  const naFicha = (c.history ?? []).filter((h) => h.weekKey === weekKey);
  if (naFicha.length) {
    setState({ pastWeekEntries: naFicha });
    return;
  }
  // nada na ficha: ou a semana é anterior ao corte de 26 semanas e está no
  // arquivo, ou não houve treino. Uma leitura dirigida responde aos dois casos.
  try {
    setState({ pastWeekEntries: await loadArchivedWeek(c.id, weekKey) });
  } catch {
    setState({ pastWeekEntries: [], error: "Não foi possível carregar essa semana." });
  }
}

export const screens = {
  onOpenCalendar: () => setState({ screen: "calendar", activeDayId: null, planChoiceWeekKey: null }),
  onOpenProgression: () => setState({ screen: "progression", activeDayId: null }),
  onBackHome: () => resetScreen(),

  onTab: (progTab: "overall" | "table") => setState({ progTab, progSelectedWeek: null }),
  onSelectWeek: (progSelectedWeek: string) => setState({ progSelectedWeek }),

  onLoadArchive: async () => {
    const c = currentClient();
    if (!c || getState().archiveState === "loading") return;
    setState({ archiveState: "loading" });
    try {
      setState({ archivedHistory: await loadAllArchived(c.id), archiveState: "loaded" });
    } catch {
      setState({ archiveState: "error" });
    }
  },

  onFixWeek: () => {
    const c = currentClient();
    if (c) persist(c.id, { activeWeekKey: weekKeyOf(todayKey()) });
  },

  onCancelChoice: () => setState({ planChoiceWeekKey: null }),

  /**
   * Abre uma semana do calendário. Passado abre em leitura; a atual volta para a
   * grade; futura abre o plano, ou pergunta como criá-lo quando ele não existe.
   */
  onOpenWeek: (week: CalendarWeek) => {
    if (week.state === "past") { void openPastWeek(week.weekKey); return; }
    if (week.state === "current") { resetScreen(); return; }
    if (week.planId) {
      setState({
        screen: "home",
        editTarget: { kind: "plan", planId: week.planId },
        activeDayId: null,
        planChoiceWeekKey: null,
      });
      return;
    }
    // só o treinador cria plano; para o aluno a linha não leva a lugar nenhum
    if (getState().view !== "trainer") return;
    setState({ planChoiceWeekKey: week.weekKey });
  },

  onChoosePlan: (weekKey: string, mode: "copy" | "empty") => {
    const c = currentClient();
    if (!c) return;
    const plan = createPlan(c, weekKey, mode);
    persist(c.id, { weekPlans: [...(c.weekPlans ?? []), plan] });
    setState({
      screen: "home",
      editTarget: { kind: "plan", planId: plan.id },
      activeDayId: null,
      planChoiceWeekKey: null,
    });
  },

  pastWeekDays: () => {
    const s = getState();
    if (!s.pastWeekKey || s.pastWeekEntries === null) return null;
    return groupWeekByDay(s.pastWeekEntries, s.pastWeekKey);
  },

  calendarWeeks: () => {
    const c = currentClient();
    return c ? buildCalendarWeeks(c) : [];
  },
};
```

- [ ] **Step 2: Exportar em `src/ui/handlers/index.ts`**

```ts
export { gate } from "./gate";
export { trainer, student, clientSummary, resetScreen } from "./trainer";
export { day } from "./workout";
export { screens, visibleHistory } from "./screens";
```

- [ ] **Step 3: Reescrever `src/ui/render.ts`**

```ts
import { render, html, nothing, type TemplateResult } from "lit-html";
import { getState, subscribe } from "./state";
import { gateView } from "./views/gate";
import { trainerView } from "./views/trainer";
import { studentView } from "./views/student";
import { calendarView } from "./views/calendar";
import { pastWeekView } from "./views/past-week";
import { progressionView } from "./views/progression";
import { dayView } from "./components/day";
import { weekRangeLabel, todayKey, weekKeyOf } from "@/domain/week";
import { isWeekOutOfSync } from "@/domain/calendar";
import * as handlers from "./handlers";
import type { Client } from "@/data/schema";

const root = document.getElementById("app")!;

/** As telas da fase 2, comuns ao treinador e ao aluno. Devolve null na grade normal. */
function screenTemplate(client: Client, editable: boolean): TemplateResult | null {
  const s = getState();

  if (s.screen === "calendar") {
    return calendarView(
      handlers.screens.calendarWeeks(),
      isWeekOutOfSync(client, weekKeyOf(todayKey())),
      weekKeyOf(todayKey()),
      s.planChoiceWeekKey,
      editable,
      { ...handlers.screens, onBack: handlers.screens.onBackHome },
    );
  }

  if (s.screen === "pastWeek" && s.pastWeekKey) {
    return pastWeekView(s.pastWeekKey, handlers.screens.pastWeekDays(), handlers.screens.onOpenCalendar);
  }

  if (s.screen === "progression") {
    return progressionView(
      handlers.visibleHistory(),
      s.progTab,
      s.progSelectedWeek,
      s.archiveState,
      { ...handlers.screens, onBack: handlers.screens.onBackHome },
    );
  }

  return null;
}

/** Grade de treinos ou o dia aberto, do treino corrente ou do plano em edição. */
function homeTemplate(client: Client, editable: boolean): TemplateResult {
  const s = getState();
  const target = s.editTarget;
  const plan =
    target.kind === "plan"
      ? (client.weekPlans ?? []).find((p) => p.id === target.planId) ?? null
      : null;

  if (target.kind === "plan" && !plan) {
    // o plano sumiu embaixo da tela: promovido pela virada de semana, ou apagado
    return html`<p class="muted-note">Esse plano não existe mais.</p>`;
  }

  const days = plan ? plan.days : client.days ?? [];
  const day = days.find((d) => d.id === s.activeDayId);
  const banner = plan
    ? html`<div class="plan-banner">Planejando ${weekRangeLabel(plan.weekKey)}</div>`
    : null;

  if (day) {
    return html`${banner}${dayView(day, s.collapsedExercises, editable, !plan, handlers.day)}`;
  }

  return html`
    ${banner}
    <div class="prog-tabs">
      <button class="dashed-btn" @click=${handlers.screens.onOpenCalendar}>
        <i class="ti ti-calendar-stats"></i> Calendário
      </button>
      <button class="dashed-btn" @click=${handlers.screens.onOpenProgression}>
        <i class="ti ti-chart-line"></i> Progressão
      </button>
    </div>
    <!-- os dias vêm do alvo de edição: do treino corrente ou do plano aberto -->
    ${editable
      ? handlers.clientSummary({ ...client, days })
      : studentView({ ...client, days }, handlers.student)}
  `;
}

function template() {
  const s = getState();
  switch (s.view) {
    case "loading":
      return html`<p class="muted-note" style="text-align:center;padding-top:60px;">Carregando…</p>`;
    case "gate":
      return gateView(s.error, handlers.gate);
    case "trainer": {
      const client = s.clients.find((c) => c.id === s.selectedClientId) ?? null;
      const body = client ? screenTemplate(client, true) ?? homeTemplate(client, true) : null;
      return trainerView(s.clients, s.selectedClientId, body, s.error, handlers.trainer);
    }
    case "student": {
      if (!s.client) return nothing;
      // editable=false: o treinador prescreve a estrutura do treino; o aluno
      // registra. "feito" e "kg" continuam editáveis porque set-row não os
      // condiciona a `editable`.
      return screenTemplate(s.client, false) ?? homeTemplate(s.client, false);
    }
  }
}

export function renderApp(): void {
  render(template(), root);
}

subscribe(renderApp);
```

- [ ] **Step 4: Rodar a suíte e o build**

```bash
npm test && npm run build
```

Esperado: PASS e build limpo.

- [ ] **Step 5: Verificar no navegador**

```bash
npm run dev
```

Como treinador, com um aluno que já tem histórico:

1. Abrir **Progressão**. A aba "Treino inteiro" mostra barras; tocar numa barra mostra a semana e o número embaixo.
2. Trocar para **Tabela**. Cada linha é um exercício e uma posição de série, com uma coluna por semana e setas entre semanas.
3. Tocar em **carregar histórico completo**. O texto muda para "Histórico completo carregado" e, se o aluno tiver mais de 26 semanas, aparecem colunas mais antigas.
4. Abrir **Calendário**. Conferir os estados das seis semanas.
5. Tocar numa **semana passada**: abre em leitura, agrupada por dia.
6. Tocar numa **semana futura vazia**: aparecem as opções de copiar e começar do zero. Escolher copiar, conferir o aviso "Planejando…", editar uma série e confirmar que o cronômetro **não** aparece.
7. Recarregar a página e confirmar, no calendário, que aquela semana agora aparece como "Planejada".

- [ ] **Step 6: Confirmar que editar plano não gera histórico**

No Console do Firestore, abrir o documento do aluno depois do passo 6 e verificar que o array `history` **não** ganhou entrada com a `weekKey` da semana planejada.

- [ ] **Step 7: Commit**

```bash
git add src/ui/handlers src/ui/render.ts
git commit -m "feat: liga calendário, progressão, semana passada e plano futuro"
```

---

### Task 15: publicar e verificar em produção

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

O workflow roda os testes antes de publicar. Acompanhar:

```bash
gh run watch --repo fermmura/muratraining2 --exit-status
```

- [ ] **Step 3: Verificar em https://fermmura.github.io/muratraining2/**

Como treinador:

1. Progressão de um aluno antigo abre sem demora perceptível, **sem** ter lido o arquivo.
2. O botão de histórico completo traz as semanas mais antigas.
3. Criar plano para a próxima semana, escolher "começar do zero", acrescentar um exercício.

Como aluno, em janela anônima:

4. A progressão abre e mostra os próprios dados.
5. O calendário mostra a semana planejada, e tocar numa semana futura sem plano não cria nada.
6. Registrar uma série na semana atual continua salvando.

- [ ] **Step 4: Verificar que o 1.0 não quebrou**

Abrir o 1.0 como treinador e como aluno. Os dois apps escrevem os mesmos campos; o que mudou foi só a tela do 2.0. Confirmar que ler e salvar continuam funcionando.

- [ ] **Step 5: Commit de status**

```bash
git commit --allow-empty -m "chore: fase 2 no ar"
git push
```

---

## Verificação da fase

A fase 2 está pronta quando tudo abaixo for verdade:

- [ ] `npm test` passa, com os testes novos de `week`, `history-merge`, `progression`, `past-week`, `calendar`, `plan-edit`, `state` e `week-bars`.
- [ ] `npm run build` passa sem erro de TypeScript.
- [ ] Nenhum arquivo de `src/` passa de ~250 linhas.
- [ ] Nenhuma dependência nova em `package.json`.
- [ ] A tabela de progressão mostra a mesma série em semanas diferentes **na mesma linha**.
- [ ] O botão de histórico completo traz semanas anteriores ao corte de 26 semanas.
- [ ] Editar um plano de semana futura não cria entrada em `history`.
- [ ] O cronômetro não aparece dentro de um plano de semana futura.
- [ ] Tocar numa semana futura vazia não grava nada antes da escolha.
- [ ] O 1.0 continua lendo e salvando.

## O que fica para as fases seguintes

Registrado para não ser confundido com lacuna do plano: fotos de exercício — e portanto a cópia de fotos ao planejar uma semana —, cardio, volume por grupo muscular, feedbacks e WhatsApp (fase 3); importação de treino por texto, personalização de cores e fontes, página de dados com backup e exportação, banner de instalação (fase 4); migração de `history` inteiro para subcoleção, depois que o 1.0 sair do ar.
