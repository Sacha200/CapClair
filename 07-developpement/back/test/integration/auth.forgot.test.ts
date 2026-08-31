/** US-1.3 — Réinitialisation : demande. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getApp } from "../helpers/app.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";
import { createUser } from "../helpers/factories.js";
import { mailer } from "../../src/server/mail/mailer.js";

const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

describe("POST /auth/password/forgot", () => {
  it("répond avec un corps identique que l'e-mail existe ou non (AC1)", async () => {
    const app = await getApp();
    await createUser(prisma, { email: "connu@exemple.fr" });

    const known = await app.inject({
      method: "POST",
      url: "/auth/password/forgot",
      payload: { email: "connu@exemple.fr" },
    });
    const unknown = await app.inject({
      method: "POST",
      url: "/auth/password/forgot",
      payload: { email: "inconnu@exemple.fr" },
    });

    expect(known.statusCode).toBe(200);
    expect(known.json()).toEqual({ status: "ok" });
    expect(unknown.statusCode).toBe(known.statusCode);
    expect(unknown.json()).toEqual(known.json());
  });

  it("pour un e-mail connu : jeton haché, expiration ~60 min, e-mail émis (AC2, AC5)", async () => {
    const app = await getApp();
    const { email } = await createUser(prisma, { email: "reset@exemple.fr" });
    const sendSpy = vi.spyOn(mailer, "send").mockResolvedValue();

    await app.inject({ method: "POST", url: "/auth/password/forgot", payload: { email } });

    const rows = await prisma.verificationToken.findMany();
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.identifier).toBe(`password-reset:${email}`);
    expect(row.token).toMatch(/^[0-9a-f]{64}$/); // sha256 hex, pas le jeton brut
    const minutes = (row.expires.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(55);
    expect(minutes).toBeLessThan(61);
    expect(sendSpy).toHaveBeenCalledOnce();

    sendSpy.mockRestore();
  });
});
