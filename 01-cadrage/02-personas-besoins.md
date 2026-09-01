# CapClair — Personas et besoins utilisateurs

**Version** : 1.0 — 21 juillet 2026
**Statut** : cadrage — à valider

> Personas construits à partir du cahier des charges, non issus d'entretiens. À confronter aux tests utilisateurs de la semaine 8 et à réviser ensuite.

---

## Persona 1 — Nadia, 34 ans (persona principal)

**Situation** : assistante de vie, deux enfants, allocataire CAF. Smartphone comme équipement principal, ordinateur portable partagé à la maison.
**Aisance numérique** : sait utiliser une application, redoute les formulaires administratifs en ligne.

**Objectif** : ne pas perdre ses droits par oubli ou incompréhension.

**Frustrations**

- Elle lit le courrier deux fois et ne sait toujours pas ce qu'on lui demande précisément.
- Elle ne distingue pas ce qui est informatif de ce qui exige une action.
- Elle range le courrier « pour plus tard » et le retrouve après la date limite.
- Elle a peur de mal faire et de déclencher un problème plus grave.

**Besoins**

| # | Besoin | Traduction produit |
|---|---|---|
| N1 | Comprendre en français simple | Résumé sans jargon, phrases courtes |
| N2 | Savoir quoi faire concrètement | Liste d'actions ordonnée et cochable |
| N3 | Savoir quoi préparer | Checklist de justificatifs |
| N4 | Voir la date limite immédiatement | Échéance en haut du dossier, format explicite |
| N5 | Ne pas oublier | Rappels J-7 / J-3 / J-0, e-mail + notification |
| N6 | Être rassurée | Ton neutre, pas d'alarmisme, avertissement honnête sur les limites |

**Citation** : « Je veux juste savoir ce que je dois faire, et avant quand. »

---

## Persona 2 — Marc, 52 ans

**Situation** : en recherche d'emploi depuis huit mois, inscrit à France Travail. Dossier CPAM en parallèle (arrêt de travail passé).
**Aisance numérique** : correcte, mais découragé par la multiplicité des espaces en ligne.

**Objectif** : garder une vue d'ensemble de plusieurs démarches simultanées.

**Frustrations**

- Trois organismes, trois logiques, aucun endroit commun.
- Il ne sait plus quel document il a déjà envoyé et à qui.
- Il doit rédiger des réponses écrites et bloque sur la formulation.

**Besoins**

| # | Besoin | Traduction produit |
|---|---|---|
| M1 | Centraliser les dossiers en cours | Tableau de bord multi-organismes |
| M2 | Suivre l'avancement | Statuts de dossier + progression |
| M3 | Savoir ce qui a déjà été fait | Historique horodaté par dossier |
| M4 | Ne pas partir d'une page blanche | Brouillon de réponse généré et modifiable |
| M5 | Exporter | Copie presse-papiers, export texte/PDF |

**Citation** : « J'ai quatre démarches en cours et aucun endroit qui me dit où j'en suis. »

---

## Persona 3 — Sophie, 41 ans (proche aidante)

**Situation** : accompagne son père âgé dans ses démarches CPAM. Travaille à temps plein, gère à distance.
**Aisance numérique** : bonne.

**Objectif** : traiter rapidement et sans erreur des courriers qui ne la concernent pas directement.

**Frustrations**

- Elle doit d'abord déchiffrer le courrier avant même de pouvoir aider.
- Elle ne veut pas engager la responsabilité de son père sur une mauvaise interprétation.
- Elle a besoin de vérifier ce que l'outil affirme.

**Besoins**

| # | Besoin | Traduction produit |
|---|---|---|
| S1 | Aller vite | Analyse en un import, résultat structuré |
| S2 | Vérifier les affirmations | Extrait source visible pour chaque information |
| S3 | Corriger ce qui est faux | Édition manuelle de toute donnée extraite |
| S4 | Distinguer le fiable du douteux | Niveau de confiance affiché |
| S5 | Ne pas être piégée | Aucun envoi automatique, avertissement avant usage du brouillon |

**Citation** : « Je veux bien faire confiance, mais je veux pouvoir vérifier. »

> **Limite MVP à assumer** : Sophie gère les courriers de son père depuis **son propre compte**. Le partage de dossier entre comptes est hors périmètre. À expliciter dans l'UI et dans les CGU.

---

## Anti-persona (hors cible MVP)

- **Le travailleur social professionnel** gérant des dizaines de dossiers pour des tiers : nécessite multi-comptes, délégation, traçabilité renforcée. Roadmap.
- **La personne cherchant un conseil juridique** ou voulant contester une décision : hors positionnement.
- **L'utilisateur non francophone** : MVP français uniquement.

---

## Synthèse des besoins transverses

| Besoin transverse | Persona(s) | Priorité MVP |
|---|---|---|
| Comprendre sans jargon | N, M, S | Must |
| Identifier l'action à faire | N, M, S | Must |
| Voir et retenir l'échéance | N, M | Must |
| Vérifier via un extrait source | S, M | Must |
| Corriger une information erronée | S | Must |
| Checklist de justificatifs | N, M | Must |
| Brouillon de réponse | M, S | Must |
| Rappels e-mail | N, M | Must |
| Vue d'ensemble multi-dossiers | M | Should |
| Historique du dossier | M, S | Should |
| Export PDF du brouillon | M | Could |
| Partage avec un tiers | S | Won't (roadmap) |

---

## Contraintes d'accessibilité issues des personas

Nadia et le père de Sophie imposent un niveau d'exigence supérieur à la moyenne :

- niveau de lecture visé : **A2/B1** pour le résumé simplifié ;
- phrases de 20 mots maximum dans les textes générés ;
- aucune abréviation non explicitée à la première occurrence ;
- taille de police confortable, contrastes AA minimum ;
- navigation clavier complète, focus visible ;
- messages d'erreur formulés en termes d'action ("Le fichier dépasse 10 Mo. Choisissez un fichier plus léger.") et non de code ;
- interface utilisable sur mobile en priorité pour l'import et la consultation.

---

## Questions ouvertes à trancher avec les tests utilisateurs

1. Le niveau de confiance doit-il être affiché en pourcentage, en trois niveaux (élevé/moyen/faible), ou seulement signalé quand il est faible ?
2. Les avertissements répétés ("document fictif", "vérifiez les informations") rassurent-ils ou fatiguent-ils ?
3. Les statuts de dossier (6 valeurs) sont-ils compréhensibles ou faut-il les réduire à 3 ou 4 ?
4. Le brouillon de réponse est-il perçu comme utile ou comme un risque ?
