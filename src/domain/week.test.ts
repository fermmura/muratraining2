import { describe, it, expect } from "vitest";
import { localDateKey, todayKey, weekKeyOf, addWeeks } from "./week";

describe("ambiente de teste", () => {
  it("roda no fuso de São Paulo (pré-requisito dos testes de data)", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/Sao_Paulo");
  });
});

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
