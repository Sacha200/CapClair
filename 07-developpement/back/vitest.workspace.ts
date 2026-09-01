import { defineWorkspace } from "vitest/config";

/** Environnement minimal injecté avant tout import (src/env.ts valide au chargement). */
const unitEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://capclair:capclair_dev@localhost:5434/capclair_test?schema=public",
  REDIS_URL: "redis://localhost:6379",
  APP_BASE_URL: "http://localhost:3000",
  COOKIE_SECURE: "false",
  AUTH_FIXED_DELAY_MS: "10",
  AUTH_FIXED_DELAY_JITTER_MS: "0",
  // argon2 volontairement rapide en test (les paramètres réels sont dans .env.example).
  ARGON2_MEMORY_KIB: "8192",
  ARGON2_TIME_COST: "1",
  ARGON2_PARALLELISM: "1",
};

export default defineWorkspace([
  {
    test: {
      name: "unit",
      include: ["src/**/*.test.ts"],
      environment: "node",
      env: unitEnv,
    },
  },
  {
    test: {
      name: "integration",
      include: ["test/integration/**/*.test.ts"],
      environment: "node",
      globalSetup: ["test/setup.ts"],
      hookTimeout: 60_000,
      testTimeout: 20_000,
    },
  },
]);
