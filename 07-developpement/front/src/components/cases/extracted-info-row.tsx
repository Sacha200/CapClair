import type { ResultInfo } from "@capclair/contract";
import { ConfidenceBadge } from "./confidence-badge";
import { SourceExcerptDisclosure } from "./source-excerpt-disclosure";

/**
 * US-4.1 (information extraite) — une ligne : libellé, valeur, signal de
 * confiance (US-4.3) et extrait source (US-4.2). `id="info-<id>"` sert d'ancre
 * au bandeau récapitulatif (`ConfidenceRecapBanner`).
 *
 * Le bouton « Corriger cette information » est ajouté en PR-C (US-4.4).
 */
export function ExtractedInfoRow({ info }: { info: ResultInfo }) {
  return (
    <li id={`info-${info.id}`} className="scroll-mt-24 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <p className="text-xs text-text-muted">{info.label || info.categoryLabel}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-text-strong">{info.value}</span>
        {info.isUserCorrected ? (
          <span className="text-xs font-medium text-text-muted">Corrigée par vous</span>
        ) : (
          <ConfidenceBadge level={info.confidenceLevel} />
        )}
      </div>
      <SourceExcerptDisclosure excerpt={info.sourceExcerpt} verifiable={info.verifiable} />
    </li>
  );
}
