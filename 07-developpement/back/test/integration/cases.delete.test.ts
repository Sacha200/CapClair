/**
 * `DELETE /api/dossiers/:id` — suppression définitive et complète d'un dossier
 * (E5, US-5.5). Aucune confirmation supplémentaire côté serveur (AC1 est une
 * responsabilité front). Vérifie l'absence de ligne orpheline dans toutes les
 * entités liées, les DEUX exceptions SetNull délibérées et symétriques
 * (`AuditEvent "case.deleted"` ET `ConsentLog` — tous deux survivent orphelins,
 * `caseFileId` mis à `null`, décision #11 du plan), et la purge physique du/des
 * fichier(s) sur disque. `deleteIfUnanalyzed` (E2) n'est pas concernée par ce
 * fichier — méthode distincte, cas d'usage différent. IPs : 198.51.100.180 à .186.
 */
import { basename, join } from "node:path";
import { existsSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../src/env.js";
import { getApp, sessionCookie } from "../helpers/app.js";
import { uploadFixture } from "../helpers/documents.js";
import { createUser } from "../helpers/factories.js";
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

function deleteCase(cookie: string | undefined, id: string, remoteAddress: string) {
  return getApp().then((app) =>
    app.inject({
      method: "DELETE",
      url: `/api/dossiers/${id}`,
      headers: cookie ? { cookie } : {},
      remoteAddress,
    }),
  );
}

/**
 * Sème un dossier complet, ancré sur un vrai document uploadé (fichier réel
 * sur disque, `remoteAddress` dédiée pour ne pas taper le plafond d'import
 * d'un autre test) puis enrichi directement via Prisma de toutes les entités
 * liées restantes, plus 2 `AuditEvent` préexistants.
 */
async function seedFullCaseGraph(cookie: string, userId: string, remoteAddress: string) {
  const app = await getApp();
  const upload = await uploadFixture(app, "sample.pdf", { cookie, remoteAddress });
  const { documentId, caseFileId } = upload.json();
  const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  const diskPath = join(env.STORAGE_DIR, basename(document.storagePath));
  expect(existsSync(diskPath)).toBe(true);

  const category = await prisma.category.findFirstOrThrow({ where: { code: "REFERENCE" } });
  const extractedInfo = await prisma.extractedInformation.create({
    data: {
      caseFileId,
      categoryId: category.id,
      label: "Référence allocataire",
      value: "0847213C",
      sourceExcerpt: "Référence allocataire : 0847213C",
    },
  });
  const manualAction = await prisma.actionItem.create({
    data: { caseFileId, title: "Action manuelle", origin: "MANUEL", sourceExcerpt: null },
  });
  const analysisAction = await prisma.actionItem.create({
    data: { caseFileId, title: "Action issue de l'analyse", origin: "ANALYSE", sourceExcerpt: "…" },
  });
  const requiredDoc = await prisma.requiredDocument.create({
    data: { caseFileId, name: "Justificatif de domicile", sourceExcerpt: "…" },
  });
  const responseDraft = await prisma.responseDraft.create({
    data: { caseFileId, content: "Madame, Monsieur, …" },
  });
  const reminder = await prisma.reminder.create({
    data: {
      caseFileId,
      reminderType: "J_MOINS_7",
      channel: "EMAIL",
      scheduledFor: new Date(Date.now() + 86_400_000),
    },
  });
  const notification = await prisma.notification.create({
    data: {
      userId,
      caseFileId,
      type: "ANALYSE_TERMINEE",
      title: "Analyse terminée",
      body: "Votre dossier a été analysé.",
    },
  });
  const preexistingEvents = await Promise.all([
    prisma.auditEvent.create({
      data: { userId, caseFileId, eventType: "case.updated", metadata: {} },
    }),
    prisma.auditEvent.create({
      data: { userId, caseFileId, eventType: "action.completed", metadata: {} },
    }),
  ]);
  // Décision #11 du plan : preuve de consentement passé, doit survivre
  // orpheline au même titre que l'AuditEvent de suppression (ConsentLog est
  // `onDelete: SetNull`, pas `Cascade` — ce n'est PAS une table vidée).
  const consentLog = await prisma.consentLog.create({
    data: {
      userId,
      caseFileId,
      consentType: "AI_PROCESSING",
      granted: true,
      policyVersion: "v1",
    },
  });

  return {
    caseFileId,
    documentId,
    diskPath,
    extractedInfoId: extractedInfo.id,
    manualActionId: manualAction.id,
    analysisActionId: analysisAction.id,
    requiredDocId: requiredDoc.id,
    responseDraftId: responseDraft.id,
    reminderId: reminder.id,
    notificationId: notification.id,
    preexistingEventIds: preexistingEvents.map((e) => e.id),
    consentLogId: consentLog.id,
  };
}

describe("DELETE /api/dossiers/:id", () => {
  it("401 sans session", async () => {
    const res = await deleteCase(undefined, "11111111-1111-1111-1111-111111111111", "198.51.100.180");
    expect(res.statusCode).toBe(401);
  });

  it("dossier complet → 200 { ok: true }, tout le graphe disparaît, seul l'AuditEvent de suppression survit (orphelin), fichier disque supprimé", async () => {
    const REMOTE = "198.51.100.181";
    const { cookie, userId } = await loginUser(REMOTE);
    const graph = await seedFullCaseGraph(cookie, userId, REMOTE);

    const res = await deleteCase(cookie, graph.caseFileId, REMOTE);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    // Aucune ligne orpheline dans les entités liées (cascade Prisma).
    expect(await prisma.document.findMany({ where: { caseFileId: graph.caseFileId } })).toEqual([]);
    expect(
      await prisma.extractedInformation.findMany({ where: { caseFileId: graph.caseFileId } }),
    ).toEqual([]);
    expect(await prisma.actionItem.findMany({ where: { caseFileId: graph.caseFileId } })).toEqual([]);
    expect(
      await prisma.requiredDocument.findMany({ where: { caseFileId: graph.caseFileId } }),
    ).toEqual([]);
    expect(
      await prisma.responseDraft.findMany({ where: { caseFileId: graph.caseFileId } }),
    ).toEqual([]);
    expect(await prisma.reminder.findMany({ where: { caseFileId: graph.caseFileId } })).toEqual([]);
    expect(
      await prisma.notification.findMany({ where: { caseFileId: graph.caseFileId } }),
    ).toEqual([]);

    // Le dossier lui-même a disparu.
    expect(await prisma.caseFile.findUnique({ where: { id: graph.caseFileId } })).toBeNull();

    // Exception documentée (AC4) : exactement 1 AuditEvent "case.deleted",
    // orphelin (caseFileId mis à null par Postgres via SetNull).
    const deletionEvents = await prisma.auditEvent.findMany({
      where: { caseFileId: null, eventType: "case.deleted", userId },
    });
    expect(deletionEvents).toHaveLength(1);

    // Les AuditEvent préexistants (autres que "case.deleted") ont bien
    // disparu — pas seulement orphelins.
    const survivingPreexisting = await prisma.auditEvent.findMany({
      where: { id: { in: graph.preexistingEventIds } },
    });
    expect(survivingPreexisting).toEqual([]);

    // Deuxième exception SetNull délibérée (décision #11) : ConsentLog n'est
    // PAS dans la liste des tables vidées — la ligne survit, orpheline
    // (caseFileId mis à null par Postgres), au lieu d'être supprimée ou
    // laissée avec un caseFileId pointant vers un dossier disparu.
    const survivingConsentLog = await prisma.consentLog.findUnique({
      where: { id: graph.consentLogId },
    });
    expect(survivingConsentLog).not.toBeNull();
    expect(survivingConsentLog?.caseFileId).toBeNull();

    // Fichier physique absent.
    expect(existsSync(graph.diskPath)).toBe(false);
  });

  it("id d'un autre compte → 404, dossier et graphe intacts", async () => {
    const REMOTE_ALICE = "198.51.100.182";
    const REMOTE_BOB = "198.51.100.183";
    const alice = await loginUser(REMOTE_ALICE);
    const bob = await loginUser(REMOTE_BOB);
    const graph = await seedFullCaseGraph(alice.cookie, alice.userId, REMOTE_ALICE);

    const res = await deleteCase(bob.cookie, graph.caseFileId, REMOTE_BOB);
    expect(res.statusCode).toBe(404);

    expect(await prisma.caseFile.findUnique({ where: { id: graph.caseFileId } })).not.toBeNull();
    expect(await prisma.document.findUnique({ where: { id: graph.documentId } })).not.toBeNull();
    expect(existsSync(graph.diskPath)).toBe(true);
  });

  it("id inconnu → 404", async () => {
    const REMOTE = "198.51.100.184";
    const { cookie } = await loginUser(REMOTE);

    const res = await deleteCase(cookie, "99999999-9999-4999-8999-999999999999", REMOTE);
    expect(res.statusCode).toBe(404);
  });
});
