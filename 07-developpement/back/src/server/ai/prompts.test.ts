import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { getDocumentProxy, extractText } from "unpdf";
import { describe, expect, it } from "vitest";
import { buildSystemPrompt, classifyOrganismeHeuristic } from "./prompts.js";

describe("classifyOrganismeHeuristic (US-3.3 AC3)", () => {
  it("reconnaît la CAF", () => {
    expect(classifyOrganismeHeuristic("Caisse d'Allocations Familiales — Réf. courrier : CAF-2026-01")).toBe(
      "CAF",
    );
  });

  it("reconnaît la CPAM", () => {
    expect(classifyOrganismeHeuristic("Caisse Primaire d'Assurance Maladie de l'Argonne")).toBe("CPAM");
  });

  it("reconnaît France Travail (et son ancien nom)", () => {
    expect(classifyOrganismeHeuristic("France Travail fictive de la Vallée")).toBe("FRANCE_TRAVAIL");
    expect(classifyOrganismeHeuristic("courrier de Pôle emploi concernant votre actualisation")).toBe(
      "FRANCE_TRAVAIL",
    );
  });

  it("insensible aux accents et à la casse", () => {
    expect(classifyOrganismeHeuristic("CAISSE PRIMAIRE D ASSURANCE MALADIE")).toBe("CPAM");
  });

  it("null sans motif reconnu — jamais de devinette forcée (AC2)", () => {
    expect(classifyOrganismeHeuristic("Bonjour, voici un courrier générique sans organisme identifiable.")).toBeNull();
  });

  it("priorise le nom complet sur une simple mention de passage", () => {
    // Courrier CPAM qui mentionne la CAF en passant : le nom complet CPAM doit l'emporter.
    expect(
      classifyOrganismeHeuristic(
        "Caisse Primaire d'Assurance Maladie. Votre dossier a été transmis par la CAF de votre secteur.",
      ),
    ).toBe("CPAM");
  });
});

describe("buildSystemPrompt", () => {
  it("inclut le bloc organisme-spécifique quand connu", () => {
    expect(buildSystemPrompt("CAF")).toContain("allocataire");
    expect(buildSystemPrompt("CPAM")).toContain("indemnités journalières");
    expect(buildSystemPrompt("FRANCE_TRAVAIL")).toContain("demandeur d'emploi");
  });

  it("bascule sur le bloc générique sans classification (INDETERMINE)", () => {
    expect(buildSystemPrompt(null)).toContain("INDETERMINE");
  });

  it("porte toujours la règle D7 (jamais de date calculée par l'IA)", () => {
    expect(buildSystemPrompt("CAF")).toMatch(/JAMAIS.*calculée/i);
  });
});

// Corpus réel (US-3.3 AC1 : ≥ 14/15) — hors de 07-developpement/, sauté si absent.
const CORPUS_DIR = fileURLToPath(new URL("../../../../../05-courriers-fictifs/", import.meta.url));
const DATASET_PATH = join(CORPUS_DIR, "dataset-reference.json");

interface DatasetEntry {
  id: string;
  fichier: string;
  organisme_attendu: "CAF" | "CPAM" | "FRANCE_TRAVAIL";
}

describe.skipIf(!existsSync(DATASET_PATH))("classification sur le corpus des 15 courriers", () => {
  it("identifie l'organisme correct dans au moins 14 cas sur 15", async () => {
    const dataset: DatasetEntry[] = JSON.parse(readFileSync(DATASET_PATH, "utf8"));
    const misclassified: string[] = [];

    for (const entry of dataset) {
      const bytes = readFileSync(join(CORPUS_DIR, entry.fichier));
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await extractText(pdf, { mergePages: true });
      const detected = classifyOrganismeHeuristic(text);
      if (detected !== entry.organisme_attendu) {
        misclassified.push(`${entry.id} : attendu ${entry.organisme_attendu}, obtenu ${detected ?? "null"}`);
      }
    }

    const correct = dataset.length - misclassified.length;
    expect(correct, `échecs : ${JSON.stringify(misclassified)}`).toBeGreaterThanOrEqual(14);
  });
});
