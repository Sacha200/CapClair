import { describe, expect, it } from "vitest";
import { withMinimumDuration } from "./delay.js";

describe("withMinimumDuration", () => {
  it("étire une opération rapide jusqu'à la durée cible", async () => {
    const start = performance.now();
    const result = await withMinimumDuration(async () => "ok", 120);
    const elapsed = performance.now() - start;
    expect(result).toBe("ok");
    expect(elapsed).toBeGreaterThanOrEqual(115);
  });

  it("n'ajoute rien à une opération déjà plus longue que la cible", async () => {
    const start = performance.now();
    await withMinimumDuration(async () => {
      await new Promise((r) => setTimeout(r, 80));
    }, 20);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(180);
  });

  it("propage l'erreur tout en respectant la durée minimale", async () => {
    const start = performance.now();
    await expect(
      withMinimumDuration(async () => {
        throw new Error("boom");
      }, 100),
    ).rejects.toThrow("boom");
    expect(performance.now() - start).toBeGreaterThanOrEqual(95);
  });

  it("cas rapide et cas lent convergent vers une durée voisine", async () => {
    const timeOf = async (workMs: number) => {
      const s = performance.now();
      await withMinimumDuration(async () => {
        await new Promise((r) => setTimeout(r, workMs));
      }, 150, 10);
      return performance.now() - s;
    };
    const fast = await timeOf(1);
    const slow = await timeOf(60);
    expect(Math.abs(fast - slow)).toBeLessThan(60);
  });
});
