/**
 * `PATCH /api/dossiers/:id/statut` — changement manuel du statut de pilotage
 * (E5, US-5.1 AC2).
 *
 * NB : nommé `cases.update-status.test.ts` (pas `cases.status.test.ts`, déjà
 * pris par le test de polling `GET /api/dossiers/:id`, écran 04).
 *
 * Les 6 valeurs de `CaseStatus` sont acceptées ; une valeur hors enum → 400.
 * Le champ "status" est verrouillé (`userLockedFields`) après un changement
 * manuel. Statut identique → 200 mais aucun `AuditEvent`
 * `case.status_changed` (pas de bruit journal) ; statut différent → exactement
 * une ligne, `metadata: { from, to }`. 404 cross-compte / id inconnu.
 * IPs : 198.51.100.140 à .143.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { CaseFileResultResponseSchema } from "@capclair/contract";
import { getApp, sessionCookie } from "../helpers/app.js";
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

function patchStatus(
  cookie: string | undefined,
  id: string,
  body: Record<string, unknown>,
  remoteAddress: string,
) {
  return getApp().then((app) =>
    app.inject({
      method: "PATCH",
      url: `/api/dossiers/${id}/statut`,
      headers: cookie ? { cookie } : {},
      payload: body,
      remoteAddress,
    }),
  );
}

const ALL_STATUSES = [
  "A_ANALYSER",
  "ACTION_REQUISE",
  "DOCUMENTS_A_PREPARER",
  "REPONSE_PRETE",
  "EN_ATTENTE",
  "TERMINE",
] as const;

describe("PATCH /api/dossiers/:id/statut", () => {
  it("401 sans session", async () => {
    const res = await patchStatus(
      undefined,
      "11111111-1111-1111-1111-111111111111",
      { status: "EN_ATTENTE" },
      "198.51.100.140",
    );
    expect(res.statusCode).toBe(401);
  });

  it("change le statut, 200 { ok: true }, reflété par GET …/resultat", async () => {
    const { cookie, userId } = await loginUser("198.51.100.140");
    const { caseFile } = await seedCaseGraph(prisma, userId, { analysisStatus: "TERMINEE" });

    const res = await patchStatus(cookie, caseFile.id, { status: "EN_ATTENTE" }, "198.51.100.140");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const app = await getApp();
    const result = await app.inject({
      method: "GET",
      url: `/api/dossiers/${caseFile.id}/resultat`,
      headers: { cookie },
      remoteAddress: "198.51.100.140",
    });
    expect(result.statusCode).toBe(200);
    const body = result.json();
    expect(() => CaseFileResultResponseSchema.parse(body)).not.toThrow();
    expect(body.status).toBe("EN_ATTENTE");
  });

  it("accepte les 6 valeurs de l'enum une par une", async () => {
    const { cookie, userId } = await loginUser("198.51.100.141");
    const { caseFile } = await seedCaseGraph(prisma, userId, { analysisStatus: "TERMINEE" });

    for (const status of ALL_STATUSES) {
      const res = await patchStatus(cookie, caseFile.id, { status }, "198.51.100.141");
      expect(res.statusCode).toBe(200);
      const after = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFile.id } });
      expect(after.status).toBe(status);
    }
  });

  it("valeur hors enum → 400", async () => {
    const { cookie, userId } = await loginUser("198.51.100.141");
    const { caseFile } = await seedCaseGraph(prisma, userId, { analysisStatus: "TERMINEE" });

    const res = await patchStatus(cookie, caseFile.id, { status: "INCONNU" }, "198.51.100.141");
    expect(res.statusCode).toBe(400);
  });

  it("statut identique au statut courant → 200, mais aucun AuditEvent case.status_changed", async () => {
    const { cookie, userId } = await loginUser("198.51.100.142");
    const { caseFile } = await seedCaseGraph(prisma, userId, {
      status: "EN_ATTENTE",
      analysisStatus: "TERMINEE",
    });

    const before = await prisma.auditEvent.count({ where: { caseFileId: caseFile.id } });
    const res = await patchStatus(cookie, caseFile.id, { status: "EN_ATTENTE" }, "198.51.100.142");
    expect(res.statusCode).toBe(200);
    const after = await prisma.auditEvent.count({ where: { caseFileId: caseFile.id } });
    expect(after).toBe(before);

    const changed = await prisma.auditEvent.findMany({
      where: { caseFileId: caseFile.id, eventType: "case.status_changed" },
    });
    expect(changed).toHaveLength(0);
  });

  it("statut différent → exactement une ligne AuditEvent case.status_changed, metadata { from, to }", async () => {
    const { cookie, userId } = await loginUser("198.51.100.142");
    const { caseFile } = await seedCaseGraph(prisma, userId, {
      status: "A_ANALYSER",
      analysisStatus: "TERMINEE",
    });

    const res = await patchStatus(cookie, caseFile.id, { status: "TERMINE" }, "198.51.100.142");
    expect(res.statusCode).toBe(200);

    const events = await prisma.auditEvent.findMany({
      where: { caseFileId: caseFile.id, eventType: "case.status_changed" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.metadata).toMatchObject({ from: "A_ANALYSER", to: "TERMINE" });

    const after = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFile.id } });
    expect(after.userLockedFields).toContain("status");
  });

  it("cross-compte → 404", async () => {
    const alice = await loginUser("198.51.100.143");
    const bob = await loginUser("198.51.100.144");
    const { caseFile } = await seedCaseGraph(prisma, alice.userId, { analysisStatus: "TERMINEE" });

    const res = await patchStatus(bob.cookie, caseFile.id, { status: "TERMINE" }, "198.51.100.144");
    expect(res.statusCode).toBe(404);
  });

  it("id inconnu → 404", async () => {
    const { cookie } = await loginUser("198.51.100.144");
    const res = await patchStatus(
      cookie,
      "22222222-2222-2222-2222-222222222222",
      { status: "TERMINE" },
      "198.51.100.144",
    );
    expect(res.statusCode).toBe(404);
  });
});
