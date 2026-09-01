/**
 * Logger applicatif (pino).
 *
 * US-8.2 : aucun contenu sensible dans les logs. On rédige agressivement les
 * champs susceptibles de porter un mot de passe, un jeton, un cookie, un e-mail
 * de courrier, etc. Le contenu des documents utilisateurs ne transite jamais ici.
 */
import { pino } from "pino";
import { env, isProd, isTest } from "../env.js";

const redactPaths = [
  "req.headers.cookie",
  "req.headers.authorization",
  "res.headers['set-cookie']",
  "*.password",
  "*.passwordConfirm",
  "*.passwordHash",
  "*.token",
  "*.sessionToken",
  "*.rawToken",
  "*.secret",
  "password",
  "passwordHash",
  "token",
  "sessionToken",
];

export const logger = pino({
  level: isTest ? "silent" : (process.env.LOG_LEVEL ?? (isProd ? "info" : "debug")),
  redact: { paths: redactPaths, censor: "[redacted]" },
  transport: isProd
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
  base: { app: "capclair-back", env: env.NODE_ENV },
});

export type Logger = typeof logger;
