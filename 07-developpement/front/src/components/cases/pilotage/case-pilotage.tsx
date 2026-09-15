import Link from "next/link";
import type { CaseFileResultResponse } from "@capclair/contract";
import { formatFrenchDate, organismeLabel } from "@/lib/cases/result-format";
import { caseStatusLabel } from "@/lib/cases/status-label";
import { ResultCard } from "../result-card";
import { CaseStatusSelect } from "./case-status-select";
import { PilotageActionsList } from "./pilotage-actions-list";
import { PilotageRequiredDocsList } from "./pilotage-required-docs-list";
import { DeleteCaseDialog } from "./delete-case-dialog";

/**
 * Écran 06 (E5 US-5.1/US-5.2/US-5.3/US-5.5) — pilotage du dossier : statut de
 * pilotage, actions (cocher/ajouter/supprimer), checklist des justificatifs
 * (fourni/note) et, en pied d'écran, la suppression définitive du dossier.
 *
 * En-tête (revue de fidélité Figma, node 60:261) : titre réel du dossier +
 * badge de statut (même gabarit que l'en-tête de l'écran 05,
 * `analysis-result.tsx`), sous-titre organisme + date de réception
 * (`organismeLabel`/`formatFrenchDate`, `lib/cases/result-format.ts`, déjà
 * utilisés à l'identique par l'écran 05 et le tableau de bord).
 */
export function CasePilotage({
  data,
  caseFileId,
}: {
  data: CaseFileResultResponse;
  caseFileId: string;
}) {
  const received = formatFrenchDate(data.documentDate);

  return (
    <div>
      <header className="flex flex-col gap-1">
        <Link
          href={`/dossiers/${caseFileId}`}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Voir le résultat de l&apos;analyse
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-text-strong">{data.title}</h1>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-bg-subtle py-[5px] pl-2.5 pr-3 text-xs font-semibold text-text-strong">
            <span className="size-2 rounded-full bg-warning" aria-hidden />
            {caseStatusLabel(data.status)}
          </span>
        </div>
        <p className="text-sm text-text-muted">
          {organismeLabel(data.organisme)}
          {received ? ` · reçu le ${received}` : null}
        </p>
      </header>

      <div className="mt-5 space-y-5">
        <ResultCard title="Statut du dossier" titleId="pilotage-status-title">
          <CaseStatusSelect caseFileId={caseFileId} status={data.status} />
        </ResultCard>

        <ResultCard title="Actions" titleId="pilotage-actions-title">
          <PilotageActionsList caseFileId={caseFileId} actions={data.actions} />
        </ResultCard>

        <ResultCard title="Justificatifs" titleId="pilotage-docs-title">
          <PilotageRequiredDocsList
            caseFileId={caseFileId}
            requiredDocuments={data.requiredDocuments}
          />
        </ResultCard>

        <DeleteCaseDialog caseFileId={caseFileId} />
      </div>
    </div>
  );
}
