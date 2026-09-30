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
