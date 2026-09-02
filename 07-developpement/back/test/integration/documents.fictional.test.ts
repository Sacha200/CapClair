/** US-2.3 — Confirmation du caractère fictif. IPs : 198.51.100.70 à .73. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { uploadFixture } from "../helpers/documents.js";
import { createUser } from "../helpers/factories.js";
import { LEGAL_BUNDLE_VERSION } from "../../src/lib/legal.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";

const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

async function loginUser(remoteAddress: string) {
  const app = await getApp();
  const user = await createUser(prisma);
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: user.email, password: user.password },
    remoteAddress,
  });
  return { cookie: sessionCookie(res)!, userId: user.user.id };
}

function confirm(cookie: string, documentId: string, remoteAddress: string, body?: unknown) {
  return getApp().then((app) =>
    app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/confirm-fictional`,
      headers: { cookie },
      payload: body ?? { confirmed: true },
      remoteAddress,
    }),
  );
}

describe("POST /api/documents/:id/confirm-fictional", () => {
  it("écrit UNE ligne ConsentLog FICTIONAL_DOCUMENT complète ; idempotent (AC2)", async () => {
    const app = await getApp();
    const { cookie, userId } = await loginUser("198.51.100.70");
    const upload = await uploadFixture(app, "courrier-1p.pdf", {
      cookie,
      remoteAddress: "198.51.100.70",
    });
    const { documentId, caseFileId } = upload.json();

    const res = await confirm(cookie, documentId, "198.51.100.70");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const rows = await prisma.consentLog.findMany({
      where: { consentType: "FICTIONAL_DOCUMENT" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId,
      caseFileId,
      granted: true,
      policyVersion: LEGAL_BUNDLE_VERSION,
    });

    // Second appel : toujours une seule ligne (pas de doublon de preuve).
    const again = await confirm(cookie, documentId, "198.51.100.70");
    expect(again.statusCode).toBe(200);
    expect(
      await prisma.consentLog.count({ where: { consentType: "FICTIONAL_DOCUMENT" } }),
    ).toBe(1);
  });

  it("{ confirmed: false } → 400, aucune ligne écrite", async () => {
    const app = await getApp();
    const { cookie } = await loginUser("198.51.100.71");
    const upload = await uploadFixture(app, "sample.pdf", {
      cookie,
      remoteAddress: "198.51.100.71",
    });

    const res = await confirm(cookie, upload.json().documentId, "198.51.100.71", {
      confirmed: false,
    });
    expect(res.statusCode).toBe(400);
    expect(await prisma.consentLog.count()).toBe(0);
  });

  it("cross-compte → 404, aucune ligne écrite (US-1.5)", async () => {
    const app = await getApp();
    const alice = await loginUser("198.51.100.72");
    const bob = await loginUser("198.51.100.73");
    const upload = await uploadFixture(app, "sample.pdf", {
      cookie: alice.cookie,
      remoteAddress: "198.51.100.72",
    });

    const res = await confirm(bob.cookie, upload.json().documentId, "198.51.100.73");
    expect(res.statusCode).toBe(404);
    expect(await prisma.consentLog.count()).toBe(0);
  });
});
