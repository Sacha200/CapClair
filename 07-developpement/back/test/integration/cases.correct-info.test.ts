/**
 * `PATCH /api/dossiers/:id/informations/:infoId` — correction manuelle d'une
 * information extraite (E4, US-4.4 AC2/AC4).
 *
 * Après correction : nouvelle valeur, `isUserCorrected = true` (le `GET
 * .../resultat` renvoie alors `confidenceLevel: "ELEVE"`), une ligne
 * `AuditEvent` `information.corrected` SANS la valeur (US-8.2). 404 si l'info
 * n'est pas dans ce dossier de ce compte ; 400 sur valeur vide/trop longue.
 * IPs : 198.51.100.120 à .122.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
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

function patchInfo(
  cookie: string,
  id: string,
  infoId: string,
  body: Record<string, unknown>,
  remoteAddress: string,
) {
  return getApp().then((app) =>
    app.inject({
      method: "PATCH",
      url: `/api/dossiers/${id}/informations/${infoId}`,
      headers: { cookie },
      payload: body,
      remoteAddress,
    }),
  );
}

async function seedTerminatedCase(userId: string) {
  return seedCaseGraph(prisma, userId, {
    analysisStatus: "TERMINEE",
    extractedText: "Votre référence allocataire est 0847213C.",
    infos: [
      {
        categoryCode: "REFERENCE",
        label: "Référence allocataire",
        value: "0847213C",
        sourceExcerpt: "référence allocataire est 0847213C",
        confidenceLevel: "MOYEN",
      },
    ],
  });
}

describe("PATCH /api/dossiers/:id/informations/:infoId", () => {
  it("corrige la valeur, pose isUserCorrected, journalise sans la valeur (AC2/AC4)", async () => {
    const { cookie, userId } = await loginUser("198.51.100.120");
    const { caseFile, extractedInfo } = await seedTerminatedCase(userId);

    const res = await patchInfo(
      cookie,
      caseFile.id,
      extractedInfo.id,
      { value: "0847213Z" },
      "198.51.100.120",
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const row = await prisma.extractedInformation.findUniqueOrThrow({
      where: { id: extractedInfo.id },
    });
    expect(row.value).toBe("0847213Z");
    expect(row.isUserCorrected).toBe(true);

    const events = await prisma.auditEvent.findMany({ where: { caseFileId: caseFile.id } });
    const corrected = events.find((e) => e.eventType === "information.corrected");
    expect(corrected).toBeTruthy();
    expect(corrected!.userId).toBe(userId);
    expect(JSON.stringify(corrected!.metadata)).not.toContain("0847213Z");
    expect(corrected!.metadata).toMatchObject({ infoId: extractedInfo.id, categoryCode: "REFERENCE" });
  });

  it("après correction, GET .../resultat renvoie la nouvelle valeur en confiance ELEVE", async () => {
    const { cookie, userId } = await loginUser("198.51.100.120");
    const { caseFile, extractedInfo } = await seedTerminatedCase(userId);

    await patchInfo(cookie, caseFile.id, extractedInfo.id, { value: "Corrigé" }, "198.51.100.120");

    const app = await getApp();
    const result = await app.inject({
      method: "GET",
      url: `/api/dossiers/${caseFile.id}/resultat`,
      headers: { cookie },
      remoteAddress: "198.51.100.120",
    });
    expect(result.statusCode).toBe(200);
    expect(result.json().informations[0]).toMatchObject({
      value: "Corrigé",
      isUserCorrected: true,
      confidenceLevel: "ELEVE",
    });
  });

  it("valeur vide → 400 ; valeur > 500 caractères → 400", async () => {
    const { cookie, userId } = await loginUser("198.51.100.121");
    const { caseFile, extractedInfo } = await seedTerminatedCase(userId);

    const empty = await patchInfo(
      cookie,
      caseFile.id,
      extractedInfo.id,
      { value: "   " },
      "198.51.100.121",
    );
    expect(empty.statusCode).toBe(400);

    const tooLong = await patchInfo(
      cookie,
      caseFile.id,
      extractedInfo.id,
      { value: "x".repeat(501) },
      "198.51.100.121",
    );
    expect(tooLong.statusCode).toBe(400);
  });

  it("infoId d'un autre dossier / d'un autre compte → 404, rien de modifié", async () => {
    const alice = await loginUser("198.51.100.122");
    const bob = await loginUser("198.51.100.121");
    const aliceCase = await seedTerminatedCase(alice.userId);
    const bobCase = await seedTerminatedCase(bob.userId);

    // L'info d'Alice via le dossier de Bob (même compte, mauvais dossier).
    const wrongCase = await patchInfo(
      bob.cookie,
      bobCase.caseFile.id,
      aliceCase.extractedInfo.id,
      { value: "x" },
      "198.51.100.121",
    );
    expect(wrongCase.statusCode).toBe(404);

    // L'info d'Alice via le compte de Bob.
    const crossAccount = await patchInfo(
      bob.cookie,
      aliceCase.caseFile.id,
      aliceCase.extractedInfo.id,
      { value: "x" },
      "198.51.100.121",
    );
    expect(crossAccount.statusCode).toBe(404);

    const untouched = await prisma.extractedInformation.findUniqueOrThrow({
      where: { id: aliceCase.extractedInfo.id },
    });
    expect(untouched.isUserCorrected).toBe(false);
  });
});
