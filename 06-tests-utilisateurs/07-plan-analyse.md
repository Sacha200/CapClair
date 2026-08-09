# Plan d'analyse et de décision — CapClair

Comment transformer 5 sessions en décisions. Définit les métriques, la façon d'agréger, les seuils qui
tranchent les décisions ouvertes, et le format de restitution.

---

## 1. Métriques collectées

**Quantitatives** (indicatives — 5 participants ne donnent pas de statistiques, mais des tendances) :

| Métrique | Source | Lecture |
|---|---|---|
| Taux de succès par tâche | Grille (2/1/0) | Tâches < 80 % de réussite = à revoir |
| Temps par tâche | Chronomètre | Écarts anormaux = friction |
| Nb d'erreurs / retours | Grille | Concentration sur un écran = problème local |
| Score SUS (moyenne des 5) | Questionnaire | Cible ≥ 70 |
| Confiance déclarée (0-10, Q9) | Questionnaire | < 6 = signal d'alerte sur la crédibilité |

**Qualitatives** (le cœur de l'analyse à 5 participants) :

- Verbatims classés par thème.
- Problèmes d'utilisabilité, chacun noté en **sévérité 0-4** (échelle Nielsen, cf. grille).
- Points de compréhension (statuts, confiance, brouillon).

---

## 2. Méthode d'agrégation

1. **Dépouiller chaque session** dans les 24 h (grille + verbatims), pendant que le souvenir est frais.
2. **Consolider les problèmes** dans un tableau unique : un problème = une ligne, avec le nombre de
   participants concernés et la sévérité maximale observée.
3. **Prioriser** par `fréquence × sévérité`. Un problème vu chez ≥ 3/5 participants **ou** de sévérité
   ≥ 3 devient prioritaire, quel que soit l'autre critère.
4. **Croiser avec les hypothèses** (H1-H6) pour statuer sur chaque décision ouverte.

Tableau de consolidation type :

| # | Problème | Écran / tâche | Participants (n/5) | Sévérité max | Priorité | Piste de correction |
|---|---|---|---|---|---|---|
| | | | | | | |

---

## 3. Seuils de décision (les arbitrages tranchés par le test)

### Décision D9 — six statuts ou quatre ?

| Résultat observé | Décision |
|---|---|
| ≥ 4/5 apparient correctement les statuts (Q3) **et** aucune confusion récurrente | **Conserver les 6 statuts.** |
| < 4/5, **ou** confusion récurrente entre deux statuts (typiquement Action requise ↔ Documents à préparer) | **Réduire à 4** : À analyser / À faire / En attente de réponse / Terminé. |

### Décision D10 — affichage du niveau de confiance

| Résultat observé | Décision |
|---|---|
| ≥ 3/5 remarquent « À vérifier » spontanément **et** le comprennent (Q4-Q6) | **Conserver** l'affichage actuel. |
| Signal peu vu (< 3/5) mais compris une fois montré | **Renforcer** la visibilité (contraste, position), sans changer le principe. |
| Signal mal compris ou générant une défiance excessive | **Revoir le libellé** et tester une formulation alternative (ex. « à confirmer sur le courrier »). |

### Hypothèse H4 — brouillon de réponse

| Résultat observé | Décision |
|---|---|
| Message de non-envoi rassure (≥ 4/5) et zones à compléter comprises | **Conserver** tel quel. |
| ≥ 2/5 inquiets ou prêts à envoyer le brouillon tel quel | **Renforcer** l'avertissement de relecture et le marquage des zones à compléter ; envisager de reléguer le brouillon au second plan. |

### Hypothèse H1 — compréhension centrale

| Résultat observé | Décision |
|---|---|
| ≥ 4/5 restituent action + échéance sans aide (tâche 3) | Hypothèse produit **validée**. |
| < 4/5 | **Revoir la restitution** (hiérarchie de l'écran 05, formulation du résumé) — problème structurant. |

---

## 4. Restitution

**Livrable de synthèse** (à produire après les 5 sessions) :

1. **Résumé exécutif** (1 page) : le produit tient-il sa promesse ? 3 forces, 3 faiblesses, score SUS.
2. **Décisions** : statut de D9, D10, H4, avec la donnée qui tranche.
3. **Liste priorisée des problèmes** (tableau §2) avec pistes de correction.
4. **Verbatims marquants** illustrant chaque point.
5. **Prochaines actions** : corrections à intégrer au backlog (créer les tickets Jira correspondants),
   et éventuel second tour de test si un changement majeur est décidé (nouveaux statuts, refonte d'un écran).

**Boucle avec le backlog** : chaque problème de sévérité ≥ 3 donne lieu à un ticket dans le projet
Jira, relié à l'epic concerné. Les décisions D9/D10 sont reportées dans le registre
(`../01-cadrage/03-incoherences-et-arbitrages.md`, section F) pour clore ces points.

---

## 5. Limites méthodologiques (à assumer)

- **5 participants** : détecte les problèmes majeurs (~80 %), pas les problèmes rares ; les chiffres
  sont des tendances, pas des mesures statistiques.
- **Prototype, pas produit réel** : pas de vraie latence d'analyse, pas de vrais courriers ; certaines
  réactions (confiance, patience) seront à reconfirmer en conditions réelles.
- **Corpus fictif** : réduit l'enjeu émotionnel réel d'un vrai courrier (stress, urgence) — le ressenti
  observé est probablement plus calme qu'en situation authentique.
- **Effet animateur** : la présence d'un observateur modifie le comportement (les participants
  persévèrent plus qu'ils ne le feraient seuls). En tenir compte dans l'interprétation.
