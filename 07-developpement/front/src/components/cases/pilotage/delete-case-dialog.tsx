"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ANALYSIS_MESSAGES } from "@capclair/contract";
import { ApiError } from "@/lib/api/errors";
import { deleteCase } from "@/lib/api/cases";

/**
 * US-5.5 — suppression définitive et complète du dossier (écran 06, pied de
 * l'orchestrateur). Confirmation explicite en deux étapes (gabarit
 * `action-delete-button.tsx`, Task 2), mais avec un texte plus appuyé sur le
 * caractère irréversible de l'action (AC1) et une annonce `aria-live="assertive"`
 * au moment où le panneau de confirmation apparaît — l'enjeu (perte
 * définitive du dossier) est bien plus élevé qu'une simple action.
 *
 * `Confirmer` → `DELETE /api/dossiers/:id` puis redirection vers `/dashboard`
 * (le dossier n'existe plus : rester sur `/dossiers/:id/pilotage` afficherait
 * une 404, `router.refresh()` ne convient pas ici).
 */
export function DeleteCaseDialog({ caseFileId }: { caseFileId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await deleteCase(caseFileId);
      router.push("/dashboard");
    } catch (err) {
      // Le panneau de confirmation reste ouvert (`confirming` inchangé) :
      // c'est la seule branche de rendu qui affiche le message d'erreur
      // ci-dessous. Le repasser à `false` ferait disparaître l'échec sans
      // aucun retour visuel pour une action irréversible.
      setError(
        err instanceof ApiError ? err.message : "La suppression n'a pas abouti. Réessayez.",
      );
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div className="border-t border-border pt-5">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm font-semibold text-error hover:underline"
        >
          Supprimer ce dossier
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      <p role="alert" aria-live="assertive" className="text-sm font-medium text-error">
        {ANALYSIS_MESSAGES.deleteConfirmationRequired} Cette suppression est irréversible :
        documents, informations, actions, justificatifs et historique de ce dossier seront
        perdus définitivement.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy}
          className="text-sm font-semibold text-error hover:underline disabled:opacity-60"
        >
          {busy ? "Suppression…" : "Confirmer la suppression"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="text-sm font-semibold text-text-muted hover:underline disabled:opacity-60"
        >
          Annuler
        </button>
      </div>
      {error ? <span className="text-sm text-error">{error}</span> : null}
    </div>
  );
}
