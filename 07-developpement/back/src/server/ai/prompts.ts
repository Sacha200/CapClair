/**
 * Classification d'organisme (heuristique, US-3.3 AC3) et construction du
 * prompt système envoyé à l'IA. Décision #4 du plan E3 : un seul appel IA —
 * la classification par mots-clés choisit l'un des 3 gabarits de prompt
 * organisme-spécifiques *avant* l'appel, plutôt qu'un premier appel IA dédié
 * qui doublerait le coût par courrier.
 */

export type HeuristicOrganisme = "CAF" | "CPAM" | "FRANCE_TRAVAIL";

/** Minuscules, sans accents — insensible à l'orthographe exacte du courrier. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Ordonné : un courrier peut mentionner plusieurs organismes en passant (ex.
// "transmis par la CAF" dans un courrier CPAM) — les motifs les plus
// spécifiques (nom complet de l'organisme, préfixe de référence) passent
// avant les synonymes plus généraux, pour limiter les faux positifs (risque
// 9.3 du plan E3).
//
// Volontairement exclus : « allocataire », « assuré », « demandeur d'emploi »
// seuls — ces termes apparaissent au disclaimer fictif de TOUS les courriers
// du corpus (« ne correspond à aucun allocataire, assuré ou demandeur
// d'emploi existant »), pas seulement ceux de l'organisme correspondant.
const PATTERNS: Array<{ organisme: HeuristicOrganisme; regex: RegExp }> = [
  { organisme: "CAF", regex: /caisse d.allocations familiales|\bcaf-\d/ },
  {
    organisme: "CPAM",
    regex: /caisse primaire d.assurance maladie|\bcpam\b|assurance maladie|carte vitale/,
  },
  {
    organisme: "FRANCE_TRAVAIL",
    regex: /\bfrance travail\b|\bpole emploi\b|\ballocation de retour a l.emploi\b|\bare\b/,
  },
];

/**
 * `null` = aucun motif reconnu → prompt générique + `Organisme.INDETERMINE`
 * en sortie (US-3.3 AC2 : jamais une devinette forcée).
 */
export function classifyOrganismeHeuristic(text: string): HeuristicOrganisme | null {
  const normalized = normalize(text);
  for (const { organisme, regex } of PATTERNS) {
    if (regex.test(normalized)) return organisme;
  }
  return null;
}

const COMMON_INSTRUCTIONS = `Tu analyses un courrier administratif français fictif (contexte de démonstration,
sans donnée réelle) pour un service qui aide des usagers à faible aisance numérique à le comprendre.

Règles impératives :
- Pour toute date ou délai (date du courrier, échéances), ne renvoie JAMAIS de valeur déjà calculée.
  Renvoie uniquement le passage textuel exact du courrier (rawText). Le calcul est fait par le serveur.
- Chaque information extraite, action, justificatif et échéance doit être rattaché à un extrait littéral
  du courrier (sourceExcerpt) — jamais vide, jamais reformulé, copié tel quel.
- N'invente aucune action ni aucun justificatif absent du texte. Un courrier purement informatif produit
  des listes vides, pas une action générique.
- Le résumé est en français simple (niveau A2-B1), 3 à 8 phrases, aucune phrase de plus de 25 mots,
  tout sigle explicité à sa première occurrence, et indique explicitement s'il y a une action à faire.
- Les actions sont formulées à l'infinitif, en une phrase de 15 mots maximum.
- Si l'organisme émetteur est ambigu ou absent du texte, renvoie "INDETERMINE" plutôt que de deviner.`;

const ORGANISME_BLOCKS: Record<HeuristicOrganisme, string> = {
  CAF: `Ce courrier provient vraisemblablement de la CAF (Caisse d'Allocations Familiales). Vocabulaire
courant : allocataire, numéro d'allocataire, RSA, prime d'activité, quotient familial, aide au logement.`,
  CPAM: `Ce courrier provient vraisemblablement de la CPAM (Caisse Primaire d'Assurance Maladie). Vocabulaire
courant : assuré, indemnités journalières, carte Vitale, arrêt de travail, feuille de soins.`,
  FRANCE_TRAVAIL: `Ce courrier provient vraisemblablement de France Travail (ex-Pôle emploi). Vocabulaire
courant : demandeur d'emploi, actualisation, ARE (allocation de retour à l'emploi), convocation, offre raisonnable d'emploi.`,
};

const GENERIC_BLOCK = `L'organisme émetteur n'a pas pu être identifié avec certitude avant l'analyse. Détermine-le
à partir du contenu si possible (CAF, CPAM ou France Travail) ; sinon renvoie "INDETERMINE".`;

export function buildSystemPrompt(organisme: HeuristicOrganisme | null): string {
  const block = organisme ? ORGANISME_BLOCKS[organisme] : GENERIC_BLOCK;
  return `${COMMON_INSTRUCTIONS}\n\n${block}`;
}
