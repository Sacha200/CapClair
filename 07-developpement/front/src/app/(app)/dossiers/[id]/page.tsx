import type { Metadata } from "next";
import { AnalysisWaiting } from "@/components/cases/analysis-waiting";

export const metadata: Metadata = { title: "Analyse en cours — CapClair" };

/**
 * Écran 04 — Attente d'analyse (I-13, D8). La garde de session est héritée de
 * `(app)/layout.tsx`. Le rendu du résultat lui-même est l'écran 05 (epic E4) ;
 * ici on suit l'état du job jusqu'à `TERMINEE` / `ECHEC`.
 */
export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section>
      <h1 className="sr-only">Analyse de votre courrier</h1>
      <AnalysisWaiting caseFileId={id} />
    </section>
  );
}
