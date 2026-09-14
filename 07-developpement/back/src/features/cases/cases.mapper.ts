import type {
  CaseFileListRow,
  CaseFileRepository,
  DashboardSummaryRow,
} from "../../server/database/repositories.js";
import type {
  CaseFileListResponse,
  CaseFileResultResponse,
  CaseFileStatusResponse,
} from "./cases.dto.js";

/**
 * Projette un dossier vers le DTO de statut (support du polling écran 04).
 * N'expose QUE l'id et l'état d'analyse — jamais le contenu dérivé, qui relève
 * de l'écran de résultat (E4).
 */
export function toCaseStatusDto(caseFile: {
  id: string;
  analysisStatus: CaseFileStatusResponse["analysisStatus"];
}): CaseFileStatusResponse {
  return { id: caseFile.id, analysisStatus: caseFile.analysisStatus };
}

// ---------------------------------------------------------------------------
// E4 — écran de résultat (US-4.1 → US-4.3)
// ---------------------------------------------------------------------------

/** Ligne renvoyée par `CaseFileRepository.findResultForUser` (graphe inclus). */
type CaseFileResultRow = Awaited<ReturnType<CaseFileRepository["findResultForUser"]>>;

const DRAFT_PREVIEW_MAX_CHARS = 200;

/**
 * US-4.2 AC2 — normalisation avant comparaison d'extrait : insensible aux
 * accents, à la casse, aux apostrophes/guillemets typographiques et aux
 * variations d'espaces (NBSP, retours à la ligne, espaces multiples).
 */
export function normalizeForExcerptMatch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques combinants
    .replace(/[‘’ʼ]/g, "'") // apostrophes typographiques
    .replace(/[“”]/g, '"') // guillemets courbes
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * US-4.2 AC2 — l'extrait est-il un passage LITTÉRAL du texte du courrier ?
 * Une chaîne vide de part et d'autre compte comme non vérifiable.
 */
export function isLiteralExcerpt(excerpt: string, sourceText: string): boolean {
  if (!excerpt || !sourceText) return false;
  return normalizeForExcerptMatch(sourceText).includes(normalizeForExcerptMatch(excerpt));
}

/** Minuit UTC du jour courant — ancre de comparaison pour `overdue` (US-3.6 AC4). */
function startOfTodayUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** 2 premières lignes non vides, tronquées — jamais le corps complet (E6). */
function draftPreview(content: string): string {
  const joined = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 2)
    .join(" ");
  return joined.length > DRAFT_PREVIEW_MAX_CHARS
    ? `${joined.slice(0, DRAFT_PREVIEW_MAX_CHARS).trimEnd()}…`
    : joined;
}

/**
 * Graphe d'un dossier `TERMINEE` → DTO de l'écran 05.
 *
 * Deux dérivations serveur (le stockage n'est pas modifié) :
 *  - `verifiable` (US-4.2) : `sourceExcerpt` est-il une sous-chaîne littérale de
 *    `extractedText` ?
 *  - `confidenceLevel` AFFICHÉ (US-4.2 AC3 / US-4.3) : `ELEVE` si l'utilisateur
 *    a corrigé la ligne (il a tranché), sinon `FAIBLE` si non vérifiable, sinon
 *    la valeur stockée.
 *
 * `extractedText` n'apparaît jamais dans le retour — seulement les booléens.
 */
export function toCaseResultDto(
  row: CaseFileResultRow,
  extractedText: string,
): CaseFileResultResponse {
  const lockedFields = row.userLockedFields;
  const today = startOfTodayUtc();

  const informations = row.extractedInfos.map((info) => {
    const verifiable = isLiteralExcerpt(info.sourceExcerpt, extractedText);
    const confidenceLevel = info.isUserCorrected
      ? "ELEVE"
      : verifiable
        ? info.confidenceLevel
        : "FAIBLE";
    return {
      id: info.id,
      categoryCode: info.category.code as CaseFileResultResponse["informations"][number]["categoryCode"],
      categoryLabel: info.category.label,
      categoryIcon: info.category.icon,
      label: info.label,
      value: info.value,
      sourceExcerpt: info.sourceExcerpt,
      verifiable,
      confidenceLevel,
      isUserCorrected: info.isUserCorrected,
    };
  });

  const infosToVerify = informations
    .filter((info) => info.confidenceLevel === "FAIBLE" && !info.isUserCorrected)
    .map((info) => ({ id: info.id, label: info.label }));

  const hasDeadline = row.mainDeadline !== null || row.mainDeadlineType !== null;
  const mainDeadline: CaseFileResultResponse["mainDeadline"] = hasDeadline
    ? {
        date: row.mainDeadline ? row.mainDeadline.toISOString() : null,
        type: row.mainDeadlineType,
        confidence: row.mainDeadlineConfidence,
        sourceExcerpt: row.mainDeadlineSourceExcerpt,
        computedFromDelay: row.mainDeadlineType === "RELATIVE",
        overdue: row.mainDeadline !== null && row.mainDeadline < today,
        isUserCorrected: lockedFields.includes("mainDeadline"),
      }
    : null;

  const actions = row.actionItems.map((action) => ({
    id: action.id,
    title: action.title,
    description: action.description,
    done: action.done,
    position: action.position,
    origin: action.origin,
    dueDate: action.dueDate ? action.dueDate.toISOString() : null,
    dueDateType: action.dueDateType,
    dueDateConfidence: action.dueDateConfidence,
    dueDateSourceExcerpt: action.dueDateSourceExcerpt,
    // E5 US-5.2 — `sourceExcerpt` est nullable en base (une action ajoutée à
    // la main n'en a pas) : le contrat le reflète désormais tel quel, jamais
    // de repli sur "" (une action MANUEL n'a pas d'extrait à vérifier, ce
    // n'est pas la même chose qu'un extrait non retrouvé).
    sourceExcerpt: action.sourceExcerpt,
    verifiable:
      action.sourceExcerpt != null ? isLiteralExcerpt(action.sourceExcerpt, extractedText) : null,
  }));

  const requiredDocuments = row.requiredDocs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    provided: doc.provided,
    userNote: doc.userNote,
    sourceExcerpt: doc.sourceExcerpt,
    verifiable: isLiteralExcerpt(doc.sourceExcerpt, extractedText),
  }));

  const responseDraft: CaseFileResultResponse["responseDraft"] = row.responseDraft
    ? {
        hasContent: row.responseDraft.content.trim().length > 0,
        preview: draftPreview(row.responseDraft.content),
      }
    : null;

  return {
    id: row.id,
    analysisStatus: "TERMINEE",
    status: row.status,
    organisme: row.organisme,
    title: row.title,
    documentDate: row.documentDate ? row.documentDate.toISOString() : null,
    documentDateSourceExcerpt: row.documentDateSourceExcerpt,
    summary: row.summary,
    warnings: row.warnings,
    mainDeadline,
    actions,
    requiredDocuments,
    informations,
    infosToVerify,
    responseDraft,
    lockedFields,
  };
}

// ---------------------------------------------------------------------------
// E5 US-5.4 — tableau de bord
// ---------------------------------------------------------------------------

/** US-5.4 — DTO liste + résumé. Aucun contenu de courrier (pas de sourceExcerpt/extractedText ici). */
export function toCaseListDto(
  cases: CaseFileListRow[],
  summary: DashboardSummaryRow,
): CaseFileListResponse {
  return {
    cases: cases.map((caseFile) => {
      const actionsTotal = caseFile.actionItems.length;
      const actionsRemaining = caseFile.actionItems.filter((action) => !action.done).length;
      return {
        id: caseFile.id,
        title: caseFile.title,
        organisme: caseFile.organisme,
        status: caseFile.status,
        analysisStatus: caseFile.analysisStatus,
        mainDeadline: caseFile.mainDeadline ? caseFile.mainDeadline.toISOString() : null,
        actionsRemaining,
        actionsTotal,
        lastActivityAt: caseFile.lastActivityAt.toISOString(),
      };
    }),
    summary: {
      activeCount: summary.activeCount,
      deadlineWithin7DaysCount: summary.deadlineWithin7DaysCount,
      remainingActionsCount: summary.remainingActionsCount,
      recentAnalyses: summary.recentAnalyses.map((analysis) => ({
        id: analysis.id,
        title: analysis.title,
        organisme: analysis.organisme,
        analysisStatus: analysis.analysisStatus,
        analyzedAt: analysis.analyzedAt ? analysis.analyzedAt.toISOString() : null,
      })),
      recentNotifications: summary.recentNotifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        read: notification.read,
        createdAt: notification.createdAt.toISOString(),
      })),
    },
  };
}
