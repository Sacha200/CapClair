# Tests utilisateurs — CapClair

Kit complet pour préparer, animer et analyser un **test d'utilisabilité modéré** de la maquette haute
fidélité, avec 5 participants correspondant aux personas du projet.

## Ce que le test doit trancher

Au-delà de vérifier que le produit est compréhensible, ce test existe pour **confirmer par des
utilisateurs réels** des décisions volontairement laissées ouvertes dans le cadrage :

- **D9** — six statuts de dossier, ou faut-il réduire à quatre ?
- **D10** — le signal « À vérifier » (confiance faible) est-il vu et compris ?
- **I-8** — le brouillon de réponse et le message « CapClair n'envoie aucun courrier » rassurent-ils ?

## Contenu du kit

| Fichier | Rôle |
|---|---|
| `01-protocole.md` | Objectifs, hypothèses (H1-H6), méthode, participants, déroulé de session, éthique |
| `02-questionnaire-recrutement.md` | Screener : critères, questions de filtrage, quotas de profils |
| `03-consentement.md` | Consentement RGPD, enregistrement, mention documents fictifs |
| `04-scenarios-taches.md` | 6-9 tâches ancrées sur le corpus fictif + script d'animation |
| `05-grille-observation.md` | Grille par participant (succès, temps, sévérité, verbatims) + grilles ciblées D9/D10/brouillon |
| `06-questionnaire-post-test.md` | SUS (français) + questions ciblées sur les décisions |
| `07-plan-analyse.md` | Métriques, agrégation, **seuils de décision** D9/D10/H4, restitution |
| `08-synthese-simulee.md` | **Exemple de synthèse à données fictives** — démontre la boucle d'analyse et le gabarit de restitution (⚠️ résultats inventés, à remplacer par de vrais tests) |

Une version **Word** du protocole complet est également disponible (voir le dossier livrables /
`Protocole-tests-utilisateurs-CapClair.docx`).

## Prototype cliquable

Les 10 écrans hi-fi sont **reliés en prototype navigable** (page ✨ Hi-Fi). Point de départ :
**écran 01 — Connexion**. Lancer via le bouton *Présenter* de Figma, ou le lien prototype :
`https://www.figma.com/proto/ikpl3eoij9BEAwIYsfSLNO?node-id=58-222&starting-point-node-id=58-222`.

Parcours câblés :

- **Flux principal** : Connexion → *Se connecter* → Tableau de bord → *Importer* → Import →
  *Lancer l'analyse* → Attente (**barre de progression animée** ~2 s) → Résultat → *Ouvrir le brouillon* → Brouillon.
- **Champs de connexion interactifs** : cliquer un champ affiche l'état focus (bordure bleue) ; un
  nouveau clic le désactive. La saisie de vrai texte reste impossible (contrainte Figma).
- **Navigation globale** : sur chaque écran, le logo et « Tableau de bord » ramènent au tableau de bord,
  « Importer un courrier » va à l'import, le menu utilisateur va aux Paramètres, les liens de pied de
  page vont aux Pages légales.
- **Tableau de bord** : la 1re carte (CAF) ouvre le Résultat, la 2e (France Travail) ouvre le Pilotage,
  la 3e (CPAM) ouvre le **Résultat sans action** (écran 05b) — support de la tâche 7.
- **Extrait source (tâche 5)** : sur l'écran Résultat, « Voir l'extrait source » ouvre une **vraie
  modale** montrant le passage du courrier avec la référence surlignée ; clic à l'extérieur ou sur ✕ pour fermer.
- **Aperçu plein écran (tâche 2 / import)** : sur l'écran Import, « Voir en plein écran » ouvre le
  courrier fictif **agrandi et lisible** en mode document ; fermeture par la barre d'outils ou le voile.
- **États système** : les boutons *Importer* et *Retour au tableau de bord* sont actifs.

**Seule limite du prototype à connaître avant d'animer :**

- Les **champs de saisie ne reçoivent pas de texte réel** (contrainte de la maquette) : la connexion se
  fait en cliquant directement sur « Se connecter ». Toutes les autres tâches (2 à 9) sont pleinement navigables.

## Appuis

- **Prototype** : page ✨ Hi-Fi du fichier Figma (10 écrans, navigables).
- **Corpus** : `../05-courriers-fictifs/` (15 courriers fictifs + dataset de référence). Cas clés
  mobilisés : CAF-01 (demande de justificatifs, échéance calculée), CPAM-05 (courrier sans action).
- **Personas** : `../01-cadrage/02-personas-besoins.md` (Nadia, Marc, Sophie).

## Quand

Phase 4 du planning (mi-octobre 2026), après stabilisation de la maquette. Séquence : recrutement →
session pilote → 5 sessions sur 2-3 jours → analyse → synthèse et clôture de D9/D10 dans le registre
de décisions.
