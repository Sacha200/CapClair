import { describe, expect, it } from "vitest";
import { RATE_LIMITS, routeRateLimit } from "./rate-limit.js";

describe("routeRateLimit", () => {
  it("produit une config `rateLimit` exploitable par Fastify", () => {
    expect(routeRateLimit(7, "1 minute")).toEqual({
      rateLimit: { max: 7, timeWindow: "1 minute" },
    });
  });
});

describe("RATE_LIMITS", () => {
  it("expose un preset par domaine soumis à limitation (US-8.1 AC1)", () => {
    expect(Object.keys(RATE_LIMITS).sort()).toEqual(
      ["analysis", "forgot", "import", "login", "register", "reset"].sort(),
    );
  });

  it("chaque preset porte un `max` entier positif et une fenêtre non vide", () => {
    for (const preset of Object.values(RATE_LIMITS)) {
      expect(Number.isInteger(preset.rateLimit.max)).toBe(true);
      expect(preset.rateLimit.max).toBeGreaterThan(0);
      expect(preset.rateLimit.timeWindow.length).toBeGreaterThan(0);
    }
  });
});
