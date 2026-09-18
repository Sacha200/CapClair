/** Rapport d'évaluation du corpus — format stable, commité, comparable dans le temps. */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { MatchCounts } from "./corpus.helpers.js";

export interface PerLetter {
  id: string;
  schemaValid: boolean;
  organismeExpected: string;
  organismeProduced: string | null;
  organismeCorrect: boolean;
  documentDateExpected: string | null;
  documentDateProduced: string | null;
  documentDateCorrect: boolean;
  /** Appariement en deux passes : extrait, puis titre en repli (étape 8). */
  actions: MatchCounts;
  /** Appariement par extrait seul : pour un document nommé, l'extrait suffit. */
  justificatifs: MatchCounts;
  echeanceExcerptGrounded: boolean | null;
  informationsUngrounded: number;
  informationsTotal: number;
  latencyMs: number;
  /**
   * Extraits bruts compares, pour rendre un recall bas diagnosticable sans
   * re-payer une execution : un attendu manque peut venir du modele comme
   * d'un decoupage different dans le dataset.
   *
   * Le corpus etant fictif (05-courriers-fictifs), ces extraits peuvent etre
   * commites. Avec de vrais courriers, US-8.2 l'interdirait : le rapport
   * devrait alors rester local.
   */
  excerptsAudit: {
    actionsExpected: Array<{ excerpt: string; title: string }>;
    actionsProduced: Array<{ excerpt: string; title: string }>;
    justificatifsExpected: string[];
    justificatifsProduced: string[];
  };
}

export interface EvalReport {
  generatedAt: string;
  model: string;
  letters: PerLetter[];
  totals: {
    count: number;
    schemaValidRate: number;
    organismeAccuracy: number;
    documentDateAccuracy: number;
    /** Rappel strict : l'extrait du dataset et celui du modèle se recouvrent. */
    actionRecall: number;
    /** Rappel souple : extrait OU, à défaut, titre. Voir `corpus.helpers.ts`. */
    actionRecallLenient: number;
    actionUngroundedRate: number;
    justificatifRecall: number;
    justificatifUngroundedRate: number;
    informationUngroundedRate: number;
    medianLatencyMs: number;
  };
}

const ratio = (num: number, den: number): number =>
  den === 0 ? 1 : Math.round((num / den) * 1000) / 1000;

export function summarize(letters: PerLetter[], model: string): EvalReport {
  const sum = (f: (l: PerLetter) => number) => letters.reduce((a, l) => a + f(l), 0);
  const latencies = letters.map((l) => l.latencyMs).sort((a, b) => a - b);

  // Dénominateurs pris sur les tailles de liste, pas reconstitués depuis les
  // compteurs : `matched + missed` cesse d'égaler l'attendu dès qu'un repli par
  // titre récupère une action.
  const actionsExpected = sum((l) => l.actions.expectedCount);
  const actionsProduced = sum((l) => l.actions.producedCount);
  const justifExpected = sum((l) => l.justificatifs.expectedCount);
  const justifProduced = sum((l) => l.justificatifs.producedCount);

  return {
    generatedAt: new Date().toISOString(),
    model,
    letters,
    totals: {
      count: letters.length,
      schemaValidRate: ratio(letters.filter((l) => l.schemaValid).length, letters.length),
      organismeAccuracy: ratio(letters.filter((l) => l.organismeCorrect).length, letters.length),
      documentDateAccuracy: ratio(
        letters.filter((l) => l.documentDateCorrect).length,
        letters.filter((l) => l.documentDateExpected !== null).length,
      ),
      actionRecall: ratio(
        sum((l) => l.actions.matched),
        actionsExpected,
      ),
      actionRecallLenient: ratio(
        sum((l) => l.actions.matchedLenient),
        actionsExpected,
      ),
      actionUngroundedRate: ratio(
        sum((l) => l.actions.ungrounded),
        actionsProduced,
      ),
      justificatifRecall: ratio(
        sum((l) => l.justificatifs.matched),
        justifExpected,
      ),
      justificatifUngroundedRate: ratio(
        sum((l) => l.justificatifs.ungrounded),
        justifProduced,
      ),
      informationUngroundedRate: ratio(
        sum((l) => l.informationsUngrounded),
        sum((l) => l.informationsTotal),
      ),
      medianLatencyMs: latencies[Math.floor(latencies.length / 2)] ?? 0,
    },
  };
}

const REPORT_DIR = fileURLToPath(new URL("../../../plans/eval-reports/", import.meta.url));

/** Écrit le JSON daté et un résumé Markdown lisible. Renvoie le chemin du JSON. */
export function writeReport(report: EvalReport): string {
  mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = report.generatedAt.slice(0, 10);
  const jsonPath = join(REPORT_DIR, `${stamp}-analysis-corpus.json`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const t = report.totals;
  const pct = (v: number) => `${(v * 100).toFixed(1)} %`;
  const rows = report.letters
    .map((l) => {
      const org = l.organismeCorrect
        ? "ok"
        : `${l.organismeProduced ?? "null"} au lieu de ${l.organismeExpected}`;
      const act = `${l.actions.matchedLenient}/${l.actions.missed}/${l.actions.ungrounded}`;
      const jus = `${l.justificatifs.matched}/${l.justificatifs.missed}/${l.justificatifs.ungrounded}`;
      return `| ${l.id} | ${l.schemaValid ? "ok" : "ECHEC"} | ${org} | ${l.documentDateCorrect ? "ok" : "ecart"} | ${act} | ${jus} |`;
    })
    .join("\n");

  const md = `# Évaluation du corpus d'analyse — ${stamp}

Modèle : \`${report.model}\` · ${t.count} courriers · latence médiane ${t.medianLatencyMs} ms

| Métrique | Valeur |
|---|---|
| Réponses conformes au schéma | ${pct(t.schemaValidRate)} |
| Organisme correct | ${pct(t.organismeAccuracy)} |
| Date du courrier correcte | ${pct(t.documentDateAccuracy)} |
| Rappel actions (extrait seul) | ${pct(t.actionRecall)} |
| Rappel actions (extrait ou titre) | ${pct(t.actionRecallLenient)} |
| Actions non ancrées | ${pct(t.actionUngroundedRate)} |
| Rappel justificatifs | ${pct(t.justificatifRecall)} |
| Justificatifs non ancrés | ${pct(t.justificatifUngroundedRate)} |
| Informations non ancrées | ${pct(t.informationUngroundedRate)} |

Deux rappels d'actions sont publiés. Le strict exige que l'extrait du dataset et
celui du modèle se recouvrent ; il sous-estime le rappel réel, parce que le
dataset et le modèle peuvent ancrer la même consigne sur deux phrases
différentes du courrier. Le souple accepte en repli un recouvrement de mots
significatifs entre titres. Le détail par courrier ci-dessous utilise le souple.

« Non ancré » = \`sourceExcerpt\` absent du texte extrait du PDF. C'est le seul
indicateur objectif d'invention, et il ne dépend d'aucun appariement. « Hors référentiel » (ancré mais absent du
dataset) est consultable par courrier dans le JSON et n'est pas un défaut : le
dataset peut être incomplet.

| Courrier | Schéma | Organisme | Date | Actions ok/manqué/non ancré | Justificatifs ok/manqué/non ancré |
|---|---|---|---|---|---|
${rows}
`;
  writeFileSync(join(REPORT_DIR, `${stamp}-analysis-corpus.md`), md, "utf8");
  return jsonPath;
}
