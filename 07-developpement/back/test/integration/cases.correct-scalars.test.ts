/**
 * `PATCH /api/dossiers/:id` — correction organisme / type de courrier / date du
 * courrier (E4, US-4.4 AC1) + non-écrasement par une ré-analyse (AC3).
 *
 * Les champs corrigés sont verrouillés (`userLockedFields`) et listés dans la
 * trace `AuditEvent` `case.updated`. Un corps vide → 400. Une ré-analyse
 * (`applyAnalysis` appelé en direct) ne réécrit pas un champ verrouillé mais
 * rafraîchit le reste. IPs : 198.51.100.126 à .128.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { createUser, seedCaseGraph } from "../helpers/factories.js";
import { applyAnalysis } from "../../src/server/database/analysis-store.js";
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

function patchCase(cookie: string, id: string, body: Record<string, unknown>, remoteAddress: string) {
  return getApp().then((app) =>
    app.inject({
      method: "PATCH",
      url: `/api/dossiers/${id}`,
      headers: { cookie },
      payload: body,
      remoteAddress,
    }),
  );
}

describe("PATCH /api/dossiers/:id (scalaires)", () => {
  it("corrige l'organisme, pose le verrou, journalise les champs touchés", async () => {
    const { cookie, userId } = await loginUser("198.51.100.126");
    const { caseFile } = await seedCaseGraph(prisma, userId, { analysisStatus: "TERMINEE" });

    const res = await patchCase(cookie, caseFile.id, { organisme: "CPAM" }, "198.51.100.126");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const after = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFile.id } });
    expect(after.organisme).toBe("CPAM");
    expect(after.userLockedFields).toContain("organisme");

    const events = await prisma.auditEvent.findMany({ where: { caseFileId: caseFile.id } });
    const updated = events.find((e) => e.eventType === "case.updated");
    expect(updated).toBeTruthy();
    expect(updated!.metadata).toMatchObject({ fields: ["organisme"] });
  });

  it("corps sans aucune clé → 400", async () => {
    const { cookie, userId } = await loginUser("198.51.100.127");
    const { caseFile } = await seedCaseGraph(prisma, userId, { analysisStatus: "TERMINEE" });

    const res = await patchCase(cookie, caseFile.id, {}, "198.51.100.127");
    expect(res.statusCode).toBe(400);
  });

  it("cross-compte → 404", async () => {
    const alice = await loginUser("198.51.100.127");
    const bob = await loginUser("198.51.100.128");
    const { caseFile } = await seedCaseGraph(prisma, alice.userId, { analysisStatus: "TERMINEE" });

    const res = await patchCase(bob.cookie, caseFile.id, { organisme: "CPAM" }, "198.51.100.128");
    expect(res.statusCode).toBe(404);
  });

  it("US-4.4 AC3 — une ré-analyse ne réécrit pas un champ verrouillé, rafraîchit le reste", async () => {
    const { cookie, userId } = await loginUser("198.51.100.128");
    const { caseFile } = await seedCaseGraph(prisma, userId, {
      analysisStatus: "TERMINEE",
      infos: [
        {
          categoryCode: "REFERENCE",
          label: "Réf. IA",
          value: "AAA",
          sourceExcerpt: "réf AAA",
        },
      ],
    });

    // Correction manuelle : organisme + titre.
    await patchCase(
      cookie,
      caseFile.id,
      { organisme: "FRANCE_TRAVAIL", title: "Titre corrigé" },
      "198.51.100.128",
    );

    // Ré-analyse avec une réponse divergente.
    await applyAnalysis(caseFile.id, {
      organisme: "CPAM",
      title: "Titre IA",
      summary: "Nouveau résumé IA.",
      documentDate: null,
      documentDateSourceExcerpt: null,
      warnings: ["Nouvel avertissement."],
      mainDeadline: null,
      informations: [
        {
          categoryCode: "MONTANT",
          label: "Montant IA",
          value: "999 €",
          sourceExcerpt: "montant 999",
          confidenceLevel: "MOYEN",
        },
      ],
      actions: [],
      requiredDocuments: [],
      responseDraft: "Brouillon IA.",
    });

    const after = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFile.id } });
    // Verrouillés : conservés.
    expect(after.organisme).toBe("FRANCE_TRAVAIL");
    expect(after.title).toBe("Titre corrigé");
    // Non verrouillables : rafraîchis.
    expect(after.summary).toBe("Nouveau résumé IA.");
    expect(after.warnings).toEqual(["Nouvel avertissement."]);

    // Les infos IA non corrigées sont remplacées.
    const infos = await prisma.extractedInformation.findMany({ where: { caseFileId: caseFile.id } });
    expect(infos).toHaveLength(1);
    expect(infos[0]!.label).toBe("Montant IA");
  });
});
