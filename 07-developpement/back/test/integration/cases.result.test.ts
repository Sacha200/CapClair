/**
 * `GET /api/dossiers/:id/resultat` — écran de résultat (E4, US-4.1 → US-4.3).
 *
 * 200 + graphe complet si `TERMINEE` ; 409 `analysis_not_ready` sinon ; 404
 * cross-compte / inconnu. US-4.2 : l'extrait littéral rend l'info `verifiable`,
 * un extrait absent du texte l'abaisse à FAIBLE et la place dans `infosToVerify`.
 * Le texte extrait complet ne fuit jamais dans la réponse (US-8.2).
 * IPs : 198.51.100.110 à .113.
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

function getResult(cookie: string | undefined, id: string, remoteAddress: string) {
  return getApp().then((app) =>
    app.inject({
      method: "GET",
      url: `/api/dossiers/${id}/resultat`,
      headers: cookie ? { cookie } : {},
      remoteAddress,
    }),
  );
}

const LETTER_TEXT =
  "Caisse d'Allocations Familiales. Votre référence allocataire est 0847213C. " +
  "Merci de nous transmettre un justificatif de domicile sous 30 jours.";

describe("GET /api/dossiers/:id/resultat", () => {
  it("401 sans session", async () => {
    const res = await getResult(undefined, "11111111-1111-1111-1111-111111111111", "198.51.100.110");
    expect(res.statusCode).toBe(401);
  });

  it("dossier TERMINEE du propriétaire → 200, forme conforme au contrat", async () => {
    const { cookie, userId } = await loginUser("198.51.100.110");
    const { caseFile } = await seedCaseGraph(prisma, userId, {
      analysisStatus: "TERMINEE",
      extractedText: LETTER_TEXT,
      infos: [
        {
          categoryCode: "REFERENCE",
          label: "Référence allocataire",
          value: "0847213C",
          sourceExcerpt: "référence allocataire est 0847213C",
        },
      ],
    });

    const res = await getResult(cookie, caseFile.id, "198.51.100.110");
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(() => CaseFileResultResponseSchema.parse(body)).not.toThrow();
    expect(body.analysisStatus).toBe("TERMINEE");
    expect(body.informations).toHaveLength(1);
    expect(body.actions).toHaveLength(1);
    expect(body.requiredDocuments).toHaveLength(1);
    expect(body.responseDraft.hasContent).toBe(true);
    expect(body.lockedFields).toEqual([]);
  });

  it("US-4.2 — extrait littéral → verifiable ; extrait absent → FAIBLE + infosToVerify", async () => {
    const { cookie, userId } = await loginUser("198.51.100.111");
    const { caseFile } = await seedCaseGraph(prisma, userId, {
      analysisStatus: "TERMINEE",
      extractedText: LETTER_TEXT,
      infos: [
        {
          categoryCode: "REFERENCE",
          label: "Référence allocataire",
          value: "0847213C",
          sourceExcerpt: "référence allocataire est 0847213C",
          confidenceLevel: "ELEVE",
        },
        {
          categoryCode: "MONTANT",
          label: "Montant réclamé",
          value: "450 €",
          sourceExcerpt: "un trop-perçu de 450 euros vous est réclamé",
          confidenceLevel: "MOYEN",
        },
      ],
    });

    const res = await getResult(cookie, caseFile.id, "198.51.100.111");
    expect(res.statusCode).toBe(200);
    const body = res.json();

    const byLabel = Object.fromEntries(
      body.informations.map((i: { label: string }) => [i.label, i]),
    );
    expect(byLabel["Référence allocataire"]).toMatchObject({
      verifiable: true,
      confidenceLevel: "ELEVE",
    });
    expect(byLabel["Montant réclamé"]).toMatchObject({
      verifiable: false,
      confidenceLevel: "FAIBLE",
    });
    expect(body.infosToVerify).toEqual([
      { id: byLabel["Montant réclamé"].id, label: "Montant réclamé" },
    ]);
  });

  it("US-8.2 — le texte extrait complet n'apparaît pas dans la réponse", async () => {
    const { cookie, userId } = await loginUser("198.51.100.112");
    const { caseFile } = await seedCaseGraph(prisma, userId, {
      analysisStatus: "TERMINEE",
      extractedText: LETTER_TEXT,
    });

    const res = await getResult(cookie, caseFile.id, "198.51.100.112");
    expect(res.body).not.toContain("Caisse d'Allocations Familiales");
  });

  it("dossier pas encore analysé → 409 analysis_not_ready", async () => {
    const { cookie, userId } = await loginUser("198.51.100.112");
    const { caseFile } = await seedCaseGraph(prisma, userId, { analysisStatus: "EN_ATTENTE" });

    const res = await getResult(cookie, caseFile.id, "198.51.100.112");
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("analysis_not_ready");
  });

  it("cross-compte → 404", async () => {
    const alice = await loginUser("198.51.100.112");
    const bob = await loginUser("198.51.100.113");
    const { caseFile } = await seedCaseGraph(prisma, alice.userId, { analysisStatus: "TERMINEE" });

    const res = await getResult(bob.cookie, caseFile.id, "198.51.100.113");
    expect(res.statusCode).toBe(404);
  });

  it("id inconnu → 404", async () => {
    const { cookie } = await loginUser("198.51.100.113");
    const res = await getResult(cookie, "22222222-2222-2222-2222-222222222222", "198.51.100.113");
    expect(res.statusCode).toBe(404);
  });
});
