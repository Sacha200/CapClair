# Retest utilisateurs sur la version corrigée — CapClair *(SIMULATION)*

> ⚠️ **DOCUMENT DE DÉMONSTRATION — DONNÉES ENTIÈREMENT FICTIVES.**
> Second tour de test *simulé*, mené (fictivement) sur la maquette **après application des corrections**
> issues du premier tour (`08-synthese-simulee.md`). Objectif : vérifier que les correctifs D9/D10 et
> mineurs résolvent bien les problèmes. **Aucun test réel n'a eu lieu ; à confirmer par de vraies sessions.**

**Version** : simulation 2.0 (retest) — juillet 2026 · 5 participants fictifs · maquette corrigée

---

## 1. Ce qui a été corrigé avant ce tour

| Problème du tour 1 | Correctif appliqué |
|---|---|
| Signal « À vérifier » peu visible (D10) | Badge plus grand/gras + fond ambré sur la ligne d'échéance |
| Confusion de deux statuts (D9) | Réduction à 4 statuts (À analyser / À faire / En attente de réponse / Terminé) |
| Case « document fictif » lue sans attention | Encadré ambré + aide « L'analyse ne démarrera qu'après avoir coché cette case » |
| Bandeau « aucune action » peu rassurant | Reformulé « C'est normal : ce courrier est purement informatif… » |
| Incertitude « qui envoie ? » | Rappel de relecture ajouté avant les boutons du brouillon |
| Mot « justificatif » flou | Sous-titre « Les documents à joindre à votre réponse » |

---

## 2. Résultats *(simulés)*

Cinq nouveaux participants fictifs, mêmes profils (3 Nadia, 1 Marc, 1 Sophie).

| Indicateur | Tour 1 | Tour 2 (corrigé) | Verdict |
|---|---|---|---|
| Repérage spontané du signal « À vérifier » (tâche 4) | 2/5 | **4/5** | ✅ Corrigé (seuil 3/5 atteint) |
| Appariement correct des statuts (tâche 6 / post-test) | 3/5, confusion récurrente | **5/5**, aucune confusion | ✅ Corrigé |
| Compréhension action + échéance (H1) | 4/5 | **5/5** | ✅ Renforcé |
| Case fictif lue et comprise | 3/5 | **5/5** | ✅ Corrigé |
| Courrier sans action compris (H5) | 4/5 | **5/5** | ✅ Corrigé |
| « Qui envoie le courrier ? » compris d'emblée (H4) | 4/5 | **5/5** | ✅ Renforcé |
| **Score SUS moyen** | 71 | **79** | ✅ « Bon → très bon » |
| Confiance déclarée (0-10) | 7,2 | **8,1** | ✅ En hausse |

---

## 3. Décisions confirmées *(illustration)*

- **D9 — quatre statuts** : validé. Les cinq participants classent correctement leur dossier ; plus
  aucune confusion. Le modèle à quatre statuts est adopté.
- **D10 — signal renforcé** : validé. Quatre participants sur cinq remarquent « À vérifier » sans
  invite ; le cinquième le voit après un court instant. La saillance est suffisante sans être anxiogène.
- **Correctifs mineurs** (case fictif, bandeau sans action, rappel de relecture, aide justificatif) :
  tous jugés efficaces, aucun nouveau problème de sévérité ≥ 2 détecté.

---

## 4. Problèmes résiduels *(simulés)*

| # | Problème | n/5 | Sévérité | Piste |
|---|---|---|---|---|
| 1 | Le libellé « En attente de réponse » interprété par 1 participant comme « en attente de MA réponse » | 1 | 1 | À surveiller ; envisager une infobulle |
| 2 | Un participant aurait aimé un bouton « Marquer comme terminé » plus visible | 1 | 1 | Améliorer l'accès à l'action de clôture |

Aucun problème bloquant. Le produit est jugé **prêt pour un développement**, sous réserve de confirmer
ces résultats par de vrais tests.

---

## 5. Verbatims marquants *(fictifs)*

- **P3 (Nadia)** — *« Là c'est clair, quatre cases, je sais où j'en suis. »* (statuts)
- **P1 (Nadia)** — *« Ah oui, "date à vérifier", je l'ai vu tout de suite cette fois. »* (D10)
- **P4 (Marc)** — *« Le rappel de relire avant d'envoyer, c'est bien, ça évite les bêtises. »* (brouillon)

---

## 6. Conclusion *(simulée)*

Les corrections issues du premier tour **atteignent leur objectif** sur ce jeu de données fictif :
les deux problèmes de sévérité 3 sont résorbés, le SUS gagne 8 points, la confiance progresse. Les
décisions D9 (quatre statuts) et D10 (signal renforcé) peuvent être considérées comme **stabilisées
pour la conception**, en attendant validation par de vrais utilisateurs.

**Feu vert conditionnel pour le développement** — la conception de la base de données et l'architecture
peuvent démarrer sur cette base.

> Rappel : tout ce qui précède est **simulé**. À remplacer par les résultats réels après de vraies sessions.
