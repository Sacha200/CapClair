# CapClair — Incohérences relevées et arbitrages à valider

**Version** : 1.0 — 21 juillet 2026
**Statut** : aucune modification du plan n'a été appliquée. Ce document liste ce qui pose problème et propose une décision. **Rien n'est tranché sans votre accord.**

---

## A. Incohérences de planning

### I-1 — Le déploiement arrive trop tard (critique)

**Constat** : le plan place Docker Compose de production, reverse proxy, HTTPS, CI/CD et déploiement VPS en **semaine 7**, après six semaines de développement.

**Pourquoi c'est un problème** : c'est l'étape qui échoue le plus souvent et le plus longtemps (certificats, variables d'environnement, permissions de volumes, migrations, différences dev/prod). La découvrir en semaine 7 signifie la découvrir sans marge, juste avant les tests utilisateurs qui en dépendent.

**Proposition** : déplacer Docker Compose et la CI en **semaine 1**, sur une application vide. Déployer une page « Hello » en HTTPS dès la première semaine, puis déployer en continu. La semaine 7 ne contient plus alors que la configuration de production et le durcissement.

**Impact** : appliqué dans le backlog (Sprint 1). **À valider.**

---

### I-2 — La capacité est dépassée d'environ 25 %

**Constat** : le périmètre décrit pèse **226 points** de complexité. Huit semaines pour un développeur seul représentent 160 à 208 points selon la disponibilité.

**Pourquoi c'est un problème** : le plan mentionne « une version en six semaines reste possible en regroupant les semaines 1–2 et 7–8 ». Regrouper ne réduit pas la charge, cela la comprime. Les semaines regroupées sont précisément celles qui contiennent le cadrage et les tests — les deux choses qu'on sacrifie en premier et qu'on regrette en dernier.

**Proposition** : coupe de 32 points (voir `../02-user-stories/02-backlog-priorise.md` §2) **et** extension à 10 semaines. La version 6 semaines est à écarter.

**Impact** : décision structurante. **À valider en priorité.**

---

### I-3 — La semaine 8 contient deux projets

**Constat** : la semaine 8 cumule tests utilisateurs (5 participants), corrections, amélioration de l'interface, README, captures, vidéo et présentation.

**Pourquoi c'est un problème** : les tests utilisateurs produisent des corrections. On ne peut pas corriger et documenter la même semaine. La vidéo de démonstration se tourne sur une version stabilisée, pas sur une version en cours de correction.

**Proposition** : semaine 8 = tests utilisateurs + corrections. **Semaine 9 = livrables portfolio**, sans développement.

**À valider.**

---

## B. Incohérences fonctionnelles

### I-4 — L'OCR d'image est sous-estimé

**Constat** : l'import d'images PNG/JPEG est listé comme une fonctionnalité simple, au même niveau que le PDF.

**Pourquoi c'est un problème** : l'OCR sur photo de courrier est un problème à part entière (cadrage, éclairage, plis, ombres). Un OCR médiocre alimente l'IA avec un texte dégradé et produit des extractions fausses — exactement le risque que tout le plan cherche à éviter. Le coût réel n'est pas l'intégration de la librairie, c'est la qualité du résultat.

**Proposition** : MVP **PDF uniquement**. L'import d'image reste techniquement accepté mais aboutit au message « Nous n'avons pas réussi à lire ce document », avec la suggestion d'utiliser un PDF. L'OCR passe en roadmap, présenté comme un choix assumé et non comme un manque.

**À valider.**

---

### I-5 — Six statuts de dossier, c'est probablement trop

**Constat** : À analyser / Action requise / Documents à préparer / Réponse prête / En attente / Terminé.

**Pourquoi c'est un problème** : « Documents à préparer » et « Action requise » se recouvrent (préparer un document *est* une action). « En attente » est ambigu : en attente de qui ? L'utilisateur cible — Nadia — doit comprendre son statut d'un coup d'œil.

**Proposition** : conserver les six pour le MVP, mais **inscrire cette question au protocole de test utilisateur**. Si moins de 4 participants sur 5 classent correctement un dossier, réduire à quatre : À analyser / À faire / En attente de réponse / Terminé.

**À valider** (ou trancher tout de suite pour quatre statuts).

---

### I-6 — Le proche aidant n'a pas de solution

**Constat** : le public cible inclut « les proches qui accompagnent une personne dans ses démarches », mais le partage de dossier entre comptes est explicitement exclu du MVP.

**Pourquoi c'est un problème** : le persona n'a alors aucune fonctionnalité dédiée. Il utilise son propre compte pour gérer les courriers d'un tiers, ce que les CGU doivent autoriser explicitement.

**Proposition** : conserver le persona comme cible d'usage (il gère depuis son compte), l'écrire noir sur blanc dans les CGU, et retirer « partage » du discours produit tant qu'il n'existe pas.

**À valider.**

---

### I-7 — Le niveau de confiance : un chiffre que personne ne sait interpréter

**Constat** : le modèle de données prévoit un `confidenceScore` numérique, affiché à l'utilisateur.

**Pourquoi c'est un problème** : « confiance 0,72 » n'a pas de sens pour un utilisateur. Pire, un score élevé peut donner une fausse assurance sur une information fausse.

**Proposition** : stocker le score numérique (utile pour mesurer), mais **n'afficher que trois niveaux** — et surtout, ne mettre en avant que le niveau faible : « Cette date est à vérifier. » Le silence vaut confiance élevée.

**À valider.**

---

### I-8 — Le brouillon de réponse est le point le plus risqué du produit

**Constat** : l'application génère un courrier que l'utilisateur enverra à une administration.

**Pourquoi c'est un problème** : c'est la seule fonctionnalité dont la sortie quitte l'application pour produire un effet dans le monde réel. Un brouillon qui affirme une chose fausse au nom de l'utilisateur est un risque d'un autre ordre qu'un résumé imprécis.

**Proposition** : trois garde-fous cumulés — (1) le brouillon ne contient **aucune affirmation factuelle** absente du dossier, (2) les zones à compléter sont matérialisées explicitement plutôt que devinées, (3) un avertissement de relecture avant toute copie ou export. Et surveiller la réaction des testeurs : si le brouillon inquiète plus qu'il n'aide, il devient une fonctionnalité secondaire.

**À valider.**

---

## C. Incohérences techniques

### I-9 — Redis pour un seul usage

**Constat** : Redis est prévu comme file de tâches et coordination du worker.

**Pourquoi c'est discutable** : le volume attendu est de quelques rappels par jour. PostgreSQL avec `SELECT ... FOR UPDATE SKIP LOCKED` couvrirait le besoin sans conteneur supplémentaire.

**Contre-argument** : Redis + BullMQ est un choix défendable en portfolio (retries, backoff, tableau de bord des jobs) et démontre une compétence recherchée.

**Proposition** : **conserver Redis**, mais pour la bonne raison — l'assumer comme choix de démonstration technique et l'écrire dans le README, plutôt que le présenter comme une nécessité de charge.

**À valider.**

---

### I-10 — Le calcul des échéances ne doit pas être confié à l'IA

**Constat** : le plan demande à l'IA d'extraire les échéances, tout en évoquant « des règles déterministes pour les dates et montants ». Les deux ne sont pas articulés.

**Proposition** : partage explicite des rôles — l'IA **repère** le passage qui contient un délai et le renvoie textuellement ; le **serveur calcule** la date à partir de la date du courrier. Une date jamais calculée par l'IA est une date jamais hallucinée. Idem pour les montants : l'IA renvoie la chaîne littérale, le serveur normalise.

**Impact** : intégré aux critères d'acceptation d'US-3.6. **À valider.**

---

### I-11 — Absence de politique de conservation des données

**Constat** : le plan prévoit la suppression manuelle d'un dossier, mais aucune durée de conservation automatique.

**Pourquoi c'est un problème** : la politique de confidentialité doit annoncer une durée. C'est aussi un argument portfolio simple et peu coûteux.

**Proposition** : suppression automatique des dossiers inactifs après **12 mois**, annoncée dans la politique, avec un e-mail d'avertissement 30 jours avant. Implémentation : une tâche planifiée sur le worker déjà présent — coût marginal.

**À valider.**

---

### I-12 — `ExtractedInformation` sans contrainte de vocabulaire

**Constat** : les champs `category` et `label` sont libres.

**Pourquoi c'est un problème** : si l'IA renvoie tantôt « Numéro allocataire », tantôt « N° allocataire », tantôt « Référence dossier », aucun affichage cohérent ni aucune mesure de qualité n'est possible.

**Proposition** : `category` devient une énumération fermée (RÉFÉRENCE, MONTANT, DATE, IDENTITÉ, CONTACT, AUTRE), contrôlée par le schéma Zod. `label` reste libre mais est normalisé côté serveur.

**À valider.**

---

### I-13 — Aucun mécanisme de reprise d'analyse

**Constat** : le parcours d'analyse est décrit comme linéaire, sans traitement du cas où l'API d'IA est indisponible ou trop lente.

**Proposition** : l'analyse est une tâche asynchrone dès le départ (le worker existe déjà), avec un état `EN_COURS` / `ÉCHEC` sur le dossier, un écran d'attente, et un bouton « Relancer l'analyse ». Coût faible si prévu dès la conception, coûteux si ajouté après.

**À valider.**

---

## D. Points manquants dans le plan

| # | Manque | Proposition | Coût |
|---|---|---|---|
| M-1 | Aucune estimation de **coût de l'API d'IA** | Plafond mensuel + limite de 10 analyses/jour/utilisateur | Faible |
| M-2 | Aucun **écran d'erreur global** ni page 404/500 | À ajouter à la liste des écrans | Faible |
| M-3 | Aucune **stratégie de sauvegarde du corpus fictif** | Le corpus est versionné dans le dépôt | Nul |
| M-4 | Aucun **journal de décisions** (ADR) | Un fichier `decisions.md` alimenté au fil de l'eau — excellent élément de portfolio | Faible |
| M-5 | Aucune **mesure de la latence d'analyse** | Enregistrer la durée de chaque analyse ; cible < 30 s | Faible |
| M-6 | Le protocole de **test utilisateur** n'est pas rédigé | À produire en semaine 6, pas en semaine 8 | Faible |
| M-7 | Aucun traitement du **document ne contenant aucune action** | Cas explicitement prévu dans les critères d'acceptation (US-3.5) | Nul |

---

## E. Ce qui est bien calibré (à conserver tel quel)

Pour être équilibré, plusieurs choix du plan sont justes et méritent d'être défendus :

- **Le monolithe modulaire plutôt que des microservices** : le bon choix pour ce volume, et un choix mature à expliquer en entretien.
- **Le corpus fictif** : élimine le risque juridique et de données personnelles tout en permettant une vraie démonstration.
- **Zod en garde-fou de la sortie IA** : c'est la bonne réponse au problème des hallucinations.
- **Les extraits sources obligatoires** : c'est le meilleur élément de conception du plan. C'est ce qui rend le produit défendable.
- **Le refus de l'envoi automatique** : positionnement clair et prudent.
- **Le dataset de référence pour mesurer la qualité** : rare dans un projet de portfolio, très valorisant.

---

## F. Registre de décisions

**Mise à jour du 22 juillet 2026** — les 17 décisions du registre sont toutes tranchées. Aucune décision en attente.

### Décisions actées

| # | Décision | Arbitrage retenu | Date |
|---|---|---|---|
| D1 | Durée du projet | **14 semaines + 1 semaine tampon** (21 juillet → 25 octobre 2026). Le plan initial de 8 semaines est abandonné. | 21/07 |
| D2 | Disponibilité | Alternance en fin d'année. **Août entièrement libre** (temps plein), soirs et week-ends le reste du temps. Vélocité : 26 pts/sem en août, 13 pts/sem sinon. | 21/07 |
| D3 | Docker + CI + HTTPS en amorçage | **Oui, sprint 2** (semaine du 27 juillet), et non en semaine 7. Une page en ligne avant le 3 août. | 21/07 |
| D4 | Coupes de périmètre | Examinées une par une. **C1, C4, C5, C6, C7, C9 acceptées** (−26 pts). **C2, C3, C8 refusées.** C10 retirée (gain nul). | 21/07 |
| D5 | OCR image | **Retiré du MVP** (= C1). PDF uniquement ; l'import d'image aboutit au parcours « document illisible ». | 21/07 |
| D6 | Taille du corpus | **15 courriers conservés** (5 par organisme). Coupe C2 refusée. | 21/07 |
| D7 | Calcul des dates côté serveur, jamais par l'IA | **Oui.** L'IA renvoie l'extrait source, le serveur calcule la date. Intégré à l'architecture (§3) et à US-3.6. | 22/07 |
| D8 | Analyse asynchrone dès le départ | **Oui.** Job BullMQ avec états EN_ATTENTE/EN_COURS/TERMINÉE/ÉCHEC. Intégré à l'architecture (§3 et §6). | 22/07 |
| D9 | Nombre de statuts de dossier | **6 statuts conservés pour le MVP**, à retester à l'oral avec 5 utilisateurs. Si moins de 4/5 classent correctement leur dossier, réduire à 4 (À analyser / À faire / En attente de réponse / Terminé). | 22/07 |
| D10 | Affichage du niveau de confiance | **3 niveaux affichés** (élevé/moyen/faible) ; seul le niveau faible est mis en avant à l'écran (« Cette date est à vérifier »). Le score numérique reste stocké mais n'est jamais montré tel quel. | 22/07 |
| D11 | Redis / BullMQ | **Conservé**, assumé comme choix de démonstration technique (retries, backoff, tableau de bord des jobs) et non comme nécessité de charge. Documenté comme tel dans le README et l'architecture (§3). | 22/07 |
| D12 | Conservation des données | **Purge automatique après 12 mois** d'inactivité, avec e-mail d'avertissement 30 jours avant. Annoncée dans les CGU, implémentée en tâche planifiée sur le worker existant. | 22/07 |
| D14 | `ExtractedInformation.category` | **Énumération fermée** (RÉFÉRENCE, MONTANT, DATE, IDENTITÉ, CONTACT, AUTRE), contrôlée par le schéma Zod. Intégré à l'architecture (§3 et §4). | 22/07 |
| — | Gestion des imprévus | **Une semaine tampon non affectée**, à consommer où c'est nécessaire. Non reprogrammée à l'avance. | 21/07 |
| — | Prompts IA | **3 prompts spécialisés** (CAF, CPAM, France Travail). Coupe C3 refusée : la spécialisation fait la qualité. | 21/07 |
| — | Export du brouillon | **Texte et PDF conservés.** Coupe C8 refusée. | 21/07 |
| — | Déploiement continu | **Script manuel** pour le MVP (= C6). Première expérience GitHub Actions → VPS : risque de blocage disproportionné au gain. CD en roadmap. | 21/07 |
| — | Journalisation | L'**écran** d'historique est reporté (= C9), mais les écritures `AuditEvent` sont développées au fil des sprints. Sans cela l'historique serait irrécupérable. | 21/07 |

> D13 (semaine dédiée au portfolio) est absorbée par D1 : le sprint 14 y est consacré, sans développement.

### Décisions restant à trancher

Aucune. Le registre est clos — 17 décisions tranchées entre le 21 et le 22 juillet 2026. Les points D9 et D10 restent à **confirmer** (pas à trancher) lors des tests utilisateurs prévus en semaine 6-7, selon le protocole déjà défini ci-dessus.

### Ajustements issus des tests (application provisoire)

> ⚠️ Fondés sur une **synthèse de tests simulée** (`../06-tests-utilisateurs/08-synthese-simulee.md`,
> données fictives). Appliqués aux maquettes à titre de démonstration, **à confirmer par de vrais tests**
> avant d'être gravés dans le produit.

- **D9 — statuts** : passage de **six à quatre** statuts (À analyser, À faire, En attente de réponse,
  Terminé). Motif simulé : confusion « Action requise » ↔ « Documents à préparer ». Répercuté dans
  le design system, l'écran de pilotage et US-5.1.
- **D10 — confiance** : **signal « À vérifier » renforcé** (badge plus grand et contrasté, fond ambré
  sur la ligne d'échéance). Le principe des trois niveaux est conservé.
- Ajustements mineurs : case « document fictif » mise en évidence (écran 03), bandeau « aucune action »
  reformulé (écran 05b), rappel de relecture ajouté (écran 07), aide sur le mot « justificatif » (écran 05).
