/**
 * Utilitaires de comparaison pour l'évaluation du corpus (audit 2026-09-16, T1).
 *
 * Critère primaire : `sourceExcerpt`, jamais le titre. Un titre peut être
 * reformulé légitimement, un extrait littéral non.
 *
 * Limite constatée à l'étape 8 du plan, sur CAF-01 : pour une ACTION, le
 * dataset et le modele peuvent ancrer la même consigne sur deux phrases
 * différentes du courrier (celle qui liste les documents, celle qui donne le
 * délai). Les deux extraits sont ancrés, aucun n'a tort, et l'appariement par
 * extrait échoue. Le titre est alors le seul arbitre disponible, d'où
 * `compareByExcerptThenTitle` : le rappel strict reste publié tel quel, un
 * rappel souple est publié à côté. Le taux d'invention (`ungrounded`) ne
 * dépend d'aucun appariement et reste inchangé.
 *
 * Cette limite ne s'applique pas aux justificatifs : un document nommé
 * n'apparaît qu'une fois dans le courrier, l'extrait suffit.
 *
 * Même normalisation que `test/integration/documents.corpus.test.ts`
 * (apostrophes typographiques et espaces insécables des PDF), avec en plus le
 * retrait des accents : on compare deux textes issus du même PDF.
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

/**
 * Mots vides français retirés avant comparaison de titres. Liste courte et
 * volontairement fermée : elle sert à ne pas apparier deux titres sur « de »
 * et « votre », pas à faire de la lemmatisation.
 */
const STOPWORDS = new Set([
  "a",
  "au",
  "aux",
  "afin",
  "apres",
  "avant",
  "avec",
  "ce",
  "ces",
  "cet",
  "cette",
  "dans",
  "de",
  "des",
  "du",
  "elle",
  "en",
  "est",
  "et",
  "etre",
  "il",
  "je",
  "la",
  "le",
  "les",
  "leur",
  "lors",
  "lui",
  "ma",
  "mes",
  "moins",
  "mon",
  "ne",
  "nos",
  "notre",
  "nous",
  "ou",
  "par",
  "pas",
  "plus",
  "pour",
  "qui",
  "que",
  "sa",
  "sans",
  "se",
  "ses",
  "son",
  "sous",
  "sur",
  "tous",
  "tout",
  "un",
  "une",
  "vers",
  "vos",
  "votre",
  "vous",
  "y",
]);

/** Mots significatifs d'un titre : normalisés, sans mots vides, longueur >= 3. */
function contentWords(title: string): Set<string> {
  return new Set(
    normalize(title)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );
}

/**
 * Critère de repli pour les actions : au moins deux mots significatifs communs,
 * et la moitié au moins des mots significatifs du titre le plus court.
 *
 * Les deux conditions sont nécessaires : le seuil seul apparierait deux titres
 * d'un mot, le compte seul apparierait deux titres longs qui partagent
 * « envoyer » et « courrier ».
 */
export function titlesOverlap(a: string, b: string): boolean {
  const wa = contentWords(a);
  const wb = contentWords(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  if (shared < 2) return false;
  return shared / Math.min(wa.size, wb.size) >= 0.5;
}

export interface MatchCounts {
  /** Taille de la liste attendue — sert de dénominateur au rappel. */
  expectedCount: number;
  /** Taille de la liste produite — sert de dénominateur au taux d'invention. */
  producedCount: number;
  /** Attendus retrouvés par l'extrait seul (critère strict). */
  matched: number;
  /** Attendus retrouvés par l'extrait OU, à défaut, le titre. Toujours >= `matched`. */
  matchedLenient: number;
  /** Attendus retrouvés par aucun des deux critères. */
  missed: number;
  /** Produits ancrés dans le texte mais sans correspondance au dataset. */
  extraGrounded: number;
  /** Produits dont le `sourceExcerpt` n'est PAS dans le texte source. */
  ungrounded: number;
}

export interface LabelledExcerpt {
  excerpt: string;
  title: string;
}

/**
 * Compte les produits ancrés non appariés et les produits non ancrés.
 * `extraGrounded` n'est PAS un taux d'invention : le dataset peut être
 * incomplet. Seul `ungrounded` est un défaut objectif (decision #3).
 */
function countProduced(
  produced: string[],
  used: Set<number>,
  sourceText: string,
): { extraGrounded: number; ungrounded: number } {
  let extraGrounded = 0;
  let ungrounded = 0;
  produced.forEach((p, i) => {
    if (!isGrounded(p, sourceText)) {
      ungrounded += 1;
    } else if (!used.has(i)) {
      extraGrounded += 1;
    }
  });
  return { extraGrounded, ungrounded };
}

/** Appariement par extrait seul. Critere retenu pour les justificatifs. */
export function compareByExcerpt(
  expected: string[],
  produced: string[],
  sourceText: string,
): MatchCounts {
  const used = new Set<number>();
  let matched = 0;

  for (const exp of expected) {
    const hit = produced.findIndex((p, i) => !used.has(i) && excerptsOverlap(exp, p));
    if (hit !== -1) {
      used.add(hit);
      matched += 1;
    }
  }

  return {
    expectedCount: expected.length,
    producedCount: produced.length,
    matched,
    matchedLenient: matched,
    missed: expected.length - matched,
    ...countProduced(produced, used, sourceText),
  };
}

/**
 * Appariement en deux passes, retenu pour les actions.
 * Passe 1 : extrait (strict). Passe 2 : titre, sur les seuls attendus et
 * produits restés libres. Un produit n'est jamais apparie deux fois.
 */
export function compareByExcerptThenTitle(
  expected: LabelledExcerpt[],
  produced: LabelledExcerpt[],
  sourceText: string,
): MatchCounts {
  const used = new Set<number>();
  const unmatchedExpected: LabelledExcerpt[] = [];
  let matched = 0;

  for (const exp of expected) {
    const hit = produced.findIndex(
      (p, i) => !used.has(i) && excerptsOverlap(exp.excerpt, p.excerpt),
    );
    if (hit === -1) {
      unmatchedExpected.push(exp);
      continue;
    }
    used.add(hit);
    matched += 1;
  }

  let recoveredByTitle = 0;
  for (const exp of unmatchedExpected) {
    const hit = produced.findIndex((p, i) => !used.has(i) && titlesOverlap(exp.title, p.title));
    if (hit !== -1) {
      used.add(hit);
      recoveredByTitle += 1;
    }
  }

  const matchedLenient = matched + recoveredByTitle;
  return {
    expectedCount: expected.length,
    producedCount: produced.length,
    matched,
    matchedLenient,
    missed: expected.length - matchedLenient,
    ...countProduced(
      produced.map((p) => p.excerpt),
      used,
      sourceText,
    ),
  };
}
