/** US-1.2 AC5 — Déconnexion invalide la session côté serveur. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";
import { createUser } from "../helpers/factories.js";

const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

describe("POST /auth/logout", () => {
  it("supprime la ligne Session ; /auth/session renvoie ensuite 401", async () => {
    const app = await getApp();
    const { email, password } = await createUser(prisma);

    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
    const cookie = sessionCookie(login)!;
    expect(await prisma.session.count()).toBe(1);

    const out = await app.inject({ method: "POST", url: "/auth/logout", headers: { cookie } });
    expect(out.statusCode).toBe(204);
    expect(await prisma.session.count()).toBe(0);

    const me = await app.inject({ method: "GET", url: "/auth/session", headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });

  it("est idempotent (déconnexion sans cookie)", async () => {
    const app = await getApp();
    const out = await app.inject({ method: "POST", url: "/auth/logout" });
    expect(out.statusCode).toBe(204);
  });
});
