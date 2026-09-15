"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResultAction } from "@capclair/contract";
import { ApiError } from "@/lib/api/errors";
import { toggleAction } from "@/lib/api/cases";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { SourceExcerptDisclosure } from "@/components/cases/source-excerpt-disclosure";
import { ActionAddForm } from "./action-add-form";
import { ActionDeleteButton } from "./action-delete-button";

/**
 * US-5.2 AC1/AC2/AC3 — liste des actions du dossier, écran 06. Contrairement à
 * `cases/actions-list.tsx` (écran 05, lecture seule, non modifié), les cases
 * sont RÉELLEMENT cochables : le clic met à jour l'affichage immédiatement
 * (état local optimiste, avant la réponse réseau), appelle `PATCH …/actions/:id`
 * en arrière-plan puis `router.refresh()`. `sourceExcerpt` d'une action
 * `MANUEL` est `null` — aucun `<SourceExcerptDisclosure>` n'est rendu dans ce
 * cas (une action manuelle n'a pas d'extrait, ce n'est pas la même chose qu'un
 * extrait non retrouvé).
 */
export function PilotageActionsList({
  caseFileId,
  actions,
}: {
  caseFileId: string;
  actions: ResultAction[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(actions);
  const [error, setError] = useState<string | null>(null);
  // Resynchronise l'état local optimiste quand le server component re-fetch
  // (après un `router.refresh()`, y compris déclenché par un autre composant —
  // ajout/suppression d'action, changement de statut). Ajustement pendant le
  // rendu (gabarit React « adjusting state when a prop changes »), pas dans un
  // effet, pour éviter un rendu en cascade.
  const [prevActions, setPrevActions] = useState(actions);
  if (actions !== prevActions) {
    setPrevActions(actions);
    setItems(actions);
  }

  const total = items.length;
  const done = items.filter((action) => action.done).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  function toggle(action: ResultAction) {
    const nextDone = !action.done;
    setError(null);
    setItems((prev) =>
      prev.map((a) => (a.id === action.id ? { ...a, done: nextDone } : a)),
    );
    void toggleAction(caseFileId, action.id, { done: nextDone })
      .then(() => router.refresh())
      .catch((err: unknown) => {
        // Repli sur l'état serveur (la case revient en arrière) + message
        // d'erreur inline : la route est limitée (`RATE_LIMITS.analysis`,
        // 10/minute) et un usage normal de la checklist peut l'atteindre.
        setItems((prev) =>
          prev.map((a) => (a.id === action.id ? { ...a, done: action.done } : a)),
        );
        setError(
          err instanceof ApiError ? err.message : "La modification n'a pas abouti. Réessayez.",
        );
      });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-text-strong">
        {total > 0 ? `${done}/${total} terminées (${percent} %)` : "0/0 terminées"}
      </p>
      {error ? <p className="text-xs font-medium text-error">{error}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-text-muted">Aucune action pour ce dossier.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((action) => (
            <li
              key={action.id}
              className="rounded-[var(--radius-chip)] bg-bg-subtle px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2.5">
                <CheckboxField
                  label={
                    <span className={action.done ? "line-through text-text-muted" : undefined}>
                      {action.title}
                    </span>
                  }
                  checked={action.done}
                  onChange={() => toggle(action)}
                />
                <ActionDeleteButton caseFileId={caseFileId} actionId={action.id} />
              </div>
              {action.description ? (
                <p className="mt-1 pl-6 text-sm text-text-muted">{action.description}</p>
              ) : null}
              {action.sourceExcerpt !== null ? (
                <div className="pl-6">
                  <SourceExcerptDisclosure
                    excerpt={action.sourceExcerpt}
                    verifiable={Boolean(action.verifiable)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ActionAddForm caseFileId={caseFileId} />
    </div>
  );
}
