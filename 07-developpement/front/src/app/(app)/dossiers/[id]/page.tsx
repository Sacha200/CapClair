import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CaseFileResultResponse } from "@capclair/contract";
import { AnalysisResult } from "@/components/cases/analysis-result";
import { AnalysisWaiting } from "@/components/cases/analysis-waiting";
import { getCaseResult } from "@/lib/api/cases";
import { ApiError } from "@/lib/api/errors";
import { readCookieHeader } from "@/lib/session";

export const metadata: Metadata = { title: "Résultat de l'analyse — CapClair" };

/**
 * Écrans 04 / 05 sur la même URL (D8, acté en E3). Le server component tente le
 * résultat riche une seule fois :
 *  - `200` (analyse `TERMINEE`) → écran 05, `<AnalysisResult>` ;
 *  - `404` → dossier inexistant / d'un autre compte → `notFound()` ;
 *  - `409` `analysis_not_ready`, réseau, `5xx` → écran 04, `<AnalysisWaiting>`,
 *    qui gère le polling puis relance ce rendu (`router.refresh()`) au passage
 *    à `TERMINEE`.
 *
 * La garde de session est héritée de `(app)/layout.tsx`.
 */
export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = await readCookieHeader();

  let result: CaseFileResultResponse | null = null;
  try {
    result = await getCaseResult(id, cookieHeader);
  } catch (err) {
    // 404 = définitif ; le reste (409 analyse en cours, réseau, 5xx) → écran d'attente.
    if (err instanceof ApiError && err.status === 404) notFound();
  }

  if (result) {
    return <AnalysisResult data={result} caseFileId={id} />;
  }

  return (
    <section>
      <h1 className="sr-only">Analyse de votre courrier</h1>
      <AnalysisWaiting caseFileId={id} />
    </section>
  );
}
