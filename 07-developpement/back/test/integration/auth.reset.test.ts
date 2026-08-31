/** US-1.3 — Réinitialisation : application. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";
import { createUser, createSessionFor } from "../helpers/factories.js";
import { mailer } from "../../src/server/mail/mailer.js";
import { verifyPassword } from "../../src/server/auth/password.js";

const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

/** Déclenche « forgot » et récupère le jeton brut depuis l'e-mail capturé. */
async function issueToken(email: string): Promise<string> {
  const app = await getApp();
  let raw = "";
  const spy = vi.spyOn(mailer, "send").mockImplementation(async (mail) => {
    raw = /token=([^\s&]+)/.exec(mail.text)?.[1] ?? "";
  });
  await app.inject({ method: "POST", url: "/auth/password/forgot", payload: { email } });
  spy.mockRestore();
  return decodeURIComponent(raw);
}

describe("POST /auth/password/reset", () => {
  it("change le mot de passe, consomme le jeton, invalide toutes les sessions (AC3, AC4)", async () => {
    const app = await getApp();
    const { user, email } = await createUser(prisma, { email: "r@exemple.fr" });
    await createSessionFor(prisma, user.id);
    await createSessionFor(prisma, user.id);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);

    const token = await issueToken(email);
    const res = await app.inject({
      method: "POST",
      url: "/auth/password/reset",
      payload: { token, password: "nouveau-mot-de-passe-1", passwordConfirm: "nouveau-mot-de-passe-1" },
    });
    expect(res.statusCode).toBe(200);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(after.passwordHash!, "nouveau-mot-de-passe-1")).toBe(true);
    expect(await prisma.verificationToken.count()).toBe(0);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);

    // Réutilisation du jeton → 400 message exact.
    const reuse = await app.inject({
      method: "POST",
      url: "/auth/password/reset",
      payload: { token, password: "encore-un-autre-12", passwordConfirm: "encore-un-autre-12" },
    });
    expect(reuse.statusCode).toBe(400);
    expect(reuse.json().error).toBe("Ce lien n'est plus valide.");
  });

  it("jeton inconnu → 400 « Ce lien n'est plus valide. »", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/password/reset",
      payload: { token: "jamais-emis", password: "assez-long-de-12x", passwordConfirm: "assez-long-de-12x" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Ce lien n'est plus valide.");
  });

  it("ne connecte pas automatiquement après reset (pas de cookie)", async () => {
    const { email } = await createUser(prisma, { email: "nologin@exemple.fr" });
    const token = await issueToken(email);
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/password/reset",
      payload: { token, password: "mon-nouveau-pass-1", passwordConfirm: "mon-nouveau-pass-1" },
    });
    expect(sessionCookie(res)).toBeUndefined();
  });
});
