import Link from "next/link";
import type { CaseFileListItem } from "@capclair/contract";
import { organismeLabel } from "@/lib/cases/result-format";
import { caseStatusLabel } from "@/lib/cases/status-label";

/**
 * US-5.4 — une ligne de la liste des dossiers du tableau de bord : titre,
 * organisme, statut de pilotage (libellé FR, `status-label.ts` de Task 2, pas
 * recréé ici), progression des actions. Toute la tuile est un lien vers
 * l'écran de résultat du dossier.
 */
export function CaseFileTile({ caseFile }: { caseFile: CaseFileListItem }) {
  return (
    <li>
      <Link
        href={`/dossiers/${caseFile.id}`}
        className="block rounded-[var(--radius-card)] border border-border bg-bg-surface px-4 py-3.5 transition-colors hover:bg-bg-subtle"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-strong">{caseFile.title}</p>
            <p className="mt-0.5 text-xs text-text-muted">{organismeLabel(caseFile.organisme)}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-bg-subtle py-[5px] pl-2.5 pr-3 text-xs font-semibold text-text-strong">
            <span className="size-2 rounded-full bg-warning" aria-hidden />
            {caseStatusLabel(caseFile.status)}
          </span>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {caseFile.actionsTotal > 0
            ? `${caseFile.actionsRemaining} action${caseFile.actionsRemaining > 1 ? "s" : ""} restante${caseFile.actionsRemaining > 1 ? "s" : ""}`
            : "Aucune action pour ce dossier"}
        </p>
      </Link>
    </li>
  );
}
