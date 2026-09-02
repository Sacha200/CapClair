/** US-3.1 — Consentement explicite avant analyse externe. IPs : 198.51.100.90 à .93. */
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

async function uploadCase(cookie: string, remoteAddress: string): Promise<string> {
  const app = await getApp();
  const res = await uploadFixture(app, "courrier-1p.pdf", { cookie, remoteAddress });
  return res.json().caseFileId as string;
}

function consentAi(cookie: string, id: string, remoteAddress: string, body?: unknown) {
  return getApp().then((app) =>
    app.inject({
      method: "POST",
      url: `/api/dossiers/${id}/consentement-ia`,
      headers: { cookie },
      payload: body ?? { confirmed: true },
      remoteAddress,
    }),
  );
}

describe("POST /api/dossiers/:id/consentement-ia", () => {
  it("écrit UNE ligne ConsentLog AI_PROCESSING complète ; idempotent (AC4)", async () => {
    const { cookie, userId } = await loginUser("198.51.100.90");
    const caseFileId = await uploadCase(cookie, "198.51.100.90");

    const res = await consentAi(cookie, caseFileId, "198.51.100.90");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const rows = await prisma.consentLog.findMany({ where: { consentType: "AI_PROCESSING" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId,
      caseFileId,
      granted: true,
      policyVersion: LEGAL_BUNDLE_VERSION,
    });
    // Postérieur à la création du dossier (AC3).
    const caseFile = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFileId } });
    expect(rows[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(caseFile.createdAt.getTime());

    const again = await consentAi(cookie, caseFileId, "198.51.100.90");
    expect(again.statusCode).toBe(200);
    expect(await prisma.consentLog.count({ where: { consentType: "AI_PROCESSING" } })).toBe(1);
  });

  it("{ confirmed: false } → 400, aucune ligne écrite", async () => {
    const { cookie } = await loginUser("198.51.100.91");
    const caseFileId = await uploadCase(cookie, "198.51.100.91");

    const res = await consentAi(cookie, caseFileId, "198.51.100.91", { confirmed: false });
    expect(res.statusCode).toBe(400);
    expect(await prisma.consentLog.count({ where: { consentType: "AI_PROCESSING" } })).toBe(0);
  });

  it("cross-compte → 404, aucune ligne écrite (US-1.5)", async () => {
    const alice = await loginUser("198.51.100.92");
    const bob = await loginUser("198.51.100.93");
    const caseFileId = await uploadCase(alice.cookie, "198.51.100.92");

    const res = await consentAi(bob.cookie, caseFileId, "198.51.100.93");
    expect(res.statusCode).toBe(404);
    expect(await prisma.consentLog.count({ where: { consentType: "AI_PROCESSING" } })).toBe(0);
  });

  it("distinct de la confirmation « document fictif » (AC2)", async () => {
    const app = await getApp();
    const { cookie } = await loginUser("198.51.100.90");
    const upload = await uploadFixture(app, "courrier-1p.pdf", {
      cookie,
      remoteAddress: "198.51.100.90",
    });
    const { documentId, caseFileId } = upload.json();

    await app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/confirm-fictional`,
      headers: { cookie },
      payload: { confirmed: true },
      remoteAddress: "198.51.100.90",
    });
    await consentAi(cookie, caseFileId, "198.51.100.90");

    const byType = await prisma.consentLog.groupBy({
      by: ["consentType"],
      _count: { _all: true },
      where: { caseFileId },
    });
    const counts = Object.fromEntries(byType.map((r) => [r.consentType, r._count._all]));
    expect(counts).toEqual({ AI_PROCESSING: 1, FICTIONAL_DOCUMENT: 1 });
  });
});
