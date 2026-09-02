/**
 * US-2.4 AC1 — Le texte extrait des 15 courriers fictifs contient les
 * fragments littéraux du dataset de référence (vérification « par
 * sur-ensemble », décision #11 du plan E2) : `source_excerpt` d'échéance et
 * d'actions, valeurs de montants, partie numérique de la référence. Les champs
 * interprétés (`date_courrier` en toutes lettres, types) relèvent de
 * l'analyse (E3), pas de l'extraction.
 *
 * Le corpus vit hors de `07-developpement/` : la suite est sautée s'il est
 * absent (CI d'un futur dépôt back séparé). IP dédiée : 198.51.100.100.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { uploadBytes } from "../helpers/documents.js";
import { createUser } from "../helpers/factories.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";

const IP = "198.51.100.100";
const CORPUS_DIR = fileURLToPath(new URL("../../../../05-courriers-fictifs/", import.meta.url));
const DATASET_PATH = join(CORPUS_DIR, "dataset-reference.json");

interface DatasetEntry {
  id: string;
  fichier: string;
  reference_personne?: string;
  actions_attendues?: Array<{ source_excerpt?: string }>;
  echeance?: { source_excerpt?: string } | null;
  montants?: Array<{ valeur?: string }>;
}

/** Minuscules + apostrophes droites + tous blancs (nbsp compris) compactes. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[\s\u00a0\u202f]+/g, " ")
    .trim();
}

/** Fragments littéraux attendus dans le texte brut extrait de ce courrier. */
function expectedFragments(entry: DatasetEntry): string[] {
  const fragments: string[] = [];
  if (entry.echeance?.source_excerpt) fragments.push(entry.echeance.source_excerpt);
  for (const action of entry.actions_attendues ?? []) {
    if (action.source_excerpt) fragments.push(action.source_excerpt);
  }
  for (const montant of entry.montants ?? []) {
    // `valeur` est parfois interprétée (« 27,44 €/jour » quand le courrier
    // écrit « 27,44 € par jour ») : seul le nombre est un extrait littéral.
    const amount = montant.valeur?.match(/\d+(?:[ .]\d{3})*,\d{2}/)?.[0];
    if (amount) fragments.push(amount);
  }
  const numericRef = entry.reference_personne?.match(/[0-9][0-9A-Z-]*/)?.[0];
  if (numericRef) fragments.push(numericRef);
  return fragments;
}

const prisma = testPrisma();
afterAll(() => disconnectTestPrisma());

describe.skipIf(!existsSync(DATASET_PATH))("corpus des 15 courriers fictifs (US-2.4 AC1)", () => {
  const dataset: DatasetEntry[] = existsSync(DATASET_PATH)
    ? JSON.parse(readFileSync(DATASET_PATH, "utf8"))
    : [];
  let cookie: string;

  beforeAll(async () => {
    await truncateAll(prisma);
    const app = await getApp();
    const { email, password } = await createUser(prisma);
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password },
      remoteAddress: IP,
    });
    cookie = sessionCookie(res)!;
  });

  it.each(dataset.map((entry) => [entry.id, entry] as const))(
    "%s → tous les fragments attendus dans le texte extrait",
    async (id, entry) => {
      const app = await getApp();
      const bytes = readFileSync(join(CORPUS_DIR, entry.fichier));
      const res = await uploadBytes(app, bytes, {
        cookie,
        remoteAddress: IP,
        filename: `${id}.pdf`,
      });
      expect(res.statusCode, `${id} : upload`).toBe(201);
      expect(res.json().readable, `${id} : lisible`).toBe(true);

      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: res.json().documentId },
      });
      const text = normalize(doc.extractedText ?? "");

      const fragments = expectedFragments(entry);
      expect(fragments.length, `${id} : dataset sans fragment vérifiable`).toBeGreaterThan(0);
      const missing = fragments.filter((fragment) => !text.includes(normalize(fragment)));
      expect(
        missing,
        `${id} : ${fragments.length - missing.length}/${fragments.length} fragments trouvés ; manquants : ${JSON.stringify(missing)}`,
      ).toEqual([]);
    },
  );
});
