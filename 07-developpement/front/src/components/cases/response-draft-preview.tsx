import type { ResultDraft } from "@capclair/contract";
import { ResultCard } from "./result-card";

/**
 * US-4.1 (brouillon de réponse) — aperçu court uniquement. L'ouverture et
 * l'édition du brouillon complet sont l'écran 06 (E6) : le bouton est présent
 * mais désactivé (`aria-disabled`) tant que la route n'existe pas.
 */
export function ResponseDraftPreview({ draft }: { draft: ResultDraft | null }) {
  const hasContent = !!draft?.hasContent && !!draft.preview.trim();

  return (
    <ResultCard title="Brouillon de réponse" titleId="draft-title">
      {hasContent ? (
        <>
          <p className="line-clamp-3 font-[family-name:var(--font-reading)] text-[15px] leading-6 text-text">
            {draft!.preview}
          </p>
          <button
            type="button"
            aria-disabled="true"
            title="Disponible prochainement (édition du brouillon — écran 06)"
            className="mt-4 inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-[var(--radius-button)] bg-primary px-4 text-sm font-semibold text-text-on-primary opacity-60"
          >
            Ouvrir le brouillon complet
          </button>
        </>
      ) : (
        <p className="text-sm text-text-muted">
          Aucun brouillon de réponse n&apos;a été proposé pour ce courrier.
        </p>
      )}
    </ResultCard>
  );
}
