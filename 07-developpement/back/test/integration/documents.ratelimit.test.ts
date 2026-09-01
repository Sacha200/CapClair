/**
 * US-8.1 (#48) — Limitation de débit sur l'import.
 *
 * IP dédiée à ce fichier (le store `import` n'est pas remis à zéro entre
 * tests, ADR-009) : n'importe pas les IPs `198.51.100.x` utilisées par les
 * autres fichiers `documents.*.test.ts`.
 */
import { env } from "../../src/env.js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { readFixture, uploadBytes } from "../helpers/documents.js";
import { createUser } from "../helpers/factories.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";

const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

describe("POST /api/documents — limitation de débit", () => {
  it(`la ${env.RATE_LIMIT_IMPORT_MAX + 1}ᵉ tentative dans la fenêtre → 429`, async () => {
    const app = await getApp();
    const { email, password } = await createUser(prisma);
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password },
      remoteAddress: "203.0.113.42",
    });
    const cookie = sessionCookie(login)!;
    const tinyImage = readFixture("pixel.png");

    const attempt = () =>
      uploadBytes(app, tinyImage, {
        cookie,
        remoteAddress: "203.0.113.42",
        filename: "pixel.png",
        contentType: "image/png",
      });

    for (let i = 0; i < env.RATE_LIMIT_IMPORT_MAX; i += 1) {
      const res = await attempt();
      expect(res.statusCode).toBe(201);
    }
    const overLimit = await attempt();

    expect(overLimit.statusCode).toBe(429);
    expect(overLimit.json().code).toBe("rate_limited");
    expect(overLimit.json().error).toMatch(/^Trop de tentatives\. Réessayez dans .+\.$/);
    expect(overLimit.headers["retry-after"]).toBeDefined();
  });

  it("une autre IP n'est pas affectée (isolation par IP)", async () => {
    const app = await getApp();
    const { email, password } = await createUser(prisma);
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password },
      remoteAddress: "203.0.113.99",
    });
    const cookie = sessionCookie(login)!;

    const res = await uploadBytes(app, readFixture("pixel.png"), {
      cookie,
      remoteAddress: "203.0.113.99",
      filename: "pixel.png",
      contentType: "image/png",
    });
    expect(res.statusCode).toBe(201);
  });
});
