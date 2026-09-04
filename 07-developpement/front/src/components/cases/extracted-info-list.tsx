import type { ResultInfo } from "@capclair/contract";
import { ResultCard } from "./result-card";
import { ExtractedInfoRow } from "./extracted-info-row";

/** US-4.1 (informations extraites) — compteur + lignes. */
export function ExtractedInfoList({ infos }: { infos: ResultInfo[] }) {
  return (
    <ResultCard title="Informations extraites" titleId="infos-title">
      {infos.length === 0 ? (
        <p className="text-sm text-text-muted">
          Aucune information structurée n&apos;a été extraite.
        </p>
      ) : (
        <ul className="space-y-3">
          {infos.map((info) => (
            <ExtractedInfoRow key={info.id} info={info} />
          ))}
        </ul>
      )}
    </ResultCard>
  );
}
