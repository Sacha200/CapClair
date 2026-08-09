# Protocole de tests utilisateurs — CapClair

**Version** : 1.0 — juillet 2026
**Type** : test d'utilisabilité modéré sur prototype haute fidélité (maquette Figma cliquable)
**Livrable associé** : ce protocole s'accompagne d'un kit complet (recrutement, consentement,
scénarios, grille d'observation, questionnaire post-test, plan d'analyse) — voir le `README.md` du dossier.

---

## 1. Contexte et raison d'être

CapClair aide un particulier à comprendre un courrier administratif (CAF, CPAM, France Travail) :
explication en français simple, liste d'actions, checklist de justificatifs, échéances, brouillon de
réponse et rappels. Le produit repose sur un principe de confiance : **l'IA propose, le serveur décide,
l'utilisateur a le dernier mot** — avec des extraits sources vérifiables et un affichage prudent des
informations à faible confiance.

Plusieurs choix de conception ont été **délibérément laissés ouverts, à confirmer par un test avec de
vrais utilisateurs** plutôt que tranchés au jugement (registre de décisions,
`../01-cadrage/03-incoherences-et-arbitrages.md`) :

- **D9** — le dossier a six statuts (À analyser, Action requise, Documents à préparer, Réponse prête,
  En attente, Terminé). Sont-ils compris ? Faut-il réduire à quatre ?
- **D10** — le niveau de confiance n'est affiché qu'à trois niveaux, et seul le niveau faible est mis
  en avant (« À vérifier »). Ce signal est-il vu et compris ?
- **I-8** — le brouillon de réponse est le point le plus sensible du produit. Le message « CapClair
  n'envoie aucun courrier » rassure-t-il ou inquiète-t-il ?

Le test doit aussi vérifier l'hypothèse centrale du produit : **une personne peu à l'aise avec
l'administration et le numérique comprend-elle son courrier et sait-elle quoi faire, grâce à CapClair ?**

---

## 2. Objectifs du test

**Objectif général** : évaluer si le persona cible comprend son courrier et parvient à agir, et
recueillir de quoi trancher les décisions ouvertes.

**Objectifs spécifiques :**

1. Mesurer le **succès et la fluidité** sur les tâches clés : importer un courrier, lancer l'analyse,
   comprendre ce qui est demandé et pour quand, préparer les justificatifs, consulter le brouillon.
2. Vérifier la **compréhension des statuts de dossier** (décision D9).
3. Vérifier la **perception du niveau de confiance** et du signal « À vérifier » (décision D10).
4. Observer la **réaction au brouillon de réponse** et au message de non-envoi (I-8).
5. Évaluer si les utilisateurs **font confiance à raison** : consultent-ils les extraits sources,
   distinguent-ils ce qui est sûr de ce qui est à vérifier ?
6. Identifier les **points de friction** de vocabulaire, de navigation et de mise en page.

**Hors périmètre** : performance technique, temps réel d'analyse IA, tests sur de vrais courriers
(le corpus est fictif), tests d'accessibilité assistée (audit séparé).

---

## 3. Hypothèses à tester

Chaque hypothèse est formulée de façon **falsifiable**, avec un critère d'invalidation explicite.
Les seuils de décision sont détaillés dans le plan d'analyse (`07-plan-analyse.md`).

| # | Hypothèse | Critère d'invalidation | Décision liée |
|---|---|---|---|
| H1 | L'utilisateur identifie correctement l'action principale et l'échéance après analyse. | < 4 participants sur 5 y parviennent sans aide. | Périmètre MVP |
| H2 | Les six statuts de dossier sont interprétés correctement. | < 4/5 classent correctement un dossier, ou confusion récurrente entre deux statuts. | **D9** (réduire à 4) |
| H3 | Le signal « À vérifier » est remarqué et compris comme « à contrôler soi-même ». | < 3/5 le remarquent spontanément, ou mécompréhension du sens. | **D10** |
| H4 | Le message « CapClair n'envoie aucun courrier » rassure plutôt qu'il n'inquiète. | ≥ 2/5 expriment de la confusion ou de l'inquiétude sur « qui envoie quoi ». | **I-8** |
| H5 | L'utilisateur comprend qu'un courrier purement informatif n'exige aucune action (cas CPAM-05). | ≥ 2/5 cherchent une action inexistante ou se croient en faute. | US-3.5 |
| H6 | L'utilisateur consulte au moins une fois un extrait source pour vérifier une information. | 0/5 ne consulte jamais l'extrait source, même invité à vérifier. | Principe de vérifiabilité |

---

## 4. Méthode

**Type** : test d'utilisabilité **modéré**, avec la méthode du **think-aloud** (le participant pense
à voix haute).

**Support** : **prototype haute fidélité Figma cliquable** (les 10 écrans de la page ✨ Hi-Fi), alimenté
par le **corpus de 15 courriers fictifs** (`../05-courriers-fictifs/`). Aucune donnée réelle n'est
utilisée ; ce point est rappelé aux participants.

**Format** : présentiel de préférence (meilleure lecture des hésitations), ou visioconférence avec
partage d'écran si nécessaire. Le participant manipule la maquette ; l'animateur ne guide pas.

**Durée** : ~45 minutes par session (voir déroulé §7).

**Rôles** :

- **Animateur** — accueille, lit les consignes, pose les tâches, relance sans souffler la solution.
- **Observateur** — remplit la grille d'observation, chronomètre, note les verbatims. Ne parle pas.

Si une seule personne anime, prévoir un enregistrement (écran + voix) pour dépouiller après coup, sous
réserve du consentement (`03-consentement.md`).

**Règle d'or de l'animation** : ne jamais aider avant 30 secondes de blocage réel, ne jamais dire
« cliquez ici », toujours renvoyer la question au participant (« Qu'est-ce que vous feriez, vous ? »,
« Que vous attendez-vous à trouver ? »).

---

## 5. Participants

**Nombre** : **5 participants** (seuil classique où l'on détecte l'essentiel des problèmes majeurs).
Prévoir 1 remplaçant en réserve. Un pilote (participant zéro) valide le déroulé avant les vraies
sessions ; ses données ne sont pas comptabilisées.

**Profils recherchés** (dérivés des personas, `../01-cadrage/02-personas-besoins.md`) :

| Profil | Cible | Nb |
|---|---|---|
| Type **Nadia** — faible aisance numérique, reçoit des courriers CAF/CPAM/France Travail, appréhende l'administration | Cœur de cible | 3 |
| Type **Marc** — gère plusieurs dossiers en parallèle (chômage, formation) | Multi-dossiers | 1 |
| Type **Sophie** — accompagne un proche dans ses démarches (aidant) | Aidant | 1 |

**Critères d'inclusion et d'exclusion** : voir le questionnaire de recrutement (`02-questionnaire-recrutement.md`).

**Défraiement** : prévoir une compensation (bon d'achat ~20-30 €) pour respecter le temps donné et
faciliter le recrutement de profils peu volontaires spontanément.

---

## 6. Matériel

- Prototype Figma (lien de partage en mode prototype), testé la veille.
- Les 15 courriers fictifs (affichés dans la maquette ; imprimés en secours).
- Grilles d'observation imprimées ou en tableur (`05-grille-observation.md`).
- Questionnaire post-test (`06-questionnaire-post-test.md`).
- Formulaire de consentement signé (`03-consentement.md`).
- Chronomètre, de quoi enregistrer (avec consentement), une boisson pour le participant.
- Un plan B hors-ligne (captures des écrans) en cas de souci de connexion.

---

## 7. Déroulé d'une session (~45 min)

| Étape | Durée | Contenu |
|---|---|---|
| 1. Accueil | 5 min | Mise à l'aise, rappel du cadre, signature du consentement. |
| 2. Introduction | 3 min | « On teste le logiciel, pas vous. Il n'y a pas de mauvaise réponse. Pensez à voix haute. » Rappel : **documents fictifs**. |
| 3. Questions de contexte | 5 min | 3-4 questions sur le rapport aux courriers administratifs (voir script, `04-scenarios-taches.md`). |
| 4. Tâches | 25 min | 6 à 8 scénarios ancrés sur le corpus (`04-scenarios-taches.md`), en think-aloud. |
| 5. Questionnaire post-test | 5 min | SUS + questions ciblées D9/D10/brouillon (`06-questionnaire-post-test.md`). |
| 6. Débrief | 2 min | « Qu'est-ce qui vous a le plus aidé ? Le plus gêné ? » Remerciements, défraiement. |

**Consigne de neutralité** : l'animateur ne montre ni satisfaction ni déception face aux actions du
participant ; il reste factuel et bienveillant.

---

## 8. Éthique et données

- Participation **volontaire**, arrêt possible à tout moment sans justification.
- **Aucune donnée réelle** manipulée : le corpus est entièrement fictif.
- Enregistrements (si consentis) conservés le temps du dépouillement puis supprimés ; données
  anonymisées (Participant 1 à 5). Voir `03-consentement.md`.
- Le test porte sur des personnes potentiellement en difficulté (administrative, numérique) :
  bienveillance et absence de jugement sont impératives.

---

## 9. Calendrier indicatif

Le test intervient dans la phase 4 du planning (semaines 12-14, mi-octobre 2026), après stabilisation
de la maquette. Séquence : recrutement → pilote → 5 sessions sur 2-3 jours → analyse → synthèse et
décisions (D9, D10). Voir `07-plan-analyse.md` pour la restitution.
