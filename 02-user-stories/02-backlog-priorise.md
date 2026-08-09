# DossierClair — Backlog priorisé

**Version** : 2.0 — 21 juillet 2026
**Remplace** : v1.0 (planning 8 semaines, hypothèse temps plein)
**Statut** : coupes arbitrées, planning à valider

---

## 1. Capacité réelle

Calculée sur la disponibilité annoncée : alternance en fin d'année, **mois d'août entièrement libre**, soirs et week-ends le reste du temps.

| Période | Régime | Semaines | Vélocité | Points |
|---|---|---|---|---|
| 21 – 26 juillet | soirs + week-end | 1 | 12 | 12 |
| 27 juillet – 2 août | mixte | 1 | 21 | 21 |
| 3 – 30 août | **temps plein** | 4 | 26 | 104 |
| 31 août – 11 octobre | alternance + soirs + week-ends | 6 | 13 | 78 |
| 12 – 25 octobre | alternance + soirs + week-ends | 2 | 13 | 26 |
| **Total** | | **14** | | **241** |
| dont **semaine tampon** (non affectée) | | 1 | | −13 |
| **Capacité engageable** | | | | **228** |

**Le mois d'août représente 43 % de la capacité totale du projet.** C'est la ressource critique : elle doit accueillir les blocs de 8 points (schéma Zod, extraction des actions, worker), c'est-à-dire tout ce qui se traite mal en soirée après une journée de travail.

> **Hypothèse à surveiller** : 13 points/semaine en période d'alternance. Si vous tenez 15–16, vous gagnez une semaine sur la fin. Si vous tombez à 10, il faut recouper. À réévaluer début septembre, après deux sprints en régime réel.

---

## 2. Coupes arbitrées

| # | Décision | Story | Gain | Statut |
|---|---|---|---|---|
| C1 | OCR image retiré — **PDF uniquement** | US-2.5 | −8 | ✅ **Acceptée** |
| C4 | Tableau de bord v1 réduite (pas de graphique de répartition) | US-5.4 | −3 | ✅ **Acceptée** |
| C5 | Écran de résultat v1, polish reporté en fin de projet | US-4.1 | −3 | ✅ **Acceptée** |
| C6 | Déploiement scripté manuel, pas de CD automatique | US-10.3 | −5 | ✅ **Acceptée** — première expérience GitHub Actions → VPS, risque de blocage élevé |
| C7 | Préférences de rappel réduites à un interrupteur global | US-7.5 | −2 | ✅ **Acceptée** |
| C9 | Écran d'historique reporté en fin de projet | US-4.5 | −5 | ✅ **Acceptée** — voir réserve ci-dessous |
| C2 | Corpus 15 → 9 courriers | US-9.1 | — | ❌ **Refusée** — les 15 courriers sont conservés |
| C3 | Un prompt unique au lieu de 3 | US-3.3 | — | ❌ **Refusée** — la spécialisation par organisme fait la qualité d'analyse |
| C8 | Export PDF retiré | US-6.3 | — | ❌ **Refusée** — 1 point de gain, et le PDF est utile en démonstration |
| C10 | — | — | — | ⛔ Retirée : n'était pas une coupe (gain nul) |

**Total retiré : 26 points.**

> ⚠️ **Réserve sur C9** : c'est **l'écran** d'historique qui est reporté, pas la journalisation. Les écritures dans `AuditEvent` sont développées dès le sprint concerné par chaque événement. Sans cela, l'historique serait vide au moment de construire l'écran, et impossible à reconstituer.

**Repoussé en roadmap post-MVP** : OCR image, graphique de répartition par organisme, préférences de rappel par dossier, déploiement continu automatique, écran d'historique enrichi.

---

## 3. Charge à couvrir

| Origine | Points |
|---|---|
| Epics E1 à E10 (49 user stories) | 226 |
| Coupes arbitrées | −26 |
| **Sous-total périmètre fonctionnel** | **200** |
| T-1 Initialisation technique | 5 |
| T-2 Wireframes | 5 |
| T-3 Tests utilisateurs et corrections | 8 |
| T-4 Livrables portfolio | 8 |
| **Total à planifier** | **226** |

**226 points à planifier pour 228 de capacité engageable.** L'équilibre tient, la semaine tampon reste intacte en réserve.

---

## 4. Plan de charge

### Phase 1 — Amorçage (21 juillet – 2 août, régime partiel, 33 pts)

L'objectif de cette phase est d'arriver au 3 août avec un socle prêt, pour que le mois d'août ne serve qu'à produire de la fonctionnalité.

#### Sprint 1 — Fondations projet (12 pts) · *21 – 26 juillet*

| Story | Intitulé | Pts |
|---|---|---|
| T-1 | Initialisation Next.js + TypeScript + Prisma + schéma de données complet | 5 |
| T-2 | Wireframes des 10 écrans principaux | 5 |
| US-8.4 | Gestion des secrets et `.env.example` | 2 |

**Fin de sprint** : le schéma Prisma couvre les 11 entités et une première migration s'applique.

#### Sprint 2 — Infrastructure et corpus (21 pts) · *27 juillet – 2 août*

| Story | Intitulé | Pts |
|---|---|---|
| US-10.1 | Environnement Docker complet (web, worker, postgres, redis, proxy) | 5 |
| US-10.2 | Pipeline CI (types, lint, tests, build) | 5 |
| US-9.1 | Corpus de **15 courriers fictifs** + dataset de référence | 5 |
| US-8.3 | CGU et politique de confidentialité (v1) | 3 |
| US-10.3′ | Déploiement scripté + HTTPS sur le VPS | 3 |

**Fin de sprint** : une page d'accueil vide est **en ligne en HTTPS**, déployée par script, et la CI est verte.

> C'est l'arbitrage structurant du projet (point I-1). Mettre le déploiement en semaine 2 plutôt qu'en semaine 7 signifie découvrir les problèmes de certificat, de volumes et de variables d'environnement pendant qu'il reste 12 semaines pour les résoudre.

---

### Phase 2 — Août, temps plein (3 – 30 août, 100 pts)

**43 % du projet.** Les quatre blocs de 8 points sont tous ici.

#### Sprint 3 — Authentification (24 pts) · *3 – 9 août*

| Story | Intitulé | Pts |
|---|---|---|
| US-1.1 | Inscription | 5 |
| US-1.3 | Réinitialisation du mot de passe | 5 |
| US-1.5 | Isolation stricte des données | 5 |
| US-1.2 | Connexion / déconnexion | 3 |
| US-1.4 | Protection des routes | 3 |
| US-8.1 | Limitation de débit | 3 |

**Fin de sprint** : le test d'isolation passe en CI sur les 6 entités liées.

#### Sprint 4 — Import et lecture (24 pts) · *10 – 16 août*

| Story | Intitulé | Pts |
|---|---|---|
| US-2.1 | Import de fichier (validation par signature) | 5 |
| US-2.4 | Extraction du texte PDF | 5 |
| US-2.2 | Aperçu avant analyse | 3 |
| US-2.6 | Gestion d'un document illisible | 3 |
| US-5.5 | Suppression définitive d'un dossier | 3 |
| US-8.2 | Journalisation sans contenu sensible | 3 |
| US-2.3 | Confirmation du caractère fictif | 2 |

**Fin de sprint** : les 15 courriers du corpus produisent un texte contenant 100 % des dates, montants et références attendus.

#### Sprint 5 — Analyse IA, socle (26 pts) · *17 – 23 août*

| Story | Intitulé | Pts |
|---|---|---|
| US-3.2 | Schéma Zod strict + politique de relance | 8 |
| US-3.3 | Détection de l'organisme (**3 prompts spécialisés**) | 5 |
| US-3.4 | Résumé simplifié | 5 |
| US-3.6 | Extraction des échéances (calcul déterministe serveur) | 5 |
| US-3.1 | Consentement explicite avant analyse externe | 3 |

**Fin de sprint** : 3 exécutions consécutives sur les 15 courriers, **0 réponse invalide persistée**, ≥ 93 % de détection d'organisme.

#### Sprint 6 — Analyse IA, restitution (26 pts) · *24 – 30 août*

| Story | Intitulé | Pts |
|---|---|---|
| US-3.5 | Extraction des actions et justificatifs | 8 |
| US-4.1 | Écran de résultat d'analyse (v1) | 5 |
| US-4.2 | Affichage des extraits sources | 5 |
| US-4.4 | Correction manuelle d'une information | 5 |
| US-4.3 | Affichage du niveau de confiance | 3 |

**Fin de sprint** : chaque information affichée dispose d'un extrait source vérifié comme sous-chaîne du document. **Le cœur du produit est fonctionnel.**

---

### Phase 3 — Septembre et octobre, régime partiel (31 août – 11 octobre, 77 pts)

Sprints calibrés à 13 points. Les tâches sont volontairement fractionnables : aucune ne dépasse 8 points, et les blocs de 8 sont isolés en début de sprint.

#### Sprint 7 — Pilotage du dossier (13 pts) · *31 août – 6 septembre*

| Story | Intitulé | Pts |
|---|---|---|
| US-5.1 | Statuts de dossier | 5 |
| US-5.2 | Actions : cocher, modifier, ajouter, supprimer | 5 |
| US-5.3 | Checklist des justificatifs | 3 |

#### Sprint 8 — Tableau de bord et accessibilité (13 pts) · *7 – 13 septembre*

| Story | Intitulé | Pts |
|---|---|---|
| US-5.4 | Tableau de bord (v1 réduite) | 5 |
| US-8.5 | Accessibilité (audit axe-core + corrections) | 5 |
| US-6.4 | Mention d'absence d'envoi automatique | 3 |

#### Sprint 9 — Brouillon de réponse (13 pts) · *14 – 20 septembre*

| Story | Intitulé | Pts |
|---|---|---|
| US-6.1 | Génération du brouillon | 5 |
| US-6.2 | Édition du brouillon | 5 |
| US-6.3 | Copie et export (**texte + PDF**) | 3 |

#### Sprint 10 — Worker et rappels (13 pts) · *21 – 27 septembre*

| Story | Intitulé | Pts |
|---|---|---|
| US-7.2 | Worker d'envoi (Redis, planification, reprise) | 8 |
| US-7.1 | Programmation automatique des rappels | 5 |

> Sprint le plus risqué de la phase 3 : un bloc de 8 points en régime partiel. Si le sprint 6 se termine en avance, avancer US-7.2 en août.

#### Sprint 11 — Fiabilisation des rappels (14 pts) · *28 septembre – 4 octobre*

| Story | Intitulé | Pts |
|---|---|---|
| US-7.3 | Absence de doublon (contrainte + test concurrentiel) | 5 |
| US-9.2 | Tests unitaires (couverture ≥ 70 %) | 5 |
| US-7.4 | Notifications internes | 3 |
| US-7.5 | Désactivation globale des rappels | 1 |

#### Sprint 12 — Tests et exploitation (11 pts) · *5 – 11 octobre*

| Story | Intitulé | Pts |
|---|---|---|
| US-9.3 | Tests d'intégration | 5 |
| US-9.4 | Test E2E du parcours principal | 3 |
| US-10.4 | Exploitation (santé, sauvegardes, restauration testée) | 3 |

**Fin de phase** : le MVP est complet, déployé, testé. **Gel des fonctionnalités.**

---

### Phase 4 — Validation et livraison (12 – 25 octobre, 16 pts)

#### Sprint 13 — Tests utilisateurs (8 pts) · *12 – 18 octobre*

| Story | Intitulé | Pts |
|---|---|---|
| T-3 | 5 participants + dépouillement + corrections prioritaires | 8 |

Le protocole de test doit être rédigé **au sprint 11**, pas ici.

#### Sprint 14 — Portfolio (8 pts) · *19 – 25 octobre*

| Story | Intitulé | Pts |
|---|---|---|
| T-4 | README, captures, vidéo 2–4 min, présentation du projet | 8 |

Aucun développement. La vidéo se tourne sur une version stabilisée.

---

### Semaine tampon (13 pts) · *à consommer où c'est nécessaire*

Non affectée. Elle absorbe un imprévu personnel, un sprint qui déborde, ou une correction lourde issue des tests utilisateurs. **Si elle n'est pas consommée, le projet se termine le 18 octobre au lieu du 25.**

Ne pas la reprogrammer à l'avance : une marge planifiée n'est plus une marge.

---

## 5. Récapitulatif

| Phase | Période | Sprints | Points |
|---|---|---|---|
| 1 — Amorçage | 21 juil – 2 août | 2 | 33 |
| 2 — Août temps plein | 3 – 30 août | 4 | 100 |
| 3 — Développement partiel | 31 août – 11 oct | 6 | 77 |
| 4 — Validation et livraison | 12 – 25 oct | 2 | 16 |
| Tampon | non affecté | 1 | 13 |
| **Total** | **21 juil – 1er nov** | **14 + 1** | **239** |

**Fin prévisionnelle : 25 octobre 2026** (1er novembre si la semaine tampon est consommée).

> ⚠️ **Écart avec le plan initial** : 14 semaines contre 8. C'est le résultat d'une estimation honnête du périmètre (226 points) confrontée à une disponibilité majoritairement partielle. Le mois d'août sauve le projet ; sans lui, il faudrait 18 semaines.
>
> **Si une échéance de fin septembre est impérative**, il faut retirer environ 60 points supplémentaires — concrètement : le brouillon de réponse (E6, 16 pts), les rappels e-mail au profit des seules notifications internes (−13 pts), et la réduction à un seul organisme (−30 pts environ). Cela ampute le projet de ses trois arguments portfolio les plus forts. À éviter sauf contrainte externe.

---

## 6. Règles de fonctionnement

1. **Aucune story ne démarre sans critères d'acceptation validés.** Une story floue est une story qui déborde.
2. **Une story est terminée quand ses critères sont vérifiés**, pas quand « ça marche chez moi ».
3. **Ne jamais entamer un sprint avec plus de 5 points de report.** Au-delà, replanifier plutôt que subir.
4. **Le dataset de référence (US-9.1) est exécuté à chaque modification de prompt.** Une régression de qualité doit être visible immédiatement.
5. **Les écritures `AuditEvent` sont développées au fil des sprints**, même sans écran pour les afficher (réserve C9).
6. **Réévaluation de la vélocité au sprint 8** (début septembre), après deux sprints en régime partiel réel. Si l'écart dépasse 20 %, replanifier la phase 3.
7. **Gel des fonctionnalités au sprint 12.** Après cette date, uniquement des corrections.
8. **Un journal de décisions** (`decisions.md`) est alimenté à chaque arbitrage technique — c'est un livrable portfolio à coût nul.
