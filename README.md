# CapClair

Application web permettant à un particulier de déposer un courrier administratif **fictif** (CAF, CPAM, France Travail) et d'obtenir une explication en français simple, une liste d'actions, une checklist de justificatifs, les échéances détectées, un brouillon de réponse et des rappels.

> **Statut : conception terminée, développement non démarré.** Les six dossiers de
> documentation sont produits, tests utilisateurs et retest compris. `07-developpement/`
> ne contient à ce stade que le schéma de base de données.

---

## Documentation du projet

### 01-cadrage

| Fichier | Contenu |
|---|---|
| `01-synthese-produit.md` | Problème, positionnement, périmètre, principes directeurs, indicateurs de succès, risques |
| `02-personas-besoins.md` | 3 personas, besoins traduits en exigences produit, contraintes d'accessibilité |
| `03-incoherences-et-arbitrages.md` | **13 incohérences relevées dans le plan initial + 14 décisions à valider** |

### 02-user-stories

| Fichier | Contenu |
|---|---|
| `01-epics-et-user-stories.md` | 10 epics, 49 user stories, critères d'acceptation mesurables (226 points) |
| `02-backlog-priorise.md` | Coupe de périmètre proposée, 8 sprints détaillés, 3 options de planning |

### 03-architecture

| Fichier | Contenu |
|---|---|
| `01-architecture-technique.md` | Stack, organisation du code, flux d'analyse asynchrone, déploiement |
| `02-schema-base-de-donnees.md` | Modèle relationnel commenté, décisions D7/D10/D12/D14 |
| `erd-capclair.mermaid` | Diagramme entité-association |

### 04-maquettes

| Fichier | Contenu |
|---|---|
| `wireframes.html` | Wireframes des 10 écrans principaux |
| `design-system.md` | Typographie, couleurs, composants, règles d'accessibilité |

### 05-courriers-fictifs

15 PDF de démonstration (5 CAF, 5 CPAM, 5 France Travail) et `dataset-reference.json`,
la vérité terrain servant à mesurer la qualité de l'extraction.

### 06-tests-utilisateurs

| Fichier | Contenu |
|---|---|
| `01-protocole.md` → `07-plan-analyse.md` | Protocole, recrutement, consentement, scénarios, grilles, plan d'analyse |
| `08-synthese-simulee.md` | Résultats du premier tour |
| `09-synthese-retest-simulee.md` | Retest : validation des correctifs D9 et D10 |

### 07-developpement

Le code. Trois dossiers — `front/`, `back/`, `db/` — pour deux dépôts distincts.
Seul `db/` est amorcé : schéma Prisma 7 et sa configuration. Voir
`07-developpement/README.md`.

---

## Planning retenu

**21 juillet → 25 octobre 2026** — 14 sprints d'une semaine, plus une semaine tampon non affectée.

| Phase | Période | Régime | Points |
|---|---|---|---|
| 1 — Amorçage | 21 juil – 2 août | partiel | 33 |
| 2 — Développement intensif | 3 – 30 août | **temps plein** | 100 |
| 3 — Développement | 31 août – 11 oct | partiel | 77 |
| 4 — Tests utilisateurs et portfolio | 12 – 25 oct | partiel | 16 |
| Tampon | non affecté | — | 13 |

**Le mois d'août représente 43 % de la capacité du projet.** Il porte les quatre blocs les plus lourds : schéma de validation IA, extraction des actions, restitution vérifiable, et l'ensemble de l'authentification.

Une page en ligne en HTTPS est attendue **dès le 2 août**, avant tout développement fonctionnel.

---

## Décisions actées

- Durée : 14 semaines + 1 tampon (le plan initial de 8 semaines est abandonné)
- Docker, CI et déploiement HTTPS en sprint 2, pas en fin de projet
- OCR image retiré du MVP — **PDF uniquement**
- Corpus de 15 courriers et 3 prompts spécialisés **conservés** (coupes refusées)
- Déploiement par script manuel ; le CD automatique passe en roadmap
- Une semaine tampon, non reprogrammée à l'avance
- Dates/montants toujours calculés côté serveur, jamais par l'IA (D7)
- Analyse asynchrone dès le départ, via le worker (D8)
- Redis/BullMQ conservé, assumé comme choix de démonstration technique (D11)
- Catégories d'information en référentiel seedé — table `Category`, `code` stable (D14)
- Conservation des dossiers 12 mois puis purge automatique (D12)
- 4 statuts de dossier, réduits de 6 après tests, et signal de confiance renforcé — D9 et D10 validés au retest

**Registre des 17 décisions clos** dans `01-cadrage/03-incoherences-et-arbitrages.md`, section F.

---

## Prochaines étapes

1. Trancher entre le monolithe modulaire décrit dans `03-architecture/01-architecture-technique.md`
   et la séparation front / back en deux dépôts adoptée dans `07-developpement/`.
2. Créer la base PostgreSQL (Supabase ou Docker en local) et générer la première
   migration Prisma — c'est le lot T-1 du sprint 1.
3. Amorcer `07-developpement/front/` et `07-developpement/back/`.
