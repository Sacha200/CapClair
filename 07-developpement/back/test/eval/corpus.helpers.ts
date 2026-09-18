/**
 * Utilitaires de comparaison pour l'évaluation du corpus (audit 2026-09-16, T1).
 *
 * L'appariement attendu ↔ produit se fait sur `sourceExcerpt` et jamais sur le
 * titre : un titre peut être reformulé légitimement, un extrait littéral non.
 * Même normalisation que `test/integration/documents.corpus.test.ts`
 * (apostrophes typographiques et espaces insécables des PDF), avec en plus le
 * retrait des accents : on compare deux textes issus du même PDF, la tolérance
 * est sans risque et évite un faux négatif sur une ligature d'extraction.
 */

/** Minuscules, accents retirés, apostrophes droites, tous blancs compactés. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[\s\u00a0\u202f]+/g, " ")
    .trim();
}

/**
 * `true` si l'un des deux extraits contient l'autre après normalisation.
 * Bidirectionnel : le modèle peut citer plus large ou plus serré que le dataset
 * tout en désignant le même passage.
 */
export function excerptsOverlap(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na.length === 0 || nb.length === 0) return false;
  return na.includes(nb) || nb.includes(na);
}

/** `true` si l'extrait est une sous-chaîne littérale du texte source (= ancré). */
export function isGrounded(excerpt: string, sourceText: string): boolean {
  if (excerpt.trim().length === 0) return false;
  return normalize(sourceText).includes(normalize(excerpt));
}

export interface MatchCounts {
  /** Attendus retrouvés dans la production. */
  matched: number;
  /** Attendus absents de la production. */
  missed: number;
  /** Produits ancrés dans le texte mais sans correspondance au dataset. */
  extraGrounded: number;
  /** Produits dont le `sourceExcerpt` n'est PAS dans le texte source. */
  ungrounded: number;
}

/**
 * Compare une liste attendue et une liste produite.
 * `extraGrounded` n'est PAS un taux d'invention : le dataset peut être
 * incomplet. Seul `ungrounded` est un défaut objectif (décision #3).
 */
export function compareByExcerpt(
  expected: string[],
  produced: string[],
  sourceText: string,
): MatchCounts {
  const usedProduced = new Set<number>();
  let matched = 0;

  for (const exp of expected) {
    const hit = produced.findIndex((p, i) => !usedProduced.has(i) && excerptsOverlap(exp, p));
    if (hit !== -1) {
      usedProduced.add(hit);
      matched += 1;
    }
  }

  let extraGrounded = 0;
  let ungrounded = 0;
  produced.forEach((p, i) => {
    if (!isGrounded(p, sourceText)) {
      ungrounded += 1;
    } else if (!usedProduced.has(i)) {
      extraGrounded += 1;
    }
  });

  return { matched, missed: expected.length - matched, extraGrounded, ungrounded };
}
