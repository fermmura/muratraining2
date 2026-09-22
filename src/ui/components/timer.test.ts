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
