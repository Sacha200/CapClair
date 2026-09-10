import type { ResultInfo } from "@capclair/contract";
import { ConfidenceBadge } from "./confidence-badge";
import { InfoEditForm } from "./info-edit-form";
import { SourceExcerptDisclosure } from "./source-excerpt-disclosure";

/**
 * US-4.1 (information extraite) — puce compacte de la maquette Hi-Fi
 * (node 28:147) : libellé au-dessus, puis `valeur ⟷ « Voir l'extrait source »`
 * sur une ligne. Signal de confiance (US-4.3) accolé à la valeur, extrait
 * source (US-4.2) en repli inline, correction (US-4.4) en pied de puce sur le
 * fond de la carte. `id="info-<id>"` sur la puce sert d'ancre au bandeau
 * récapitulatif (`ConfidenceRecapBanner`).
 */
export function ExtractedInfoRow({
  info,
  caseFileId,
}: {
  info: ResultInfo;
  caseFileId?: string;
}) {
  return (
    <li>
      <div
        id={`info-${info.id}`}
        className="scroll-mt-24 rounded-[var(--radius-chip)] bg-bg-subtle px-3 py-2.5"
      >
        <p className="text-xs font-medium text-text-muted">
          {info.label || info.categoryLabel}
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-text-strong">{info.value}</span>
            {info.isUserCorrected ? (
              <span className="text-xs font-medium text-text-muted">Corrigée par vous</span>
            ) : (
              <ConfidenceBadge level={info.confidenceLevel} />
            )}
          </span>
          <SourceExcerptDisclosure
            excerpt={info.sourceExcerpt}
            verifiable={info.verifiable}
            inline
          />
        </div>
        {caseFileId ? <InfoEditForm caseFileId={caseFileId} info={info} /> : null}
      </div>
    </li>
  );
}
