# DossierClair — Synthèse produit

**Version** : 1.0
**Date** : 21 juillet 2026
**Statut** : cadrage — à valider
**Source** : Plan du projet DossierClair (cahier des charges de référence)

---

## 1. En une phrase

DossierClair transforme un courrier administratif difficile à lire en un dossier clair : ce qu'il faut comprendre, ce qu'il faut faire, ce qu'il faut fournir, et pour quand.

## 2. Le problème

Un courrier de la CAF, de la CPAM ou de France Travail cumule souvent plusieurs difficultés :

- vocabulaire administratif et sigles non expliqués ;
- plusieurs demandes mélangées dans un même paragraphe ;
- justificatifs listés de façon dispersée ;
- échéance noyée dans le texte ou exprimée indirectement ("dans un délai d'un mois à compter de la réception") ;
- conséquences formulées de manière allusive ("à défaut, votre dossier pourra être suspendu").

Résultat : la personne comprend qu'il y a un problème sans identifier l'action précise, ni la date limite. Elle reporte, puis oublie.

**Question produit** : comment transformer un courrier administratif complexe en un dossier compréhensible, vérifiable et directement exploitable par un particulier ?

## 3. Ce que le produit n'est pas

- Ce n'est **pas un conseiller juridique**. Aucune interprétation de droit, aucun conseil de recours.
- Ce n'est **pas une garantie d'exactitude**. L'analyse est générée automatiquement et doit être vérifiée.
- Ce n'est **pas un canal de transmission**. L'application n'envoie rien à une administration.
- Dans le MVP, ce n'est **pas un outil pour vrais courriers** : uniquement des documents fictifs de démonstration.

Ce positionnement est une contrainte de conception, pas un avertissement décoratif : il détermine l'UI (avertissements, extraits sources, corrections manuelles) et l'architecture (consentement, journalisation, suppression).

## 4. Proposition de valeur

| Sans DossierClair | Avec DossierClair |
|---|---|
| Un mur de texte | Un résumé en français simple |
| "Il faut faire quelque chose" | Une liste d'actions cochables |
| Justificatifs éparpillés | Une checklist unique |
| Date limite invisible | Une échéance mise en avant + rappels |
| Répondre = page blanche | Un brouillon modifiable |
| Aucune trace | Un dossier avec statut et historique |

**Différenciateur assumé** : la vérifiabilité. Chaque information importante est reliée à un extrait du courrier et corrigeable par l'utilisateur. Le produit ne cherche pas à avoir toujours raison, il cherche à être contrôlable.

## 5. Utilisateurs cibles (MVP)

1. Personne peu à l'aise avec les démarches administratives.
2. Personne en difficulté face au langage administratif (dont non-francophones de naissance, dyslexie, faible littératie).
3. Personne organisée mais surchargée, qui oublie les échéances.
4. Proche aidant qui accompagne quelqu'un dans ses démarches.

Détail dans `01-cadrage/02-personas-besoins.md`.

## 6. Périmètre fonctionnel MVP

**Inclus**

- Compte utilisateur (inscription, connexion, réinitialisation de mot de passe).
- Import d'un PDF/PNG/JPEG fictif, aperçu, extraction du texte.
- Consentement explicite avant tout envoi à l'API d'IA.
- Analyse : organisme, type de courrier, résumé simple, actions, justificatifs, échéances, montants, références, extraits sources, niveau de confiance.
- Brouillon de réponse généré, modifiable, copiable et exportable.
- Dossier avec statut, progression, historique, corrections manuelles.
- Rappels internes et par e-mail (J-7, J-3, J-0), désactivables.
- Tableau de bord de suivi.

**Exclus explicitement du MVP** (conservés en roadmap)

Connexion aux comptes réels CAF/CPAM/France Travail, récupération automatique de courriers, envoi automatique aux administrations, vrais documents, application mobile native, SMS, analyse juridique, recours, multilingue, partage avec travailleurs sociaux, signature électronique, couverture de tous les organismes français.

## 7. Corpus documentaire

15 courriers fictifs (5 par organisme : CAF, CPAM, France Travail), portant la mention visible **« Document fictif créé à des fins de démonstration »**, accompagnés d'un jeu de données de référence (attentes d'analyse) servant à mesurer la qualité.

## 8. Architecture retenue (rappel)

Monolithe modulaire Next.js (App Router, TypeScript) + worker asynchrone.
PostgreSQL/Prisma, Redis (file de tâches), Auth.js, Zod, Tailwind + shadcn/ui, API d'IA externe, SMTP, Docker Compose, reverse proxy HTTPS, déploiement VPS Linux.

Détail à produire dans `03-architecture/`.

## 9. Principes directeurs (non négociables)

1. **Vérifiabilité avant exhaustivité** — mieux vaut 5 informations sourcées que 15 approximatives.
2. **L'utilisateur a le dernier mot** — toute donnée extraite est corrigeable, et la correction prime.
3. **Incertitude visible** — un champ peu fiable est affiché comme tel, jamais masqué.
4. **Une action principale par écran** — la charge cognitive est le premier ennemi.
5. **Rien ne part sans consentement** — le consentement est enregistré, versionné, horodaté.
6. **Aucun contenu de document dans les logs.**
7. **Réalisme de sécurité malgré le caractère fictif** — les bonnes pratiques sont démontrables en portfolio.

## 10. Objectifs et indicateurs de succès

| Objectif | Indicateur | Cible MVP |
|---|---|---|
| Compréhension | Participants identifiant l'action principale sans aide | ≥ 80 % |
| Repérage d'échéance | Participants trouvant la date limite sans aide | ≥ 80 % |
| Utilité perçue | Note moyenne sur 5 | ≥ 4,0 |
| Fiabilité d'extraction | Échéances correctes sur le dataset de référence | ≥ 90 % |
| Fiabilité d'organisme | Organisme correctement détecté | ≥ 95 % |
| Robustesse | Réponses IA invalides enregistrées en base | 0 |
| Parcours | Erreurs bloquantes sur le parcours principal | 0 |
| Rappels | Doublons de rappel pour une même échéance | 0 |
| Étanchéité | Accès à un dossier d'un autre compte | 0 |

## 11. Triple objectif du projet

1. **Démonstration portfolio** aboutie (README, captures, vidéo 2–4 min, argumentaire technique).
2. **MVP testable** par 5 utilisateurs réels sur documents fictifs.
3. **Base technique propre** permettant d'évoluer vers de vrais documents sans réécriture.

Ces trois objectifs sont classés par ordre de priorité en cas d'arbitrage : la démonstration prime sur l'exhaustivité fonctionnelle.

## 12. Risques principaux

| Risque | Impact | Mitigation |
|---|---|---|
| Hallucinations de l'IA (dates, montants) | Élevé | Schéma Zod strict, règles déterministes sur dates/montants, extraits sources obligatoires, correction manuelle |
| Charge des semaines 6–7 (worker + e-mails + CI/CD + déploiement) | Élevé | Voir `03-incoherences-et-arbitrages.md` — déploiement à anticiper en semaine 1 |
| Qualité OCR sur images | Moyen | Message d'erreur explicite, corpus fictif généré en PDF texte natif prioritairement |
| Coût/latence API IA | Moyen | Température faible, prompts courts par organisme, cache sur relance identique |
| Périmètre trop large pour un développeur seul | Élevé | Backlog MoSCoW strict, "Could" sacrifiables sans négocier |

## 13. Prochaines étapes

1. Valider les décisions listées en fin de `03-incoherences-et-arbitrages.md`.
2. Produire l'architecture détaillée (`03-architecture/`).
3. Rédiger les 15 courriers fictifs et le dataset de référence (`05-courriers-fictifs/`).
4. Wireframes des 10 écrans principaux (`04-maquettes/`).
