/** Fabriques de données pour les tests d'intégration. */
import { hashPassword } from "../../src/server/auth/password.js";
import { createSession } from "../../src/server/auth/session.js";
import type { PrismaClient } from "../../src/server/database/client.js";
import type { AnalysisStatus, ConfidenceLevel } from "../../src/generated/prisma/client.js";

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

/** Une information extraite à semer (catégorie référencée par `code`, D14). */
export interface SeedInfo {
  categoryCode?: string;
  label: string;
  value: string;
  sourceExcerpt: string;
  confidenceLevel?: ConfidenceLevel;
  isUserCorrected?: boolean;
}

export interface SeedCaseGraphOptions {
  analysisStatus?: AnalysisStatus;
  /** US-4.4 AC3 — champs scalaires protégés d'une ré-analyse. */
  userLockedFields?: string[];
  /** Texte du courrier (base de la vérification d'extrait US-4.2). */
  extractedText?: string | null;
  summary?: string;
  /** Remplace l'unique `ExtractedInformation` par défaut. */
  infos?: SeedInfo[];
}

/**
 * Sème un dossier complet pour `userId` : le `CaseFile` + une ligne dans chacune
 * des 6 entités liées (US-1.5). `ExtractedInformation` référence une catégorie du
 * référentiel D14 (seedée par migration). `options` permet de contrôler l'état
 * d'analyse, les champs verrouillés, le texte extrait et les infos (tests E4).
 */
export async function seedCaseGraph(
  client: PrismaClient,
  userId: string,
  options: SeedCaseGraphOptions = {},
) {
  const infos: SeedInfo[] = options.infos ?? [
    {
      categoryCode: "REFERENCE",
      label: "Référence allocataire",
      value: "0847213C",
      sourceExcerpt: "Référence allocataire : 0847213C",
    },
  ];

  const categoryCodes = [...new Set(infos.map((info) => info.categoryCode ?? "AUTRE"))];
  const categories = await client.category.findMany({ where: { code: { in: categoryCodes } } });
  const categoryIdByCode = new Map(categories.map((category) => [category.code, category.id]));

  const caseFile = await client.caseFile.create({
    data: {
      userId,
      organisme: "CAF",
      title: "Dossier de test",
      summary: options.summary ?? "…",
      ...(options.analysisStatus ? { analysisStatus: options.analysisStatus } : {}),
      ...(options.userLockedFields ? { userLockedFields: options.userLockedFields } : {}),
    },
  });

  const document = await client.document.create({
    data: {
      caseFileId: caseFile.id,
      originalName: "courrier.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1234,
      storagePath: "fixtures/courrier.pdf",
      extractedText: options.extractedText === undefined ? null : options.extractedText,
    },
  });

  const extractedInfos = await Promise.all(
    infos.map((info) => {
      const code = info.categoryCode ?? "AUTRE";
      const categoryId = categoryIdByCode.get(code);
      if (!categoryId) throw new Error(`Catégorie « ${code} » absente du référentiel seedé.`);
      return client.extractedInformation.create({
        data: {
          caseFileId: caseFile.id,
          categoryId,
          label: info.label,
          value: info.value,
          sourceExcerpt: info.sourceExcerpt,
          ...(info.confidenceLevel ? { confidenceLevel: info.confidenceLevel } : {}),
          ...(info.isUserCorrected ? { isUserCorrected: info.isUserCorrected } : {}),
        },
      });
    }),
  );

  const [actionItem, requiredDoc, responseDraft, reminder] = await Promise.all([
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

  return {
    caseFile,
    document,
    extractedInfo: extractedInfos[0]!,
    extractedInfos,
    actionItem,
    requiredDoc,
    responseDraft,
    reminder,
  };
}
