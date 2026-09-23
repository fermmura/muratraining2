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
