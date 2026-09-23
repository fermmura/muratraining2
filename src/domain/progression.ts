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
