/** US-1.1 — Inscription. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";
import { createUser } from "../helpers/factories.js";

const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

const valid = {
  name: "Nadia K.",
  email: "nadia@exemple.fr",
  password: "mot-de-passe-tres-long-1",
  passwordConfirm: "mot-de-passe-tres-long-1",
  acceptCgu: true,
  acceptPrivacy: true,
};

describe("POST /auth/register", () => {
  it("crée le compte, la session, le consentement CGU ; le mot de passe est haché argon2id (AC5, AC7)", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: valid });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(sessionCookie(res)).toBeDefined();

    const user = await prisma.user.findUniqueOrThrow({ where: { email: valid.email } });
    expect(user.passwordHash?.startsWith("$argon2id$")).toBe(true);
    expect(user.passwordHash).not.toContain(valid.password);

    const sessions = await prisma.session.count({ where: { userId: user.id } });
    expect(sessions).toBe(1);

    const consent = await prisma.consentLog.findFirstOrThrow({ where: { userId: user.id } });
    expect(consent.consentType).toBe("CGU");
    expect(consent.granted).toBe(true);
    expect(consent.policyVersion.length).toBeGreaterThan(1);
    expect(consent.policyVersion).not.toBe("v1");
  });

  it("e-mail déjà pris : même statut et même corps, aucun nouveau compte, délais voisins (AC4)", async () => {
    const app = await getApp();
    await createUser(prisma, { email: "pris@exemple.fr" });

    const timeCall = async (payload: Record<string, unknown>) => {
      const t0 = performance.now();
      const res = await app.inject({ method: "POST", url: "/auth/register", payload });
      return { res, ms: performance.now() - t0 };
    };

    const taken = await timeCall({ ...valid, email: "pris@exemple.fr" });
    const free = await timeCall({ ...valid, email: "libre@exemple.fr" });

    expect(taken.res.statusCode).toBe(free.res.statusCode);
    expect(taken.res.json()).toEqual(free.res.json());
    expect(await prisma.user.count({ where: { email: "pris@exemple.fr" } })).toBe(1);
    expect(Math.abs(taken.ms - free.ms)).toBeLessThan(120);
  });

  it("refuse si une case n'est pas cochée : 400, champ ciblé, aucun compte (AC2)", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { ...valid, email: "x@y.fr", acceptCgu: false },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().fields).toHaveProperty("acceptCgu");
    expect(await prisma.user.count({ where: { email: "x@y.fr" } })).toBe(0);
  });

  it("refuse un mot de passe de moins de 12 caractères avec le message exact (AC3)", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { ...valid, email: "z@y.fr", password: "onze-caract", passwordConfirm: "onze-caract" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().fields.password).toBe("Le mot de passe doit contenir au moins 12 caractères.");
  });
});
