# MuraTraining 2.0 — Fase 4a (importação por texto, personalização e banner de instalação) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a importação de treino por texto com prévia, a tela de personalização de cores e fontes (aplicando o tema publicado para todos) e o banner de instalação do app.

**Architecture:** O parser do 1.0 é transcrito em `src/domain/workout-import.ts` e o tema mora em `src/domain/theme.ts`, os dois como funções puras testadas. O tema continua em `settings/theme = { draft, published }`, o documento do 1.0. Quem aplica o tema na tela é um único inscrito no estado (`startThemeSync`): ele mostra o rascunho enquanto o treinador está na personalização e o publicado no resto. O banner de instalação decide o que mostrar por uma função pura (`installKindFor`) e guarda a dispensa na mesma chave de `localStorage` do 1.0.

**Tech Stack:** Vite 5, TypeScript 5, lit-html 3, Firebase JS SDK 10 (modular), vite-plugin-pwa 0.20, Vitest 2. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-10-05-fase-4a-importacao-tema-instalacao-design.md`

## Global Constraints

Valem para **todas** as tarefas.

- **Compatibilidade de schema é obrigatória.** Nunca renomeie, remova ou mude o formato gravado de um campo. Só é permitido **adicionar**.
- **Tema:** `settings/theme = { draft: Theme, published: Theme }`. Publicar e restaurar gravam o **mesmo** tema nos dois campos, com `merge: true`. O 2.0 nunca lê `draft`.
- **Parser fiel ao 1.0** (`app.js:2357-2516`). Os valores esperados nos testes saíram do parser do 1.0 rodado sobre os mesmos textos. Se um teste falhar, corrija o código, não o teste.
- **Importação só adiciona** dias ao fim de `days`, e só nos treinos atuais (nunca num plano de semana futura).
- **Dispensa do banner:** chave `install-banner-dismissed` = `"1"` em `localStorage`, a mesma do 1.0. Todo acesso ao `localStorage` dentro de try/catch.
- **Esta fase não altera `firestore.rules`.** `settings/{doc}` já permite leitura a qualquer logado e escrita só ao treinador. Se alguma tarefa parecer exigir regra nova, pare e escale.
- **Nenhuma dependência nova** em `package.json`.
- Comentários e textos de interface em português. Identificadores de código em inglês, inclusive nos testes.
- **Nenhum arquivo de `src/` passa de ~250 linhas.** `src/ui/styles.css` já tem 275; estilos novos vão para `src/ui/styles-import-theme.css`.

## O que já existe

```ts
// src/data/schema.ts   Day { id, title, exercises }, Exercise { id, name, notes, sets, muscle?, synergist?, ... }, ExerciseSet
// src/data/id.ts       uid(): string
// src/domain/muscle.ts guessMuscle(name): string; guessSynergist(name): string   ("" quando não reconhece)
// src/ui/state.ts      getState(), setState(patch), subscribe(fn), Screen, AppState
// src/ui/handlers/target.ts  currentClient(); persist(clientId, patch)
// src/ui/handlers/trainer.ts resetScreen()  — volta para a grade do treino corrente (screen "home")
// src/ui/views/trainer.ts    trainerView(clients, selectedId, body, error, h: TrainerHandlers)
// src/ui/render.ts     screenTemplate(client, editable), homeTemplate(client, editable), template()
// src/ui/styles.css    .theme-row, .theme-row input[type=color], .theme-row select, #install-banner (já existem)
```

`index.html` já carrega Anton e Inter, as fontes padrão. O `.update-banner` (3b) fica no topo, dentro do fluxo; o `#install-banner` é fixo no rodapé.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/domain/workout-import.ts` | texto → `Day[]`; resumo e agrupamento de séries para a prévia |
| `src/domain/theme.ts` | `Theme`, padrão, rótulos, listas de fonte, `mergeTheme`, `fontHref` |
| `src/data/theme-repo.ts` | ler o tema publicado e publicar |
| `src/ui/theme.ts` | aplicar o tema no `<html>` e mantê-lo em sincronia com o estado |
| `src/ui/install.ts` | `beforeinstallprompt`, iOS, standalone, dispensa |
| `src/ui/handlers/import.ts`, `src/ui/views/import.ts` | tela de importação (texto → prévia → adicionar) |
| `src/ui/handlers/theme.ts`, `src/ui/views/theme.ts` | tela de personalização |
| `src/ui/components/install-banner.ts` | o banner |
| `src/ui/styles-import-theme.css` | estilos novos |

---

### Task 1: `domain/workout-import.ts` — ler o treino colado

**Files:**
- Create: `src/domain/workout-import.ts`
- Test: `src/domain/workout-import.test.ts`

**Interfaces:**
- Consumes: `uid()` (`@/data/id`); `guessMuscle`, `guessSynergist` (`./muscle`).
- Produces:
  ```ts
  export interface ImportSummary { days: number; exercises: number; sets: number }
  export interface SetGroup { count: number; repsGoal: string; load: string; rir: string }
  export function parseWorkoutText(text: string): Day[]
  export function importSummary(days: Day[]): ImportSummary
  export function setGroups(sets: ExerciseSet[]): SetGroup[]
  ```

Diferença deliberada em relação ao 1.0: quando o músculo ou o sinergista não é reconhecido, o 1.0 grava `muscle: ""`; aqui o campo fica ausente. Os dois são lidos como "sem músculo" pelo 2.0 (`guessedMuscles` testa `if (ex.muscle)`) e pelo 1.0.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/domain/workout-import.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseWorkoutText, importSummary, setGroups } from "./workout-import";
import type { Day, ExerciseSet } from "@/data/schema";

// Os valores esperados saíram do parser do próprio 1.0 rodado sobre os mesmos
// textos: o 2.0 tem de ler igual enquanto os dois convivem.

/** Tira os ids, que são aleatórios, para comparar só a estrutura. */
function shape(days: Day[]) {
  return days.map((d) => ({
    title: d.title,
    exercises: d.exercises.map(({ id: _id, sets, ...e }) => ({
      ...e,
      sets: sets.map(({ id: _sid, ...s }) => s),
    })),
  }));
}

function set(repsGoal: string, load = "", rir = "") {
  return { repsGoal, repsDone: "", load, intensity: 0, rir, rirEnabled: false };
}

describe("parseWorkoutText", () => {
  it("lê dia, exercício e séries com carga e RIR", () => {
    const days = parseWorkoutText("Segunda-feira\nSupino reto\n3x8-12r 40kg 2rir");
    expect(shape(days)).toEqual([
      {
        title: "Segunda-feira",
        exercises: [{
          name: "Supino reto", muscle: "Peito", synergist: "Tríceps", notes: "",
          sets: [set("8-12", "40", "2"), set("8-12", "40", "2"), set("8-12", "40", "2")],
        }],
      },
    ]);
  });

  it("ignora as linhas antes do primeiro dia", () => {
    const days = parseWorkoutText("Ficha do João\nObjetivo: hipertrofia\nTerça\nRosca direta\n2x10r");
    expect(shape(days)).toEqual([
      {
        title: "Terça",
        exercises: [{ name: "Rosca direta", muscle: "Bíceps", notes: "", sets: [set("10"), set("10")] }],
      },
    ]);
  });

  it("devolve vazio sem nenhum dia da semana", () => {
    expect(parseWorkoutText("Supino reto\n3x10r")).toEqual([]);
    expect(parseWorkoutText("")).toEqual([]);
  });

  it("tira asteriscos do dia, dois-pontos do nome e não confunde placa com repetição", () => {
    const days = parseWorkoutText("**Quarta-feira**\nAgachamento livre:\n4x6-8r placa 5\n3x placa 4 12r");
    const [ex] = days[0].exercises;
    expect(days[0].title).toBe("Quarta-feira");
    expect(ex.name).toBe("Agachamento livre");
    expect(ex.sets.map((s) => [s.repsGoal, s.load])).toEqual([
      ["6-8", "Placa 5"], ["6-8", "Placa 5"], ["6-8", "Placa 5"], ["6-8", "Placa 5"],
      ["12", "Placa 4"], ["12", "Placa 4"], ["12", "Placa 4"],
    ]);
    // o 1.0 deixa o "12r" do formato solto como nota da última série
    expect(ex.notes).toBe("(série 7) 12r");
  });

  it("lê peso do corpo, zerada e sem peso", () => {
    const days = parseWorkoutText(
      "Quinta\nFlexão\n3x10r peso do corpo\nAbdominal\n2x15r zerada\nPrancha\n1x 30s sem peso",
    );
    expect(shape(days)[0].exercises).toEqual([
      { name: "Flexão", notes: "", sets: [set("10", "corpo"), set("10", "corpo"), set("10", "corpo")] },
      { name: "Abdominal", muscle: "Abdômen", notes: "", sets: [set("15", "0"), set("15", "0")] },
      { name: "Prancha", muscle: "Abdômen", notes: "(série 1) 30s", sets: [set("", "0")] },
    ]);
  });

  it("junta as notas e cria o aquecimento quando a nota vem antes de qualquer exercício", () => {
    const days = parseWorkoutText(
      "Sexta\nDescanso no máximo 1m30\nRemada curvada\n- segurar 2s\n(sem strap)\n*foco na escápula*\n12r 20kg\n3x10r 50kg cluster",
    );
    expect(shape(days)[0].exercises).toEqual([
      { name: "Aquecimento / Mobilidade", notes: "Descanso no máximo 1m30", sets: [] },
      {
        name: "Remada curvada", muscle: "Costas", synergist: "Bíceps",
        notes: "segurar 2s; sem strap; foco na escápula; 12r 20kg; (série 3) cluster",
        sets: [set("10", "50"), set("10", "50"), set("10", "50")],
      },
    ]);
  });

  it("separa vários dias e dá id próprio a cada dia, exercício e série", () => {
    const days = parseWorkoutText(
      "Segunda\nSupino\n2x10r\n\nQuarta\nLeg press\n3x12r 100kg\nCadeira extensora\n2x15r",
    );
    expect(days.map((d) => d.title)).toEqual(["Segunda", "Quarta"]);
    expect(days[1].exercises.map((e) => e.name)).toEqual(["Leg press", "Cadeira extensora"]);
    const ids = days.flatMap((d) => [d.id, ...d.exercises.flatMap((e) => [e.id, ...e.sets.map((s) => s.id)])]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("importSummary", () => {
  it("conta dias, exercícios e séries", () => {
    const days = parseWorkoutText(
      "Segunda\nSupino\n2x10r\n\nQuarta\nLeg press\n3x12r 100kg\nCadeira extensora\n2x15r",
    );
    expect(importSummary(days)).toEqual({ days: 2, exercises: 3, sets: 7 });
    expect(importSummary([])).toEqual({ days: 0, exercises: 0, sets: 0 });
  });
});

describe("setGroups", () => {
  const s = (repsGoal: string, load: string, rir = ""): ExerciseSet => ({
    id: "x", repsGoal, repsDone: "", load, intensity: 0, rir, rirEnabled: false,
  });

  it("agrupa só séries iguais e seguidas", () => {
    expect(setGroups([s("10", "40"), s("10", "40"), s("8", "45"), s("10", "40")])).toEqual([
      { count: 2, repsGoal: "10", load: "40", rir: "" },
      { count: 1, repsGoal: "8", load: "45", rir: "" },
      { count: 1, repsGoal: "10", load: "40", rir: "" },
    ]);
  });

  it("separa pelo RIR", () => {
    expect(setGroups([s("10", "40", "2"), s("10", "40", "1")])).toHaveLength(2);
  });

  it("devolve vazio sem séries", () => {
    expect(setGroups([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/domain/workout-import.test.ts`
Expected: FAIL — `Failed to resolve import "./workout-import"`.

- [ ] **Step 3: Implementar `src/domain/workout-import.ts`**

```ts
import { uid } from "@/data/id";
import { guessMuscle, guessSynergist } from "./muscle";
import type { Day, Exercise, ExerciseSet } from "@/data/schema";

/*
 * Leitura de treino colado como texto. Transcrição fiel do 1.0
 * (app.js:2357-2516): o mesmo texto precisa dar o mesmo treino nos dois apps
 * enquanto eles convivem. Corrigir uma regra daqui é mudança de comportamento,
 * fora desta fase.
 */

const WEEKDAY_RE = /\b(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)\b/i;
const WARMUP_NAME = "Aquecimento / Mobilidade";

interface SetLine {
  count: number;
  range: string;
  load: string;
  rir: string;
  extraNote: string;
}

export interface ImportSummary {
  days: number;
  exercises: number;
  sets: number;
}

/** Séries iguais e seguidas, para a prévia mostrar "3× 8-12" em vez de três linhas. */
export interface SetGroup {
  count: number;
  repsGoal: string;
  load: string;
  rir: string;
}

function stripStars(line: string): string {
  return line.replace(/^\*+/, "").replace(/\*+$/, "").trim();
}

/** RIR, carga e o que sobrar, do texto depois do "Nx" e do range de reps. */
function extractRest(count: number, range: string, rest: string): SetLine {
  let load = "";
  let rir = "";

  const rirMatch = rest.match(/(\d+)\s*rir\b/i);
  if (rirMatch) rir = rirMatch[1];

  const placaMatch = rest.match(/placa\s*(\d+)/i);
  const kgMatch = rest.match(/([\d]+(?:[.,]\d+)?)\s*kg/i);

  if (placaMatch) load = `Placa ${placaMatch[1]}`;
  else if (/zerada|sem peso/i.test(rest)) load = "0";
  else if (kgMatch) load = kgMatch[1];
  else if (/peso do corpo|\bcorpo\b/i.test(rest)) load = "corpo";

  // o que não virou range/kg/rir vira observação, para não perder informação
  let leftover = rest;
  for (const m of [rirMatch, placaMatch, kgMatch]) {
    if (m) leftover = leftover.replace(m[0], "");
  }
  leftover = leftover.replace(/zerada|sem peso|peso do corpo|\bkg\b/gi, "");
  leftover = leftover.replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, "").trim();

  return { count, range, load, rir, extraNote: leftover };
}

function parseWorkLine(line: string): SetLine | null {
  // formato limpo: "NxRANGEr resto"
  const clean = line.match(/^(\d+)\s*x\s*(\d+)(?:[-\s]+(\d+))?\s*r\b(.*)$/i);
  if (clean) {
    const count = parseInt(clean[1], 10) || 1;
    const range = clean[3] ? `${clean[2]}-${clean[3]}` : clean[2];
    return extractRest(count, range, clean[4] || "");
  }

  // formato solto: "Nx resto qualquer" (placa, cluster... sem range logo depois do x)
  const loose = line.match(/^(\d+)\s*x\s*(.*)$/i);
  if (loose) {
    const count = parseInt(loose[1], 10) || 1;
    const rest = loose[2] || "";
    const restForRange = rest.replace(/placa\s*\d+/i, ""); // o nº da placa não vira reps
    const rangeMatch = restForRange.match(/(\d+)(?:[-\s]+(\d+))?\s*r\b/i);
    const range = rangeMatch ? (rangeMatch[2] ? `${rangeMatch[1]}-${rangeMatch[2]}` : rangeMatch[1]) : "";
    return extractRest(count, range, rest);
  }

  return null;
}

/** Aquecimento sem "-" na frente, tipo "12r 0kg" ou "5 8r 40kg". */
function isPrepLine(line: string): boolean {
  return /^\d+(?:[-\s]+\d+)?\s*r\b/i.test(line) && !/^\d+\s*x/i.test(line);
}

/** Instrução geral, que não é exercício nem série. */
function looksLikeInstruction(line: string): boolean {
  return /^(descanso|obs|observa[cç][aã]o|dica)\b/i.test(line);
}

function newExercise(name: string): Exercise {
  const ex: Exercise = { id: uid(), name, notes: "", sets: [] };
  const muscle = guessMuscle(name);
  const synergist = guessSynergist(name);
  if (muscle) ex.muscle = muscle;
  if (synergist) ex.synergist = synergist;
  return ex;
}

function newSet(line: SetLine): ExerciseSet {
  return {
    id: uid(), repsGoal: line.range, repsDone: "", load: line.load,
    intensity: 0, rir: line.rir, rirEnabled: false,
  };
}

/**
 * Dias lidos do texto. Linhas antes do primeiro dia da semana são ignoradas
 * (título da ficha, nome do aluno). Sem nenhum dia, devolve [].
 */
export function parseWorkoutText(text: string): Day[] {
  const days: Day[] = [];
  const notes = new Map<Exercise, string[]>();
  let day: Day | null = null;
  let ex: Exercise | null = null;

  const current = (d: Day): Exercise => {
    if (!ex) {
      ex = { id: uid(), name: WARMUP_NAME, notes: "", sets: [] };
      d.exercises.push(ex);
    }
    return ex;
  };
  const note = (e: Exercise, s: string) => {
    const list = notes.get(e) ?? [];
    list.push(s);
    notes.set(e, list);
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    if (WEEKDAY_RE.test(line)) {
      day = { id: uid(), title: stripStars(line), exercises: [] };
      days.push(day);
      ex = null;
      continue;
    }
    if (!day) continue;

    if (line.startsWith("-")) {
      note(current(day), line.slice(1).trim());
      continue;
    }

    const work = parseWorkLine(line);
    if (work) {
      const e = current(day);
      for (let n = 0; n < work.count; n++) e.sets.push(newSet(work));
      if (work.extraNote) note(e, `(série ${e.sets.length}) ${work.extraNote}`);
      continue;
    }

    if (isPrepLine(line) || looksLikeInstruction(line)) {
      note(current(day), line);
      continue;
    }

    if (line.startsWith("*") || (line.startsWith("(") && line.endsWith(")"))) {
      note(current(day), stripStars(line).replace(/^\(|\)$/g, ""));
      continue;
    }

    // qualquer outra linha é um exercício novo
    ex = newExercise(line.replace(/:$/, ""));
    day.exercises.push(ex);
  }

  for (const [e, list] of notes) e.notes = list.join("; ");
  return days;
}

export function importSummary(days: Day[]): ImportSummary {
  const exercises = days.flatMap((d) => d.exercises);
  return {
    days: days.length,
    exercises: exercises.length,
    sets: exercises.reduce((n, e) => n + e.sets.length, 0),
  };
}

export function setGroups(sets: ExerciseSet[]): SetGroup[] {
  const groups: SetGroup[] = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && last.repsGoal === s.repsGoal && last.load === s.load && last.rir === s.rir) {
      last.count++;
    } else {
      groups.push({ count: 1, repsGoal: s.repsGoal, load: s.load, rir: s.rir });
    }
  }
  return groups;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/domain/workout-import.test.ts`
Expected: PASS (11 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/workout-import.ts src/domain/workout-import.test.ts
git commit -m "feat: lê treino colado como texto, com as regras do 1.0"
```

---

### Task 2: `domain/theme.ts` — tema, padrão e validação

**Files:**
- Create: `src/domain/theme.ts`
- Test: `src/domain/theme.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Theme { bg; panel; panelAlt; line; chalk; muted; red; redDim; steel; plate; fontDisplay; fontBody: string }
  export type ColorKey = Exclude<keyof Theme, "fontDisplay" | "fontBody">
  export const DEFAULT_THEME: Theme
  export const THEME_COLORS: { key: ColorKey; label: string }[]
  export const FONT_DISPLAY_OPTIONS: string[]
  export const FONT_BODY_OPTIONS: string[]
  export function mergeTheme(saved: unknown): Theme
  export function fontHref(family: string): string
  ```

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/domain/theme.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_THEME, THEME_COLORS, mergeTheme, fontHref } from "./theme";

describe("THEME_COLORS", () => {
  it("tem as 10 cores do 1.0, sem as fontes", () => {
    expect(THEME_COLORS.map((c) => c.key)).toEqual([
      "bg", "panel", "panelAlt", "line", "chalk", "muted", "red", "redDim", "steel", "plate",
    ]);
  });
});

describe("mergeTheme", () => {
  it("devolve o padrão sem documento", () => {
    expect(mergeTheme(undefined)).toEqual(DEFAULT_THEME);
    expect(mergeTheme(null)).toEqual(DEFAULT_THEME);
    expect(mergeTheme("lixo")).toEqual(DEFAULT_THEME);
    expect(mergeTheme({})).toEqual(DEFAULT_THEME);
  });

  it("aceita um tema completo e válido", () => {
    const t = { ...DEFAULT_THEME, bg: "#000000", red: "#00ff00", fontDisplay: "Oswald", fontBody: "Roboto" };
    expect(mergeTheme(t)).toEqual(t);
  });

  it("completa os campos que faltam com o padrão", () => {
    expect(mergeTheme({ bg: "#101010" })).toEqual({ ...DEFAULT_THEME, bg: "#101010" });
  });

  it("descarta cor inválida, campo a campo", () => {
    const t = mergeTheme({ bg: "red", panel: "#12345", line: 42, chalk: "#ABCDEF" });
    expect(t.bg).toBe(DEFAULT_THEME.bg);
    expect(t.panel).toBe(DEFAULT_THEME.panel);
    expect(t.line).toBe(DEFAULT_THEME.line);
    expect(t.chalk).toBe("#ABCDEF");
  });

  it("descarta fonte fora da lista", () => {
    const t = mergeTheme({ fontDisplay: "Comic Sans MS", fontBody: "Poppins" });
    expect(t.fontDisplay).toBe("Anton");
    expect(t.fontBody).toBe("Poppins");
  });

  it("ignora campos desconhecidos", () => {
    expect(mergeTheme({ extra: "#000000" })).toEqual(DEFAULT_THEME);
  });
});

describe("fontHref", () => {
  it("pede os pesos de 400 a 700", () => {
    expect(fontHref("Work Sans")).toBe(
      "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap",
    );
  });

  it("não pede pesos de fonte que só tem um", () => {
    expect(fontHref("Bebas Neue")).toBe("https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/domain/theme.test.ts`
Expected: FAIL — `Failed to resolve import "./theme"`.

- [ ] **Step 3: Implementar `src/domain/theme.ts`**

```ts
/*
 * Tema do app: as 10 cores e as 2 fontes do 1.0 (app.js:24-32), no mesmo
 * documento `settings/theme = { draft, published }`. Os dois apps leem e
 * gravam o mesmo formato enquanto convivem.
 */

export interface Theme {
  bg: string;
  panel: string;
  panelAlt: string;
  line: string;
  chalk: string;
  muted: string;
  red: string;
  redDim: string;
  steel: string;
  plate: string;
  fontDisplay: string;
  fontBody: string;
}

export type ColorKey = Exclude<keyof Theme, "fontDisplay" | "fontBody">;

export const DEFAULT_THEME: Theme = {
  bg: "#17161A", panel: "#211F25", panelAlt: "#2A2830", line: "#3A3742",
  chalk: "#F3EFE6", muted: "#9A94A6", red: "#FF4433", redDim: "#5C2620",
  steel: "#4C86B4", plate: "#E8B94A",
  fontDisplay: "Anton", fontBody: "Inter",
};

/** Na ordem e com os rótulos da tela do 1.0. */
export const THEME_COLORS: { key: ColorKey; label: string }[] = [
  { key: "bg", label: "Fundo" },
  { key: "panel", label: "Painel" },
  { key: "panelAlt", label: "Painel (alt)" },
  { key: "line", label: "Bordas" },
  { key: "chalk", label: "Texto principal" },
  { key: "muted", label: "Texto secundário" },
  { key: "red", label: "Destaque (botões)" },
  { key: "redDim", label: "Destaque escuro" },
  { key: "steel", label: "Cor do kg" },
  { key: "plate", label: "Cor da meta" },
];

export const FONT_DISPLAY_OPTIONS = ["Anton", "Bebas Neue", "Oswald", "Poppins", "Montserrat"];
export const FONT_BODY_OPTIONS = ["Inter", "Roboto", "Work Sans", "Nunito Sans", "Poppins"];

/** Fontes que o Google Fonts só tem num peso: pedir 500-700 delas falha. */
const SINGLE_WEIGHT = new Set(["Anton", "Bebas Neue"]);

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * O tema salvo, completado com o padrão campo a campo. Cor fora de `#rrggbb`
 * e fonte fora da lista caem no padrão: um documento estragado nunca deixa o
 * app ilegível.
 */
export function mergeTheme(saved: unknown): Theme {
  const t: Theme = { ...DEFAULT_THEME };
  if (!saved || typeof saved !== "object") return t;
  const s = saved as Record<string, unknown>;
  for (const { key } of THEME_COLORS) {
    const v = s[key];
    if (typeof v === "string" && HEX.test(v)) t[key] = v;
  }
  if (typeof s.fontDisplay === "string" && FONT_DISPLAY_OPTIONS.includes(s.fontDisplay)) t.fontDisplay = s.fontDisplay;
  if (typeof s.fontBody === "string" && FONT_BODY_OPTIONS.includes(s.fontBody)) t.fontBody = s.fontBody;
  return t;
}

/** Endereço do Google Fonts para uma família só. */
export function fontHref(family: string): string {
  const name = family.replace(/ /g, "+");
  const weights = SINGLE_WEIGHT.has(family) ? "" : ":wght@400;500;600;700";
  return `https://fonts.googleapis.com/css2?family=${name}${weights}&display=swap`;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/domain/theme.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/theme.ts src/domain/theme.test.ts
git commit -m "feat: tema do 1.0 com validação campo a campo"
```

---

### Task 3: tela de importação

**Files:**
- Modify: `src/ui/state.ts`
- Create: `src/ui/handlers/import.ts`
- Create: `src/ui/views/import.ts`
- Create: `src/ui/styles-import-theme.css`
- Modify: `src/ui/handlers/index.ts`
- Modify: `src/ui/render.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `parseWorkoutText`, `importSummary`, `setGroups`, `SetGroup` (Task 1); `currentClient`, `persist` (`./target`); `resetScreen` (`./trainer`).
- Produces:
  ```ts
  // state.ts
  Screen += "import"; AppState += { importText: string; importPreview: Day[] | null; importError: string | null }
  // handlers/import.ts
  export const importer: { onOpen(); onRead(text: string); onEdit(); onConfirm(); onClose() }
  // views/import.ts
  export interface ImportHandlers { onRead; onEdit; onConfirm; onClose }
  export function importView(text: string, preview: Day[] | null, error: string | null, h: ImportHandlers): TemplateResult
  ```

- [ ] **Step 1: Estado em `src/ui/state.ts`**

Trocar o import do schema por:

```ts
import type { Client, Day, HistoryEntry } from "@/data/schema";
```

Trocar a declaração de `Screen` por:

```ts
/** Tela aberta dentro da área do aluno. `home` é a grade de treinos da fase 1. */
export type Screen =
  | "home" | "calendar" | "pastWeek" | "progression" | "cardio" | "feedback" | "muscle"
  | "import";
```

Em `AppState`, logo depois de `updateReady: boolean;`:

```ts
  /** Texto colado na importação, guardado para voltar da prévia e corrigir. */
  importText: string;
  /** O que o texto virou; null enquanto não foi lido. */
  importPreview: Day[] | null;
  importError: string | null;
```

Em `INITIAL`, logo depois de `updateReady: false,`:

```ts
  importText: "",
  importPreview: null,
  importError: null,
```

- [ ] **Step 2: Criar `src/ui/handlers/import.ts`**

```ts
import { getState, setState } from "../state";
import { parseWorkoutText } from "@/domain/workout-import";
import { currentClient, persist } from "./target";
import { resetScreen } from "./trainer";

// mensagens do 1.0
const EMPTY = "Cole o texto do treino antes de importar.";
const NO_DAY = 'Não encontrei nenhum dia da semana nesse texto (ex.: "Segunda-feira"). Confira o formato.';

/** `importer`, e não `import`: a palavra é reservada. */
export const importer = {
  onOpen: () => {
    // só nos treinos atuais, como no 1.0: num plano de semana futura o botão nem aparece
    if (getState().editTarget.kind !== "current") return;
    setState({ screen: "import", activeDayId: null, importText: "", importPreview: null, importError: null });
  },

  onRead: (text: string) => {
    if (!text.trim()) {
      setState({ importText: text, importPreview: null, importError: EMPTY });
      return;
    }
    const days = parseWorkoutText(text);
    setState({
      importText: text,
      importPreview: days.length ? days : null,
      importError: days.length ? null : NO_DAY,
    });
  },

  /** Volta da prévia para a caixa, com o texto que estava lá. */
  onEdit: () => setState({ importPreview: null }),

  /** Acrescenta os dias lidos ao fim dos treinos do aluno, sem tocar nos que já existem. */
  onConfirm: () => {
    const c = currentClient();
    const days = getState().importPreview;
    if (!c || !days) return;
    persist(c.id, { days: [...(c.days ?? []), ...days] });
    setState({ importText: "", importPreview: null });
    resetScreen();
  },

  onClose: () => resetScreen(),
};
```

- [ ] **Step 3: Criar `src/ui/views/import.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import { importSummary, setGroups, type SetGroup } from "@/domain/workout-import";
import type { Day } from "@/data/schema";

export interface ImportHandlers {
  onRead: (text: string) => void;
  onEdit: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "3× 8-12 · 40 kg · 2 RIR". Carga que não é número ("Placa 5", "corpo") sai como veio. */
function groupLabel(g: SetGroup): string {
  const parts = [`${g.count}×${g.repsGoal ? ` ${g.repsGoal}` : ""}`];
  if (g.load) parts.push(/^\d+(?:[.,]\d+)?$/.test(g.load) ? `${g.load} kg` : g.load);
  if (g.rir) parts.push(`${g.rir} RIR`);
  return parts.join(" · ");
}

function textStep(text: string, error: string | null, h: ImportHandlers): TemplateResult {
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onClose}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Importar treino</span>
    </div>
    <p class="muted-note import-hint">
      Cole o texto do treino no formato de dias da semana, nomes de exercício e linhas com
      "1x10-12r 20kg". Isso <b>adiciona</b> novos treinos sem apagar os que já existem.
    </p>
    <form @submit=${(e: Event) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      h.onRead((form.elements.namedItem("text") as HTMLTextAreaElement).value);
    }}>
      <textarea class="import-text" name="text" .value=${text}
        placeholder=${"Segunda-feira (...)\nNome do exercício\n-8r 10kg\n1x9-12r 26kg\n..."}></textarea>
      ${error ? html`<p class="import-error">${error}</p>` : null}
      <div class="import-actions">
        <button class="cta" type="submit">Ler</button>
      </div>
    </form>
  `;
}

function previewStep(days: Day[], h: ImportHandlers): TemplateResult {
  const sum = importSummary(days);
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onEdit}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Conferir</span>
    </div>
    <p class="muted-note import-hint">
      ${plural(sum.days, "dia", "dias")}, ${plural(sum.exercises, "exercício", "exercícios")},
      ${plural(sum.sets, "série", "séries")}. Serão adicionados aos treinos do aluno, sem apagar os que já existem.
    </p>
    ${days.map(
      (d) => html`
        <div class="import-day">
          <h3 class="display">${d.title}</h3>
          ${d.exercises.map(
            (ex) => html`
              <div class="import-ex">
                <div class="import-ex-name">
                  ${ex.name}
                  ${ex.muscle ? html`<span class="import-ex-muscle">${ex.muscle}</span>` : null}
                </div>
                ${setGroups(ex.sets).map((g) => html`<div class="import-sets">${groupLabel(g)}</div>`)}
                ${ex.notes ? html`<div class="import-notes">${ex.notes}</div>` : null}
              </div>`,
          )}
        </div>`,
    )}
    <div class="import-actions">
      <button class="cta" @click=${h.onConfirm}>Adicionar ao aluno</button>
      <button class="dashed-btn import-back" @click=${h.onEdit}>Voltar e corrigir</button>
    </div>
  `;
}

export function importView(
  text: string,
  preview: Day[] | null,
  error: string | null,
  h: ImportHandlers,
): TemplateResult {
  return preview ? previewStep(preview, h) : textStep(text, error, h);
}
```

- [ ] **Step 4: Criar `src/ui/styles-import-theme.css` e importar em `src/main.ts`**

```css
/* importar treino */
.import-hint { margin-bottom: 12px; line-height: 1.5; }
.import-text { width: 100%; min-height: 240px; background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
  padding: 10px; font-size: 13px; color: var(--chalk); resize: vertical; font-family: monospace; line-height: 1.4; }
.import-error { color: var(--red); font-size: 13px; margin-top: 8px; }
.import-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.import-back { justify-content: center; }
.import-day { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
.import-day h3 { font-size: 18px; margin-bottom: 6px; }
.import-ex { padding: 8px 0; border-top: 1px solid var(--line); }
.import-ex:first-of-type { border-top: none; }
.import-ex-name { font-weight: 600; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.import-ex-muscle { font-size: 12px; color: var(--muted); font-weight: 400; }
.import-sets { font-size: 13px; color: var(--plate); margin-top: 2px; }
.import-notes { font-size: 12px; color: var(--muted); margin-top: 2px; line-height: 1.4; }
```

Em `src/main.ts`, logo depois de `import "./ui/styles-muscle-photo.css";`:

```ts
import "./ui/styles-import-theme.css";
```

- [ ] **Step 5: Exportar em `src/ui/handlers/index.ts`**

Acrescentar ao final:

```ts
export { importer } from "./import";
```

- [ ] **Step 6: Rota e botão em `src/ui/render.ts`**

Acrescentar o import, logo depois de `import { muscleVolumeView } from "./views/muscle-volume";`:

```ts
import { importView } from "./views/import";
```

Em `screenTemplate`, logo depois do bloco `if (s.screen === "muscle") { ... }`:

```ts
  if (s.screen === "import" && editable) {
    return importView(s.importText, s.importPreview, s.importError, handlers.importer);
  }
```

Em `homeTemplate`, dentro de `.prog-tabs`, logo depois do botão "Volume muscular" (o bloco `${editable ? ... : null}`) e antes do botão de Feedbacks:

```ts
      ${editable && !plan
        ? html`<button class="dashed-btn" @click=${handlers.importer.onOpen}>
            <i class="ti ti-clipboard-text"></i> Importar treino
          </button>`
        : null}
```

- [ ] **Step 7: Rodar a suíte e o build**

Run: `npm test && npm run build`
Expected: tudo verde, sem erro de TypeScript.

- [ ] **Step 8: Commit**

```bash
git add src/ui/state.ts src/ui/handlers/import.ts src/ui/views/import.ts src/ui/styles-import-theme.css src/ui/handlers/index.ts src/ui/render.ts src/main.ts
git commit -m "feat: importa treino colado como texto, com prévia antes de adicionar"
```

---

### Task 4: personalização e tema publicado para todos

**Files:**
- Create: `src/data/theme-repo.ts`
- Create: `src/ui/theme.ts`
- Modify: `src/ui/state.ts`
- Create: `src/ui/handlers/theme.ts`
- Create: `src/ui/views/theme.ts`
- Modify: `src/ui/handlers/index.ts`
- Modify: `src/ui/views/trainer.ts`
- Modify: `src/ui/render.ts`
- Modify: `src/main.ts`
- Modify: `src/ui/styles-import-theme.css`

**Interfaces:**
- Consumes: `Theme`, `ColorKey`, `DEFAULT_THEME`, `THEME_COLORS`, `FONT_*_OPTIONS`, `mergeTheme`, `fontHref` (Task 2); `resetScreen` (`./trainer`).
- Produces:
  ```ts
  // data/theme-repo.ts
  export async function loadPublishedTheme(): Promise<Theme>
  export async function publishTheme(theme: Theme): Promise<void>
  // ui/theme.ts
  export function applyTheme(t: Theme): void
  export function startThemeSync(): void
  // state.ts
  Screen += "theme"; export type ThemeStatus = "idle" | "saving" | "saved" | "error"
  AppState += { theme: Theme; themeDraft: Theme | null; themeStatus: ThemeStatus }
  // handlers/theme.ts
  export const theme: { onOpen(); onColor(key, value); onFont(key, value); onPublish(); onDiscard(); onReset(); onClose() }
  // views/theme.ts
  export function themeView(draft: Theme, status: ThemeStatus, h: ThemeHandlers): TemplateResult
  // views/trainer.ts
  TrainerHandlers += { onOpenTheme: () => void }
  ```

**Por que um inscrito só aplica o tema:** a tela de personalização pode ser deixada por "voltar", por escolher um aluno na barra lateral (`resetScreen`) ou por sair da conta. Em vez de cada saída lembrar de reaplicar o tema publicado, `startThemeSync` olha o estado a cada mudança: com `screen === "theme"`, aplica o rascunho; em qualquer outra tela, o publicado. Ele só mexe no `<html>` quando a referência do tema muda.

- [ ] **Step 1: Criar `src/data/theme-repo.ts`**

```ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { mergeTheme, type Theme } from "@/domain/theme";

/** O mesmo documento do 1.0: `settings/theme = { draft, published }`. */
const themeDoc = () => doc(db, "settings", "theme");

/** O tema que os alunos veem. Sem documento, o padrão. */
export async function loadPublishedTheme(): Promise<Theme> {
  const snap = await getDoc(themeDoc());
  return mergeTheme(snap.exists() ? snap.data().published : undefined);
}

/**
 * Publica para todos. Grava o mesmo tema em `draft` e `published`, como o 1.0
 * faz ao publicar, para os dois apps continuarem mostrando o mesmo visual.
 */
export async function publishTheme(theme: Theme): Promise<void> {
  await setDoc(themeDoc(), { draft: theme, published: theme }, { merge: true });
}
```

- [ ] **Step 2: Estado em `src/ui/state.ts`**

Logo depois de `import type { Session } from "@/auth/session";`:

```ts
import { DEFAULT_THEME, type Theme } from "@/domain/theme";
```

Trocar a declaração de `Screen` (e seu comentário) por:

```ts
/**
 * Tela aberta dentro da área do aluno. `home` é a grade de treinos da fase 1.
 * `theme` é do treinador e não depende de aluno selecionado.
 */
export type Screen =
  | "home" | "calendar" | "pastWeek" | "progression" | "cardio" | "feedback" | "muscle"
  | "import" | "theme";

export type ThemeStatus = "idle" | "saving" | "saved" | "error";
```

Em `AppState`, logo depois de `importError: string | null;`:

```ts
  /** O tema publicado, aplicado em toda tela fora da personalização. */
  theme: Theme;
  /** O que o treinador está mexendo na personalização; só vale nessa tela. */
  themeDraft: Theme | null;
  themeStatus: ThemeStatus;
```

Em `INITIAL`, logo depois de `importError: null,`:

```ts
  theme: DEFAULT_THEME,
  themeDraft: null,
  themeStatus: "idle",
```

- [ ] **Step 3: Criar `src/ui/theme.ts`**

```ts
import { getState, subscribe } from "./state";
import { DEFAULT_THEME, THEME_COLORS, fontHref, type Theme } from "@/domain/theme";

// index.html já carrega as duas fontes padrão
const loadedFonts = new Set([DEFAULT_THEME.fontDisplay, DEFAULT_THEME.fontBody]);

/** Baixa uma família só, na primeira vez que ela for usada. */
function loadFont(family: string): void {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = fontHref(family);
  document.head.appendChild(link);
}

export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  for (const { key } of THEME_COLORS) root.style.setProperty(`--${key}`, t[key]);
  loadFont(t.fontDisplay);
  loadFont(t.fontBody);
  root.style.setProperty("--font-display", `'${t.fontDisplay}', 'Inter', sans-serif`);
  root.style.setProperty("--font-body", `'${t.fontBody}', system-ui, sans-serif`);
}

/**
 * Mantém a tela com o tema certo: o rascunho enquanto o treinador está na
 * personalização, o publicado em qualquer outra tela. Sair da personalização
 * por qualquer caminho — voltar, escolher um aluno — reaplica o publicado sem
 * que cada saída precise lembrar disso.
 */
export function startThemeSync(): void {
  let applied: Theme | null = null;
  const sync = () => {
    const s = getState();
    const t = s.screen === "theme" && s.themeDraft ? s.themeDraft : s.theme;
    if (t === applied) return;
    applied = t;
    applyTheme(t);
  };
  subscribe(sync);
  sync();
}
```

- [ ] **Step 4: Criar `src/ui/handlers/theme.ts`**

```ts
import { getState, setState } from "../state";
import { publishTheme } from "@/data/theme-repo";
import { DEFAULT_THEME, type ColorKey, type Theme } from "@/domain/theme";
import { resetScreen } from "./trainer";

type FontKey = "fontDisplay" | "fontBody";

function edit(patch: Partial<Theme>): void {
  const draft = getState().themeDraft;
  if (draft) setState({ themeDraft: { ...draft, ...patch }, themeStatus: "idle" });
}

async function publish(t: Theme): Promise<void> {
  setState({ themeStatus: "saving" });
  try {
    await publishTheme(t);
    setState({ theme: t, themeStatus: "saved" });
  } catch {
    setState({ themeStatus: "error" });
  }
}

export const theme = {
  // o rascunho parte sempre do publicado: não há modo prévia guardado entre sessões
  onOpen: () => setState({ screen: "theme", activeDayId: null, themeDraft: getState().theme, themeStatus: "idle" }),
  onColor: (key: ColorKey, value: string) => edit({ [key]: value }),
  onFont: (key: FontKey, value: string) => edit({ [key]: value }),

  onPublish: () => {
    const draft = getState().themeDraft;
    if (draft && getState().themeStatus !== "saving") void publish(draft);
  },

  onDiscard: () => setState({ themeDraft: getState().theme, themeStatus: "idle" }),

  onReset: () => {
    if (!confirm("Voltar ao visual padrão? Vale na hora para todos os alunos.")) return;
    setState({ themeDraft: DEFAULT_THEME });
    void publish(DEFAULT_THEME);
  },

  // a volta ao tema publicado acontece em startThemeSync, ao sair da tela
  onClose: () => resetScreen(),
};
```

- [ ] **Step 5: Criar `src/ui/views/theme.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import { FONT_BODY_OPTIONS, FONT_DISPLAY_OPTIONS, THEME_COLORS, type ColorKey, type Theme } from "@/domain/theme";
import type { ThemeStatus } from "../state";

export interface ThemeHandlers {
  onColor: (key: ColorKey, value: string) => void;
  onFont: (key: "fontDisplay" | "fontBody", value: string) => void;
  onPublish: () => void;
  onDiscard: () => void;
  onReset: () => void;
  onClose: () => void;
}

const STATUS: Record<ThemeStatus, string> = {
  idle: "",
  saving: "Publicando…",
  saved: "Publicado para os alunos.",
  error: "Não foi possível publicar. Tente de novo.",
};

function fontRow(
  label: string, key: "fontDisplay" | "fontBody", options: string[], value: string, h: ThemeHandlers,
): TemplateResult {
  return html`
    <div class="theme-row">
      <label for="tf-${key}">${label}</label>
      <select id="tf-${key}" @change=${(e: Event) => h.onFont(key, (e.target as HTMLSelectElement).value)}>
        ${options.map((f) => html`<option value=${f} ?selected=${f === value}>${f}</option>`)}
      </select>
    </div>`;
}

export function themeView(draft: Theme, status: ThemeStatus, h: ThemeHandlers): TemplateResult {
  return html`
    <div class="day-head">
      <button class="back" @click=${h.onClose}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Personalização</span>
    </div>
    <div class="theme-panel">
      <p class="muted-note theme-intro">
        As mudanças aparecem só para você até publicar. Sair desta tela sem publicar desfaz.
      </p>

      <p class="theme-section">Cores</p>
      ${THEME_COLORS.map(
        (c) => html`
          <div class="theme-row">
            <label for="tc-${c.key}">${c.label}</label>
            <input id="tc-${c.key}" type="color" .value=${draft[c.key]}
              @input=${(e: Event) => h.onColor(c.key, (e.target as HTMLInputElement).value)} />
          </div>`,
      )}

      <p class="theme-section">Fontes</p>
      ${fontRow("Títulos", "fontDisplay", FONT_DISPLAY_OPTIONS, draft.fontDisplay, h)}
      ${fontRow("Texto", "fontBody", FONT_BODY_OPTIONS, draft.fontBody, h)}

      <div class="theme-actions">
        <button class="cta" ?disabled=${status === "saving"} @click=${h.onPublish}>Publicar para os alunos</button>
        ${STATUS[status] ? html`<p class="theme-status">${STATUS[status]}</p>` : null}
        <button class="dashed-btn" @click=${h.onDiscard}>Descartar alterações</button>
        <button class="dashed-btn theme-danger" @click=${h.onReset}>
          <i class="ti ti-refresh"></i> Restaurar padrão (aplica na hora)
        </button>
      </div>
    </div>
  `;
}
```

- [ ] **Step 6: Exportar em `src/ui/handlers/index.ts`**

Acrescentar ao final:

```ts
export { theme } from "./theme";
```

- [ ] **Step 7: Ícone de paleta em `src/ui/views/trainer.ts`**

Em `TrainerHandlers`, logo depois de `onLogout: () => void;`:

```ts
  onOpenTheme: () => void;
```

Trocar a linha `<button class="logout" @click=${h.onLogout}>Sair</button>` do topo por:

```ts
      <div class="topbar-actions">
        <button class="icon-btn" aria-label="Personalizar visual" @click=${h.onOpenTheme}>
          <i class="ti ti-palette"></i>
        </button>
        <button class="logout" @click=${h.onLogout}>Sair</button>
      </div>
```

`handlers.trainer` **não** ganha `onOpenTheme`: `handlers/theme.ts` importa `resetScreen` de `handlers/trainer.ts`, e o caminho inverso criaria um ciclo. O `render.ts` junta os dois (Step 8).

- [ ] **Step 8: Rota em `src/ui/render.ts`**

Acrescentar o import, logo depois de `import { importView } from "./views/import";`:

```ts
import { themeView } from "./views/theme";
```

No `case "trainer"` de `viewTemplate`, trocar as duas linhas `const body = ...` e `return trainerView(...)` por:

```ts
      // a personalização vale para todos os alunos: abre com ou sem aluno escolhido
      const body = s.screen === "theme" && s.themeDraft
        ? themeView(s.themeDraft, s.themeStatus, handlers.theme)
        : client ? screenTemplate(client, true) ?? homeTemplate(client, true) : null;
      return trainerView(s.clients, s.selectedClientId, body, s.error,
        { ...handlers.trainer, onOpenTheme: handlers.theme.onOpen });
```

- [ ] **Step 9: Carregar e sincronizar em `src/main.ts`**

Logo depois de `import { startPwa } from "./pwa";`:

```ts
import { startThemeSync } from "./ui/theme";
import { loadPublishedTheme } from "./data/theme-repo";
```

Dentro de `watchSession`, logo depois de `setState({ session, error: null });`:

```ts
  // uma leitura por abertura, sem listener: quem já está com o app aberto pega
  // o tema novo na próxima vez. A regra só deixa ler depois do login. Sem
  // documento ou sem rede, fica o padrão, sem aviso.
  loadPublishedTheme().then((theme) => setState({ theme }), () => {});
```

Logo depois de `startPwa();` no final do arquivo:

```ts
startThemeSync();
```

- [ ] **Step 10: Estilos, ao final de `src/ui/styles-import-theme.css`**

```css
/* personalização (as linhas .theme-row já estão em styles.css) */
.theme-panel { max-width: 420px; }
.theme-intro { margin-bottom: 6px; line-height: 1.5; }
.theme-section { text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: .05em; color: var(--muted); margin: 16px 0 0; }
.theme-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
.theme-actions .dashed-btn { justify-content: center; }
.theme-actions .cta:disabled { opacity: .6; }
.theme-danger { color: var(--red); border-color: var(--red); }
.theme-status { font-size: 13px; color: var(--muted); text-align: center; }

/* topo do treinador */
.topbar-actions { display: flex; align-items: center; gap: 8px; }
.icon-btn { color: var(--muted); font-size: 18px; padding: 6px; }
```

- [ ] **Step 11: Rodar a suíte e o build**

Run: `npm test && npm run build`
Expected: tudo verde, sem erro de TypeScript.

- [ ] **Step 12: Commit**

```bash
git add src/data/theme-repo.ts src/ui/theme.ts src/ui/state.ts src/ui/handlers/theme.ts src/ui/views/theme.ts src/ui/handlers/index.ts src/ui/views/trainer.ts src/ui/render.ts src/main.ts src/ui/styles-import-theme.css
git commit -m "feat: personalização de cores e fontes; o 2.0 passa a aplicar o tema publicado"
```

---

### Task 5: banner de instalação

**Files:**
- Modify: `src/ui/state.ts`
- Create: `src/ui/install.ts`
- Test: `src/ui/install.test.ts`
- Create: `src/ui/components/install-banner.ts`
- Modify: `src/ui/render.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces:
  ```ts
  // state.ts
  export type InstallKind = "android" | "ios" | null; AppState += { installKind: InstallKind }
  // ui/install.ts
  export interface InstallEnv { standalone: boolean; ios: boolean; dismissed: boolean }
  export function installKindFor(env: InstallEnv, promptReady: boolean): InstallKind
  export function startInstall(): void
  export async function promptInstall(): Promise<void>
  export function dismissInstall(): void
  // components/install-banner.ts
  export function installBanner(kind: InstallKind, onInstall: () => void, onDismiss: () => void): TemplateResult | null
  ```

`install.ts` não toca em `window` fora das funções: a suíte roda em ambiente `node` e importa o módulo para testar `installKindFor`.

- [ ] **Step 1: Estado em `src/ui/state.ts`**

Logo depois da declaração de `Screen`:

```ts
/** Que banner de instalação mostrar; null quando nenhum cabe. */
export type InstallKind = "android" | "ios" | null;
```

Em `AppState`, logo depois de `themeStatus: ThemeStatus;`:

```ts
  installKind: InstallKind;
```

Em `INITIAL`, logo depois de `themeStatus: "idle",`:

```ts
  installKind: null,
```

- [ ] **Step 2: Escrever os testes que falham**

Criar `src/ui/install.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { installKindFor } from "./install";

const base = { standalone: false, ios: false, dismissed: false };

describe("installKindFor", () => {
  it("mostra o botão quando o navegador oferece o prompt", () => {
    expect(installKindFor(base, true)).toBe("android");
  });

  it("mostra a instrução no iPhone, que não tem prompt", () => {
    expect(installKindFor({ ...base, ios: true }, false)).toBe("ios");
  });

  it("não mostra nada sem prompt fora do iPhone", () => {
    expect(installKindFor(base, false)).toBeNull();
  });

  it("não mostra nada com o app já instalado", () => {
    expect(installKindFor({ ...base, standalone: true }, true)).toBeNull();
    expect(installKindFor({ ...base, standalone: true, ios: true }, false)).toBeNull();
  });

  it("não mostra nada depois de dispensado", () => {
    expect(installKindFor({ ...base, dismissed: true }, true)).toBeNull();
    expect(installKindFor({ ...base, dismissed: true, ios: true }, false)).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run src/ui/install.test.ts`
Expected: FAIL — `Failed to resolve import "./install"`.

- [ ] **Step 4: Criar `src/ui/install.ts`**

```ts
import { setState, type InstallKind } from "./state";

// a mesma chave do 1.0: quem já dispensou lá não vê de novo aqui
const DISMISS_KEY = "install-banner-dismissed";
const IOS_DELAY = 1500;

/** O evento do Chrome que guarda o prompt nativo de instalação. Não está nos tipos do DOM. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<unknown>;
}

export interface InstallEnv {
  standalone: boolean;
  ios: boolean;
  dismissed: boolean;
}

/** Que banner cabe agora. `promptReady`: o navegador já ofereceu o prompt nativo. */
export function installKindFor(env: InstallEnv, promptReady: boolean): InstallKind {
  if (env.standalone || env.dismissed) return null;
  if (promptReady) return "android";
  return env.ios ? "ios" : null;
}

let deferred: InstallPromptEvent | null = null;

function isDismissed(): boolean {
  // em aba anônima ou com dados bloqueados, o acesso ao localStorage pode lançar
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function currentEnv(): InstallEnv {
  return {
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true,
    ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
    dismissed: isDismissed(),
  };
}

export function startInstall(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    setState({ installKind: installKindFor(currentEnv(), true) });
  });
  window.addEventListener("appinstalled", () => setState({ installKind: null }));
  // o Safari do iPhone não tem prompt: só a instrução, depois que a tela assentou
  setTimeout(() => setState({ installKind: installKindFor(currentEnv(), deferred !== null) }), IOS_DELAY);
}

/** Abre o prompt nativo. Sem marcar como dispensado, como no 1.0: quem recusa vê de novo noutra visita. */
export async function promptInstall(): Promise<void> {
  setState({ installKind: null });
  const e = deferred;
  deferred = null;
  if (!e) return;
  await e.prompt();
  await e.userChoice;
}

export function dismissInstall(): void {
  setState({ installKind: null });
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // sem armazenamento, o banner volta na próxima visita; nada a fazer
  }
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run src/ui/install.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 6: Criar `src/ui/components/install-banner.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import type { InstallKind } from "../state";

/** Rodapé fixo; o estilo `#install-banner` está em styles.css. Textos do 1.0. */
export function installBanner(
  kind: InstallKind,
  onInstall: () => void,
  onDismiss: () => void,
): TemplateResult | null {
  if (!kind) return null;
  return html`
    <div id="install-banner" role="status">
      ${kind === "android"
        ? html`<span>Instale este app no seu celular pra acesso rápido, direto da tela inicial.</span>
            <button id="ib-install" @click=${onInstall}>Instalar</button>`
        : html`<span>Toque em <b>Compartilhar</b> (⬆️) e depois em <b>"Adicionar à Tela de Início"</b> pra instalar o app.</span>`}
      <button id="ib-dismiss" aria-label="Dispensar" @click=${onDismiss}><i class="ti ti-x"></i></button>
    </div>
  `;
}
```

- [ ] **Step 7: Ligar em `src/ui/render.ts`**

Logo depois de `import { updateBanner } from "./components/update-banner";`:

```ts
import { installBanner } from "./components/install-banner";
```

Logo depois de `import { applyUpdate } from "@/pwa";`:

```ts
import { promptInstall, dismissInstall } from "./install";
```

Em `template()`, logo depois de `${photoViewer(s.photoViewer, handlers.photos.onClosePhoto)}`:

```ts
    <!-- com as duas valendo, só a de versão nova: é a mais urgente -->
    ${s.updateReady ? null : installBanner(s.installKind, () => void promptInstall(), dismissInstall)}
```

- [ ] **Step 8: Iniciar em `src/main.ts`**

Logo depois de `import { startThemeSync } from "./ui/theme";`:

```ts
import { startInstall } from "./ui/install";
```

Logo depois de `startThemeSync();`:

```ts
startInstall();
```

- [ ] **Step 9: Rodar a suíte e o build**

Run: `npm test && npm run build`
Expected: tudo verde (228 testes no total), sem erro de TypeScript.

- [ ] **Step 10: Commit**

```bash
git add src/ui/state.ts src/ui/install.ts src/ui/install.test.ts src/ui/components/install-banner.ts src/ui/render.ts src/main.ts
git commit -m "feat: banner de instalação do app, com a mesma dispensa do 1.0"
```

---

### Task 6: publicar e verificar em produção

**Files:** nenhum arquivo novo.

- [ ] **Step 1: Suíte, build e limites**

```bash
npm test && npm run build
git diff e58dab2..HEAD --stat -- package.json firestore.rules
wc -l src/domain/workout-import.ts src/ui/render.ts src/ui/state.ts src/ui/views/import.ts src/ui/views/theme.ts
```

Expected: tudo verde; o `git diff` sem saída; nenhum arquivo acima de ~250 linhas.

- [ ] **Step 2: Publicar**

```bash
git push origin main
gh run list --repo fermmura/muratraining2 --limit 1
gh run watch <id> --repo fermmura/muratraining2 --exit-status
```

- [ ] **Step 3: Verificar em https://fermmura.github.io/muratraining2/**

Como treinador:

1. Nos treinos de um aluno, "Importar treino": "Ler" com a caixa vazia mostra "Cole o texto do treino antes de importar."; um texto sem dia da semana mostra a mensagem de formato.
2. Colar uma ficha real com dois dias: a prévia mostra os dias, os exercícios com músculo, as séries agrupadas ("3× 8-12 · 40 kg · 2 RIR") e as notas. "Voltar e corrigir" volta com o texto na caixa.
3. "Adicionar ao aluno": os dias aparecem no fim da grade e os treinos que existiam continuam lá.
4. Abrir um plano de semana futura: não há botão "Importar treino".
5. Ícone de paleta: trocar o fundo e a fonte dos títulos muda a tela na hora. Escolher um aluno na barra lateral volta ao visual publicado.
6. Mudar de novo e "Publicar para os alunos": aparece "Publicado para os alunos.". Recarregar: o visual publicado continua.
7. "Restaurar padrão": pede confirmação e volta às cores originais.

Como aluno:

8. Depois que o treinador publicou um tema, abrir o app: o aluno vê o tema publicado.
9. No Chrome do Android, fora do app instalado: aparece o banner com "Instalar"; o × some com ele e ele não volta ao recarregar.
10. No iPhone, no Safari: aparece a instrução de "Adicionar à Tela de Início".

No 1.0:

11. O tema publicado pelo 2.0 aparece no 1.0, e o publicado pelo 1.0 aparece no 2.0 (na próxima abertura).
12. O treino importado pelo 2.0 aparece no 1.0.

- [ ] **Step 4: Commit de status**

```bash
git commit --allow-empty -m "chore: fase 4a no ar"
git push
```

---

## Verificação da fase

- [ ] `npm test` passa, com os testes novos de `workout-import`, `theme` e `install`.
- [ ] `npm run build` passa sem erro de TypeScript.
- [ ] Nenhum arquivo de `src/` criado ou alterado passa de ~250 linhas; nenhuma dependência nova; `firestore.rules` intocado.
- [ ] A importação só adiciona, e só nos treinos atuais.
- [ ] Publicar grava o mesmo tema em `draft` e `published`.
- [ ] Sair da personalização sem publicar, por qualquer caminho, volta ao tema publicado.
- [ ] Documento de tema estragado não deixa o app ilegível.
- [ ] O banner nunca aparece com o app instalado, nem depois de dispensado, nem junto com a faixa de versão nova.

## Fora desta fase

Registrado para não ser confundido com lacuna do plano: página de dados com backup, restauração, planilha Excel e recuperação (fase 4b); substituir treinos pela importação; importar para semana futura; modo prévia do tema; tema em tempo real em aparelhos já abertos; migração de `history` inteiro para subcoleção, depois que o 1.0 sair do ar.
