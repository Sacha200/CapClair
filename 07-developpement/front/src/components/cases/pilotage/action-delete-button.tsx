"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { deleteAction } from "@/lib/api/cases";

/**
 * US-5.2 AC3 — suppression définitive d'une action. Confirmation légère
 * inline (pas de modal — aucune primitive de ce genre dans `components/ui/`) :
 * un premier clic affiche « Confirmer ? » avec deux boutons Oui/Annuler, sans
 * appel API. `Oui` supprime puis `router.refresh()`.
 */
export function ActionDeleteButton({
  caseFileId,
  actionId,
}: {
  caseFileId: string;
  actionId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await deleteAction(caseFileId, actionId);
      router.refresh();
    } catch (err) {
      // Le panneau de confirmation reste ouvert (`confirming` inchangé) :
      // c'est la seule branche de rendu qui affiche le message d'erreur
      // ci-dessous. Le repasser à `false` ferait disparaître l'échec sans
      // aucun retour visuel.
      setError(
        err instanceof ApiError ? err.message : "La suppression n'a pas abouti. Réessayez.",
      );
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="Supprimer cette action"
        className="shrink-0 text-xs font-semibold text-error hover:underline"
      >
        Supprimer
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 text-xs">
      <span className="font-medium text-text">Confirmer ?</span>
      <button
        type="button"
        onClick={() => void confirm()}
        disabled={busy}
        className="font-semibold text-error hover:underline disabled:opacity-60"
      >
        Oui
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="font-semibold text-text-muted hover:underline disabled:opacity-60"
      >
        Annuler
      </button>
      {error ? <span className="text-error">{error}</span> : null}
    </div>
  );
}
