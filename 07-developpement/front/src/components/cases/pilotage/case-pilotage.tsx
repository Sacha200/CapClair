import Link from "next/link";
import type { CaseFileResultResponse } from "@capclair/contract";
import { CaseStatusSelect } from "./case-status-select";
import { PilotageActionsList } from "./pilotage-actions-list";
import { PilotageRequiredDocsList } from "./pilotage-required-docs-list";

/**
 * Écran 06 (E5 US-5.1/US-5.2/US-5.3) — pilotage du dossier : statut de
 * pilotage, actions (cocher/ajouter/supprimer) et checklist des justificatifs
 * (fourni/note). La suppression du dossier est hors périmètre de cette tâche
 * (E5, tâche suivante) — volontairement absente ici.
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

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-text-strong">Justificatifs</h2>
          <PilotageRequiredDocsList
            caseFileId={caseFileId}
            requiredDocuments={data.requiredDocuments}
          />
        </div>
      </div>
    </div>
  );
}
