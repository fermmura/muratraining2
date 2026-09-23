import { describe, it, expect } from "vitest";
import { buildCalendarWeeks, isWeekOutOfSync, CALENDAR_OFFSETS } from "./calendar";
import { weekKeyOf, todayKey } from "./week";
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
    const weeks = buildCalendarWeeks(client({ activeWeekKey: "2026-09-14" }));
    expect(weeks.find((w) => w.offset === 0)?.weekKey).toBe("2026-09-14");
    expect(weeks.find((w) => w.offset === -1)?.weekKey).toBe("2026-09-07");
    expect(weeks.find((w) => w.offset === 1)?.weekKey).toBe("2026-09-21");
  });

  it("marca a semana ativa como atual", () => {
    expect(buildCalendarWeeks(client()).find((w) => w.offset === 0)?.state).toBe("current");
  });

  it("conta séries feitas e totais da semana atual", () => {
    const current = buildCalendarWeeks(client()).find((w) => w.offset === 0);
    expect(current?.setsDone).toBe(1);
    expect(current?.setsTotal).toBe(2);
  });

  it("marca semana anterior com registro como concluída e conta as séries", () => {
    const c = client({ history: [entry(), entry({ setId: "s2", setIndex: 1 })] });
    const past = buildCalendarWeeks(c).find((w) => w.offset === -1);
    expect(past?.state).toBe("past");
    expect(past?.setsDone).toBe(2);
  });

  it("conta série repetida em dias diferentes da semana passada", () => {
    // mesma série, mesmo exercício, dias diferentes: cada dia conta
    const c = client({
      history: [
        entry({ dayTitle: "Peito A", setId: "s1" }),
        entry({ dayTitle: "Peito B", setId: "s2" }),
      ],
    });
    const past = buildCalendarWeeks(c).find((w) => w.offset === -1);
    expect(past?.setsDone).toBe(2);
  });

  it("marca semana anterior sem registro como concluída sem séries", () => {
    const past = buildCalendarWeeks(client()).find((w) => w.offset === -1);
    expect(past?.state).toBe("past");
    expect(past?.setsDone).toBe(0);
  });

  it("marca semana futura com plano como planejada e informa o plano", () => {
    const c = client({ weekPlans: [{ id: "p1", weekKey: "2026-09-21", days: days() }] });
    const future = buildCalendarWeeks(c).find((w) => w.offset === 1);
    expect(future?.state).toBe("planned");
    expect(future?.planId).toBe("p1");
  });

  it("marca semana futura sem plano como vazia", () => {
    const future = buildCalendarWeeks(client()).find((w) => w.offset === 1);
    expect(future?.state).toBe("empty");
    expect(future?.planId).toBeNull();
  });

  it("não conta série sem 'feito' como feita na semana passada", () => {
    const c = client({ history: [entry({ repsDone: "" })] });
    expect(buildCalendarWeeks(c).find((w) => w.offset === -1)?.setsDone).toBe(0);
  });

  it("funciona sem activeWeekKey usando a semana de hoje", () => {
    const c = client({ activeWeekKey: undefined });
    expect(buildCalendarWeeks(c).find((w) => w.offset === 0)?.weekKey).toBe(weekKeyOf(todayKey()));
  });

  it("normaliza activeWeekKey para a segunda-feira daquela semana", () => {
    // relógio errado ou aluno inativo podem deixar activeWeekKey num dia que não é segunda
    const c = client({ activeWeekKey: "2026-09-16" }); // quarta-feira
    expect(buildCalendarWeeks(c).find((w) => w.offset === 0)?.weekKey).toBe("2026-09-14");
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
