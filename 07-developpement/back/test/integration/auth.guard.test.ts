/** US-1.4 AC3/AC4 — Garde des routes /api. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";
import { createUser } from "../helpers/factories.js";

const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

describe("scope /api", () => {
  it("GET /api/_ping sans session → 401", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/api/_ping" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("unauthorized");
  });

  it("GET /api/_ping avec session valide → 200 et userId", async () => {
    const app = await getApp();
    const { email, password } = await createUser(prisma);
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
    const cookie = sessionCookie(login)!;

    const res = await app.inject({ method: "GET", url: "/api/_ping", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(typeof res.json().userId).toBe("string");
  });

  it("GET /api/sante reste public (200 ou 503 selon l'infra, jamais 401)", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/api/sante" });
    expect([200, 503]).toContain(res.statusCode);
  });
});
