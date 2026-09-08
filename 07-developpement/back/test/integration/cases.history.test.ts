/**
 * `GET /api/dossiers/:id/historique` — historique du dossier (E4, US-4.5).
 *
 * Entrées du plus récent au plus ancien, libellés FR humanisés (jamais un
 * `eventType` technique, AC2), aucune `metadata` ni contenu de courrier (AC3).
 * L'import d'un document crée l'entrée « Courrier importé ». 404 cross-compte.
 * IPs : 198.51.100.130 à .132.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { CaseFileHistoryResponseSchema } from "@capclair/contract";
import { getApp, sessionCookie } from "../helpers/app.js";
import { uploadFixture } from "../helpers/documents.js";
import { createUser, seedCaseGraph } from "../helpers/factories.js";
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

function getHistory(cookie: string | undefined, id: string, remoteAddress: string) {
  return getApp().then((app) =>
    app.inject({
      method: "GET",
      url: `/api/dossiers/${id}/historique`,
      headers: cookie ? { cookie } : {},
      remoteAddress,
    }),
  );
}

describe("GET /api/dossiers/:id/historique", () => {
  it("401 sans session", async () => {
    const res = await getHistory(undefined, "11111111-1111-1111-1111-111111111111", "198.51.100.130");
    expect(res.statusCode).toBe(401);
  });

  it("entrées triées desc, libellés FR, sans metadata ni type technique (AC2/AC3)", async () => {
    const { cookie, userId } = await loginUser("198.51.100.130");
    const { caseFile } = await seedCaseGraph(prisma, userId);

    await prisma.auditEvent.create({
      data: {
        userId,
        caseFileId: caseFile.id,
        eventType: "document.imported",
        metadata: {},
        createdAt: new Date("2026-07-01T09:00:00.000Z"),
      },
    });
    await prisma.auditEvent.create({
      data: {
        userId,
        caseFileId: caseFile.id,
        eventType: "analysis.completed",
        metadata: { organisme: "CAF", counts: { informations: 3 } },
        createdAt: new Date("2026-07-01T09:05:00.000Z"),
      },
    });
    await prisma.auditEvent.create({
      data: {
        userId,
        caseFileId: caseFile.id,
        eventType: "information.corrected",
        metadata: { infoId: "abc", categoryCode: "REFERENCE" },
        createdAt: new Date("2026-07-02T14:00:00.000Z"),
      },
    });

    const res = await getHistory(cookie, caseFile.id, "198.51.100.130");
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(() => CaseFileHistoryResponseSchema.parse(body)).not.toThrow();
    expect(body.entries.map((e: { label: string }) => e.label)).toEqual([
      "Information corrigée",
      "Analyse terminée",
      "Courrier importé",
    ]);

    const serialized = JSON.stringify(body);
    for (const leak of ["information.corrected", "analysis.completed", "categoryCode", "REFERENCE", "infoId", "counts"]) {
      expect(serialized).not.toContain(leak);
    }
  });

  it("l'import d'un document crée l'entrée « Courrier importé »", async () => {
    const { cookie } = await loginUser("198.51.100.131");
    const upload = await uploadFixture(await getApp(), "courrier-1p.pdf", {
      cookie,
      remoteAddress: "198.51.100.131",
    });
    const caseFileId = upload.json().caseFileId as string;

    const res = await getHistory(cookie, caseFileId, "198.51.100.131");
    expect(res.statusCode).toBe(200);
    expect(res.json().entries.map((e: { label: string }) => e.label)).toContain("Courrier importé");
  });

  it("cross-compte → 404", async () => {
    const alice = await loginUser("198.51.100.132");
    const bob = await loginUser("198.51.100.131");
    const { caseFile } = await seedCaseGraph(prisma, alice.userId);

    const res = await getHistory(bob.cookie, caseFile.id, "198.51.100.131");
    expect(res.statusCode).toBe(404);
  });
});
