# MuraTraining 2.0 — Fase 3b (volume muscular, fotos e aviso de versão nova) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar músculo e sinergista por exercício, o volume por grupo no dia e numa tela própria, fotos de exercício (enviar, ver, remover e copiar para semana futura) e o aviso de versão nova do app.

**Architecture:** Cálculo em `src/domain/` como função pura testada: `muscle.ts` e `photo-copy.ts`. Fotos continuam em `clients/{uid}/photos/{exId} = { dataUrl }`, o formato do 1.0; o que o 2.0 já leu fica em `state.photos`, para que redesenhar a tela não refaça leitura nem decodificação. O cartão do exercício ganha dois componentes próprios (`muscle-picker.ts` e `exercise-photo.ts`) para não inchar. O aviso de versão nova registra o service worker por `virtual:pwa-register`.

**Tech Stack:** Vite 5, TypeScript 5, lit-html 3, Firebase JS SDK 10 (modular), vite-plugin-pwa 0.20, Vitest 2. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-09-29-fase-3-cardio-feedback-volume-fotos-design.md` (parte 3b)

## Global Constraints

Valem para **todas** as tarefas.

- **Compatibilidade de schema é obrigatória.** Nunca renomeie, remova ou mude o formato gravado de um campo. Só é permitido **adicionar**.
- **Fotos:** `clients/{uid}/photos/{exId} = { dataUrl: string }`, com `hasPhoto: true` no exercício. Exercícios muito antigos podem ter `photoUrl` com a imagem embutida; o 2.0 exibe, não migra.
- **Só o treinador escreve fotos** (regra do Firestore). Nada no aparelho do aluno pode chamar `savePhoto` ou `deletePhoto`.
- **Compressão igual à do 1.0:** maior lado 700px, JPEG qualidade 0,6, recusa acima de 700.000 caracteres.
- **Músculos, palavras de adivinhação e meia série do sinergista:** copiados do 1.0 (`app.js:1251-1318`), transcritos no Task 1.
- **Esta fase não altera `firestore.rules`.** Se alguma tarefa parecer exigir regra nova, pare e escale.
- **Nenhuma dependência nova** em `package.json`.
- Comentários e textos de interface em português. Identificadores de código em inglês, inclusive nos testes.
- **Nenhum arquivo de `src/` passa de ~250 linhas.** `src/ui/styles.css` já tem 275; estilos novos vão para `src/ui/styles-muscle-photo.css`.
- **`registerType: "prompt"` fica.** O app nunca recarrega sozinho; quem está usando decide.

## O que já existe

```ts
// src/data/schema.ts   Exercise { id, name, notes, sets, muscle?, synergist?, photoUrl?, hasPhoto?, ... }, Day, WeekPlan
// src/domain/plan-edit.ts   createPlan(client, weekKey, mode): WeekPlan; replacePlanDays(plans, planId, days): WeekPlan[]
// src/ui/state.ts      getState(), setState(patch), Screen, AppState
// src/ui/handlers/target.ts  currentClient(); persist(clientId, patch); editableDays(client): Day[]; mutateDays(fn)
// src/ui/handlers/workout.ts day = { onBack, onToggle, onToggleTimer, onAddExercise, onRemoveExercise, onRename, onNotes, onAddSet, onRemove, onField }
// src/ui/handlers/screens.ts screens = { ..., onChoosePlan(weekKey, mode) }
// src/ui/components/exercise.ts  exerciseCard(ex, collapsed, editable, h: ExerciseHandlers)
// src/ui/components/day.ts       dayView(day, collapsed, editable, showTimer, h: DayHandlers)
```

`createPlan(client, weekKey, "copy")` clona `client.days` com ids novos, **na mesma ordem** de dias e exercícios, e sem `hasPhoto`/`photoUrl`.

---

### Task 1: `domain/muscle.ts` — grupos, adivinhação e volume

**Files:**
- Create: `src/domain/muscle.ts`
- Test: `src/domain/muscle.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const MUSCLE_GROUPS: readonly string[]
  export function guessMuscle(name: string): string          // "" quando não reconhece
  export function guessSynergist(name: string): string       // "" quando não reconhece
  export function guessedMuscles(ex: Exercise, name: string): { muscle?: string; synergist?: string }
  export interface SetCount { done: number; total: number }
  export function daySetCount(day: Day): SetCount
  export interface MuscleVolume { muscle: string; done: number; total: number }
  export function muscleVolume(days: Day[]): MuscleVolume[]
  export function formatVolume(n: number): string
  ```

- [ ] **Step 1: Escrever os testes que falham**

`src/domain/muscle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  MUSCLE_GROUPS, guessMuscle, guessSynergist, guessedMuscles,
  daySetCount, muscleVolume, formatVolume,
} from "./muscle";
import type { Day, Exercise, ExerciseSet } from "@/data/schema";

function set(repsDone = ""): ExerciseSet {
  return { id: "s", repsGoal: "10", repsDone, load: "", intensity: 0, rir: "", rirEnabled: false };
}

function ex(patch: Partial<Exercise>): Exercise {
  return { id: "e", name: "", notes: "", sets: [], ...patch };
}

function day(exercises: Exercise[]): Day {
  return { id: "d", title: "Treino", exercises };
}

describe("MUSCLE_GROUPS", () => {
  it("tem os 15 grupos do 1.0", () => {
    expect(MUSCLE_GROUPS).toHaveLength(15);
    expect(MUSCLE_GROUPS).toContain("Deltoide posterior");
  });
});

describe("guessMuscle", () => {
  it("reconhece pelo nome, sem diferenciar maiúscula", () => {
    expect(guessMuscle("SUPINO reto")).toBe("Peito");
    expect(guessMuscle("Rosca direta")).toBe("Bíceps");
    expect(guessMuscle("Tríceps testa")).toBe("Tríceps");
    expect(guessMuscle("Agachamento livre")).toBe("Quadríceps");
    expect(guessMuscle("Cadeira flexora")).toBe("Posterior de coxa");
    expect(guessMuscle("Hip thrust")).toBe("Glúteo");
    expect(guessMuscle("Elevação lateral")).toBe("Ombro");
  });

  it("confere o deltoide posterior antes do peito, porque 'crucifixo invertido' contém 'crucifixo'", () => {
    expect(guessMuscle("Crucifixo invertido")).toBe("Deltoide posterior");
  });

  it("rosca inversa de punho é antebraço, não bíceps", () => {
    expect(guessMuscle("Rosca inversa punho")).toBe("Antebraço");
  });

  it("devolve vazio quando não reconhece", () => {
    expect(guessMuscle("Burpee")).toBe("");
  });
});

describe("guessSynergist", () => {
  it("reconhece os compostos", () => {
    expect(guessSynergist("Supino inclinado")).toBe("Tríceps");
    expect(guessSynergist("Puxada alta")).toBe("Bíceps");
    expect(guessSynergist("Crucifixo invertido")).toBe("Trapézio");
    expect(guessSynergist("Agachamento")).toBe("Glúteo");
  });

  it("devolve vazio para isolado", () => {
    expect(guessSynergist("Rosca direta")).toBe("");
  });
});

describe("guessedMuscles", () => {
  it("preenche músculo e sinergista quando estão vazios", () => {
    expect(guessedMuscles(ex({}), "Supino reto")).toEqual({ muscle: "Peito", synergist: "Tríceps" });
  });

  it("nunca sobrescreve um músculo já escolhido", () => {
    expect(guessedMuscles(ex({ muscle: "Ombro" }), "Supino reto")).toEqual({});
  });

  it("mantém o sinergista já escolhido", () => {
    expect(guessedMuscles(ex({ synergist: "Ombro" }), "Supino reto")).toEqual({ muscle: "Peito" });
  });

  it("não devolve nada quando não reconhece", () => {
    expect(guessedMuscles(ex({}), "Burpee")).toEqual({});
  });
});

describe("daySetCount", () => {
  it("conta séries e as feitas", () => {
    const d = day([ex({ sets: [set("10"), set(""), set("8")] }), ex({ sets: [set("")] })]);
    expect(daySetCount(d)).toEqual({ done: 2, total: 4 });
  });
});

describe("muscleVolume", () => {
  it("conta uma série para o principal e meia para o sinergista", () => {
    const d = day([ex({ muscle: "Peito", synergist: "Tríceps", sets: [set("10"), set("")] })]);
    expect(muscleVolume([d])).toEqual([
      { muscle: "Peito", done: 1, total: 2 },
      { muscle: "Tríceps", done: 0.5, total: 1 },
    ]);
  });

  it("soma os dias e ordena do maior total para o menor", () => {
    const a = day([ex({ muscle: "Bíceps", sets: [set()] })]);
    const b = day([ex({ muscle: "Costas", sets: [set(), set(), set()] }), ex({ muscle: "Bíceps", sets: [set()] })]);
    expect(muscleVolume([a, b]).map((v) => [v.muscle, v.total])).toEqual([["Costas", 3], ["Bíceps", 2]]);
  });

  it("ignora exercício sem músculo", () => {
    expect(muscleVolume([day([ex({ sets: [set()] })])])).toEqual([]);
  });
});

describe("formatVolume", () => {
  it("escreve inteiro sem casa decimal e meia série com vírgula", () => {
    expect(formatVolume(3)).toBe("3");
    expect(formatVolume(2.5)).toBe("2,5");
    expect(formatVolume(0)).toBe("0");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/domain/muscle.test.ts`
Expected: FAIL — `Failed to load url ./muscle`.

- [ ] **Step 3: Implementar `src/domain/muscle.ts`**

```ts
import type { Day, Exercise } from "@/data/schema";

/** Os mesmos do 1.0 (app.js:1251-1254). O nome é o que fica gravado. */
export const MUSCLE_GROUPS: readonly string[] = [
  "Peito", "Costas", "Ombro", "Deltoide posterior", "Trapézio", "Bíceps", "Tríceps", "Antebraço",
  "Quadríceps", "Posterior de coxa", "Glúteo", "Adutores", "Panturrilha", "Abdômen", "Lombar",
];

function matcher(name: string): (...words: string[]) => boolean {
  const n = (name ?? "").toLowerCase();
  return (...words) => words.some((w) => n.includes(w));
}

/**
 * Adivinha o músculo pelo nome, com as palavras do 1.0 (app.js:1283-1302).
 * A ordem importa: "crucifixo invertido" precisa ser visto antes de "crucifixo".
 */
export function guessMuscle(name: string): string {
  const has = matcher(name);
  if (has("crucifixo invertido", "crucifixo inverso", "face pull", "remada alta", "elevação posterior", "elevacao posterior", "peck deck invertido", "peckdeck invertido")) return "Deltoide posterior";
  if (has("supino", "peck deck", "peckdeck", "crucifixo", "cross over", "crossover", "voador")) return "Peito";
  if (has("puxada", "remada", "pulldown", "barra fixa", "pull-up", "pulley costas", "levantamento terra", "terra convencional")) return "Costas";
  if (has("desenvolvimento", "elevação lateral", "elevacao lateral", "elevação frontal", "arnold")) return "Ombro";
  if (has("encolhimento", "trapézio", "trapezio")) return "Trapézio";
  if (has("rosca") && !has("rosca inversa punho")) return "Bíceps";
  if (has("tríceps", "triceps", "jm press", "francês", "frances", "testa")) return "Tríceps";
  if (has("punho", "antebraço", "antebraco")) return "Antebraço";
  if (has("panturrilha", "flexão plantar", "flexao plantar")) return "Panturrilha";
  if (has("agachamento", "leg press", "cadeira extensora", "hack", "avanço", "avanco", "afundo")) return "Quadríceps";
  if (has("stiff", "cadeira flexora", "mesa flexora", "flexão de joelho", "flexao de joelho", "flexão nórdica", "flexao nordica")) return "Posterior de coxa";
  if (has("glúteo", "gluteo", "hip thrust", "elevação pélvica", "elevacao pelvica", "coice")) return "Glúteo";
  if (has("adutora", "adutor")) return "Adutores";
  if (has("abdominal", "abs supra", "abs infra", "prancha", "abdômen", "abdomen")) return "Abdômen";
  if (has("lombar", "extensão de tronco", "extensao de tronco", "hiperextensão", "hiperextensao")) return "Lombar";
  return "";
}

/**
 * Exercícios compostos recrutam um segundo músculo. A série conta meia para ele:
 * é o método que melhor prevê hipertrofia segundo Pelland et al., 2025, Sports
 * Medicine — a mesma escolha do 1.0 (app.js:1304-1318).
 */
export function guessSynergist(name: string): string {
  const has = matcher(name);
  if (has("crucifixo invertido", "crucifixo inverso", "face pull", "remada alta", "elevação posterior", "elevacao posterior")) return "Trapézio";
  if (has("supino", "crucifixo", "cross over", "crossover", "voador") && !has("máquina peito isolad")) return "Tríceps";
  if (has("puxada", "remada", "pulldown", "barra fixa", "pull-up", "pulley costas")) return "Bíceps";
  if (has("desenvolvimento", "arnold")) return "Tríceps";
  if (has("levantamento terra", "terra convencional", "stiff", "hip thrust", "elevação pélvica", "elevacao pelvica")) return "Posterior de coxa";
  if (has("agachamento", "leg press", "hack", "avanço", "avanco", "afundo")) return "Glúteo";
  return "";
}

/**
 * O que adivinhar ao renomear. Só age quando o músculo ainda não foi escolhido,
 * e nunca troca o sinergista que alguém já escolheu.
 */
export function guessedMuscles(ex: Exercise, name: string): { muscle?: string; synergist?: string } {
  if (ex.muscle) return {};
  const patch: { muscle?: string; synergist?: string } = {};
  const muscle = guessMuscle(name);
  if (muscle) patch.muscle = muscle;
  if (!ex.synergist) {
    const synergist = guessSynergist(name);
    if (synergist) patch.synergist = synergist;
  }
  return patch;
}

export interface SetCount {
  done: number;
  total: number;
}

export function daySetCount(day: Day): SetCount {
  const count: SetCount = { done: 0, total: 0 };
  for (const e of day.exercises ?? []) {
    for (const s of e.sets ?? []) {
      count.total++;
      if (s.repsDone) count.done++;
    }
  }
  return count;
}

export interface MuscleVolume {
  muscle: string;
  done: number;
  total: number;
}

/** Séries por grupo nos dias dados: uma para o principal, meia para o sinergista. Maior total primeiro. */
export function muscleVolume(days: Day[]): MuscleVolume[] {
  const byMuscle = new Map<string, MuscleVolume>();
  const add = (muscle: string | undefined, weight: number, done: boolean) => {
    if (!muscle) return;
    const v = byMuscle.get(muscle) ?? { muscle, done: 0, total: 0 };
    v.total += weight;
    if (done) v.done += weight;
    byMuscle.set(muscle, v);
  };
  for (const d of days ?? []) {
    for (const e of d.exercises ?? []) {
      for (const s of e.sets ?? []) {
        add(e.muscle, 1, !!s.repsDone);
        add(e.synergist, 0.5, !!s.repsDone);
      }
    }
  }
  return [...byMuscle.values()].sort((a, b) => b.total - a.total);
}

/** "3", "2,5". Os valores são múltiplos de meia série; o arredondamento é só por segurança. */
export function formatVolume(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/domain/muscle.test.ts`
Expected: PASS, 16 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domain/muscle.ts src/domain/muscle.test.ts
git commit -m "feat: adivinha músculo e calcula volume por grupo"
```

---

### Task 2: `domain/photo-copy.ts` — quais fotos copiar para o plano

**Files:**
- Create: `src/domain/photo-copy.ts`
- Test: `src/domain/photo-copy.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PhotoCopy { from: string; to: string; inline?: string }
  export function photoCopies(source: Day[], copied: Day[]): PhotoCopy[]
  export function withPhotoFlags(days: Day[], exIds: ReadonlySet<string>): Day[]
  ```

- [ ] **Step 1: Escrever os testes que falham**

`src/domain/photo-copy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { photoCopies, withPhotoFlags } from "./photo-copy";
import type { Day, Exercise } from "@/data/schema";

function ex(id: string, patch: Partial<Exercise> = {}): Exercise {
  return { id, name: id, notes: "", sets: [], ...patch };
}

function day(id: string, exercises: Exercise[]): Day {
  return { id, title: id, exercises };
}

describe("photoCopies", () => {
  it("casa por posição os exercícios que tinham foto", () => {
    const source = [day("d1", [ex("a", { hasPhoto: true }), ex("b")]), day("d2", [ex("c", { hasPhoto: true })])];
    const copied = [day("n1", [ex("a2"), ex("b2")]), day("n2", [ex("c2")])];
    expect(photoCopies(source, copied)).toEqual([
      { from: "a", to: "a2" },
      { from: "c", to: "c2" },
    ]);
  });

  it("leva a imagem embutida dos exercícios antigos", () => {
    const source = [day("d1", [ex("a", { photoUrl: "data:img" })])];
    const copied = [day("n1", [ex("a2")])];
    expect(photoCopies(source, copied)).toEqual([{ from: "a", to: "a2", inline: "data:img" }]);
  });

  it("não quebra quando a cópia tem menos exercícios", () => {
    const source = [day("d1", [ex("a", { hasPhoto: true }), ex("b", { hasPhoto: true })])];
    const copied = [day("n1", [ex("a2")])];
    expect(photoCopies(source, copied)).toEqual([{ from: "a", to: "a2" }]);
  });
});

describe("withPhotoFlags", () => {
  it("marca hasPhoto só nos exercícios pedidos", () => {
    const days = [day("d1", [ex("a"), ex("b")])];
    const [d] = withPhotoFlags(days, new Set(["b"]));
    expect(d.exercises[0].hasPhoto).toBeUndefined();
    expect(d.exercises[1].hasPhoto).toBe(true);
  });

  it("não altera os dias recebidos", () => {
    const days = [day("d1", [ex("a")])];
    withPhotoFlags(days, new Set(["a"]));
    expect(days[0].exercises[0].hasPhoto).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/domain/photo-copy.test.ts`
Expected: FAIL — `Failed to load url ./photo-copy`.

- [ ] **Step 3: Implementar `src/domain/photo-copy.ts`**

```ts
import type { Day } from "@/data/schema";

/** Copiar a foto do exercício `from` para o `to`. `inline` é a imagem embutida de exercícios antigos. */
export interface PhotoCopy {
  from: string;
  to: string;
  inline?: string;
}

/**
 * As fotos a copiar depois de `cloneDaysWithNewIds`. O clone preserva a ordem de
 * dias e exercícios, então origem e cópia se casam por posição.
 */
export function photoCopies(source: Day[], copied: Day[]): PhotoCopy[] {
  const pairs: PhotoCopy[] = [];
  (source ?? []).forEach((d, i) => {
    (d.exercises ?? []).forEach((e, j) => {
      const target = copied[i]?.exercises?.[j];
      if (!target || !(e.hasPhoto || e.photoUrl)) return;
      pairs.push(e.photoUrl ? { from: e.id, to: target.id, inline: e.photoUrl } : { from: e.id, to: target.id });
    });
  });
  return pairs;
}

/** Marca `hasPhoto` nos exercícios cuja foto terminou de copiar. */
export function withPhotoFlags(days: Day[], exIds: ReadonlySet<string>): Day[] {
  return (days ?? []).map((d) => ({
    ...d,
    exercises: (d.exercises ?? []).map((e) => (exIds.has(e.id) ? { ...e, hasPhoto: true } : e)),
  }));
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/domain/photo-copy.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domain/photo-copy.ts src/domain/photo-copy.test.ts
git commit -m "feat: calcula as fotos a copiar para o plano de semana futura"
```

---

### Task 3: músculo no cartão do exercício e volume no cabeçalho do dia

**Files:**
- Modify: `src/ui/handlers/target.ts` (acrescentar `mutateExercise`)
- Modify: `src/ui/handlers/workout.ts` (`onRename` adivinha; `onMuscle` novo)
- Create: `src/ui/components/muscle-picker.ts`
- Create: `src/ui/components/day-volume.ts`
- Modify: `src/ui/components/exercise.ts`
- Modify: `src/ui/components/day.ts`
- Create: `src/ui/styles-muscle-photo.css`
- Modify: `src/main.ts` (importar o CSS)

**Interfaces:**
- Consumes: `MUSCLE_GROUPS`, `guessedMuscles`, `daySetCount`, `muscleVolume`, `formatVolume` (Task 1).
- Produces:
  ```ts
  // target.ts
  export function mutateExercise(exId: string, fn: (ex: Exercise) => Exercise): void
  // muscle-picker.ts
  export interface MuscleHandlers { onMuscle: (exId: string, field: "muscle" | "synergist", value: string) => void }
  export function musclePicker(ex: Exercise, editable: boolean, h: MuscleHandlers): TemplateResult | null
  // day-volume.ts
  export function dayVolume(day: Day): TemplateResult | null
  ```

- [ ] **Step 1: `mutateExercise` em `src/ui/handlers/target.ts`**

Trocar o import de tipos para `import type { Client, Day, Exercise } from "@/data/schema";` e acrescentar depois de `mutateDays`:

```ts
/** Aplica `fn` ao exercício `exId`, em qualquer dia do alvo atual. */
export function mutateExercise(exId: string, fn: (ex: Exercise) => Exercise): void {
  mutateDays((days) =>
    days.map((d) => ({
      ...d,
      exercises: (d.exercises ?? []).map((e) => (e.id === exId ? fn(e) : e)),
    })),
  );
}
```

- [ ] **Step 2: `onRename` e `onMuscle` em `src/ui/handlers/workout.ts`**

Acrescentar os imports:

```ts
import { guessedMuscles } from "@/domain/muscle";
```

e trocar `mutateDays` por `mutateDays, mutateExercise` no import de `./target`.

Substituir `onRename` por:

```ts
  // com o músculo ainda vazio, adivinha pelo nome, como o 1.0 (app.js:1981-1990)
  onRename: (exId: string, name: string) =>
    mutateExercise(exId, (e) => ({ ...e, name, ...guessedMuscles(e, name) })),

  onMuscle: (exId: string, field: "muscle" | "synergist", value: string) =>
    mutateExercise(exId, (e) => ({ ...e, [field]: value })),
```

- [ ] **Step 3: Criar `src/ui/components/muscle-picker.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import { MUSCLE_GROUPS } from "@/domain/muscle";
import type { Exercise } from "@/data/schema";

export interface MuscleHandlers {
  onMuscle: (exId: string, field: "muscle" | "synergist", value: string) => void;
}

// `?selected` em cada opção, e não `.value` no select: as opções chegam por uma
// expressão filha e ainda não existem quando o valor do select seria aplicado
function options(selected: string | undefined, empty: string): TemplateResult {
  return html`
    <option value="" ?selected=${!selected}>${empty}</option>
    ${MUSCLE_GROUPS.map((m) => html`<option value=${m} ?selected=${selected === m}>${m}</option>`)}
  `;
}

/** Treinador escolhe; aluno vê as etiquetas. */
export function musclePicker(ex: Exercise, editable: boolean, h: MuscleHandlers): TemplateResult | null {
  if (editable) {
    const change = (field: "muscle" | "synergist") => (e: Event) =>
      h.onMuscle(ex.id, field, (e.target as HTMLSelectElement).value);
    return html`
      <div class="muscle-picker">
        <select @change=${change("muscle")} aria-label="Músculo principal">
          ${options(ex.muscle, "Músculo")}
        </select>
        <select class="synergist" @change=${change("synergist")}
                aria-label="Sinergista, conta meia série" title="Sinergista — conta como meia série">
          ${options(ex.synergist, "Sinergista (½)")}
        </select>
      </div>
    `;
  }
  if (!ex.muscle && !ex.synergist) return null;
  return html`
    <div class="muscle-tags">
      ${ex.muscle ? html`<span class="muscle-tag">${ex.muscle}</span>` : null}
      ${ex.synergist ? html`<span class="muscle-tag synergist">+½ ${ex.synergist}</span>` : null}
    </div>
  `;
}
```

- [ ] **Step 4: Criar `src/ui/components/day-volume.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import { daySetCount, formatVolume, muscleVolume } from "@/domain/muscle";
import type { Day } from "@/data/schema";

/** "x/y séries feitas" e uma etiqueta por grupo muscular, abaixo do título do dia. */
export function dayVolume(day: Day): TemplateResult | null {
  const count = daySetCount(day);
  if (count.total === 0) return null;
  const volumes = muscleVolume([day]);
  return html`
    <div class="day-volume ${count.done === count.total ? "complete" : ""}">
      ${count.done}/${count.total} séries feitas
    </div>
    ${volumes.length
      ? html`<div class="muscle-pills">
          ${volumes.map((v) => html`<span class="muscle-pill">${v.muscle}: <b>${formatVolume(v.done)}/${formatVolume(v.total)}</b></span>`)}
        </div>`
      : null}
  `;
}
```

- [ ] **Step 5: Ligar no cartão, em `src/ui/components/exercise.ts`**

Acrescentar o import:

```ts
import { musclePicker, type MuscleHandlers } from "./muscle-picker";
```

Trocar `export interface ExerciseHandlers extends SetRowHandlers {` por `export interface ExerciseHandlers extends SetRowHandlers, MuscleHandlers {`.

Logo depois de `<div class="ex-body ${collapsed ? "hidden" : ""}">`, antes do bloco de observações:

```ts
        ${musclePicker(ex, editable, h)}
```

- [ ] **Step 6: Ligar no dia, em `src/ui/components/day.ts`**

Acrescentar o import `import { dayVolume } from "./day-volume";` e, logo depois do `</div>` que fecha `day-head`:

```ts
    ${dayVolume(day)}
```

- [ ] **Step 7: Criar `src/ui/styles-muscle-photo.css` e importar em `src/main.ts`**

```css
/* Fase 3b: músculo, volume, fotos e aviso de versão nova. */

/* músculo no cartão */
.muscle-picker { display: flex; gap: 6px; margin-bottom: 10px; }
.muscle-picker select { flex: 1; min-width: 0; background: var(--panelAlt); border: 1px solid var(--line);
  border-radius: 6px; padding: 6px; color: var(--chalk); font: inherit; font-size: 13px; }
.muscle-picker select.synergist { color: var(--muted); }
.muscle-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.muscle-tag { font-size: 11px; border: 1px solid var(--line); border-radius: 20px; padding: 2px 8px; color: var(--chalk); }
.muscle-tag.synergist { opacity: .6; }

/* volume no cabeçalho do dia */
.day-volume { color: var(--muted); font-size: 13px; margin: -10px 0 8px; }
.day-volume.complete { color: var(--green); }
.muscle-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.muscle-pill { font-size: 11px; border: 1px solid var(--line); border-radius: 20px; padding: 2px 8px; color: var(--muted); }
.muscle-pill b { color: var(--chalk); font-weight: 600; }
```

Em `src/main.ts`, depois de `import "./ui/styles-cardio-feedback.css";`:

```ts
import "./ui/styles-muscle-photo.css";
```

- [ ] **Step 8: Rodar a suíte e o build**

Run: `npm test && npm run build`
Expected: tudo verde. `handlers.day` agora tem `onMuscle`, que `ExerciseHandlers` exige; se o tsc reclamar de handler faltando, é aqui.

- [ ] **Step 9: Commit**

```bash
git add src/ui/handlers/target.ts src/ui/handlers/workout.ts src/ui/components/muscle-picker.ts src/ui/components/day-volume.ts src/ui/components/exercise.ts src/ui/components/day.ts src/ui/styles-muscle-photo.css src/main.ts
git commit -m "feat: músculo e sinergista no exercício, volume no cabeçalho do dia"
```

---

### Task 4: tela de volume muscular

**Files:**
- Modify: `src/ui/state.ts` (`Screen` ganha `"muscle"`)
- Create: `src/ui/views/muscle-volume.ts`
- Modify: `src/ui/handlers/screens.ts` (`onOpenMuscle`, `onCloseMuscle`)
- Modify: `src/ui/handlers/index.ts` (exportar `editableDays`)
- Modify: `src/ui/render.ts`
- Modify: `src/ui/styles-muscle-photo.css`

**Interfaces:**
- Consumes: `muscleVolume`, `formatVolume`, `MuscleVolume` (Task 1); `editableDays(client)`.
- Produces: `muscleVolumeView(volumes: MuscleVolume[], onBack: () => void): TemplateResult`.

- [ ] **Step 1: `Screen` em `src/ui/state.ts`**

```ts
export type Screen = "home" | "calendar" | "pastWeek" | "progression" | "cardio" | "feedback" | "muscle";
```

- [ ] **Step 2: Criar `src/ui/views/muscle-volume.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import { formatVolume, type MuscleVolume } from "@/domain/muscle";

export function muscleVolumeView(volumes: MuscleVolume[], onBack: () => void): TemplateResult {
  const max = volumes[0]?.total || 1;
  const pct = (n: number) => `${Math.round((n / max) * 100)}%`;
  return html`
    <div class="day-head">
      <button class="back" @click=${onBack}><i class="ti ti-arrow-left"></i></button>
      <span class="day-title display">Volume muscular</span>
    </div>
    <p class="muted-note volume-intro">
      Séries por grupo muscular, somando todos os treinos da semana. A parte colorida mostra o que já
      foi feito. O sinergista de um exercício composto conta meia série (supino soma ½ para o tríceps).
    </p>
    ${volumes.length === 0
      ? html`<p class="muted-note">
          Nenhum exercício com grupo muscular ainda. O grupo é adivinhado pelo nome ao renomear o
          exercício, ou escolhido no próprio cartão.
        </p>`
      : html`<div class="volume-list">
          ${volumes.map(
            (v) => html`
              <div>
                <div class="volume-row-head">
                  <span>${v.muscle}</span>
                  <span class="muted-note">${formatVolume(v.done)}/${formatVolume(v.total)} séries</span>
                </div>
                <div class="volume-bar">
                  <div class="volume-bar-total" style="width:${pct(v.total)}"></div>
                  <div class="volume-bar-done" style="width:${pct(v.done)}"></div>
                </div>
              </div>`,
          )}
        </div>`}
  `;
}
```

- [ ] **Step 3: Handlers em `src/ui/handlers/screens.ts`**

Dentro do objeto `screens`, depois de `onBackHome`:

```ts
  onOpenMuscle: () => setState({ screen: "muscle", activeDayId: null }),
  // volta sem resetar o alvo: quem abriu o volume de dentro de um plano volta ao plano
  onCloseMuscle: () => setState({ screen: "home" }),
```

- [ ] **Step 4: Exportar `editableDays` em `src/ui/handlers/index.ts`**

Acrescentar a linha:

```ts
export { editableDays } from "./target";
```

- [ ] **Step 5: Rota e botão em `src/ui/render.ts`**

Imports:

```ts
import { muscleVolumeView } from "./views/muscle-volume";
import { muscleVolume } from "@/domain/muscle";
```

Em `screenTemplate`, antes do `return null;`:

```ts
  if (s.screen === "muscle") {
    // os dias do alvo de edição: com um plano aberto, é o volume do plano
    return muscleVolumeView(muscleVolume(handlers.editableDays(client)), handlers.screens.onCloseMuscle);
  }
```

Em `homeTemplate`, dentro de `prog-tabs`, depois do botão de Cardio:

```ts
      ${editable
        ? html`<button class="dashed-btn" @click=${handlers.screens.onOpenMuscle}>
            <i class="ti ti-chart-donut-3"></i> Volume muscular
          </button>`
        : null}
```

- [ ] **Step 6: Estilos, ao final de `src/ui/styles-muscle-photo.css`**

```css
/* tela de volume */
.volume-intro { margin-bottom: 18px; }
.volume-list { display: flex; flex-direction: column; gap: 16px; }
.volume-row-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px;
  font-size: 14px; font-weight: 600; }
.volume-row-head .muted-note { font-size: 12px; font-weight: 400; }
.volume-bar { position: relative; height: 16px; overflow: hidden; background: var(--panelAlt);
  border: 1px solid var(--line); border-radius: 8px; }
.volume-bar-total, .volume-bar-done { position: absolute; top: 0; left: 0; height: 100%; }
.volume-bar-total { background: var(--line); }
.volume-bar-done { background: var(--red); }
```

- [ ] **Step 7: Rodar a suíte e o build**

Run: `npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 8: Commit**

```bash
git add src/ui/state.ts src/ui/views/muscle-volume.ts src/ui/handlers/screens.ts src/ui/handlers/index.ts src/ui/render.ts src/ui/styles-muscle-photo.css
git commit -m "feat: adiciona a tela de volume muscular"
```

---

### Task 5: dados de foto, compressão, estado e handlers

**Files:**
- Create: `src/data/photos.ts`
- Create: `src/ui/image.ts`
- Modify: `src/ui/state.ts` (`photos`, `photoViewer`)
- Create: `src/ui/handlers/photos.ts`
- Modify: `src/ui/handlers/index.ts`

**Interfaces:**
- Consumes: `mutateExercise` (Task 3); `withPhotoFlags`, `PhotoCopy` (Task 2); `replacePlanDays`.
- Produces:
  ```ts
  // data/photos.ts
  export function loadPhoto(clientId: string, exId: string): Promise<string | null>
  export function savePhoto(clientId: string, exId: string, dataUrl: string): Promise<void>
  export function deletePhoto(clientId: string, exId: string): Promise<void>
  // ui/image.ts
  export const PHOTO_MAX_CHARS = 700_000
  export function compressImage(file: File, maxSide?: number, quality?: number): Promise<string>
  // state.ts
  photos: ReadonlyMap<string, string | null>; photoViewer: string | null
  // handlers/photos.ts
  export const photos: {
    photoOf(ex: Exercise): string | null | undefined;   // undefined = carregando
    onAddPhoto(exId: string, file: File): void;
    onRemovePhoto(exId: string): void;
    onViewPhoto(src: string): void;
    onClosePhoto(): void;
  }
  export function copyPlanPhotos(clientId: string, planId: string, copies: PhotoCopy[]): Promise<void>
  export function forgetPhoto(clientId: string, ex: Exercise): void
  ```

- [ ] **Step 1: Criar `src/data/photos.ts`**

```ts
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

/**
 * clients/{clientId}/photos/{exId} = { dataUrl }, o formato do 1.0. Cada foto
 * mora no próprio documento para não pesar no documento do aluno, que tem teto
 * de 1MB; o exercício só leva `hasPhoto: true`.
 */
function photoRef(clientId: string, exId: string) {
  return doc(db, "clients", clientId, "photos", exId);
}

/** null quando o documento não existe: exercício marcado com foto que se perdeu. */
export async function loadPhoto(clientId: string, exId: string): Promise<string | null> {
  const snap = await getDoc(photoRef(clientId, exId));
  const dataUrl = snap.data()?.dataUrl;
  return typeof dataUrl === "string" && dataUrl ? dataUrl : null;
}

/** Mesmo contrato de `saveClient`: offline a promessa só resolve quando sincronizar. */
export async function savePhoto(clientId: string, exId: string, dataUrl: string): Promise<void> {
  await setDoc(photoRef(clientId, exId), { dataUrl });
}

export async function deletePhoto(clientId: string, exId: string): Promise<void> {
  await deleteDoc(photoRef(clientId, exId));
}
```

- [ ] **Step 2: Criar `src/ui/image.ts`**

```ts
/** Os mesmos números do 1.0 (app.js:2013-2016). */
export const PHOTO_MAX_SIDE = 700;
export const PHOTO_QUALITY = 0.6;
/** Acima disso o documento da foto chegaria perto do teto de 1MB do Firestore. */
export const PHOTO_MAX_CHARS = 700_000;

/**
 * Reduz a foto no aparelho e devolve um data URL JPEG. `createImageBitmap`
 * respeita a orientação EXIF, então foto de celular não chega deitada.
 */
export async function compressImage(
  file: File,
  maxSide = PHOTO_MAX_SIDE,
  quality = PHOTO_QUALITY,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}
```

- [ ] **Step 3: Estado em `src/ui/state.ts`**

Em `AppState`, depois de `planChoiceWeekKey`:

```ts
  /** Fotos já lidas, por id de exercício. null = o documento da foto não existe. */
  photos: ReadonlyMap<string, string | null>;
  /** Foto aberta em tela cheia. */
  photoViewer: string | null;
```

Em `INITIAL`, depois de `planChoiceWeekKey: null,`:

```ts
  photos: new Map<string, string | null>(),
  photoViewer: null,
```

- [ ] **Step 4: Criar `src/ui/handlers/photos.ts`**

```ts
import { getState, setState } from "../state";
import { deletePhoto, loadPhoto, savePhoto } from "@/data/photos";
import { compressImage, PHOTO_MAX_CHARS } from "../image";
import { withPhotoFlags, type PhotoCopy } from "@/domain/photo-copy";
import { replacePlanDays } from "@/domain/plan-edit";
import { currentClient, mutateExercise, persist } from "./target";
import type { Exercise } from "@/data/schema";

/** Leituras já disparadas, para a render não pedir a mesma foto duas vezes. */
const requested = new Set<string>();

function remember(exId: string, src: string | null): void {
  const next = new Map(getState().photos);
  next.set(exId, src);
  setState({ photos: next });
}

async function fetchPhoto(clientId: string, exId: string): Promise<void> {
  try {
    remember(exId, await loadPhoto(clientId, exId));
  } catch {
    // sem rede, por exemplo: a próxima render tenta de novo
    requested.delete(exId);
  }
}

/**
 * Some com a foto de um exercício que está sendo removido. Só o treinador
 * remove exercício, e só ele pode apagar foto.
 */
export function forgetPhoto(clientId: string, ex: Exercise): void {
  if (ex.hasPhoto) deletePhoto(clientId, ex.id).catch(() => {});
}

export const photos = {
  /**
   * A foto a mostrar: o texto da imagem, null quando não há, ou undefined
   * enquanto carrega. Dispara a leitura na primeira vez; a resposta chega pelo
   * estado e redesenha a tela.
   */
  photoOf: (ex: Exercise): string | null | undefined => {
    if (ex.photoUrl) return ex.photoUrl;
    if (!ex.hasPhoto) return null;
    const known = getState().photos.get(ex.id);
    if (known !== undefined) return known;
    const c = currentClient();
    if (c && !requested.has(ex.id)) {
      requested.add(ex.id);
      void fetchPhoto(c.id, ex.id);
    }
    return undefined;
  },

  onAddPhoto: async (exId: string, file: File) => {
    const c = currentClient();
    if (!c) return;
    let dataUrl: string;
    try {
      dataUrl = await compressImage(file);
    } catch {
      setState({ error: "Não foi possível ler essa imagem." });
      return;
    }
    if (dataUrl.length > PHOTO_MAX_CHARS) {
      setState({ error: "Foto muito grande ou detalhada. Tente outra." });
      return;
    }
    remember(exId, dataUrl);
    // sem await: offline a promessa só resolve quando sincronizar
    savePhoto(c.id, exId, dataUrl).catch(() => setState({ error: "Não foi possível salvar a foto." }));
    mutateExercise(exId, (e) => ({ ...e, hasPhoto: true }));
  },

  onRemovePhoto: (exId: string) => {
    const c = currentClient();
    if (!c || !confirm("Remover essa foto?")) return;
    remember(exId, null);
    deletePhoto(c.id, exId).catch(() => {});
    mutateExercise(exId, ({ hasPhoto: _flag, photoUrl: _inline, ...rest }) => rest);
  },

  onViewPhoto: (src: string) => setState({ photoViewer: src }),
  onClosePhoto: () => setState({ photoViewer: null }),
};

/**
 * Copia as fotos para os exercícios de um plano recém-criado e marca `hasPhoto`
 * nos que deram certo. Roda no aparelho do treinador, o único que pode escrever
 * fotos. Uma foto que falha deixa aquele exercício sem foto, e não quebrado.
 */
export async function copyPlanPhotos(clientId: string, planId: string, copies: PhotoCopy[]): Promise<void> {
  const copied = new Set<string>();
  for (const cp of copies) {
    try {
      const src = cp.inline ?? (await loadPhoto(clientId, cp.from));
      if (!src) continue;
      savePhoto(clientId, cp.to, src).catch(() =>
        setState({ error: "Não foi possível copiar uma foto para o plano." }),
      );
      remember(cp.to, src);
      copied.add(cp.to);
    } catch {
      // foto de origem ilegível: o exercício do plano segue sem foto
    }
  }
  if (!copied.size) return;

  // relê o aluno agora: o plano pode ter sido editado enquanto as fotos copiavam
  const client = getState().clients.find((c) => c.id === clientId);
  const plans = client?.weekPlans ?? [];
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return;
  persist(clientId, { weekPlans: replacePlanDays(plans, planId, withPhotoFlags(plan.days, copied)) });
}
```

- [ ] **Step 5: Exportar em `src/ui/handlers/index.ts`**

```ts
export { photos, copyPlanPhotos, forgetPhoto } from "./photos";
```

- [ ] **Step 6: Rodar a suíte e o build**

Run: `npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 7: Commit**

```bash
git add src/data/photos.ts src/ui/image.ts src/ui/state.ts src/ui/handlers/photos.ts src/ui/handlers/index.ts
git commit -m "feat: lê, grava e comprime fotos de exercício"
```

---

### Task 6: foto no cartão, tela cheia e remoção junto com o exercício

**Files:**
- Create: `src/ui/components/exercise-photo.ts`
- Create: `src/ui/components/photo-viewer.ts`
- Modify: `src/ui/components/exercise.ts`
- Modify: `src/ui/handlers/workout.ts` (`onRemoveExercise` apaga a foto)
- Modify: `src/ui/render.ts`
- Modify: `src/ui/styles-muscle-photo.css`

**Interfaces:**
- Consumes: `photos` e `forgetPhoto` (Task 5).
- Produces:
  ```ts
  export interface PhotoHandlers {
    photoOf: (ex: Exercise) => string | null | undefined;
    onAddPhoto: (exId: string, file: File) => void;
    onRemovePhoto: (exId: string) => void;
    onViewPhoto: (src: string) => void;
  }
  export function exercisePhoto(ex: Exercise, editable: boolean, h: PhotoHandlers): TemplateResult | null
  export function photoViewer(src: string | null, onClose: () => void): TemplateResult | null
  ```

- [ ] **Step 1: Criar `src/ui/components/exercise-photo.ts`**

```ts
import { html, type TemplateResult } from "lit-html";
import type { Exercise } from "@/data/schema";

export interface PhotoHandlers {
  photoOf: (ex: Exercise) => string | null | undefined;
  onAddPhoto: (exId: string, file: File) => void;
  onRemovePhoto: (exId: string) => void;
  onViewPhoto: (src: string) => void;
}

function onPick(e: Event, exId: string, h: PhotoHandlers): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  // limpa para que escolher o mesmo arquivo de novo também dispare
  input.value = "";
  if (file) h.onAddPhoto(exId, file);
}

/**
 * Foto do exercício. `hasPhoto` sem documento chega aqui como null e vira "sem
 * foto": o aluno não vê quadro vazio e o treinador pode enviar de novo.
 */
export function exercisePhoto(ex: Exercise, editable: boolean, h: PhotoHandlers): TemplateResult | null {
  const src = h.photoOf(ex);
  if (src === undefined) return html`<div class="ex-photo-loading muted-note">carregando foto…</div>`;
  if (src) {
    return html`
      <div class="ex-photo">
        <img src=${src} alt="Foto do exercício ${ex.name}" @click=${() => h.onViewPhoto(src)} />
        ${editable
          ? html`<button class="ex-photo-remove" @click=${() => h.onRemovePhoto(ex.id)} aria-label="Remover foto">
              <i class="ti ti-x"></i>
            </button>`
          : null}
      </div>
    `;
  }
  if (!editable) return null;
  return html`
    <label class="dashed-btn photo-add">
      <i class="ti ti-photo-plus"></i> Adicionar foto
      <input type="file" accept="image/*" class="hidden" @change=${(e: Event) => onPick(e, ex.id, h)} />
    </label>
  `;
}
```

- [ ] **Step 2: Criar `src/ui/components/photo-viewer.ts`**

```ts
import { html, type TemplateResult } from "lit-html";

export function photoViewer(src: string | null, onClose: () => void): TemplateResult | null {
  if (!src) return null;
  return html`
    <div class="photo-viewer" @click=${onClose} role="dialog" aria-label="Foto do exercício">
      <img src=${src} alt="Foto do exercício em tela cheia" />
      <button class="photo-viewer-close" aria-label="Fechar"><i class="ti ti-x"></i></button>
    </div>
  `;
}
```

- [ ] **Step 3: Foto no cartão, em `src/ui/components/exercise.ts`**

Acrescentar o import:

```ts
import { exercisePhoto, type PhotoHandlers } from "./exercise-photo";
```

Trocar a declaração da interface por `export interface ExerciseHandlers extends SetRowHandlers, MuscleHandlers, PhotoHandlers {`.

Logo depois de `${musclePicker(ex, editable, h)}`:

```ts
        ${exercisePhoto(ex, editable, h)}
```

- [ ] **Step 4: Apagar a foto junto com o exercício, em `src/ui/handlers/workout.ts`**

Acrescentar o import `import { forgetPhoto } from "./photos";` e substituir `onRemoveExercise` por:

```ts
  onRemoveExercise: (exId: string) => {
    const c = currentClient();
    const ex = c && editableDays(c).flatMap((d) => d.exercises ?? []).find((e) => e.id === exId);
    // cada exercício tem id próprio, então ninguém mais aponta para essa foto
    if (c && ex) forgetPhoto(c.id, ex);
    mutateDays((days) =>
      days.map((d) => ({ ...d, exercises: (d.exercises ?? []).filter((e) => e.id !== exId) })),
    );
  },
```

- [ ] **Step 5: Ligar em `src/ui/render.ts`**

Imports:

```ts
import { photoViewer } from "./components/photo-viewer";
```

Em `homeTemplate`, trocar `handlers.day` por `{ ...handlers.day, ...handlers.photos }` na chamada de `dayView`.

Renomear a função `template()` para `viewTemplate()` e acrescentar, logo abaixo dela:

```ts
/** Camadas por cima de qualquer tela. */
function template() {
  const s = getState();
  return html`
    ${viewTemplate()}
    ${photoViewer(s.photoViewer, handlers.photos.onClosePhoto)}
  `;
}
```

- [ ] **Step 6: Estilos, ao final de `src/ui/styles-muscle-photo.css`**

```css
/* foto no cartão */
.ex-photo { position: relative; margin-bottom: 10px; }
.ex-photo img { display: block; width: 100%; max-height: 240px; object-fit: cover; border-radius: 8px;
  border: 1px solid var(--line); cursor: zoom-in; }
.ex-photo-remove { position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,.6); color: var(--chalk);
  border-radius: 6px; padding: 4px; }
.ex-photo-loading { margin-bottom: 10px; font-size: 12px; }
.photo-add { margin-bottom: 10px; cursor: pointer; }

/* tela cheia */
.photo-viewer { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.92); display: flex;
  align-items: center; justify-content: center; padding: 16px; }
.photo-viewer img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; }
.photo-viewer-close { position: absolute; top: 16px; right: 16px; color: var(--chalk); font-size: 22px; }
```

- [ ] **Step 7: Rodar a suíte e o build**

Run: `npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 8: Commit**

```bash
git add src/ui/components/exercise-photo.ts src/ui/components/photo-viewer.ts src/ui/components/exercise.ts src/ui/handlers/workout.ts src/ui/render.ts src/ui/styles-muscle-photo.css
git commit -m "feat: mostra, envia e remove a foto do exercício"
```

---

### Task 7: copiar as fotos ao planejar a semana futura

**Files:**
- Modify: `src/ui/handlers/screens.ts` (`onChoosePlan`)
- Modify: `src/domain/plan-edit.ts` (comentário)

**Interfaces:**
- Consumes: `photoCopies` (Task 2); `copyPlanPhotos` (Task 5).

- [ ] **Step 1: Disparar a cópia em `onChoosePlan`**

Acrescentar os imports em `src/ui/handlers/screens.ts`:

```ts
import { photoCopies } from "@/domain/photo-copy";
import { copyPlanPhotos } from "./photos";
```

Em `onChoosePlan`, logo depois de `persist(c.id, { weekPlans: [...(c.weekPlans ?? []), plan] });`:

```ts
    // o plano aparece na hora; as fotos chegam em seguida, uma leitura e uma escrita cada
    if (mode === "copy") void copyPlanPhotos(c.id, plan.id, photoCopies(c.days ?? [], plan.days));
```

- [ ] **Step 2: Atualizar o comentário de `createPlan` em `src/domain/plan-edit.ts`**

Trocar o parágrafo que começa com "Fotos de exercício são da fase 3" por:

```ts
 * A cópia chega sem `hasPhoto`: a foto mora no id antigo do exercício. Quem cria
 * o plano copia as fotos depois (ver `copyPlanPhotos`) e marca os exercícios cuja
 * cópia deu certo.
```

- [ ] **Step 3: Rodar a suíte e o build**

Run: `npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 4: Commit**

```bash
git add src/ui/handlers/screens.ts src/domain/plan-edit.ts
git commit -m "feat: copia as fotos ao planejar a semana futura"
```

---

### Task 8: aviso de versão nova

**Files:**
- Modify: `src/vite-env.d.ts`
- Create: `src/pwa.ts`
- Create: `src/ui/components/update-banner.ts`
- Modify: `src/ui/state.ts` (`updateReady`)
- Modify: `src/main.ts`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/styles-muscle-photo.css`

**Interfaces:**
- Produces:
  ```ts
  // src/pwa.ts
  export function startPwa(): void
  export function applyUpdate(): void
  // update-banner.ts
  export function updateBanner(ready: boolean, onUpdate: () => void): TemplateResult | null
  ```

- [ ] **Step 1: Tipos do módulo virtual em `src/vite-env.d.ts`**

Logo abaixo de `/// <reference types="vite/client" />`:

```ts
/// <reference types="vite-plugin-pwa/client" />
```

- [ ] **Step 2: `updateReady` em `src/ui/state.ts`**

Em `AppState`, depois de `photoViewer`:

```ts
  /** Há uma versão nova do app esperando para ser aplicada. */
  updateReady: boolean;
```

Em `INITIAL`: `updateReady: false,`.

- [ ] **Step 3: Criar `src/pwa.ts`**

```ts
import { registerSW } from "virtual:pwa-register";
import { setState } from "./ui/state";

const HOUR = 60 * 60 * 1000;

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

/**
 * Registra o service worker. `registerType: "prompt"` (vite.config.ts) existe
 * para nunca recarregar no meio de uma série; sem esta tela, porém, ninguém via
 * o prompt, e o app instalado podia rodar a versão antiga por dias.
 *
 * O app instalado fica em segundo plano sem navegar, e o navegador só procura
 * versão nova em navegação. Por isso a verificação de hora em hora.
 */
export function startPwa(): void {
  updateSW = registerSW({
    onNeedRefresh: () => setState({ updateReady: true }),
    onRegisteredSW: (_url, registration) => {
      if (registration) setInterval(() => void registration.update(), HOUR);
    },
  });
}

export function applyUpdate(): void {
  void updateSW?.(true);
}
```

- [ ] **Step 4: Criar `src/ui/components/update-banner.ts`**

```ts
import { html, type TemplateResult } from "lit-html";

export function updateBanner(ready: boolean, onUpdate: () => void): TemplateResult | null {
  if (!ready) return null;
  return html`
    <div class="update-banner" role="status">
      <span>Nova versão disponível.</span>
      <button @click=${onUpdate}>Atualizar</button>
    </div>
  `;
}
```

- [ ] **Step 5: Iniciar em `src/main.ts`**

Acrescentar o import `import { startPwa } from "./pwa";` e, logo antes de `renderApp();` no fim do arquivo:

```ts
startPwa();
```

- [ ] **Step 6: Faixa em `src/ui/render.ts`**

Imports:

```ts
import { updateBanner } from "./components/update-banner";
import { applyUpdate } from "@/pwa";
```

Na função `template()` criada na Task 6, acima de `${viewTemplate()}`:

```ts
    ${updateBanner(s.updateReady, applyUpdate)}
```

- [ ] **Step 7: Estilos, ao final de `src/ui/styles-muscle-photo.css`**

```css
/* aviso de versão nova */
.update-banner { display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: var(--panelAlt); border: 1px solid var(--plate); border-radius: 10px; padding: 10px 12px;
  margin-bottom: 14px; font-size: 13px; }
.update-banner button { color: var(--plate); font-weight: 600; text-decoration: underline; }
```

- [ ] **Step 8: Rodar a suíte e o build, e conferir o registro**

Run: `npm test && npm run build`
Expected: tudo verde. Conferir que o build **não** injeta mais o registro automático, porque agora o app registra sozinho:

Run: `grep -c "registerSW.js" dist/index.html`
Expected: `0`.

- [ ] **Step 9: Commit**

```bash
git add src/vite-env.d.ts src/pwa.ts src/ui/components/update-banner.ts src/ui/state.ts src/main.ts src/ui/render.ts src/ui/styles-muscle-photo.css
git commit -m "feat: avisa quando há versão nova do app"
```

---

### Task 9: publicar e verificar em produção

**Files:** nenhum arquivo novo.

- [ ] **Step 1: Suíte, build e limites**

```bash
npm test && npm run build
```

Conferir que nenhum arquivo de `src/` criado ou alterado nesta fase passa de ~250 linhas, que `package.json` e `firestore.rules` não mudaram.

- [ ] **Step 2: Publicar**

```bash
git push origin main
gh run list --repo fermmura/muratraining2 --limit 1
gh run watch <id> --repo fermmura/muratraining2 --exit-status
```

- [ ] **Step 3: Verificar em https://fermmura.github.io/muratraining2/**

Como treinador:

1. Criar um exercício "Supino reto": o cartão passa a mostrar Peito e Tríceps (½). Trocar o músculo à mão e renomear: a escolha fica.
2. O cabeçalho do dia mostra "x/y séries feitas" e as etiquetas por grupo.
3. "Volume muscular" lista os grupos em barras.
4. Adicionar uma foto: aparece no cartão; tocar abre em tela cheia.
5. Planejar a próxima semana copiando o treino: o exercício com foto aparece com a foto no plano.

Como aluno:

6. Vê as etiquetas de músculo e a foto; não vê listas nem botão de foto.
7. Ao publicar a próxima versão, a faixa "Nova versão disponível" aparece (verificar na publicação seguinte).

No 1.0:

8. A foto enviada pelo 2.0 aparece; o músculo escolhido no 2.0 aparece no exercício.

- [ ] **Step 4: Commit de status**

```bash
git commit --allow-empty -m "chore: fase 3b no ar"
git push
```

---

## Verificação da fase

- [ ] `npm test` passa, com os testes novos de `muscle` e `photo-copy`.
- [ ] `npm run build` passa sem erro de TypeScript.
- [ ] Nenhum arquivo de `src/` criado ou alterado passa de ~250 linhas; nenhuma dependência nova; `firestore.rules` intocado.
- [ ] Escolha manual de músculo nunca é sobrescrita ao renomear.
- [ ] `hasPhoto` sem documento não mostra quadro vazio.
- [ ] Nada no aparelho do aluno escreve em `photos`.
- [ ] Copiar treino para semana futura leva as fotos.
- [ ] O app avisa quando há versão nova e nunca recarrega sozinho.
