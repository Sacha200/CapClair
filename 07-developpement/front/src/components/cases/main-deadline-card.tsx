import type { ResultDeadline } from "@capclair/contract";
import { formatFrenchDate } from "@/lib/cases/result-format";
import { ConfidenceBadge } from "./confidence-badge";
import { DeadlineEditDialog } from "./deadline-edit-dialog";
import { ResultCard } from "./result-card";

/**
 * US-4.1 (échéance principale) — première carte de l'écran, sur fond accentué
 * (maquette node 27:145). US-3.6 AC4 : « Échéance dépassée » sobre si `overdue`.
 * D7 : `computedFromDelay` ⇒ on rappelle que la date est dérivée du délai.
 *
 * `caseFileId` fourni ⇒ « Corriger l'échéance » (US-4.4 AC5), bornée à
 * `documentDate`.
 */
export function MainDeadlineCard({
  deadline,
  caseFileId,
  documentDate,
}: {
  deadline: ResultDeadline | null;
  caseFileId?: string;
  documentDate?: string | null;
}) {
  const formatted = formatFrenchDate(deadline?.date);

  return (
    <ResultCard
      title="Échéance principale"
      titleId="deadline-title"
      titleVariant="overline"
      tone="highlight"
    >
      {!deadline || !formatted ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text">
            Aucune échéance n&apos;a été identifiée dans ce courrier.
          </p>
          {caseFileId ? (
            <DeadlineEditDialog
              caseFileId={caseFileId}
              currentDate={deadline?.date ?? null}
              minDate={documentDate ?? null}
            />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[22px] font-bold text-text-strong">{formatted}</span>
            {deadline.isUserCorrected ? (
              <span className="text-xs font-medium text-text-muted">Corrigée par vous</span>
            ) : (
              <ConfidenceBadge level={deadline.confidence ?? "MOYEN"} lowLabel="Date à vérifier" />
            )}
          </div>

          {deadline.overdue ? (
            <p className="text-sm font-medium text-text-strong">Échéance dépassée.</p>
          ) : null}

          {deadline.computedFromDelay && deadline.sourceExcerpt ? (
            <p className="font-[family-name:var(--font-reading)] text-sm text-text-muted">
              Calculée par le serveur à partir de «&nbsp;{deadline.sourceExcerpt}&nbsp;».
            </p>
          ) : null}

          {caseFileId ? (
            <DeadlineEditDialog
              caseFileId={caseFileId}
              currentDate={deadline.date}
              minDate={documentDate ?? null}
            />
          ) : null}
        </div>
      )}
    </ResultCard>
  );
}
