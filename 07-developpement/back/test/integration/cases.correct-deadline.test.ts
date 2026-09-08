/**
 * `PATCH /api/dossiers/:id/echeance` — correction de l'échéance principale
 * (E4, US-4.4 AC5).
 *
 * Date valide → 200 ; le `GET .../resultat` renvoie la nouvelle date, confiance
 * `ELEVE`, `isUserCorrected` vrai, `mainDeadline` dans `lockedFields`, type
 * `EXPLICITE` (plus « calculée à partir d'un délai »). Date antérieure à la
 * date du courrier → 400 `deadline_before_document` (US-3.6 AC5). Une ligne
 * `AuditEvent` `deadline.corrected`. 404 cross-compte. IPs : 198.51.100.123 à .125.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { createUser, seedCaseGraph } from "../helpers/factories.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";

const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

const DOC_DATE = new Date("2026-07-03T00:00:00.000Z");

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

function patchDeadline(cookie: string, id: string, body: Record<string, unknown>, remoteAddress: string) {
  return getApp().then((app) =>
    app.inject({
      method: "PATCH",
      url: `/api/dossiers/${id}/echeance`,
      headers: { cookie },
      payload: body,
      remoteAddress,
    }),
  );
}

function getResult(cookie: string, id: string, remoteAddress: string) {
  return getApp().then((app) =>
    app.inject({
      method: "GET",
      url: `/api/dossiers/${id}/resultat`,
      headers: { cookie },
      remoteAddress,
    }),
  );
}

describe("PATCH /api/dossiers/:id/echeance", () => {
  it("date valide → 200 ; le résultat reflète la correction (EXPLICITE, ELEVE, verrou)", async () => {
    const { cookie, userId } = await loginUser("198.51.100.123");
    const { caseFile } = await seedCaseGraph(prisma, userId, {
      analysisStatus: "TERMINEE",
      documentDate: DOC_DATE,
    });

    const res = await patchDeadline(cookie, caseFile.id, { date: "2026-08-14" }, "198.51.100.123");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const result = await getResult(cookie, caseFile.id, "198.51.100.123");
    expect(result.json().mainDeadline).toMatchObject({
      date: "2026-08-14T00:00:00.000Z",
      type: "EXPLICITE",
      confidence: "ELEVE",
      computedFromDelay: false,
      isUserCorrected: true,
    });
    expect(result.json().lockedFields).toContain("mainDeadline");

    const events = await prisma.auditEvent.findMany({ where: { caseFileId: caseFile.id } });
    expect(events.some((e) => e.eventType === "deadline.corrected")).toBe(true);
  });

  it("date antérieure à la date du courrier → 400 deadline_before_document (US-3.6 AC5)", async () => {
    const { cookie, userId } = await loginUser("198.51.100.124");
    const { caseFile } = await seedCaseGraph(prisma, userId, {
      analysisStatus: "TERMINEE",
      documentDate: DOC_DATE,
    });

    const res = await patchDeadline(cookie, caseFile.id, { date: "2026-07-02" }, "198.51.100.124");
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("deadline_before_document");

    const caseAfter = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFile.id } });
    expect(caseAfter.userLockedFields).not.toContain("mainDeadline");
  });

  it("date = date du courrier → acceptée (borne ≥)", async () => {
    const { cookie, userId } = await loginUser("198.51.100.124");
    const { caseFile } = await seedCaseGraph(prisma, userId, {
      analysisStatus: "TERMINEE",
      documentDate: DOC_DATE,
    });

    const res = await patchDeadline(cookie, caseFile.id, { date: "2026-07-03" }, "198.51.100.124");
    expect(res.statusCode).toBe(200);
  });

  it("format de date invalide → 400", async () => {
    const { cookie, userId } = await loginUser("198.51.100.125");
    const { caseFile } = await seedCaseGraph(prisma, userId, { analysisStatus: "TERMINEE" });

    const res = await patchDeadline(cookie, caseFile.id, { date: "14/08/2026" }, "198.51.100.125");
    expect(res.statusCode).toBe(400);
  });

  it("cross-compte → 404", async () => {
    const alice = await loginUser("198.51.100.125");
    const bob = await loginUser("198.51.100.123");
    const { caseFile } = await seedCaseGraph(prisma, alice.userId, {
      analysisStatus: "TERMINEE",
      documentDate: DOC_DATE,
    });

    const res = await patchDeadline(bob.cookie, caseFile.id, { date: "2026-08-14" }, "198.51.100.123");
    expect(res.statusCode).toBe(404);
  });
});
