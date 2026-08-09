# Corpus de courriers fictifs — CapClair

Ce dossier contient le corpus de démonstration utilisé pour concevoir, tester et mesurer la qualité
de l'extraction IA (US-3.2 à US-3.6, US-9.1). Il ne contient **aucune donnée réelle**.

## Contenu

| Dossier | Nb. courriers | Organisme |
|---|---|---|
| `CAF/` | 5 | Caisse d'Allocations Familiales (fictive) |
| `CPAM/` | 5 | Caisse Primaire d'Assurance Maladie (fictive) |
| `FRANCE-TRAVAIL/` | 5 | France Travail (fictive) |

Chaque PDF porte en en-tête et en pied de page la mention **« Document fictif créé à des fins de
démonstration »**. Les noms d'organismes, agences, personnes, adresses, numéros de dossier et
montants sont entièrement inventés.

## Pourquoi 15 courriers et pas moins

La coupe C2 (réduire le corpus à 9 courriers) a été examinée et refusée (voir
`../01-cadrage/03-incoherences-et-arbitrages.md`, section F). Le corpus de 15 a été conservé pour
garantir une couverture suffisante des cas limites listés ci-dessous, indispensable pour mesurer
la qualité de l'extraction IA (US-9.1) sur un échantillon représentatif plutôt que sur 2-3 cas par
organisme.

## Cas de figure couverts

| Cas | Courriers concernés |
|---|---|
| Échéance explicite (date en toutes lettres) | CAF-02, CAF-03, CPAM-01, CPAM-03, CPAM-04, FT-01, FT-02, FT-03, FT-04, FT-05 |
| Échéance relative (délai à calculer par le serveur, jamais par l'IA — décision D7) | CAF-01, CAF-04, CAF-05, CPAM-02 |
| Échéance déjà dépassée à la date de réception simulée | CAF-02, CAF-05, CPAM-02, FT-03 |
| Courrier purement informatif, sans aucune action attendue | CPAM-05 |
| Montants à afficher (trop-perçu, indemnité, allocation) | CAF-02, CAF-03, CPAM-03, FT-01, FT-04, FT-05 |
| Plusieurs justificatifs demandés dans un seul courrier | CAF-01, FT-02 |
| Convocation à un rendez-vous physique | FT-02 |

Le cas CPAM-05 est le test de non-régression clé pour l'exigence « un courrier purement informatif
produit une liste d'actions vide » (US-3.5).

## `dataset-reference.json`

Fichier de référence utilisé pour comparer automatiquement la sortie de l'IA à un résultat attendu.
Pour chaque courrier (`id` = nom du fichier sans extension) :

- `organisme_attendu`, `type_courrier_attendu`, `date_courrier`, `reference_personne`
- `actions_attendues[]` — chaque action avec un `titre` et un `source_excerpt` (extrait exact du
  texte du courrier, utilisé pour vérifier que l'IA cite bien sa source et ne l'invente pas)
- `justificatifs_attendus[]` — même structure
- `echeance` — `type` (`explicite` ou `relative`), `date_calculee` (résultat attendu du calcul
  serveur, jamais de l'IA), et `source_excerpt`
- `montants[]` — libellé et valeur
- `avertissements[]` — conséquences en cas d'inaction, si mentionnées dans le courrier

Les `source_excerpt` sont des sous-chaînes exactes du corps du courrier : ils servent de base au
test « l'IA cite-t-elle un passage réellement présent dans le document ? », qui est le garde-fou
central contre l'hallucination (principe directeur du projet, voir
`../01-cadrage/01-synthese-produit.md`).

## Utilisation prévue

1. Sprint 2 (US-9.1, KAN-55) : mettre en place le script de scoring automatique comparant la sortie
   de l'IA à `dataset-reference.json`.
2. Sprints suivants : rejouer ce corpus à chaque évolution des prompts IA pour détecter une
   régression de qualité.
3. Tests utilisateurs (`06-tests-utilisateurs/`, à produire) : ces mêmes courriers serviront de
   support aux séances de test avec des utilisateurs réels, en clarifiant systématiquement qu'il
   s'agit de documents fictifs.
