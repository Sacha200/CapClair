/** Rapport d'évaluation du corpus — format stable, commité, comparable dans le temps. */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export interface PerLetter {
  id: string;
  schemaValid: boolean;
  organismeExpected: string;
  organismeProduced: string | null;
  organismeCorrect: boolean;
  documentDateExpected: string | null;
  documentDateProduced: string | null;
  documentDateCorrect: boolean;
  actions: { matched: number; missed: number; extraGrounded: number; ungrounded: number };
  justificatifs: { matched: number; missed: number; extraGrounded: number; ungrounded: number };
  echeanceExcerptGrounded: boolean | null;
  informationsUngrounded: number;
  informationsTotal: number;
  latencyMs: number;
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
    actionRecall: number;
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

  const actionsExpected = sum((l) => l.actions.matched + l.actions.missed);
  const actionsProduced = sum(
    (l) => l.actions.matched + l.actions.extraGrounded + l.actions.ungrounded,
  );
  const justifExpected = sum((l) => l.justificatifs.matched + l.justificatifs.missed);
  const justifProduced = sum(
    (l) => l.justificatifs.matched + l.justificatifs.extraGrounded + l.justificatifs.ungrounded,
  );

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
      const act = `${l.actions.matched}/${l.actions.missed}/${l.actions.ungrounded}`;
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
| Rappel actions | ${pct(t.actionRecall)} |
| Actions non ancrées | ${pct(t.actionUngroundedRate)} |
| Rappel justificatifs | ${pct(t.justificatifRecall)} |
| Justificatifs non ancrés | ${pct(t.justificatifUngroundedRate)} |
| Informations non ancrées | ${pct(t.informationUngroundedRate)} |

« Non ancré » = \`sourceExcerpt\` absent du texte extrait du PDF. C'est le seul
indicateur objectif d'invention. « Hors référentiel » (ancré mais absent du
dataset) est consultable par courrier dans le JSON et n'est pas un défaut : le
dataset peut être incomplet.

| Courrier | Schéma | Organisme | Date | Actions ok/manqué/non ancré | Justificatifs ok/manqué/non ancré |
|---|---|---|---|---|---|
${rows}
`;
  writeFileSync(join(REPORT_DIR, `${stamp}-analysis-corpus.md`), md, "utf8");
  return jsonPath;
}
