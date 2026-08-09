# Wireframes — CapClair

**Itération 1** — 22 juillet 2026.

Deux supports, même contenu :

- **Figma (source de travail)** : [CapClair — Wireframes MVP](https://www.figma.com/design/ikpl3eoij9BEAwIYsfSLNO)
  (équipe Karim-sacha Veille). Les 10 écrans sont des **gabarits desktop 1440 × 1024**, avec des
  **composants Header et Footer partagés** (instanciés sur chaque écran) et un contenu centré à ~1040 px.
  L'écran de connexion utilise un header minimal pré-connexion et une carte centrée.
- **`wireframes.html`** : version statique consultable hors Figma, avec les annotations (user stories +
  décisions du registre) en regard de chaque écran. Cette version reste au format compact de l'itération 1 ;
  la source de référence à jour est désormais Figma.

Basse fidélité volontaire : structure, hiérarchie et contenu de l'information. Aucune charte graphique
(couleurs, typographie, composants finaux) n'est appliquée à ce stade — c'est un choix, pas un oubli,
pour valider le fond avant la forme.

## Raffinements itération 2

- Gabarits passés en **desktop 1440 × 1024** avec composants **Header** et **Footer** partagés.
- Écrans de contenu (tableau de bord, résultat, pilotage, paramètres, légales, états) en **pleine
  largeur** (marge 40 px) ; connexion/import/attente restent centrés (écrans à tâche unique).
- **Écran 05 (Résultat)** : disposition **deux colonnes** retenue — à gauche échéance + résumé +
  actions + justificatifs, à droite informations extraites + brouillon. La version colonne unique a
  été écartée.
- **Écran 03 (Import)** : aperçu du PDF **inline** dans une deuxième colonne (à côté de la zone de
  dépôt), la confirmation et les boutons restant sous les deux colonnes. La modal n'est utilisée que
  comme zoom secondaire (« voir en plein écran »), pas comme moyen principal de consultation —
  décision motivée par l'accessibilité pour le persona Nadia.

## Liste des 10 écrans

| # | Écran | User stories couvertes |
|---|---|---|
| 1 | Connexion / Inscription | US-1.1, US-1.2, US-1.3 |
| 2 | Tableau de bord | US-5.4, US-1.4, US-1.5 |
| 3 | Import d'un courrier | US-2.1, US-2.2, US-2.3, US-3.1 |
| 4 | Écran d'attente d'analyse | I-13, D8 |
| 5 | Résultat d'analyse | US-4.1, US-4.2, US-4.3, US-4.4 |
| 6 | Pilotage du dossier | US-5.1, US-5.2, US-5.3, US-5.5, US-4.5 |
| 7 | Brouillon de réponse | US-6.1, US-6.2, US-6.3, US-6.4, I-8 |
| 8 | Paramètres et compte | US-7.4, US-7.5, D12 |
| 9 | Pages légales | US-8.3, I-6 |
| 10 | États système | M-2, US-2.6 |

Cette liste n'était pas explicitement écrite dans le plan initial ni dans le cahier des charges — elle a
été déduite des 49 user stories et des points manquants identifiés (`01-cadrage/03-incoherences-et-arbitrages.md`,
sections B et D). Si un écran te semble manquant ou à fusionner, c'est le moment de le dire : c'est
nettement moins coûteux à corriger ici qu'après développement.

## Décisions du registre appliquées visuellement

- **D7** (dates calculées côté serveur) — écran 5 : la date affichée est accompagnée de l'extrait source qui l'a produite.
- **D9** (6 statuts, à retester) — écran 6 : les 6 statuts sont listés tels quels, sans réduction anticipée.
- **D10** (confiance en 3 niveaux) — écran 5 : seul le niveau faible est visuellement mis en avant (badge orange + texte).
- **D12** (purge à 12 mois) — écran 8 : la règle est explicitée en langage simple, pas seulement dans les CGU.
- **I-8** (garde-fous du brouillon) — écran 7 : bandeau d'avertissement permanent + zones à compléter surlignées.
- **I-6** (persona aidant) — écran 9 : mention explicite de son statut dans les CGU.
- **M-2** (écrans d'erreur manquants) — écran 10 : état vide, document illisible, 404, 500.

## Itération 3 — passe haute fidélité

Le fichier Figma contient désormais trois pages :

- **Wireframes** — les 10 écrans basse fidélité (itérations 1-2), conservés comme référence de structure.
- **🎨 Design System** — fondation visuelle (voir ci-dessous).
- **✨ Hi-Fi** — les **10 écrans** maquettés en haute fidélité, ordonnés 01 → 10.

### Direction visuelle — inspirée du DSFR, sans en être

CapClair traite des courriers de l'administration ; s'ancrer visuellement dans cet univers rassure
l'utilisateur. On s'inspire donc du **Système de Design de l'État (DSFR)** — typographies, échelle
d'espacement, contrastes AA, bleu institutionnel — **mais on ne l'utilise pas tel quel**, pour deux raisons :

1. **Juridique** : les conditions d'utilisation du DSFR le réservent aux sites de l'État et de ses
   opérateurs. Un service privé n'a pas le droit de l'employer.
2. **Positionnement** : le bloc-marque « Marianne / République Française » garantit à l'usager qu'il est
   sur un site *officiel*. CapClair doit affirmer l'inverse (« je ne suis pas l'administration, vérifie
   toujours »). Reprendre l'habillage officiel tromperait l'utilisateur et ruinerait ce positionnement.

On garde donc ce qui est libre et crée la familiarité, **sans le bloc-marque RF ni le logo officiel**,
avec une identité CapClair distincte.

### Tokens et composants

- **Couleurs** (collection `CapClair · Tokens`) : bleu confiance `#1F5F8B` en primaire, vert validation
  `#2E7D46` (« terminé »), orange `#C8611A` (« à vérifier / action requise »), rouge `#B42318` (erreur),
  neutres et fonds. Tous les fills des composants sont **liés aux variables**.
- **Typographies** : **Marianne** (titres + UI) et **Spectral** (texte de lecture : résumés, contenu de
  courrier, mentions légales). ⚠️ Marianne n'étant pas disponible dans l'environnement Figma, elle est
  **substituée par Mulish** dans la maquette ; **la production utilisera la vraie Marianne**. Spectral est
  utilisée telle quelle.
- **Composants à variants** : Bouton (Primaire/Secondaire/Tertiaire × Default/Hover), Badge de statut
  (6 statuts, pastille + libellé — jamais la couleur seule), Champ de saisie (Default/Focus/Filled),
  Case à cocher (cochée/décochée), Badge de confiance « À vérifier », Header et Footer hi-fi.

### État de la hi-fi

Les **10 écrans** sont maquettés en haute fidélité sur la page ✨ Hi-Fi, construits à partir des
composants et tokens du design system : 01 Connexion, 02 Tableau de bord, 03 Import, 04 Attente,
05 Résultat (2 colonnes), 06 Pilotage, 07 Brouillon, 08 Paramètres, 09 Pages légales, 10 États système.

Reste possible pour une passe ultérieure : ajouter aux composants les états d'interaction réels
(hover, focus clavier) et brancher un prototype cliquable reliant les écrans.

## Prochaine étape après validation

Rédiger le protocole de tests utilisateurs (`06-tests-utilisateurs/`), qui s'appuiera sur ces
maquettes et sur le corpus de 15 courriers fictifs (`05-courriers-fictifs/`).
