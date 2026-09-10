import { RiInformationLine } from "@remixicon/react";
import { RESULT_WARNING_BANNER } from "@capclair/contract";

/**
 * US-4.1 AC3 — avertissement PERMANENT de l'écran de résultat. Texte repris
 * mot pour mot du contrat (`RESULT_WARNING_BANNER`), jamais reformulé ici.
 * Distinct des `warnings` contextuels du courrier (`WarningsNote`).
 */
export function ResultWarningBanner() {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-[var(--radius-chip)] border border-border bg-bg-subtle px-3 py-2.5 text-sm text-text-muted"
    >
      <RiInformationLine size={18} className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
      <span>{RESULT_WARNING_BANNER}</span>
    </div>
  );
}
