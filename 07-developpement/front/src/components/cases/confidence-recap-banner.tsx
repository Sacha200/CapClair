import { RiAlertLine } from "@remixicon/react";
import type { CaseFileResultResponse } from "@capclair/contract";

/**
 * US-4.3 AC3 — récapitulatif des informations à vérifier. Affiché uniquement
 * si au moins une info est de confiance FAIBLE et non corrigée. Chaque entrée
 * pointe vers la ligne correspondante (`#info-<id>`).
 */
export function ConfidenceRecapBanner({
  infos,
}: {
  infos: CaseFileResultResponse["infosToVerify"];
}) {
  if (infos.length === 0) return null;

  return (
    <section
      aria-labelledby="recap-verifier-title"
      className="rounded-[var(--radius-chip)] border border-warning bg-warning-light px-4 py-3 text-sm text-text-strong"
    >
      <h2
        id="recap-verifier-title"
        className="flex items-center gap-1.5 font-semibold text-warning"
      >
        <RiAlertLine size={16} className="shrink-0" aria-hidden />
        {infos.length === 1
          ? "1 information à vérifier"
          : `${infos.length} informations à vérifier`}
      </h2>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
        {infos.map((info) => (
          <li key={info.id}>
            <a href={`#info-${info.id}`} className="font-medium text-primary hover:underline">
              {info.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
