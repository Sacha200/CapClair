/** Fabriques de données pour les tests d'intégration. */
import { hashPassword } from "../../src/server/auth/password.js";
import { createSession } from "../../src/server/auth/session.js";
import type { PrismaClient } from "../../src/server/database/client.js";

let counter = 0;

export async function createUser(
  client: PrismaClient,
  overrides: { email?: string; name?: string; password?: string } = {},
) {
  counter += 1;
  const email = overrides.email ?? `user${counter}-${Date.now()}@exemple.fr`;
  const password = overrides.password ?? "mot-de-passe-tres-long-1";
  const user = await client.user.create({
    data: {
      email,
      name: overrides.name ?? `Utilisateur ${counter}`,
      passwordHash: await hashPassword(password),
    },
  });
  return { user, email, password };
}

/** Crée une session pour un utilisateur et renvoie le jeton brut (à mettre en cookie). */
export function createSessionFor(client: PrismaClient, userId: string): Promise<string> {
  return createSession(userId, client);
}

/**
 * Sème un dossier complet pour `userId` : le `CaseFile` + une ligne dans chacune
 * des 6 entités liées (US-1.5). `ExtractedInformation` référence une catégorie du
 * référentiel D14 (seedée par migration).
 */
export async function seedCaseGraph(client: PrismaClient, userId: string) {
  const category = await client.category.findFirstOrThrow({ where: { code: "REFERENCE" } });

  const caseFile = await client.caseFile.create({
    data: { userId, organisme: "CAF", title: "Dossier de test", summary: "…" },
  });

  const [document, extractedInfo, actionItem, requiredDoc, responseDraft, reminder] =
    await Promise.all([
      client.document.create({
        data: {
          caseFileId: caseFile.id,
          filename: "courrier.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1234,
          storagePath: "/tmp/courrier.pdf",
        },
      }),
      client.extractedInformation.create({
        data: {
          caseFileId: caseFile.id,
          categoryId: category.id,
          label: "Référence allocataire",
          value: "0847213C",
          sourceExcerpt: "Référence allocataire : 0847213C",
        },
      }),
      client.actionItem.create({
        data: { caseFileId: caseFile.id, title: "Envoyer le justificatif", sourceExcerpt: "…" },
      }),
      client.requiredDocument.create({
        data: { caseFileId: caseFile.id, name: "Justificatif de domicile", sourceExcerpt: "…" },
      }),
      client.responseDraft.create({
        data: { caseFileId: caseFile.id, content: "Madame, Monsieur, …" },
      }),
      client.reminder.create({
        data: {
          caseFileId: caseFile.id,
          reminderType: "J_MOINS_7",
          channel: "EMAIL",
          scheduledFor: new Date(Date.now() + 86_400_000),
        },
      }),
    ]);

  return { caseFile, document, extractedInfo, actionItem, requiredDoc, responseDraft, reminder };
}
