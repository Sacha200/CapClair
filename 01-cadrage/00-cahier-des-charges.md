# Cahier des Charges — CapClair

**Version** : 2.0 — révisée le 9 septembre 2026 (v1.0 du 2 septembre 2026, source Notion)
**Statut** : document de référence, aligné sur l'implémentation réelle (E1 à E4 livrés)
**Périmètre de la révision** : nommage (DossierClair → CapClair) et section 7 (architecture technique), pour refléter les ADR actées pendant le développement (`07-developpement/decisions.md`). Le reste du contenu (genèse, marché, user stories, exigences, WBS, roadmap, risques, glossaire) est fidèle à la version Notion d'origine.

---

## Table des matières

1. Genèse du projet
2. Étude de marché
3. Proposition de valeur
4. User Stories
5. Exigences fonctionnelles
6. Exigences non-fonctionnelles
7. Architecture technique
8. WBS détaillé
9. Tickets de développement
10. Roadmap
11. Analyse des risques
12. Glossaire

---

## 1. Genèse du projet

### 1.1 Contexte

En France, des millions de personnes reçoivent chaque année des courriers de la CAF, de la CPAM ou de France Travail. Ces courriers déterminent l'accès à des droits (allocations, remboursements, indemnités) mais restent difficiles à comprendre : vocabulaire administratif, sigles non explicités, demandes multiples imbriquées, justificatifs dispersés, échéances noyées dans le texte ou exprimées indirectement (« dans un délai d'un mois à compter de la réception »).

La conséquence est concrète : la personne comprend qu'un problème existe sans identifier l'action précise ni la date limite. Elle reporte, puis oublie — et perd parfois un droit pour une raison de forme.

Les dispositifs publics existants (France Services, Aidants Connect) reposent sur un accompagnement humain, en présentiel, avec des délais de rendez-vous. Ils ne répondent pas au besoin d'une aide immédiate, à domicile, à toute heure.

### 1.2 Problématique

**Comment transformer un courrier administratif complexe en un dossier compréhensible, vérifiable et directement exploitable par un particulier ?**

CapClair n'est ni un conseiller juridique, ni un canal de transmission vers les administrations. C'est une aide à la compréhension et à l'organisation.

### 1.3 Objectifs du projet


| #  | Objectif                                      | Indicateur de succès                                                                     | Priorité |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------- |
| O1 | Expliquer un courrier en français simple     | ≥ 80 % des testeurs identifient l'action principale sans aide                            | P0        |
| O2 | Rendre l'analyse vérifiable                  | Chaque information importante est reliée à un extrait du courrier                       | P0        |
| O3 | Détecter et rappeler les échéances         | ≥ 80 % des testeurs trouvent la date limite sans aide ; rappels J-7/J-3/J-0 sans doublon | P0        |
| O4 | Générer un brouillon de réponse modifiable | Un brouillon est produit et éditable, sans aucune affirmation absente du dossier         | P1        |
| O5 | Garantir la fiabilité de l'IA                | 0 réponse IA invalide enregistrée en base ; organisme détecté ≥ 95 %                 | P0        |
| O6 | Démontrer une base technique propre          | Projet fonctionnel via Docker Compose, en ligne en HTTPS, tests en CI                     | P1        |

### 1.4 Nature du projet

CapClair est un **projet portfolio** réalisé par un développeur seul. Le MVP fonctionne exclusivement sur des **courriers fictifs** portant la mention « Document fictif créé à des fins de démonstration », ce qui écarte tout risque juridique et de données personnelles réelles tout en permettant une démonstration crédible.

---

## 2. Étude de marché

### 2.1 Contexte concurrentiel

Le besoin est réel et déjà adressé, de deux manières : par des **dispositifs publics d'accompagnement humain** et par des **applications privées d'IA**. Un concurrent direct, SOS Papier, occupe précisément le créneau visé par CapClair.

### 2.2 Benchmark concurrentiel


| Critère                           | France Services | Aidants Connect | SOS Papier      | Mesdroitssociaux | **CapClair** |
| ------------------------------------ | ----------------- | ----------------- | ----------------- | ------------------ | -------------- |
| Explication de courrier par IA     | ❌              | ❌              | ✅              | ❌               | ✅           |
| Extraits sources vérifiables      | ⚠️ (humain)   | ⚠️ (humain)   | ❌              | ❌               | ✅           |
| Correction manuelle des données   | ❌              | ❌              | ❌              | ❌               | ✅           |
| Niveau de confiance affiché       | ❌              | ❌              | ❌              | ❌               | ✅           |
| Détection d'échéances + rappels | ❌              | ❌              | ✅              | ❌               | ✅           |
| Brouillon de réponse              | ⚠️ (humain)   | ❌              | ✅              | ❌               | ✅           |
| Disponibilité 24/7 à domicile    | ❌              | ❌              | ✅              | ✅               | ✅           |
| Gratuité                          | ✅              | ✅              | ⚠️ (freemium) | ✅               | ✅ (MVP)     |

✅ = complet · ⚠️ = partiel ou humain · ❌ = absent

### 2.3 Analyse

**Dispositifs publics (France Services, Aidants Connect)** : fiables et gratuits, mais reposent sur un rendez-vous humain en présentiel. Aidants Connect est de plus réservé aux aidants professionnels (les proches aidants en sont exclus). Ils ne couvrent pas le besoin d'aide immédiate et autonome.

**SOS Papier** : concurrent direct le plus proche. Scan de courrier, explication par IA (Mistral AI), génération de réponse, calendrier et rappels, sur CAF/CPAM/France Travail/URSSAF/impôts. Modèle freemium (4,99 € / 9,99 € par mois). Anonymise les données avant analyse. **C'est la preuve que le besoin est validé par le marché.**

### 2.4 Différenciateur de CapClair

CapClair ne cherche pas à concurrencer un produit commercial déjà lancé, mais à démontrer une approche techniquement plus rigoureuse sur le point faible de tous les acteurs IA : **la confiance**.


| Axe                                  | Position de CapClair                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vérifiabilité**                  | Chaque information affichée est reliée à un extrait littéral du courrier, vérifié comme sous-chaîne du texte. Aucun concurrent IA ne le fait. |
| **Contrôle utilisateur**            | Toute donnée extraite est corrigeable ; la correction prime sur l'IA et n'est jamais écrasée.                                                     |
| **Honnêteté sur l'incertitude**    | Un niveau de confiance faible est signalé explicitement plutôt que masqué.                                                                        |
| **Anti-hallucination déterministe** | Les dates et montants ne sont jamais calculés par l'IA : elle repère le passage, le serveur calcule.                                               |
| **Périmètre fictif assumé**       | Choix de conception qui élimine le risque données personnelles et permet un dataset de référence mesurable.                                      |

> Le produit ne cherche pas à avoir toujours raison, il cherche à être **contrôlable**. C'est la thèse défendable en soutenance.

### 2.5 Cible utilisateur


| Segment                                      | Description                                                      | Besoin principal                       |
| ---------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------- |
| Personnes peu à l'aise avec l'administratif | Faible littératie administrative, non-francophones de naissance | Comprendre sans jargon                 |
| Personnes surchargées                       | Plusieurs démarches en parallèle                               | Ne pas oublier une échéance          |
| Proches aidants                              | Accompagnent un tiers depuis leur propre compte                  | Vérifier avant d'agir au nom d'autrui |

---

## 3. Proposition de valeur

> **CapClair transforme un courrier administratif difficile à lire en un dossier clair : ce qu'il faut comprendre, ce qu'il faut faire, ce qu'il faut fournir, et pour quand — avec, pour chaque information, le passage du courrier qui la justifie.**

### 3.1 Différenciateurs clés


| Différenciateur         | Description                                                   |
| -------------------------- | --------------------------------------------------------------- |
| Vérifiabilité          | Chaque information reliée à un extrait du courrier          |
| Contrôle                | Toute donnée corrigeable, la correction prime                |
| Incertitude visible      | Le niveau de confiance faible est signalé, pas masqué       |
| Fiabilité déterministe | Dates et montants calculés côté serveur, jamais par l'IA   |
| Suivi complet            | Statut, progression, historique, rappels jusqu'à la clôture |

### 3.2 Avant / Après


| Sans CapClair                     | Avec CapClair                          |
| ----------------------------------- | ---------------------------------------- |
| Un mur de texte                   | Un résumé en français simple        |
| « Il faut faire quelque chose » | Une liste d'actions cochables          |
| Justificatifs éparpillés        | Une checklist unique                   |
| Date limite invisible             | Une échéance mise en avant + rappels |
| Répondre = page blanche          | Un brouillon modifiable                |
| Aucune trace                      | Un dossier avec statut et historique   |

---

## 4. User Stories

Les user stories complètes (49 stories, 10 epics, critères d'acceptation mesurables) sont maintenues dans `02-user-stories/01-epics-et-user-stories.md`. Numérotation `US-<epic>.<n>`, priorisation MoSCoW. Synthèse ci-dessous.


| Epic | Intitulé                     | Stories | Points |
| ------ | ------------------------------- | --------- | -------- |
| E1   | Authentification et compte    | 5       | 21     |
| E2   | Import et lecture du document | 6       | 26     |
| E3   | Consentement et appel à l'IA | 6       | 34     |
| E4   | Consultation et vérification | 5       | 26     |
| E5   | Pilotage du dossier           | 5       | 24     |
| E6   | Brouillon de réponse         | 4       | 16     |
| E7   | Rappels et notifications      | 5       | 24     |
| E8   | Sécurité et conformité     | 5       | 16     |
| E9   | Qualité et tests             | 4       | 18     |
| E10  | Déploiement et exploitation  | 4       | 21     |

### 4.1 Epic E1 — Authentification (exemples)

**US-1.1 — Inscription (M)** — En tant que visiteur, je veux créer un compte avec nom, e-mail et mot de passe, afin d'accéder à mon espace personnel.

- Deux cases obligatoires (CGU, politique de confidentialité) ; compte non créé si l'une manque.
- Mot de passe < 12 caractères refusé avec message explicite.
- E-mail déjà utilisé : même message et même délai qu'un e-mail libre (anti-énumération).
- Mot de passe stocké haché (argon2id ou bcrypt coût ≥ 12).
- Acceptation CGU enregistrée dans `ConsentLog` avec version et horodatage.

**US-1.5 — Isolation stricte des données (M)** — En tant qu'utilisateur, je veux qu'aucun autre compte ne puisse voir mes dossiers.

- Filtrage sur `userId` au niveau de la couche d'accès, pas seulement dans l'UI.
- Accès à un dossier d'autrui renvoie 404 (pas 403).
- Test d'intégration sur les 6 entités liées, bloquant en CI.

### 4.2 Epic E3 — Analyse IA (exemple structurant)

**US-3.2 — Schéma de sortie IA strict (M)** — En tant que développeur, je veux que la réponse de l'IA respecte un schéma validé, afin de ne jamais enregistrer de donnée malformée.

- Schéma Zod sur les 13 champs (organisme, type, date, références, montants, résumé, actions, justificatifs, échéances, brouillon, extraits, avertissements, confiance).
- Réponse invalide jamais persistée ; relance limitée à 2 tentatives.
- Chaque action/justificatif/échéance porte un `sourceExcerpt` non vide.
- Taux d'échec de validation : 0 sur 3 exécutions consécutives du corpus.

**US-3.6 — Extraction des échéances (M)** — En tant qu'utilisateur, je veux voir clairement la date limite.

- Dates explicites extraites à 100 % sur le corpus.
- Délais relatifs calculés par **règle déterministe côté serveur**, pas par l'IA.
- Date calculée signalée comme telle ; aucune date antérieure au courrier acceptée.

---

## 5. Exigences fonctionnelles

Chaque exigence est tracée vers la ou les user stories qui la portent.

### 5.1 Module Authentification (AUTH)


| ID        | Exigence                                                                                              | US liées | Priorité |
| ----------- | ------------------------------------------------------------------------------------------------------- | ----------- | ----------- |
| F-AUTH-01 | Le système doit permettre l'inscription par e-mail avec validation et double consentement            | US-1.1    | P0        |
| F-AUTH-02 | Le système doit gérer connexion, déconnexion et invalidation de session côté serveur             | US-1.2    | P0        |
| F-AUTH-03 | Le système doit fournir une réinitialisation de mot de passe par e-mail à jeton unique (60 min)    | US-1.3    | P1        |
| F-AUTH-04 | Le système doit protéger toutes les routes privées et renvoyer 401 sur les routes API sans session | US-1.4    | P0        |
| F-AUTH-05 | Le système doit isoler les dossiers par`userId` au niveau de la couche de données                   | US-1.5    | P0        |

### 5.2 Module Import et lecture (DOC)


| ID       | Exigence                                                                               | US liées | Priorité |
| ---------- | ---------------------------------------------------------------------------------------- | ----------- | ----------- |
| F-DOC-01 | Le système doit accepter PDF/PNG/JPEG, validés par signature de fichier, ≤ 10 Mo    | US-2.1    | P0        |
| F-DOC-02 | Le système doit afficher un aperçu du document via une route authentifiée           | US-2.2    | P0        |
| F-DOC-03 | Le système doit exiger la confirmation du caractère fictif avant analyse             | US-2.3    | P0        |
| F-DOC-04 | Le système doit extraire le texte d'un PDF et l'enregistrer                           | US-2.4    | P0        |
| F-DOC-05 | Le système doit gérer les documents illisibles sans appeler l'IA (< 100 caractères) | US-2.6    | P0        |
| F-DOC-06 | Le système doit permettre la suppression définitive d'un dossier et de ses fichiers  | US-5.5    | P0        |

### 5.3 Module Analyse IA (AI)


| ID      | Exigence                                                                                | US liées | Priorité |
| --------- | ----------------------------------------------------------------------------------------- | ----------- | ----------- |
| F-AI-01 | Le système doit recueillir un consentement explicite avant tout appel externe          | US-3.1    | P0        |
| F-AI-02 | Le système doit valider la sortie IA par un schéma Zod strict, sinon relancer (max 2) | US-3.2    | P0        |
| F-AI-03 | Le système doit détecter l'organisme via un prompt spécialisé par organisme         | US-3.3    | P0        |
| F-AI-04 | Le système doit produire un résumé en français simple (phrases ≤ 25 mots)          | US-3.4    | P0        |
| F-AI-05 | Le système doit extraire actions et justificatifs, chacun relié à un extrait         | US-3.5    | P0        |
| F-AI-06 | Le système doit calculer les échéances côté serveur, jamais par l'IA               | US-3.6    | P0        |

### 5.4 Module Vérification (VER)


| ID       | Exigence                                                                                   | US liées | Priorité |
| ---------- | -------------------------------------------------------------------------------------------- | ----------- | ----------- |
| F-VER-01 | Le système doit afficher le résultat sur un écran unique, échéance en tête           | US-4.1    | P0        |
| F-VER-02 | Le système doit afficher un extrait source vérifié pour chaque information              | US-4.2    | P0        |
| F-VER-03 | Le système doit afficher un niveau de confiance en 3 niveaux, jamais par la couleur seule | US-4.3    | P1        |
| F-VER-04 | Le système doit permettre la correction manuelle de toute information extraite            | US-4.4    | P0        |

### 5.5 Module Pilotage (CASE)


| ID        | Exigence                                                                                              | US liées | Priorité |
| ----------- | ------------------------------------------------------------------------------------------------------- | ----------- | ----------- |
| F-CASE-01 | Le système doit gérer 6 statuts de dossier et journaliser les changements                           | US-5.1    | P0        |
| F-CASE-02 | Le système doit permettre de cocher, modifier, ajouter, supprimer une action                         | US-5.2    | P0        |
| F-CASE-03 | Le système doit gérer une checklist de justificatifs avec notes                                     | US-5.3    | P1        |
| F-CASE-04 | Le système doit fournir un tableau de bord (dossiers actifs, échéances proches, actions restantes) | US-5.4    | P0        |

### 5.6 Module Brouillon (DRAFT)


| ID         | Exigence                                                                               | US liées | Priorité |
| ------------ | ---------------------------------------------------------------------------------------- | ----------- | ----------- |
| F-DRAFT-01 | Le système doit générer un brouillon sans aucune affirmation absente du dossier     | US-6.1    | P1        |
| F-DRAFT-02 | Le système doit permettre l'édition avec sauvegarde automatique                      | US-6.2    | P1        |
| F-DRAFT-03 | Le système doit permettre copie presse-papiers et export texte/PDF avec avertissement | US-6.3    | P1        |
| F-DRAFT-04 | Le système ne doit jamais transmettre le courrier à une administration               | US-6.4    | P0        |

### 5.7 Module Rappels (REM)


| ID       | Exigence                                                                                    | US liées | Priorité |
| ---------- | --------------------------------------------------------------------------------------------- | ----------- | ----------- |
| F-REM-01 | Le système doit programmer des rappels J-7/J-3/J-0 à l'enregistrement d'une échéance    | US-7.1    | P0        |
| F-REM-02 | Le système doit envoyer les rappels via un worker asynchrone avec reprise sur incident     | US-7.2    | P0        |
| F-REM-03 | Le système doit garantir l'absence de doublon (contrainte d'unicité + test concurrentiel) | US-7.3    | P0        |
| F-REM-04 | Le système doit créer des notifications internes avec compteur de non-lus                 | US-7.4    | P1        |
| F-REM-05 | Le système doit permettre la désactivation globale des rappels e-mail                     | US-7.5    | P1        |

---

## 6. Exigences non-fonctionnelles


| ID    | Catégorie       | Exigence                                                           | Métrique                   | Priorité |
| ------- | ------------------ | -------------------------------------------------------------------- | ----------------------------- | ----------- |
| NF-01 | Performance      | Temps de réponse API (hors analyse IA)                            | p95 < 300 ms                | P1        |
| NF-02 | Performance      | Chargement du tableau de bord (20 dossiers)                        | < 1,5 s                     | P1        |
| NF-03 | Performance      | Latence d'analyse IA de bout en bout                               | < 30 s                      | P1        |
| NF-04 | Fiabilité IA    | Réponses IA invalides persistées                                 | 0                           | P0        |
| NF-05 | Fiabilité IA    | Détection d'organisme sur le corpus                               | ≥ 95 %                     | P0        |
| NF-06 | Sécurité       | Mots de passe hachés (argon2id/bcrypt ≥ 12)                      | 100 %                       | P0        |
| NF-07 | Sécurité       | Cookies de session httpOnly, secure, sameSite                      | 100 %                       | P0        |
| NF-08 | Sécurité       | Validation des entrées par schémas Zod sur chaque endpoint       | 100 %                       | P0        |
| NF-09 | Sécurité       | Limitation de débit sur auth, import, analyse                     | active                      | P0        |
| NF-10 | Confidentialité | Aucun contenu de document dans les logs                            | vérifié par test          | P0        |
| NF-11 | Confidentialité | Conformité RGPD, consentement versionné, suppression définitive | conforme                    | P0        |
| NF-12 | Étanchéité    | Accès à un dossier d'un autre compte                             | 0 (404)                     | P0        |
| NF-13 | Accessibilité   | Score Lighthouse Accessibilité / audit axe-core                   | > 90 / 0 violation critique | P1        |
| NF-14 | Accessibilité   | Parcours principal réalisable au clavier seul                     | oui                         | P0        |
| NF-15 | Compatibilité   | Responsive mobile (375px+), tablette, desktop                      | oui                         | P1        |
| NF-16 | Maintenabilité  | Couverture de tests (server/features)                              | ≥ 70 %                     | P0        |
| NF-17 | Disponibilité   | Application en ligne HTTPS, health check                           | actif                       | P1        |

---

## 7. Architecture technique

> ✅ Décisions techniques tranchées. Version complète : `03-architecture/01-architecture-technique.md` (voir sa note « Révision v1.1 (implémentation) » en tête de fichier). Journal détaillé des arbitrages techniques pris pendant le développement : `07-developpement/decisions.md` (ADR-001 à ADR-016).

### 7.1 Principe directeur

L'architecture sert un seul objectif produit : **produire une analyse vérifiable**. La règle qui structure tout : l'IA propose du texte, le serveur décide de ce qui est enregistré, l'utilisateur a le dernier mot. Trois barrières séparent la sortie IA de la base : validation de schéma (rien de malformé n'entre), règles déterministes (dates et montants jamais calculés par l'IA), correction manuelle (l'utilisateur écrase toute valeur).

### 7.1bis Approche retenue

> **Révision d'implémentation (sprint 1, ADR-001).** Le plan initial prévoyait un monolithe Next.js unique (routes API + Server Actions + worker, un seul process). Le développement a finalement scindé le code en **deux applications séparées** : `front/` (Next.js App Router, UI seule, aucune route API ni Server Action) et `back/` (API **Fastify** + worker **BullMQ**, même base de code), reliées par un contrat d'API HTTP explicite (paquet interne Zod `@capclair/contract`, ADR-003). L'esprit « monolithe modulaire, pas de microservices » est conservé — un seul dépôt, une base de code partagée, aucun service métier isolé — mais l'exécution est scindée en deux processus plutôt qu'un seul.

**Monolithe modulaire + worker asynchrone dédié.** Choix délibérément opposé aux microservices, adapté à un développeur seul et à ce volume. `back` et `worker` partagent le code mais tournent en deux processus, communiquant uniquement par PostgreSQL et Redis — jamais par appel direct.

### 7.2 Stack


| Couche           | Technologie                                                | Rôle                                                                                                                                     |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend         | Next.js (App Router), TypeScript                           | Interface uniquement — aucune route API ni Server Action                                                                                 |
| Backend / API    | Fastify 5, TypeScript                                      | API HTTP + worker BullMQ (même base de code, process séparé)                                                                           |
| Contrat API      | Paquet interne Zod`@capclair/contract`                     | Schémas partagés front/back — un seul schéma sert de validateur serveur (Fastify) et de resolver de formulaire (front)                |
| Authentification | Sessions opaques maison (argon2id, cookie httpOnly/secure) | Sessions, e-mail/mot de passe — Auth.js écarté (back Fastify distinct du front Next.js, ADR-002)                                       |
| Validation       | Zod                                                        | Schémas d'entrée et sortie IA                                                                                                           |
| Base de données | PostgreSQL + Prisma                                        | Persistance relationnelle                                                                                                                 |
| File de tâches  | Redis                                                      | Coordination du worker de rappels                                                                                                         |
| Worker           | Process Node dédié (`back`)                              | Rappels, analyses asynchrones, purge                                                                                                      |
| IA               | API externe                                                | Analyse des courriers                                                                                                                     |
| E-mail           | SMTP / API transactionnelle                                | Rappels et réinitialisation                                                                                                              |
| UI               | Tailwind CSS v4, composants accessibles écrits à la main | shadcn/ui écarté à l'amorçage (compatibilité incertaine avec Tailwind v4 + React 19 + Next 16, ADR-008) ; réintroductible si besoin |
| Infra            | Docker Compose, reverse proxy HTTPS (Caddy)                | Déploiement VPS Linux                                                                                                                    |

### 7.3 Conteneurs

`front` (Next.js, UI), `back` (API Fastify), `worker` (tâches asynchrones, même base de code que `back`), `postgres`, `redis`, `reverse-proxy` (Caddy, HTTPS automatique). Volumes persistants pour PostgreSQL et les fichiers importés.

### 7.4 Décisions techniques tranchées

**D7 — Dates et montants calculés par le serveur, jamais par l'IA.** L'IA renvoie le passage textuel (`sourceExcerpt`), le serveur en extrait la valeur par règles déterministes. Une date jamais générée par l'IA est une date jamais hallucinée (mitigation R1). Toute échéance antérieure à la date du courrier est rejetée.

**D8 — Analyse asynchrone dès le départ.** Tâche BullMQ avec états EN_ATTENTE / EN_COURS / TERMINEE / ECHEC, écran d'attente et bouton « Relancer ». L'API IA peut être lente ou indisponible ; l'async est gratuit puisque le worker existe déjà. La tâche est idempotente et **préserve les corrections manuelles**.

**D11 — Redis conservé, assumé comme choix de démonstration.** PostgreSQL suffirait au volume ; BullMQ apporte retries, backoff et planification — compétences défendables en soutenance. Sert aussi de cache d'analyses identiques (économie d'appels IA).

**D14 — `ExtractedInformation.category` en ensemble fermé, pas en champ libre.** Un champ libre rendrait impossible tout affichage cohérent et toute mesure de qualité. *Implémentation (écart avec le plan initial qui prévoyait un enum Prisma) : table référentielle `Category` seedée (`code` unique = l'ensemble fermé stable, migration de données dédiée) plutôt qu'un `enum`, pour porter des métadonnées d'affichage (libellé, icône, couleur, ordre) enrichissables sans casser le code métier. `ExtractedInformation.categoryId` référence `Category.id`.*

> Décisions d'implémentation complémentaires (non présentes dans le plan initial, actées pendant les sprints 1-4) : ADR-001 (scission front/back), ADR-002 (auth maison), ADR-003 (contrat Zod interne), ADR-005 (partage du cookie de session sur une origine publique unique), ADR-008 (Fastify, pas de shadcn/ui), ADR-011 à ADR-016 (import, stockage, extraction PDF). Détail complet dans `07-developpement/decisions.md`.

### 7.5 Flux d'analyse (asynchrone)

Import → validation signature/taille → extraction texte (arrêt si < 100 caractères, **aucun appel IA**) → consentement enregistré → **tâche mise en file** → *[worker]* appel API IA (ou cache) → validation Zod (relance max 2, sinon ECHEC) → **calcul déterministe dates/montants** → contrôle de cohérence → persistance (préserve les corrections) → programmation des rappels → écran de résultat.

### 7.6 Flux de rappel

Worker planifié → sélectionne les rappels PENDING échus → ignore les dossiers « Terminé » → vérifie les préférences → envoie (SENT) ou échoue (FAILED, backoff, max 3). Anti-doublon garanti par une contrainte d'unicité en base (`caseFileId` + `reminderType` + `channel`) et l'atomicité du passage PENDING→SENT.

### 7.7 Modèle de données

11 entités (clés UUID) : User, CaseFile, Document, ExtractedInformation, ActionItem, RequiredDocument, ResponseDraft, Reminder, Notification, ConsentLog, AuditEvent. Toutes les entités liées portent `caseFileId` et sont supprimées en cascade. Contrainte d'unicité anti-doublon sur Reminder. `AuditEvent` ne contient jamais de contenu de document et est écrit dès le début. Détail des champs dans le fichier d'architecture local (`03-architecture/02-schema-base-de-donnees.md`).

### 7.8 Conteneurs et déploiement

`front`, `back`, `worker`, `postgres`, `redis` (file + cache), `reverse-proxy` (Caddy, TLS automatique — préféré à Nginx pour éviter la friction des certificats ; route `/api/*` et `/auth/*` vers `back`, le reste vers `front`, sur une origine publique unique pour partager le cookie de session sans CORS, ADR-005). Fichiers importés hors racine servie par un conteneur, nom UUID généré serveur. Déploiement par script manuel (décision C6), le CD automatique restant en roadmap.

---

## 8. WBS détaillé

Le projet se décompose en 5 branches et 14 lots de travail.


| Branche                                                               | Lots   | Points  | Phase |
| ----------------------------------------------------------------------- | -------- | --------- | ------- |
| WBS-1 — Fondations (init, Docker, CI, déploiement, corpus)          | 3      | 33      | 1     |
| WBS-2 — Compte et sécurité (auth, isolation, rate limiting)        | 2      | 24      | 2     |
| WBS-3 — Document et analyse (import, extraction, IA, restitution)    | 4      | 76      | 2     |
| WBS-4 — Pilotage et communication (dossier, brouillon, rappels)      | 3      | 55      | 3     |
| WBS-5 — Qualité et livraison (tests, tests utilisateurs, portfolio) | 2      | 38      | 3-4   |
| **Total**                                                             | **14** | **226** | —    |

Chaque lot est tracé vers les user stories (section 4) et les tickets (section 9).

---

## 9. Tickets de développement

Le backlog complet en 14 sprints est maintenu dans `02-user-stories/02-backlog-priorise.md`. Résumé par phase :


| Phase                  | Période           | Sprints | Points | Focus                                             |
| ------------------------ | -------------------- | --------- | -------- | --------------------------------------------------- |
| 1 — Amorçage         | 21 juil – 2 août | 2       | 33     | Init, Docker, CI, déploiement HTTPS, corpus      |
| 2 — Août temps plein | 3 – 30 août      | 4       | 100    | Auth, import, analyse IA, restitution vérifiable |
| 3 — Développement    | 31 août – 11 oct | 6       | 77     | Pilotage, brouillon, worker, tests                |
| 4 — Validation        | 12 – 25 oct       | 2       | 16     | Tests utilisateurs, portfolio                     |
| Tampon                 | non affecté       | 1       | 13     | Réserve imprévus                                |

> Note : la colonne « Assigné » du modèle Mozgia (6 personnes) est sans objet ici — projet à développeur unique.

---

## 10. Roadmap

### 10.1 Jalons de validation


| Jalon          | Échéance | Critère de succès                                                 |
| ---------------- | ------------ | --------------------------------------------------------------------- |
| Socle en ligne | 2 août    | Page HTTPS déployée, CI verte, corpus prêt                       |
| MVP Compte     | 9 août    | Auth complète, test d'isolation vert                               |
| MVP Lecture    | 16 août   | 15 courriers extraits à 100 % des données attendues               |
| MVP Analyse    | 23 août   | 0 réponse IA invalide, organisme ≥ 93 %                           |
| MVP Cœur      | 30 août   | Analyse vérifiable avec extraits sources — cœur fonctionnel      |
| MVP Complet    | 11 octobre | Toutes les fonctionnalités P0/P1, worker sans doublon, tests en CI |
| Release        | 25 octobre | Tests utilisateurs documentés, portfolio prêt                     |

### 10.2 Roadmap post-MVP

OCR image, graphique de répartition par organisme, préférences de rappel par dossier, déploiement continu automatique, écran d'historique enrichi, puis (long terme) vrais documents, multilingue, partage entre comptes.

> Note : l'écran d'historique (US-4.5) a en réalité été livré dès l'epic E4 (PR-D), en avance sur cette roadmap post-MVP — voir `07-developpement/plans/E4-consultation-et-verification-du-dossier.md`.

---

## 11. Analyse des risques


| #  | Risque                                           | Probabilité | Impact  | Mitigation                                                                                           | Plan B                                                           |
| ---- | -------------------------------------------------- | -------------- | --------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| R1 | Hallucinations IA (dates, montants faux)         | Élevée     | Élevé | Schéma Zod strict, calcul déterministe serveur, extraits sources obligatoires, correction manuelle | Réduire le périmètre d'extraction aux champs les plus fiables |
| R2 | Charge sous-estimée (dev seul, 226 pts)         | Élevée     | Élevé | Coupe MoSCoW (−26 pts), mois d'août à temps plein, semaine tampon                                 | Reporter les P1 en roadmap, réduire à un organisme             |
| R3 | Déploiement VPS bloquant (1re expérience)      | Moyenne      | Élevé | Déploiement anticipé en sprint 2, script manuel plutôt que CD                                     | Hébergement PaaS de secours                                     |
| R4 | Qualité d'extraction PDF insuffisante           | Moyenne      | Moyen   | Corpus généré en PDF texte natif, dataset de référence mesuré                                  | Améliorer les prompts, revoir le format du corpus               |
| R5 | Coût/latence de l'API IA                        | Moyenne      | Moyen   | Température faible, prompts courts, cache sur relance, plafond 10 analyses/jour/utilisateur         | Modèle alternatif moins cher                                    |
| R6 | Disponibilité personnelle réduite (alternance) | Moyenne      | Moyen   | Vélocité calibrée à 13 pts hors août, réévaluation au sprint 8                                | Consommer la semaine tampon, décaler la fin                     |
| R7 | Concurrent établi (SOS Papier)                  | Faible       | Faible  | Positionnement portfolio, différenciateur vérifiabilité assumé                                   | N/A (projet non commercial)                                      |
| R8 | Statuts de dossier mal compris                   | Faible       | Moyen   | Test utilisateur dédié ; réduction de 6 à 4 statuts si < 4/5 réussissent                        | Simplifier le vocabulaire                                        |

### Matrice Probabilité × Impact


|              | Faible | Moyen      | Élevé |
| -------------- | -------- | ------------ | --------- |
| **Élevée** |        |            | R1, R2  |
| **Moyenne**  |        | R4, R5, R8 | R3, R6  |
| **Faible**   | R7     |            |         |

Risques critiques surveillés à chaque fin de sprint : **R1, R2, R3**.

---

## 12. Glossaire


| Terme                  | Définition                                                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@capclair/contract`   | Paquet interne (workspace npm) de schémas Zod partagés entre`front/` et `back/` — requêtes, réponses, sortie IA (ADR-003).                                                                                                                |
| Auth.js                | Librairie d'authentification pour Next.js (sessions, OAuth, e-mail/mot de passe).**Évaluée puis écartée** (ADR-002) : le back est un service Fastify séparé du front Next.js, incompatible avec une librairie pensée pour Next.js seul. |
| CAF                    | Caisse d'Allocations Familiales                                                                                                                                                                                                                |
| CPAM                   | Caisse Primaire d'Assurance Maladie                                                                                                                                                                                                            |
| Consentement           | Accord explicite de l'utilisateur, enregistré et versionné, avant tout envoi à l'IA                                                                                                                                                         |
| Corpus                 | Ensemble des 15 courriers fictifs de démonstration                                                                                                                                                                                            |
| Dataset de référence | Attentes d'analyse par courrier, servant à mesurer la qualité de l'IA                                                                                                                                                                        |
| Docker Compose         | Outil d'orchestration de conteneurs pour l'environnement complet                                                                                                                                                                               |
| Extrait source         | Passage littéral du courrier justifiant une information extraite                                                                                                                                                                              |
| FALC                   | Facile À Lire et à Comprendre — niveau de langue simplifié                                                                                                                                                                                 |
| Fastify                | Framework HTTP Node.js utilisé par`back/` pour l'API et le worker (ADR-001, ADR-008).                                                                                                                                                         |
| France Travail         | Opérateur public de l'emploi (ex-Pôle emploi)                                                                                                                                                                                                |
| Monolithe modulaire    | Architecture applicative unique, organisée en modules métier séparés — ici scindée en deux processus (`front`, `back`) partageant un seul dépôt (voir §7.1bis)                                                                        |
| MoSCoW                 | Priorisation Must / Should / Could / Won't have                                                                                                                                                                                                |
| MVP                    | Minimum Viable Product — produit minimum viable                                                                                                                                                                                               |
| Niveau de confiance    | Indicateur (élevé/moyen/faible) de la fiabilité d'une information extraite                                                                                                                                                                  |
| Next.js                | Framework React avec rendu côté serveur (SSR)                                                                                                                                                                                                |
| OCR                    | Reconnaissance optique de caractères (extraction de texte depuis une image)                                                                                                                                                                   |
| Prisma                 | ORM TypeScript pour PostgreSQL                                                                                                                                                                                                                 |
| Redis                  | Base en mémoire, ici file de tâches du worker                                                                                                                                                                                                |
| RGPD                   | Règlement Général sur la Protection des Données                                                                                                                                                                                            |
| Session opaque         | Jeton aléatoire 256 bits ; seul`sha256(jeton)` est stocké en base (table `Session`). Remplace Auth.js/JWT (ADR-002).                                                                                                                         |
| SP                     | Story Points — unité d'estimation de complexité                                                                                                                                                                                             |
| US                     | User Story — fonctionnalité décrite du point de vue utilisateur                                                                                                                                                                             |
| VPS                    | Virtual Private Server — serveur privé virtuel de déploiement                                                                                                                                                                               |
| WBS                    | Work Breakdown Structure — décomposition en tâches                                                                                                                                                                                          |
| Worker                 | Processus séparé traitant les tâches asynchrones (rappels, analyses, purge), même base de code que`back`                                                                                                                                   |
| Zod                    | Librairie TypeScript de validation de schémas                                                                                                                                                                                                 |

---

**Sources de l'étude de marché** : SOS Papier ([sospapier.com](http://sospapier.com)), France Services ([france-services.gouv.fr](http://france-services.gouv.fr)), Aidants Connect ([aidantsconnect.beta.gouv.fr](http://aidantsconnect.beta.gouv.fr)), Mesdroitssociaux ([mesdroitssociaux.gouv.fr](http://mesdroitssociaux.gouv.fr)).
