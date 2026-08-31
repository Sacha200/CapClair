/** US-1.2 — Connexion. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";
import { createUser } from "../helpers/factories.js";

const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

describe("POST /auth/login", () => {
  it("bon couple → session + /auth/session OK ; cookie httpOnly+secure=false(dev)+lax (AC1, AC4)", async () => {
    const app = await getApp();
    const { email, password } = await createUser(prisma);

    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    const setCookie = res.headers["set-cookie"];
    const raw = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
    expect(raw.toLowerCase()).toContain("httponly");
    expect(raw.toLowerCase()).toContain("samesite=lax");

    const cookie = sessionCookie(res)!;
    const me = await app.inject({ method: "GET", url: "/auth/session", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe(email);
  });

  it("mauvais mot de passe → 401 « Identifiants incorrects. » sans cookie (AC2)", async () => {
    const app = await getApp();
    const { email } = await createUser(prisma);
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "mauvais-mot-de-passe" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Identifiants incorrects.");
    expect(sessionCookie(res)).toBeUndefined();
  });

  it("6ᵉ tentative dans la fenêtre → 429 (AC3)", async () => {
    const app = await getApp();
    const { email } = await createUser(prisma);
    const attempt = () =>
      app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "faux" },
        remoteAddress: "203.0.113.7",
      });

    for (let i = 0; i < 5; i += 1) {
      const r = await attempt();
      expect(r.statusCode).toBe(401);
    }
    const sixth = await attempt();
    expect(sixth.statusCode).toBe(429);
  });
});
