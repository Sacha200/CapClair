import { describe, expect, it } from "vitest";
import { EnvSchema } from "./env.js";

describe("EnvSchema", () => {
  it("liste les variables obligatoires manquantes", () => {
    const result = EnvSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const missing = result.error.issues.map((i) => i.path.join("."));
      expect(missing).toEqual(
        expect.arrayContaining(["DATABASE_URL", "REDIS_URL", "APP_BASE_URL", "ANTHROPIC_API_KEY"]),
      );
    }
  });

  it("accepte un environnement minimal valide et applique les défauts", () => {
    const result = EnvSchema.safeParse({
      DATABASE_URL: "postgresql://u:p@localhost:5434/db",
      REDIS_URL: "redis://localhost:6379",
      APP_BASE_URL: "http://localhost:3000",
      ANTHROPIC_API_KEY: "sk-ant-test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3001);
      expect(result.data.SESSION_TTL_HOURS).toBe(168);
      expect(result.data.COOKIE_SECURE).toBe(true);
      expect(result.data.RATE_LIMIT_LOGIN_MAX).toBe(5);
      expect(result.data.RATE_LIMIT_GLOBAL_MAX).toBe(1000);
      expect(result.data.RATE_LIMIT_IMPORT_MAX).toBe(20);
      expect(result.data.RATE_LIMIT_ANALYSIS_MAX).toBe(10);
      expect(result.data.ANTHROPIC_MODEL).toBe("claude-sonnet-5");
    }
  });

  it("rejette une URL de base de données malformée", () => {
    const result = EnvSchema.safeParse({
      DATABASE_URL: "pas-une-url",
      REDIS_URL: "redis://localhost:6379",
      APP_BASE_URL: "http://localhost:3000",
    });
    expect(result.success).toBe(false);
  });
});
