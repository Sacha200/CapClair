import { ResultCard } from "./result-card";

/** US-4.1 (résumé) — texte en police de lecture (Spectral, node 27:152). */
export function SummarySection({ summary }: { summary: string | null }) {
  return (
    <ResultCard title="Résumé" titleId="summary-title">
      <p className="font-[family-name:var(--font-reading)] text-base leading-relaxed text-text">
        {summary?.trim()
          ? summary
          : "Aucun résumé n'a pu être généré pour ce courrier."}
      </p>
    </ResultCard>
  );
}
