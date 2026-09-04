import { RiAlertLine } from "@remixicon/react";
import type { DisplayConfidence } from "@capclair/contract";
import { confidenceLabel } from "@/lib/cases/result-format";

/**
 * US-4.3 AC2 — signal de confiance : icône + **texte** (jamais la couleur
 * seule). `ELEVE` n'affiche rien (D10). `lowLabel` permet d'adapter le libellé
 * au contexte (« Date à vérifier » sur la carte échéance).
 */
export function ConfidenceBadge({
  level,
  lowLabel,
}: {
  level: DisplayConfidence;
  lowLabel?: string;
}) {
  const label = confidenceLabel(level, lowLabel);
  if (!label) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-chip)] border border-warning bg-warning-light px-2 py-0.5 text-xs font-semibold text-warning">
      <RiAlertLine size={14} className="shrink-0" aria-hidden />
      {label}
    </span>
  );
}
