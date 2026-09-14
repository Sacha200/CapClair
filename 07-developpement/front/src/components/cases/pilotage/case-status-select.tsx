"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CaseStatus } from "@capclair/contract";
import { ApiError } from "@/lib/api/errors";
import { updateCaseStatus } from "@/lib/api/cases";
import { CASE_STATUSES, caseStatusLabel } from "@/lib/cases/status-label";

/**
 * US-5.1 AC2 — sélecteur du statut de pilotage (écran 06). `<select>` natif,
 * les 6 valeurs de `CaseStatus`, value contrôlée par le statut courant.
 * Sélection → `PATCH …/statut` puis `router.refresh()` ; erreur API affichée
 * sous le champ.
 */
export function CaseStatusSelect({
  caseFileId,
  status,
}: {
  caseFileId: string;
  status: CaseStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as CaseStatus;
    setBusy(true);
    setError(null);
    try {
      await updateCaseStatus(caseFileId, { status: next });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Le changement de statut n'a pas abouti. Réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="case-status-select" className="text-sm font-medium text-text-strong">
        Statut du dossier
      </label>
      <select
        id="case-status-select"
        value={status}
        disabled={busy}
        onChange={(event) => void onChange(event)}
        className="min-h-11 rounded-[var(--radius-field)] border border-border-strong bg-bg-surface px-3 text-sm text-text"
      >
        {CASE_STATUSES.map((code) => (
          <option key={code} value={code}>
            {caseStatusLabel(code)}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs font-medium text-error">{error}</p> : null}
    </div>
  );
}
