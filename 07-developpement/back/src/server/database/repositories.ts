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
import type { ConsentType, Organisme, PrismaClient } from "../../generated/prisma/client.js";
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

  /** Dossier créé à l'import (E2) : organisme/titre provisoires, écrasés à l'analyse (E3). */
  create(data: { organisme: Organisme; title: string }) {
    return this.prisma.caseFile.create({
      data: { userId: this.userId, organisme: data.organisme, title: data.title },
    });
  }

  /**
   * Supprime le dossier s'il n'a pas encore été analysé (US-2.2 AC2, ADR-011).
   * Aucun effet si le dossier n'existe pas, appartient à un autre compte, ou
   * est déjà en cours/fin d'analyse — jamais d'erreur, juste `false`.
   */
  async deleteIfUnanalyzed(id: string): Promise<boolean> {
    const result = await this.prisma.caseFile.deleteMany({
      where: { id, userId: this.userId, analysisStatus: "EN_ATTENTE" },
    });
    return result.count > 0;
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

  /**
   * Crée le dossier ET le document dans une même transaction (US-2.1) : un
   * import réussi produit toujours les deux lignes, ou aucune des deux
   * (atomicité — voir plan E2 §12.9). Un doc ↔ un dossier au MVP (ADR-011).
   */
  createWithCase(data: {
    organisme: Organisme;
    title: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
    extractedText?: string | null;
    extractedTextHash?: string | null;
  }) {
    const userId = this.userId;
    return this.prisma.$transaction(async (tx) => {
      const caseFile = await tx.caseFile.create({
        data: { userId, organisme: data.organisme, title: data.title },
      });
      const document = await tx.document.create({
        data: {
          caseFileId: caseFile.id,
          originalName: data.originalName,
          mimeType: data.mimeType,
          sizeBytes: data.sizeBytes,
          storagePath: data.storagePath,
          extractedText: data.extractedText ?? null,
          extractedTextHash: data.extractedTextHash ?? null,
        },
      });
      return { caseFile, document };
    });
  }

  /**
   * Remplace le fichier d'un document existant (US-2.2 AC2, US-2.6 AC4) : même
   * `Document`, même `CaseFile` — la transition « illisible → lisible » ne
   * recrée pas le dossier. Renvoie l'ancien `storagePath` pour la purge disque
   * (best-effort, côté service). 404 si absent/autre compte.
   */
  async replaceFileForUser(
    id: string,
    data: {
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      storagePath: string;
      extractedText?: string | null;
      extractedTextHash?: string | null;
    },
  ): Promise<{ oldStoragePath: string; caseFileId: string }> {
    const existing = await this.findByIdForUser(id); // NotFoundError si absent/autre compte
    await this.prisma.document.update({
      where: { id: existing.id },
      data: {
        originalName: data.originalName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        storagePath: data.storagePath,
        extractedText: data.extractedText ?? null,
        extractedTextHash: data.extractedTextHash ?? null,
      },
    });
    return { oldStoragePath: existing.storagePath, caseFileId: existing.caseFileId };
  }

  /** Scopé ; renvoie le `storagePath` pour la purge disque (best-effort, côté service). */
  async deleteForUser(id: string): Promise<{ storagePath: string; caseFileId: string }> {
    const existing = await this.findByIdForUser(id); // NotFoundError si absent/autre compte
    await this.prisma.document.delete({ where: { id: existing.id } });
    return { storagePath: existing.storagePath, caseFileId: existing.caseFileId };
  }
}

/**
 * Consentements rattachés à un dossier (US-2.3 : `FICTIONAL_DOCUMENT`).
 *
 * `record` écrit toujours pour l'utilisateur du scope — jamais de `userId`
 * fourni par l'appelant. La ligne est immuable (preuve de consentement,
 * cf. schéma) : pas de update/delete ici.
 */
export class ConsentLogRepository extends LinkedRepository {
  async record(data: {
    caseFileId: string;
    consentType: ConsentType;
    granted: boolean;
    policyVersion: string;
  }) {
    // Le dossier doit appartenir au scope : même 404 qu'une lecture (US-1.5).
    const caseFile = await this.prisma.caseFile.findFirst({
      where: { id: data.caseFileId, ...this.caseFileScope },
      select: { id: true },
    });
    if (!caseFile) throw new NotFoundError("caseFile");
    return this.prisma.consentLog.create({
      data: {
        userId: this.userId,
        caseFileId: data.caseFileId,
        consentType: data.consentType,
        granted: data.granted,
        policyVersion: data.policyVersion,
      },
    });
  }

  findLatest(query: { caseFileId: string; consentType: ConsentType }) {
    return this.prisma.consentLog.findFirst({
      where: {
        caseFileId: query.caseFileId,
        consentType: query.consentType,
        userId: this.userId,
        caseFile: this.caseFileScope,
      },
      orderBy: { createdAt: "desc" },
    });
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
