/**
 * Configuration validée au démarrage.
 *
 * US-8.4 : si une variable obligatoire manque ou est invalide, on liste TOUTES
 * les erreurs puis on quitte avec un code non nul. Aucune valeur secrète par
 * défaut ; seuls quelques réglages non sensibles ont un défaut.
 */
import "dotenv/config";
import { z } from "zod";

const booleanish = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

/** Une variable présente mais vide (`FOO=`) est traitée comme absente. */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? undefined : v), schema.optional());

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().url(),
  TEST_DATABASE_URL: optional(z.string().url()),

  REDIS_URL: z.string().url(),

  APP_BASE_URL: z.string().url(),

  SESSION_COOKIE_NAME: z.string().min(1).default("capclair_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  COOKIE_DOMAIN: optional(z.string().min(1)),
  COOKIE_SECURE: booleanish.default("true"),

  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(60),

  ARGON2_MEMORY_KIB: z.coerce.number().int().positive().default(65536),
  ARGON2_TIME_COST: z.coerce.number().int().positive().default(3),
  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),

  AUTH_FIXED_DELAY_MS: z.coerce.number().int().nonnegative().default(350),
  AUTH_FIXED_DELAY_JITTER_MS: z.coerce.number().int().nonnegative().default(40),

  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_LOGIN_WINDOW: z.string().min(1).default("15 minutes"),
  RATE_LIMIT_REGISTER_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_FORGOT_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_RESET_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_REDIS: booleanish.default("false"),
  TRUST_PROXY: booleanish.default("false"),

  CORS_ORIGIN: optional(z.string().url()),

  MAIL_TRANSPORT: z.enum(["console", "smtp"]).default("console"),
  MAIL_FROM: z.string().min(1).default("CapClair <no-reply@capclair.local>"),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Valeurs de repli utilisées UNIQUEMENT sous Vitest, pour que l'import d'un
 * module dépendant de `env` ne tue pas le runner. Les tests d'intégration
 * fournissent une vraie `TEST_DATABASE_URL` via `test/setup.ts`.
 */
const VITEST_FALLBACK: Record<string, string> = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://capclair:capclair_dev@localhost:5434/capclair_test?schema=public",
  REDIS_URL: "redis://localhost:6379",
  APP_BASE_URL: "http://localhost:3000",
  COOKIE_SECURE: "false",
};

function loadEnv(): Env {
  const source = process.env.VITEST ? { ...VITEST_FALLBACK, ...process.env } : process.env;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => {
      const key = issue.path.join(".") || "(racine)";
      return `  - ${key} : ${issue.message}`;
    });
    console.error(
      `\n[CapClair] Configuration invalide — l'application ne peut pas démarrer :\n${lines.join(
        "\n",
      )}\n\nRenseigner ces variables dans .env (voir .env.example).\n`,
    );
    process.exit(1);
  }
  return parsed.data;
}

export const env: Env = loadEnv();

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
