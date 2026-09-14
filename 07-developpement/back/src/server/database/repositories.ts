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
import type {
  ActionItem,
  AnalysisStatus,
  CaseStatus,
  ConsentType,
  Notification,
  Organisme,
  Prisma,
  PrismaClient,
  RequiredDocument,
} from "../../generated/prisma/client.js";
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

  /**
   * Graphe complet d'un dossier pour l'écran de résultat (E4, US-4.1). Scopé
   * `userId` ; `NotFoundError` (→ 404) si absent/autre compte/supprimé.
   *
   * Le `select` du document ne remonte que `extractedText` : il sert de base à
   * la vérification US-4.2 (l'extrait est-il un passage littéral du courrier ?)
   * et n'est jamais renvoyé tel quel — seul le booléen `verifiable` sort du
   * mapper (US-8.2).
   */
  async findResultForUser(id: string) {
    const row = await this.prisma.caseFile.findFirst({
      where: { id, userId: this.userId, deletedAt: null },
      include: {
        documents: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { extractedText: true },
        },
        extractedInfos: {
          include: { category: true },
          orderBy: { createdAt: "asc" },
        },
        actionItems: { orderBy: { position: "asc" } },
        requiredDocs: { orderBy: { createdAt: "asc" } },
        responseDraft: true,
      },
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

  /**
   * US-5.5 — suppression définitive et complète d'un dossier. Ordre important (AC4) :
   * 1. Vérifie que le dossier appartient au compte (404 sinon).
   * 2. Crée l'AuditEvent "case.deleted" AVANT toute suppression — caseFileId encore valide à ce
   *    moment, donc l'événement est rattaché normalement à sa création.
   * 3. Supprime tous les AUTRES AuditEvent de ce dossier (pour que seul l'événement de suppression
   *    survive après coup, AC4 — "seul l'AuditEvent de suppression conservé").
   * 4. Supprime le CaseFile lui-même — Prisma cascade automatiquement Document/ExtractedInformation/
   *    ActionItem/RequiredDocument/ResponseDraft/Reminder/ConsentLog/Notification (onDelete: Cascade
   *    déjà en place sur tous ces modèles). L'AuditEvent de suppression créé à l'étape 2, lui, a une
   *    relation `onDelete: SetNull` vers CaseFile — il survit avec caseFileId mis à null par Postgres,
   *    exactement le comportement voulu (AC4 : conservé, mais sans lien vers un dossier qui n'existe
   *    plus).
   * Toutes les étapes 2-4 dans UNE SEULE transaction Prisma ($transaction) pour la cohérence.
   * Renvoie les storagePath des documents du dossier (récupérés avant la transaction) pour que
   * l'appelant purge les fichiers sur disque après coup.
   */
  async deleteForUser(id: string): Promise<{ storagePaths: string[] }> {
    await this.findByIdForUser(id); // 404 si absent/autre compte
    const documents = await this.prisma.document.findMany({
      where: { caseFileId: id },
      select: { storagePath: true },
    });

    await this.prisma.$transaction([
      this.prisma.auditEvent.create({
        data: { caseFileId: id, userId: this.userId, eventType: "case.deleted", metadata: {} },
      }),
      this.prisma.auditEvent.deleteMany({
        where: { caseFileId: id, eventType: { not: "case.deleted" } },
      }),
      this.prisma.caseFile.delete({ where: { id } }),
    ]);

    return { storagePaths: documents.map((d) => d.storagePath) };
  }

  /**
   * Prépare un dossier à (ré)analyse (US-3.1 AC3, D8). Autorisé depuis
   * `EN_ATTENTE` (jamais analysé) ou `ECHEC` (relance, plan E3 §7) ; refusé
   * depuis `EN_COURS`/`TERMINEE` → la route répond 409. Repositionne le statut
   * à `EN_ATTENTE` pour que le worker reparte proprement.
   */
  async requeueForAnalysis(
    id: string,
  ): Promise<{ queued: true } | { queued: false; status: AnalysisStatus }> {
    const caseFile = await this.findByIdForUser(id); // 404 si absent/autre compte
    if (caseFile.analysisStatus === "EN_COURS" || caseFile.analysisStatus === "TERMINEE") {
      return { queued: false, status: caseFile.analysisStatus };
    }
    await this.prisma.caseFile.updateMany({
      where: { id, userId: this.userId, deletedAt: null },
      data: { analysisStatus: "EN_ATTENTE" },
    });
    return { queued: true };
  }

  /**
   * US-4.4 AC1 — corrige un ou plusieurs champs scalaires (organisme, type de
   * courrier, date du courrier). Chaque champ touché est ajouté à
   * `userLockedFields` : une ré-analyse ne le réécrira plus (AC3). 404 si
   * absent/autre compte. Renvoie la liste des champs effectivement modifiés
   * (pour la trace `AuditEvent`).
   */
  async updateScalarsForUser(
    id: string,
    data: { organisme?: Organisme; title?: string; documentDate?: Date | null },
  ): Promise<{ touched: string[] }> {
    const caseFile = await this.findByIdForUser(id); // 404 si absent/autre compte
    const touched: string[] = [];
    if (data.organisme !== undefined) touched.push("organisme");
    if (data.title !== undefined) touched.push("title");
    if (data.documentDate !== undefined) touched.push("documentDate");
    await this.prisma.caseFile.updateMany({
      where: { id, userId: this.userId, deletedAt: null },
      data: {
        ...(data.organisme !== undefined ? { organisme: data.organisme } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.documentDate !== undefined ? { documentDate: data.documentDate } : {}),
        userLockedFields: [...new Set([...caseFile.userLockedFields, ...touched])],
        lastActivityAt: new Date(),
      },
    });
    return { touched };
  }

  /**
   * US-4.4 AC5 — remplace l'échéance principale par une date corrigée à la
   * main. Confiance forcée à `ELEVE` (l'utilisateur a tranché), extrait source
   * remplacé, type passé à `EXPLICITE` (une date saisie n'est plus un délai
   * calculé — D7), et `"mainDeadline"` verrouillé contre la ré-analyse. La
   * validation de cohérence (≥ date du courrier) est faite en amont, dans le
   * service. 404 si absent/autre compte.
   */
  async setCorrectedDeadlineForUser(id: string, date: Date): Promise<void> {
    const caseFile = await this.findByIdForUser(id); // 404 si absent/autre compte
    await this.prisma.caseFile.updateMany({
      where: { id, userId: this.userId, deletedAt: null },
      data: {
        mainDeadline: date,
        mainDeadlineType: "EXPLICITE",
        mainDeadlineConfidence: "ELEVE",
        mainDeadlineSourceExcerpt: "Corrigée par vous",
        userLockedFields: [...new Set([...caseFile.userLockedFields, "mainDeadline"])],
        lastActivityAt: new Date(),
      },
    });
  }

  /** US-5.1 AC2 — change le statut ; renvoie l'ancien pour la trace AuditEvent. 404 si absent/autre compte. */
  async updateStatusForUser(id: string, status: CaseStatus): Promise<{ from: CaseStatus }> {
    const caseFile = await this.findByIdForUser(id); // 404 si absent/autre compte
    await this.prisma.caseFile.updateMany({
      where: { id, userId: this.userId, deletedAt: null },
      data: {
        status,
        userLockedFields: [...new Set([...caseFile.userLockedFields, "status"])],
        lastActivityAt: new Date(),
      },
    });
    return { from: caseFile.status };
  }

  /**
   * US-5.4 — liste des dossiers + résumé pour le tableau de bord, en un nombre borné de requêtes.
   * `actionsRemaining`/`actionsTotal` par dossier : compte les ActionItem liés (pas de N+1 — utilise
   * `include: { actionItems: { select: { done: true } } }` sur la requête de liste, puis calcule en
   * mémoire ; le jeu de dossiers d'un compte reste petit, pas besoin d'agrégation SQL dédiée).
   */
  async listWithSummaryForUser(): Promise<{
    cases: CaseFileListRow[];
    summary: DashboardSummaryRow;
  }> {
    const cases = await this.prisma.caseFile.findMany({
      where: { userId: this.userId, deletedAt: null },
      orderBy: { lastActivityAt: "desc" },
      include: { actionItems: { select: { done: true } } },
    });

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let activeCount = 0;
    let deadlineWithin7DaysCount = 0;
    let remainingActionsCount = 0;
    const recentAnalyses: DashboardSummaryRow["recentAnalyses"] = [];

    for (const caseFile of cases) {
      const isActive = caseFile.status !== "TERMINE";
      if (isActive) {
        activeCount += 1;
        if (
          caseFile.mainDeadline !== null &&
          caseFile.mainDeadline >= now &&
          caseFile.mainDeadline <= in7Days
        ) {
          deadlineWithin7DaysCount += 1;
        }
        remainingActionsCount += caseFile.actionItems.filter((action) => !action.done).length;
      }
      if (caseFile.analysisStatus === "TERMINEE" && recentAnalyses.length < 5) {
        recentAnalyses.push({
          id: caseFile.id,
          title: caseFile.title,
          organisme: caseFile.organisme,
          analysisStatus: caseFile.analysisStatus,
          analyzedAt: caseFile.lastActivityAt,
        });
      }
    }

    const recentNotifications = await this.prisma.notification.findMany({
      where: { userId: this.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      cases,
      summary: {
        activeCount,
        deadlineWithin7DaysCount,
        remainingActionsCount,
        recentAnalyses,
        recentNotifications,
      },
    };
  }
}

/** Ligne de dossier de `listWithSummaryForUser` (graphe incluant les actions, pour le tableau de bord). */
export type CaseFileListRow = Prisma.CaseFileGetPayload<{
  include: { actionItems: { select: { done: true } } };
}>;

/** Résumé du tableau de bord produit par `listWithSummaryForUser`. */
export interface DashboardSummaryRow {
  activeCount: number;
  deadlineWithin7DaysCount: number;
  remainingActionsCount: number;
  recentAnalyses: Array<{
    id: string;
    title: string;
    organisme: Organisme;
    analysisStatus: AnalysisStatus;
    analyzedAt: Date;
  }>;
  recentNotifications: Notification[];
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

  /**
   * US-4.4 — corrige la valeur (et éventuellement le libellé) d'une information
   * extraite, et pose `isUserCorrected = true` : la ligne est désormais
   * protégée contre l'écrasement par une ré-analyse (`applyAnalysis`). 404 si
   * l'info n'est pas dans CE dossier de CE compte. Renvoie la ligne d'origine
   * (catégorie incluse) pour la trace `AuditEvent`.
   */
  async updateForUser(caseFileId: string, infoId: string, data: { value: string; label?: string }) {
    const row = await this.prisma.extractedInformation.findFirst({
      where: { id: infoId, caseFileId, caseFile: this.caseFileScope },
      include: { category: true },
    });
    if (!row) throw new NotFoundError("extractedInformation");
    await this.prisma.extractedInformation.update({
      where: { id: infoId },
      data: {
        value: data.value,
        ...(data.label !== undefined ? { label: data.label } : {}),
        isUserCorrected: true,
      },
    });
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

  /**
   * US-5.2 AC2 — création manuelle d'une action. `position` = (max des
   * positions existantes du dossier) + 1, ou 0 si aucune. 404 si le dossier
   * n'appartient pas au compte.
   */
  async createForUser(
    caseFileId: string,
    data: { title: string; description?: string; dueDate?: Date },
  ) {
    const caseFile = await this.prisma.caseFile.findFirst({
      where: { id: caseFileId, ...this.caseFileScope },
      select: { id: true },
    });
    if (!caseFile) throw new NotFoundError("caseFile");

    const last = await this.prisma.actionItem.findFirst({
      where: { caseFileId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = last ? last.position + 1 : 0;

    return this.prisma.actionItem.create({
      data: {
        caseFileId,
        title: data.title,
        description: data.description ?? null,
        origin: "MANUEL",
        sourceExcerpt: null,
        position,
        ...(data.dueDate ? { dueDate: data.dueDate, dueDateType: "EXPLICITE" } : {}),
      },
    });
  }

  /**
   * US-5.2 AC1 — coche/décoche une action. `done: true` fixe `doneAt`,
   * `done: false` le remet à `null`. 404 si `actionId` n'est pas dans ce
   * dossier de ce compte.
   */
  async updateForUser(
    caseFileId: string,
    actionId: string,
    data: { done: boolean },
  ): Promise<ActionItem> {
    const row = await this.prisma.actionItem.findFirst({
      where: { id: actionId, caseFileId, caseFile: this.caseFileScope },
    });
    if (!row) throw new NotFoundError("actionItem");
    return this.prisma.actionItem.update({
      where: { id: actionId },
      data: { done: data.done, doneAt: data.done ? new Date() : null },
    });
  }

  /** US-5.2 AC3 — suppression définitive. 404 si hors scope. */
  async deleteForUser(caseFileId: string, actionId: string): Promise<void> {
    const row = await this.prisma.actionItem.findFirst({
      where: { id: actionId, caseFileId, caseFile: this.caseFileScope },
      select: { id: true },
    });
    if (!row) throw new NotFoundError("actionItem");
    await this.prisma.actionItem.delete({ where: { id: actionId } });
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

  /**
   * US-5.3 AC1/AC2 — coche « fourni » et/ou pose une note libre sur un
   * justificatif. Au moins une des deux clés (garanti par le schéma). 404 si
   * `docId` n'est pas dans ce dossier de ce compte.
   */
  async updateForUser(
    caseFileId: string,
    docId: string,
    data: { provided?: boolean; userNote?: string | null },
  ): Promise<RequiredDocument> {
    const row = await this.prisma.requiredDocument.findFirst({
      where: { id: docId, caseFileId, caseFile: this.caseFileScope },
    });
    if (!row) throw new NotFoundError("requiredDocument");
    return this.prisma.requiredDocument.update({
      where: { id: docId },
      data: {
        ...(data.provided !== undefined ? { provided: data.provided } : {}),
        ...(data.userNote !== undefined ? { userNote: data.userNote } : {}),
      },
    });
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

/**
 * Journal d'audit scopé `userId` (US-4.4 AC4). Les évènements d'analyse écrits
 * par le worker passent par `server/database/analysis-store.ts` (couche
 * système, sans utilisateur courant) ; ceux issus d'une action utilisateur
 * passent ici, via `context.forUser(...)`.
 */
export class AuditEventRepository extends LinkedRepository {
  /**
   * `metadata` ne porte JAMAIS de contenu de courrier : identifiants, codes de
   * catégorie et noms de champs uniquement (US-8.2). 404 si le dossier
   * n'appartient pas au compte.
   */
  async record(input: {
    caseFileId: string;
    eventType: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const caseFile = await this.prisma.caseFile.findFirst({
      where: { id: input.caseFileId, ...this.caseFileScope },
      select: { id: true },
    });
    if (!caseFile) throw new NotFoundError("caseFile");
    await this.prisma.auditEvent.create({
      data: {
        userId: this.userId,
        caseFileId: input.caseFileId,
        eventType: input.eventType,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Historique d'un dossier (US-4.5), du plus récent au plus ancien. Ne
   * remonte que l'id, le type et l'horodatage — jamais `metadata`, qui n'a pas
   * vocation à être affiché. 404 si le dossier n'appartient pas au compte.
   */
  async listForCaseFileForUser(caseFileId: string) {
    const caseFile = await this.prisma.caseFile.findFirst({
      where: { id: caseFileId, ...this.caseFileScope },
      select: { id: true },
    });
    if (!caseFile) throw new NotFoundError("caseFile");
    return this.prisma.auditEvent.findMany({
      where: { caseFileId },
      orderBy: { createdAt: "desc" },
      select: { id: true, eventType: true, createdAt: true },
    });
  }
}
