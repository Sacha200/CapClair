import Link from "next/link";
import type { CaseFileResultResponse } from "@capclair/contract";
import { CaseStatusSelect } from "./case-status-select";
import { PilotageActionsList } from "./pilotage-actions-list";

/**
 * Écran 06 (amorce, E5 US-5.1/US-5.2) — pilotage du dossier : statut de
 * pilotage et actions (cocher/ajouter/supprimer). La checklist justificatifs
 * et la suppression du dossier sont hors périmètre de cette tâche (E5, tâches
 * suivantes) — volontairement absentes ici.
 */
export function CasePilotage({
  data,
  caseFileId,
}: {
  data: CaseFileResultResponse;
  caseFileId: string;
}) {
  return (
    <div>
      <header className="flex flex-col gap-1">
        <Link
          href={`/dossiers/${caseFileId}`}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Voir le résultat de l&apos;analyse
        </Link>
        <h1 className="text-2xl font-bold text-text-strong">Pilotage du dossier</h1>
        <p className="text-sm text-text-muted">{data.title}</p>
      </header>

      <div className="mt-5 space-y-5">
        <CaseStatusSelect caseFileId={caseFileId} status={data.status} />

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-text-strong">Actions</h2>
          <PilotageActionsList caseFileId={caseFileId} actions={data.actions} />
        </div>
      </div>
    </div>
  );
}
