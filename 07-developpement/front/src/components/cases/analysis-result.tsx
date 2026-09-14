import Link from "next/link";
import type { CaseFileResultResponse } from "@capclair/contract";
import { formatFrenchDate, organismeLabel } from "@/lib/cases/result-format";
import { caseStatusLabel } from "@/lib/cases/status-label";
import { ActionsList } from "./actions-list";
import { CaseHeaderEdit } from "./case-header-edit";
import { CaseHistory } from "./case-history";
import { ConfidenceRecapBanner } from "./confidence-recap-banner";
import { ExtractedInfoList } from "./extracted-info-list";
import { MainDeadlineCard } from "./main-deadline-card";
import { RequiredDocsList } from "./required-docs-list";
import { ResponseDraftPreview } from "./response-draft-preview";
import { ResultWarningBanner } from "./result-warning-banner";
import { SummarySection } from "./summary-section";
import { WarningsNote } from "./warnings-note";

/**
 * Écran 05 — Résultat d'analyse (maquette Hi-Fi node 26:146).
 *
 * Ordre DOM / lecture / tabulation imposé par US-4.1, identique en mobile et en
 * desktop : échéance → résumé → actions → justificatifs → informations →
 * brouillon. Les bandeaux d'avertissement (US-4.1 AC3, US-4.3 AC3), absents de
 * la maquette mais imposés par les AC, s'intercalent entre l'échéance et le
 * résumé. La grille 2 colonnes ≥ lg est purement cosmétique : la colonne de
 * droite (informations + brouillon) suit les justificatifs dans le markup.
 */
export function AnalysisResult({
  data,
  caseFileId,
}: {
  data: CaseFileResultResponse;
  /** Fourni ⇒ affordances de correction manuelle (US-4.4). */
  caseFileId?: string;
}) {
  const received = formatFrenchDate(data.documentDate);

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">{data.title}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {organismeLabel(data.organisme)}
            {received ? ` · courrier reçu le ${received}` : null}
          </p>
          {caseFileId ? (
            <CaseHeaderEdit
              caseFileId={caseFileId}
              organisme={data.organisme}
              title={data.title}
              documentDate={data.documentDate}
            />
          ) : null}
        </div>
        {/* Statut de pilotage (US-5.1) : badge non cliquable ici — la
            modification se fait sur l'écran 06 (`<CaseStatusSelect>`). */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-bg-subtle py-[5px] pl-2.5 pr-3 text-xs font-semibold text-text-strong">
            <span className="size-2 rounded-full bg-warning" aria-hidden />
            {caseStatusLabel(data.status)}
          </span>
          {caseFileId ? (
            <Link
              href={`/dossiers/${caseFileId}/pilotage`}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Piloter ce dossier
            </Link>
          ) : null}
        </div>
      </header>

      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start lg:gap-5">
        <div className="space-y-4">
          <MainDeadlineCard
            deadline={data.mainDeadline}
            caseFileId={caseFileId}
            documentDate={data.documentDate}
          />
          <ResultWarningBanner />
          <ConfidenceRecapBanner infos={data.infosToVerify} />
          <SummarySection summary={data.summary} />
          <WarningsNote warnings={data.warnings} />
          <ActionsList actions={data.actions} />
          <RequiredDocsList docs={data.requiredDocuments} />
        </div>

        <div className="mt-4 space-y-4 lg:mt-0">
          <ExtractedInfoList infos={data.informations} caseFileId={caseFileId} />
          <ResponseDraftPreview draft={data.responseDraft} />
        </div>
      </div>

      {/* US-4.5 — hors des 6 sections imposées par US-4.1 : rendu en fin d'écran,
          pleine largeur. Chargé côté client, masqué s'il est vide. */}
      {caseFileId ? (
        <div className="mt-4">
          <CaseHistory caseFileId={caseFileId} />
        </div>
      ) : null}
    </div>
  );
}
