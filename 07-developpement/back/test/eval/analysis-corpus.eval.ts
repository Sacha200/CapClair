/**
 * Évaluation de la qualité d'analyse IA sur les 15 courriers fictifs (audit T1).
 *
 * DÉCLENCHE DE VRAIS APPELS FACTURÉS. Ce fichier n'appartient ni au projet
 * Vitest `unit` ni à `integration` : il ne tourne que via `npm run eval:corpus`
 * et n'est jamais exécuté en CI de PR (décision #1).
 *
 * Mesure l'étage IA seul (décision #2) : PDF → texte via `server/pdf`, puis
 * `analyzeLetter()` en direct. Ni HTTP, ni base, ni worker — un écart mesuré
 * ici désigne le prompt ou le modèle, jamais le câblage.
 *
 * `EVAL_CORPUS_LIMIT=1 npm run eval:corpus` limite l'exécution aux N premiers
 * courriers : c'est la façon prévue de faire une passe à blanc, plutôt que de
 * modifier ce fichier et risquer de commiter la troncature.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeLetter } from "../../src/server/ai/client.js";
import { classifyOrganismeHeuristic } from "../../src/server/ai/prompts.js";
import { extractPdfText } from "../../src/server/pdf/extract.js";
import { parseExplicitFrenchDate } from "../../src/lib/dates.js";
import { env } from "../../src/env.js";
import { compareByExcerpt, isGrounded } from "./corpus.helpers.js";
import { summarize, writeReport, type PerLetter } from "./report.js";

const CORPUS_DIR = fileURLToPath(new URL("../../../../05-courriers-fictifs/", import.meta.url));
const DATASET_PATH = join(CORPUS_DIR, "dataset-reference.json");

/** Valeur de repli de `src/env.ts` sous Vitest : jamais une vraie clé. */
const FALLBACK_API_KEY = "sk-ant-test-fallback";

interface DatasetEntry {
  id: string;
  fichier: string;
  organisme_attendu: string;
  date_courrier?: string | null;
  actions_attendues?: Array<{ source_excerpt?: string }>;
  justificatifs_attendus?: Array<{ source_excerpt?: string }>;
  echeance?: { source_excerpt?: string } | null;
}

const excerpts = (rows?: Array<{ source_excerpt?: string }>): string[] =>
  (rows ?? []).map((r) => r.source_excerpt ?? "").filter((s) => s.length > 0);

describe.skipIf(!existsSync(DATASET_PATH))("évaluation du corpus d'analyse", () => {
  it("produit un rapport chiffré sur les 15 courriers", { timeout: 15 * 60_000 }, async () => {
    // Sans vraie clé, les 15 appels échoueraient en 401 après plusieurs
    // minutes : on refuse de démarrer plutôt que de produire un rapport à zéro.
    if (env.ANTHROPIC_API_KEY === FALLBACK_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY absente de back/.env : le harnais d'évaluation exige une vraie clé.",
      );
    }

    const all = JSON.parse(readFileSync(DATASET_PATH, "utf8")) as DatasetEntry[];
    const limit = Number(process.env.EVAL_CORPUS_LIMIT ?? all.length);
    const dataset = Number.isFinite(limit) ? all.slice(0, limit) : all;

    // Passe d'extraction d'abord, gratuite : un chemin de PDF faux ou un
    // document illisible doit casser AVANT le premier appel facturé.
    const sources = new Map<string, string>();
    for (const entry of dataset) {
      const pdf = readFileSync(join(CORPUS_DIR, entry.fichier));
      const { text } = await extractPdfText(pdf);
      if (text.trim().length === 0) {
        throw new Error(`Extraction vide pour ${entry.id} (${entry.fichier}) — aucun appel émis.`);
      }
      sources.set(entry.id, text);
    }

    const letters: PerLetter[] = [];

    for (const entry of dataset) {
      const text = sources.get(entry.id) ?? "";

      const started = Date.now();
      const { result } = await analyzeLetter(text, classifyOrganismeHeuristic(text));
      const latencyMs = Date.now() - started;

      if (!result) {
        letters.push({
          id: entry.id,
          schemaValid: false,
          organismeExpected: entry.organisme_attendu,
          organismeProduced: null,
          organismeCorrect: false,
          documentDateExpected: entry.date_courrier ?? null,
          documentDateProduced: null,
          documentDateCorrect: false,
          actions: {
            matched: 0,
            missed: excerpts(entry.actions_attendues).length,
            extraGrounded: 0,
            ungrounded: 0,
          },
          justificatifs: {
            matched: 0,
            missed: excerpts(entry.justificatifs_attendus).length,
            extraGrounded: 0,
            ungrounded: 0,
          },
          echeanceExcerptGrounded: null,
          informationsUngrounded: 0,
          informationsTotal: 0,
          latencyMs,
        });
        continue;
      }

      // Comparaison de dates sur la valeur dérivée côté serveur (D7), pas sur
      // la chaîne brute : « 3 juillet 2026 » et « 03/07/2026 » sont la même date.
      const expectedDate = entry.date_courrier
        ? parseExplicitFrenchDate(entry.date_courrier)
        : null;
      const producedDate = result.dateCourrierRawText
        ? parseExplicitFrenchDate(result.dateCourrierRawText)
        : null;

      letters.push({
        id: entry.id,
        schemaValid: true,
        organismeExpected: entry.organisme_attendu,
        organismeProduced: result.organisme,
        organismeCorrect: result.organisme === entry.organisme_attendu,
        documentDateExpected: entry.date_courrier ?? null,
        documentDateProduced: result.dateCourrierRawText ?? null,
        documentDateCorrect:
          expectedDate !== null &&
          producedDate !== null &&
          expectedDate.getTime() === producedDate.getTime(),
        actions: compareByExcerpt(
          excerpts(entry.actions_attendues),
          result.actions.map((a) => a.sourceExcerpt),
          text,
        ),
        justificatifs: compareByExcerpt(
          excerpts(entry.justificatifs_attendus),
          result.justificatifs.map((j) => j.sourceExcerpt),
          text,
        ),
        echeanceExcerptGrounded: result.echeancePrincipale?.sourceExcerpt
          ? isGrounded(result.echeancePrincipale.sourceExcerpt, text)
          : null,
        informationsUngrounded: result.informationsExtraites.filter(
          (i) => !isGrounded(i.sourceExcerpt, text),
        ).length,
        informationsTotal: result.informationsExtraites.length,
        latencyMs,
      });
    }

    const report = summarize(letters, env.ANTHROPIC_MODEL);
    const path = writeReport(report);
    console.warn(`\nRapport écrit : ${path}\n`, report.totals);

    // Première exécution = référence (décision #4). Seule garde ici : le
    // harnais a bien traversé tout le corpus.
    expect(report.totals.count).toBe(dataset.length);
  });
});
