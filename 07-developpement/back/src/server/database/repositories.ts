/**
 * Repositories scopés à un utilisateur (US-1.5).
 *
 * Chaque méthode de lecture/écriture filtre sur `userId` (directement pour
 * `CaseFile`, via la relation `caseFile.userId` pour les entités liées). Un
 * identifiant appartenant à un autre compte est traité comme inexistant :
 * `findByIdForUser` lève `NotFoundError` → 404 (jamais 403).
 *
 * Seul ce module (et `context.ts`) appelle Prisma directement ; `features/*` et
 * `server/auth/*` doivent passer par `context.forUser(...)` (règle ESLint).
 */
import type { PrismaClient } from "../../generated/prisma/client.js";
import { NotFoundError } from "../../lib/errors.js";

/** Dossiers — filtrés directement sur `userId`, hors dossiers supprimés. */
export class CaseFileRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
  ) {}

  listForUser() {
    return this.prisma.caseFile.findMany({
      where: { userId: this.userId, deletedAt: null },
      orderBy: { lastActivityAt: "desc" },
    });
  }

  async findByIdForUser(id: string) {
    const row = await this.prisma.caseFile.findFirst({
      where: { id, userId: this.userId, deletedAt: null },
    });
    if (!row) throw new NotFoundError("caseFile");
    return row;
  }
}

/** Base commune aux entités rattachées à un dossier (filtre via `caseFile.userId`). */
abstract class LinkedRepository {
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly userId: string,
  ) {}

  protected get caseFileScope() {
    return { userId: this.userId, deletedAt: null } as const;
  }
}

export class DocumentRepository extends LinkedRepository {
  async findByIdForUser(id: string) {
    const row = await this.prisma.document.findFirst({
      where: { id, caseFile: this.caseFileScope },
    });
    if (!row) throw new NotFoundError("document");
    return row;
  }
}

export class ExtractedInformationRepository extends LinkedRepository {
  async findByIdForUser(id: string) {
    const row = await this.prisma.extractedInformation.findFirst({
      where: { id, caseFile: this.caseFileScope },
    });
    if (!row) throw new NotFoundError("extractedInformation");
    return row;
  }
}

export class ActionItemRepository extends LinkedRepository {
  async findByIdForUser(id: string) {
    const row = await this.prisma.actionItem.findFirst({
      where: { id, caseFile: this.caseFileScope },
    });
    if (!row) throw new NotFoundError("actionItem");
    return row;
  }
}

export class RequiredDocumentRepository extends LinkedRepository {
  async findByIdForUser(id: string) {
    const row = await this.prisma.requiredDocument.findFirst({
      where: { id, caseFile: this.caseFileScope },
    });
    if (!row) throw new NotFoundError("requiredDocument");
    return row;
  }
}

export class ResponseDraftRepository extends LinkedRepository {
  async findByIdForUser(id: string) {
    const row = await this.prisma.responseDraft.findFirst({
      where: { id, caseFile: this.caseFileScope },
    });
    if (!row) throw new NotFoundError("responseDraft");
    return row;
  }
}

export class ReminderRepository extends LinkedRepository {
  async findByIdForUser(id: string) {
    const row = await this.prisma.reminder.findFirst({
      where: { id, caseFile: this.caseFileScope },
    });
    if (!row) throw new NotFoundError("reminder");
    return row;
  }
}
