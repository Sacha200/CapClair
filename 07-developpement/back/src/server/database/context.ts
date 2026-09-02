/**
 * Point d'entrée de la couche d'accès aux données pour un utilisateur donné.
 *
 * `forUser(userId)` renvoie un jeu de repositories déjà scopés : toute lecture ou
 * écriture sur un dossier et ses entités liées est filtrée sur `userId` en base,
 * pas seulement dans l'UI (US-1.5 AC1).
 *
 * Usage :
 *   const db = forUser(req.user.id);
 *   const dossier = await db.caseFiles.findByIdForUser(id); // 404 si autre compte
 */
import { prisma as defaultPrisma } from "./client.js";
import type { PrismaClient } from "./client.js";
import {
  ActionItemRepository,
  CaseFileRepository,
  ConsentLogRepository,
  DocumentRepository,
  ExtractedInformationRepository,
  ReminderRepository,
  RequiredDocumentRepository,
  ResponseDraftRepository,
} from "./repositories.js";

export interface UserScopedDb {
  readonly userId: string;
  readonly caseFiles: CaseFileRepository;
  readonly documents: DocumentRepository;
  readonly consentLogs: ConsentLogRepository;
  readonly extractedInfos: ExtractedInformationRepository;
  readonly actionItems: ActionItemRepository;
  readonly requiredDocs: RequiredDocumentRepository;
  readonly responseDrafts: ResponseDraftRepository;
  readonly reminders: ReminderRepository;
}

export function forUser(userId: string, client: PrismaClient = defaultPrisma): UserScopedDb {
  return {
    userId,
    caseFiles: new CaseFileRepository(client, userId),
    documents: new DocumentRepository(client, userId),
    consentLogs: new ConsentLogRepository(client, userId),
    extractedInfos: new ExtractedInformationRepository(client, userId),
    actionItems: new ActionItemRepository(client, userId),
    requiredDocs: new RequiredDocumentRepository(client, userId),
    responseDrafts: new ResponseDraftRepository(client, userId),
    reminders: new ReminderRepository(client, userId),
  };
}
