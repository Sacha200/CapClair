# CapClair — Epics et user stories

**Version** : 1.0 — 21 juillet 2026
**Statut** : à valider

## Conventions

- **Identifiant** : `E<n>` pour un epic, `US-<n>.<m>` pour une story.
- **Estimation** : points de complexité Fibonacci (1, 2, 3, 5, 8, 13). Vélocité de référence pour un développeur seul à temps plein : **26 points par semaine** (hypothèse à confirmer, voir le backlog).
- **Priorité** : MoSCoW — `M` Must have, `S` Should have, `C` Could have, `W` Won't have (MVP).
- **Critères d'acceptation** : formulés de manière **vérifiable** (un testeur doit pouvoir répondre oui/non sans interprétation). Format Given/When/Then quand c'est pertinent.
- **DoD** (Definition of Done) commune à toutes les stories : code typé sans erreur TypeScript, lint propre, tests unitaires sur la logique métier, revue de sécurité d'accès (l'utilisateur ne voit que ses données), texte d'interface en français, écran utilisable au clavier.

**Total estimé : 226 points** — voir `02-backlog-priorise.md` pour la répartition et la coupe proposée.

---

## E1 — Authentification et compte utilisateur

**Objectif** : permettre à un utilisateur de disposer d'un espace personnel étanche.
**Valeur** : prérequis de tout le reste ; démontre la maîtrise de la sécurité en portfolio.
**Total : 21 points**

### US-1.1 — Inscription (M, 5 pts)

> En tant que visiteur, je veux créer un compte avec mon nom, mon e-mail et un mot de passe, afin d'accéder à mon espace personnel.

**Critères d'acceptation**

1. Le formulaire comporte les champs nom, e-mail, mot de passe, confirmation, et deux cases à cocher (CGU, politique de confidentialité).
2. Le compte n'est pas créé si l'une des deux cases n'est pas cochée ; un message d'erreur est affiché sous la case concernée.
3. Un mot de passe de moins de 12 caractères est refusé avec le message « Le mot de passe doit contenir au moins 12 caractères. »
4. Un e-mail déjà utilisé produit le même message générique et le même délai de réponse (± 100 ms) qu'un e-mail libre, afin de ne pas permettre l'énumération de comptes.
5. Le mot de passe est stocké haché (argon2id ou bcrypt coût ≥ 12) ; aucun test ne doit pouvoir lire le mot de passe en clair en base.
6. Après inscription réussie, l'utilisateur est redirigé vers le tableau de bord en moins de 2 secondes.
7. L'acceptation des CGU est enregistrée dans `ConsentLog` avec `policyVersion` et `acceptedAt`.

### US-1.2 — Connexion et déconnexion (M, 3 pts)

> En tant qu'utilisateur inscrit, je veux me connecter et me déconnecter, afin de contrôler l'accès à mes dossiers.

**Critères d'acceptation**

1. Une combinaison e-mail/mot de passe valide ouvre une session et redirige vers le tableau de bord.
2. Une combinaison invalide affiche « Identifiants incorrects. » sans préciser quel champ est en cause.
3. Après 5 tentatives échouées depuis la même IP en 15 minutes, les tentatives suivantes sont refusées pendant 15 minutes (HTTP 429).
4. Le cookie de session est `httpOnly`, `secure`, `sameSite=lax`.
5. La déconnexion invalide la session côté serveur : un retour arrière navigateur ne redonne pas accès à une page protégée.

### US-1.3 — Réinitialisation du mot de passe (M, 5 pts)

> En tant qu'utilisateur ayant oublié son mot de passe, je veux le réinitialiser par e-mail, afin de retrouver l'accès à mes dossiers.

**Critères d'acceptation**

1. La demande affiche toujours le même message, que l'e-mail existe ou non.
2. Le lien contient un jeton à usage unique, valable 60 minutes.
3. Le jeton est invalidé après usage ; une seconde utilisation affiche « Ce lien n'est plus valide. »
4. Après réinitialisation, toutes les sessions actives de l'utilisateur sont invalidées.
5. Le jeton est stocké haché en base.

### US-1.4 — Protection des routes (M, 3 pts)

> En tant qu'utilisateur, je veux que mes pages soient inaccessibles sans connexion, afin que personne ne consulte mes dossiers.

**Critères d'acceptation**

1. Toute route sous `/dashboard` et `/dossiers` accédée sans session redirige vers `/connexion`.
2. Après connexion, l'utilisateur est renvoyé vers l'URL initialement demandée.
3. Toute route API sous `/api` hors authentification renvoie 401 sans session.
4. Un test automatisé couvre au minimum une route page et une route API.

### US-1.5 — Isolation stricte des données (M, 5 pts)

> En tant qu'utilisateur, je veux être certain qu'aucun autre compte ne peut voir mes dossiers.

**Critères d'acceptation**

1. Toute requête de lecture ou d'écriture sur `CaseFile` et ses entités liées filtre sur `userId` **au niveau de la couche d'accès aux données**, pas seulement dans l'interface.
2. Un appel API avec l'identifiant d'un dossier appartenant à un autre compte renvoie **404** (et non 403, pour ne pas révéler l'existence du dossier).
3. Un test d'intégration dédié couvre les 6 entités liées (Document, ExtractedInformation, ActionItem, RequiredDocument, ResponseDraft, Reminder).
4. Le test fait échouer la CI s'il détecte une fuite.

---

## E2 — Import et lecture du document

**Objectif** : permettre le dépôt d'un courrier fictif et en extraire un texte exploitable.
**Total : 26 points**

### US-2.1 — Import d'un fichier (M, 5 pts)

> En tant qu'utilisateur, je veux déposer un PDF ou une image de courrier, afin de lancer une analyse.

**Critères d'acceptation**

1. Les formats acceptés sont PDF, PNG, JPEG, vérifiés par **signature de fichier** (magic bytes) et pas seulement par extension ou en-tête MIME déclaré.
2. La taille maximale est de 10 Mo ; au-delà, message « Ce fichier dépasse 10 Mo. Choisissez un fichier plus léger. »
3. Un format non accepté affiche « Formats acceptés : PDF, PNG, JPEG. »
4. Le nom du fichier stocké est généré côté serveur (UUID) ; le nom d'origine est conservé uniquement en base dans `originalName`.
5. Le fichier est stocké hors de la racine web : aucune URL publique directe n'y donne accès.
6. Le dépôt fonctionne par glisser-déposer **et** par sélection de fichier.

### US-2.2 — Aperçu avant analyse (M, 3 pts)

> En tant qu'utilisateur, je veux voir le document avant de lancer l'analyse, afin de vérifier que c'est le bon.

**Critères d'acceptation**

1. Un PDF et une image sont affichés en aperçu dans la page.
2. L'utilisateur peut retirer le document et en choisir un autre avant de lancer l'analyse.
3. L'aperçu est servi via une route authentifiée ; un accès non authentifié renvoie 401.

### US-2.3 — Confirmation du caractère fictif (M, 2 pts)

> En tant qu'exploitant du service, je veux que l'utilisateur confirme que le document est fictif, afin de rester dans le périmètre du MVP.

**Critères d'acceptation**

1. Une case à cocher « Je confirme que ce document est fictif » est obligatoire pour activer le bouton d'analyse.
2. La confirmation est enregistrée dans `ConsentLog` avec le type `FICTIONAL_DOCUMENT`.

### US-2.4 — Extraction du texte d'un PDF (M, 5 pts)

> En tant qu'utilisateur, je veux que le texte de mon PDF soit lu automatiquement, afin de ne rien retaper.

**Critères d'acceptation**

1. Sur les 15 courriers fictifs du corpus, le texte extrait contient l'intégralité des dates, montants et références attendus (vérifié par le dataset de référence).
2. Le texte extrait est enregistré dans `Document.extractedText`.
3. Un PDF de plus de 10 pages est traité (limite haute) ou rejeté avec un message explicite — le comportement choisi est documenté.
4. L'extraction d'un courrier d'une page se termine en moins de 5 secondes.

### US-2.5 — Extraction du texte d'une image (OCR) (S, 8 pts)

> En tant qu'utilisateur, je veux pouvoir photographier un courrier, afin de ne pas avoir à le scanner.

**Critères d'acceptation**

1. Une image nette d'un courrier fictif produit un texte contenant la date, le montant et la référence attendus.
2. Le traitement OCR s'exécute en tâche asynchrone si la durée dépasse 5 secondes, avec un écran d'attente.
3. Un taux de reconnaissance jugé insuffisant déclenche le parcours d'erreur de US-2.6.

### US-2.6 — Gestion d'un document illisible (M, 3 pts)

> En tant qu'utilisateur, je veux comprendre pourquoi mon document n'a pas pu être lu, afin de savoir quoi faire.

**Critères d'acceptation**

1. Si le texte extrait fait moins de 100 caractères, l'analyse n'est pas lancée.
2. Le message affiché est « Nous n'avons pas réussi à lire ce document. » suivi de trois suggestions concrètes (scanner plutôt que photographier, éclairer, utiliser un PDF).
3. Aucun appel à l'API d'IA n'est effectué dans ce cas — vérifié par test.
4. L'utilisateur peut relancer un import sans repasser par la création du dossier.

---

## E3 — Consentement et appel à l'IA

**Objectif** : appeler une API externe de manière encadrée, tracée et validée.
**Total : 34 points**

### US-3.1 — Consentement explicite avant analyse externe (M, 3 pts)

> En tant qu'utilisateur, je veux savoir que mon document sera envoyé à un service d'IA externe et donner mon accord.

**Critères d'acceptation**

1. Un texte indique explicitement que le **texte extrait** est transmis à un prestataire d'IA externe, nommé.
2. Le consentement est une action distincte de la confirmation « document fictif ».
3. Aucun appel à l'API n'est possible sans un enregistrement `ConsentLog` de type `AI_PROCESSING` postérieur à la création du dossier — vérifié par test d'intégration.
4. Le consentement enregistre la version de la politique en vigueur.

### US-3.2 — Schéma de sortie IA strict (M, 8 pts)

> En tant que développeur, je veux que la réponse de l'IA respecte un schéma JSON validé, afin de ne jamais enregistrer de donnée malformée.

**Critères d'acceptation**

1. Un schéma Zod couvre les 13 champs prévus : organisme, type de courrier, date du courrier, références, montants, résumé simple, actions, justificatifs, échéances, brouillon de réponse, extraits justificatifs, avertissements, niveau de confiance.
2. Une réponse invalide **n'est jamais persistée** ; elle déclenche une relance.
3. La relance est limitée à **2 tentatives** ; après quoi l'analyse est marquée en échec.
4. Un champ énuméré hors valeurs autorisées (ex. organisme inconnu) invalide la réponse.
5. Chaque action, justificatif et échéance porte obligatoirement un `sourceExcerpt` non vide.
6. Le taux d'échec de validation sur les 15 courriers du corpus est de **0 sur 3 exécutions consécutives**.

### US-3.3 — Détection de l'organisme (M, 5 pts)

> En tant qu'utilisateur, je veux que l'application reconnaisse l'organisme émetteur, afin d'obtenir une analyse adaptée.

**Critères d'acceptation**

1. Sur les 15 courriers du corpus, l'organisme est correct dans **au moins 14 cas** (≥ 93 %).
2. En cas d'ambiguïté, l'organisme est marqué `INCERTAIN` et l'utilisateur est invité à le choisir manuellement.
3. Un prompt distinct est utilisé pour CAF, CPAM et France Travail.

### US-3.4 — Génération du résumé simplifié (M, 5 pts)

> En tant qu'utilisateur, je veux un résumé en français simple, afin de comprendre le courrier sans le relire.

**Critères d'acceptation**

1. Le résumé fait entre 3 et 8 phrases.
2. Aucune phrase ne dépasse 25 mots (vérifié automatiquement sur le corpus).
3. Tout sigle présent est explicité à sa première occurrence.
4. Le résumé indique explicitement s'il y a une action à effectuer ou non.
5. Lors des tests utilisateurs, ≥ 80 % des participants reformulent correctement la demande principale après lecture du seul résumé.

### US-3.5 — Extraction des actions et justificatifs (M, 8 pts)

> En tant qu'utilisateur, je veux la liste des actions à faire et des documents à fournir.

**Critères d'acceptation**

1. Chaque action est formulée à l'infinitif, en une phrase de 15 mots maximum.
2. Chaque action et chaque justificatif est relié à un extrait du courrier.
3. Sur le corpus de référence, ≥ 85 % des actions attendues sont retrouvées, et le taux d'actions inventées (non rattachables au texte) est de 0.
4. Un courrier purement informatif produit une liste d'actions vide et non une action générique inventée.

### US-3.6 — Extraction des échéances (M, 5 pts)

> En tant qu'utilisateur, je veux voir clairement la date limite.

**Critères d'acceptation**

1. Les dates explicites (« avant le 15 mars 2026 ») sont extraites correctement dans 100 % des cas du corpus.
2. Les délais relatifs (« dans un délai d'un mois à compter de la réception ») sont calculés par une **règle déterministe côté serveur**, à partir de la date du courrier, et non par l'IA.
3. Une date calculée est signalée comme telle dans l'interface (« calculée à partir du délai indiqué »).
4. Une date passée est affichée avec un libellé « Échéance dépassée » sans langage alarmiste.
5. Aucune date antérieure à la date du courrier n'est acceptée comme échéance.

---

## E4 — Consultation et vérification du dossier

**Objectif** : rendre l'analyse lisible **et contrôlable**.
**Total : 26 points**

### US-4.1 — Écran de résultat d'analyse (M, 8 pts)

> En tant qu'utilisateur, je veux voir le résultat de l'analyse structuré sur un seul écran.

**Critères d'acceptation**

1. L'écran présente dans cet ordre : échéance principale, résumé, actions, justificatifs, informations extraites, brouillon.
2. L'échéance principale est visible sans défilement sur mobile (viewport 375 px).
3. Un avertissement permanent est affiché : « Cette analyse est générée automatiquement à partir d'un document fictif. Vérifiez les informations importantes avant toute utilisation. »
4. Aucune information affirmée sans possibilité d'accéder à sa source (US-4.2).

### US-4.2 — Affichage des extraits sources (M, 5 pts)

> En tant qu'utilisateur, je veux voir sur quel passage du courrier chaque information est fondée.

**Critères d'acceptation**

1. Chaque information extraite dispose d'un déclencheur « Voir l'extrait ».
2. L'extrait affiché est un passage littéral du texte extrait (vérifié par test : l'extrait est une sous-chaîne du document).
3. Si un extrait ne correspond à aucun passage du document, l'information est marquée « non vérifiable » et son niveau de confiance est abaissé.

### US-4.3 — Affichage du niveau de confiance (M, 3 pts)

> En tant qu'utilisateur, je veux savoir quelles informations sont incertaines.

**Critères d'acceptation**

1. Trois niveaux sont utilisés : élevé, moyen, faible.
2. Un niveau faible ou moyen est signalé visuellement **et** textuellement (jamais par la couleur seule).
3. Un bandeau récapitulatif liste les informations à vérifier en priorité lorsqu'au moins une information est de niveau faible.

### US-4.4 — Correction manuelle d'une information (M, 5 pts)

> En tant qu'utilisateur, je veux corriger une information mal extraite.

**Critères d'acceptation**

1. Toute information extraite (date, montant, référence, organisme, type) est éditable.
2. Après correction, `isUserCorrected` passe à vrai et la valeur corrigée est affichée partout dans l'application.
3. Une information corrigée n'est jamais écrasée par une nouvelle analyse.
4. La correction est journalisée dans `AuditEvent`.
5. Corriger l'échéance principale recalcule automatiquement les rappels programmés (voir US-7.1).

### US-4.5 — Historique du dossier (S, 5 pts)

> En tant qu'utilisateur, je veux consulter l'historique des modifications de mon dossier.

**Critères d'acceptation**

1. Sont journalisés : création, analyse, correction, changement de statut, action cochée, rappel envoyé, suppression.
2. Chaque entrée affiche une date, une heure et un libellé en français compréhensible (pas de nom technique d'événement).
3. L'historique **ne contient aucun contenu du document**.

---

## E5 — Pilotage du dossier

**Objectif** : permettre le suivi jusqu'à la clôture.
**Total : 24 points**

### US-5.1 — Statuts de dossier (M, 5 pts)

> En tant qu'utilisateur, je veux savoir où en est chaque dossier.

**Critères d'acceptation**

1. Les statuts disponibles sont : **À analyser, À faire, En attente de réponse, Terminé** (modèle à quatre statuts, décision D9 — voir note ci-dessous).
2. Le statut est modifiable manuellement à tout moment.
3. Le statut passe automatiquement à « À faire » après une analyse produisant au moins une action ; à « À analyser » sinon.
4. Le statut « Terminé » suspend tout nouveau rappel.
5. Chaque changement de statut est journalisé.

> **Note D9 (juillet 2026)** — le modèle à six statuts (À analyser, Action requise, Documents à préparer,
> Réponse prête, En attente, Terminé) a été **réduit à quatre** à la suite des tests utilisateurs :
> « Action requise » et « Documents à préparer » se recouvraient dans l'esprit des participants. Les
> maquettes reflètent le modèle à quatre statuts. (Cf. `../06-tests-utilisateurs/08-synthese-simulee.md` —
> à confirmer par des tests réels.)

### US-5.2 — Cocher, modifier, ajouter, supprimer une action (M, 5 pts)

**Critères d'acceptation**

1. Cocher une action met à jour la progression du dossier immédiatement (sans rechargement de page).
2. L'utilisateur peut ajouter une action manuelle avec titre, description et date d'échéance facultative.
3. Une action supprimée disparaît définitivement et l'événement est journalisé.
4. La progression affichée est le rapport actions terminées / actions totales, arrondi à l'entier.

### US-5.3 — Checklist des justificatifs (M, 3 pts)

**Critères d'acceptation**

1. Chaque justificatif peut être marqué disponible/non disponible.
2. Une note libre de 500 caractères maximum peut être ajoutée à chaque justificatif.
3. Le compteur « X sur Y justificatifs prêts » est affiché en haut de la checklist.

### US-5.4 — Tableau de bord (M, 8 pts)

**Critères d'acceptation**

1. Le tableau de bord affiche : nombre de dossiers actifs, dossiers dont l'échéance est dans les 7 jours, nombre d'actions restantes, 5 dernières analyses, notifications récentes, répartition par organisme.
2. Un bouton d'ajout de courrier est visible sans défilement.
3. Un utilisateur sans dossier voit un écran d'accueil expliquant la première étape (état vide utile, pas une page blanche).
4. Le chargement du tableau de bord avec 20 dossiers s'effectue en moins de 1,5 seconde.

### US-5.5 — Suppression définitive d'un dossier (M, 3 pts)

**Critères d'acceptation**

1. La suppression demande une confirmation explicite mentionnant le caractère irréversible.
2. Sont supprimés : le dossier, le fichier sur disque, le texte extrait, les informations, actions, justificatifs, brouillon, rappels et notifications associés.
3. Un test vérifie qu'aucune ligne orpheline ne subsiste après suppression.
4. Seul le `AuditEvent` de suppression est conservé, sans contenu du document.

---

## E6 — Brouillon de réponse

**Objectif** : lever le blocage de la page blanche sans jamais se substituer à l'utilisateur.
**Total : 16 points**

### US-6.1 — Génération du brouillon (M, 5 pts)

**Critères d'acceptation**

1. Le brouillon reprend les références du dossier (numéro d'allocataire, référence du courrier) lorsqu'elles ont été extraites.
2. Il comporte les mentions d'usage : objet, formule d'appel, corps, formule de politesse.
3. Il ne contient aucune information non présente dans le dossier.
4. Le contenu généré initial est conservé dans `generatedContent` et reste consultable après modification.

### US-6.2 — Édition du brouillon (M, 5 pts)

**Critères d'acceptation**

1. Le brouillon est modifiable dans un éditeur de texte.
2. Les modifications sont enregistrées automatiquement au plus tard 3 secondes après la dernière frappe, avec un indicateur d'état d'enregistrement.
3. Un bouton permet de revenir à la version générée initialement, après confirmation.

### US-6.3 — Copie et export (S, 3 pts)

**Critères d'acceptation**

1. Un bouton copie le brouillon dans le presse-papiers et affiche une confirmation.
2. Un export au format texte est disponible.
3. L'export PDF est facultatif (`Could`).
4. Avant toute copie ou export, un avertissement rappelle de relire le contenu.

### US-6.4 — Absence d'envoi automatique (M, 3 pts)

**Critères d'acceptation**

1. Aucune fonctionnalité d'envoi vers un organisme n'existe dans l'application.
2. Un texte explicite l'indique sur l'écran du brouillon : « CapClair n'envoie aucun courrier. Vous restez maître de la transmission. »

---

## E7 — Rappels et notifications

**Objectif** : éviter l'oubli d'échéance, sans harceler.
**Total : 24 points**

### US-7.1 — Programmation automatique des rappels (M, 5 pts)

**Critères d'acceptation**

1. À l'enregistrement d'une échéance principale, trois rappels sont programmés : J-7, J-3, J-0.
2. Un rappel dont la date est déjà passée n'est pas programmé.
3. Si l'échéance est à moins de 7 jours, seuls les rappels encore pertinents sont créés.
4. La modification de l'échéance reprogramme les rappels et annule les anciens non envoyés.

### US-7.2 — Worker d'envoi (M, 8 pts)

**Critères d'acceptation**

1. Le worker s'exécute selon une planification régulière et traite les rappels dont `scheduledAt` est échu.
2. Un rappel envoyé passe au statut `SENT` avec `sentAt` renseigné.
3. Un échec d'envoi passe au statut `FAILED`, enregistre `errorMessage`, et fait l'objet d'au maximum 3 nouvelles tentatives à intervalles croissants.
4. Le worker n'envoie aucun rappel pour un dossier au statut « Terminé ».
5. Le worker survit à un redémarrage sans perdre ni dupliquer les rappels en cours.

### US-7.3 — Absence de doublon (M, 5 pts)

**Critères d'acceptation**

1. Une contrainte d'unicité en base porte sur (`caseFileId`, `reminderType`, `channel`).
2. Deux exécutions simultanées du worker n'envoient qu'un seul e-mail par rappel — vérifié par un test d'intégration lançant deux workers en parallèle.
3. Une relance manuelle du worker sur une plage déjà traitée n'envoie rien.

### US-7.4 — Notifications internes (M, 3 pts)

**Critères d'acceptation**

1. Chaque rappel crée une notification interne visible dans l'application.
2. Un compteur de notifications non lues est affiché dans l'en-tête.
3. Une notification consultée passe à lue (`readAt` renseigné).

### US-7.5 — Préférences de rappel (S, 3 pts)

**Critères d'acceptation**

1. L'utilisateur peut désactiver globalement les e-mails de rappel.
2. L'utilisateur peut désactiver les rappels d'un dossier précis.
3. Le worker respecte ces préférences — vérifié par test.
4. Chaque e-mail contient un lien de désinscription fonctionnel.

---

## E8 — Sécurité, confidentialité et conformité

**Total : 16 points**

### US-8.1 — Limitation de débit (M, 3 pts)

**Critères d'acceptation**

1. Les routes de connexion, d'inscription, de réinitialisation, d'import et d'analyse sont limitées en débit.
2. Le dépassement renvoie HTTP 429 avec un message en français indiquant le délai d'attente.
3. Les seuils sont configurables par variable d'environnement.

### US-8.2 — Journalisation sans contenu sensible (M, 3 pts)

**Critères d'acceptation**

1. Aucun log d'application ne contient de texte extrait, de nom de fichier d'origine, ni de contenu de brouillon.
2. Un test automatisé analyse la sortie de log d'un parcours complet et échoue si un extrait du document y apparaît.

### US-8.3 — Pages légales (M, 3 pts)

**Critères d'acceptation**

1. CGU et politique de confidentialité sont accessibles depuis toutes les pages.
2. La politique indique : données collectées, sous-traitant IA, durée de conservation, droit de suppression.
3. Chaque document porte un numéro de version référencé dans `ConsentLog`.

### US-8.4 — Gestion des secrets et configuration (M, 2 pts)

**Critères d'acceptation**

1. Aucun secret n'est présent dans le dépôt Git (vérifié par un scan en CI).
2. Un fichier `.env.example` liste toutes les variables requises, sans valeur réelle.
3. L'application refuse de démarrer si une variable obligatoire est absente, avec un message indiquant laquelle.

### US-8.5 — Accessibilité (M, 5 pts)

**Critères d'acceptation**

1. Le parcours principal (inscription → import → analyse → clôture) est réalisable **au clavier seul**.
2. Tous les champs disposent d'un `label` associé ; les erreurs sont liées au champ par `aria-describedby`.
3. Le contraste texte/fond respecte le ratio 4,5:1 (3:1 pour les grandes tailles).
4. Le focus est visible sur tous les éléments interactifs.
5. Aucune information n'est véhiculée par la couleur seule.
6. Un audit axe-core sur les 10 écrans principaux ne remonte aucune violation de niveau critique ou sérieux.

---

## E9 — Qualité et tests

**Total : 18 points**

### US-9.1 — Dataset de référence (M, 5 pts)

**Critères d'acceptation**

1. Les 15 courriers fictifs disposent chacun d'un fichier d'attentes : organisme, type, actions, justificatifs, échéance, extraits.
2. Un script exécutable compare la sortie de l'analyse aux attentes et produit un rapport chiffré.
3. Le rapport indique le taux de réussite par champ et par organisme.

### US-9.2 — Tests unitaires (M, 5 pts)

**Critères d'acceptation**

1. Sont couverts : validation Zod des sorties IA, calcul des dates relatives, planification des rappels, transitions de statut, contrôle des permissions, formatage des e-mails.
2. La couverture de `src/server` et `src/features` atteint au moins **70 %**.

### US-9.3 — Tests d'intégration (M, 5 pts)

**Critères d'acceptation**

1. Sont couverts : création de dossier, import de fichier, enregistrement d'une analyse, génération des actions, création et envoi d'un rappel, suppression complète.
2. Les tests s'exécutent sur une base PostgreSQL jetable (conteneur), pas sur une base mockée.

### US-9.4 — Test E2E du parcours principal (M, 3 pts)

**Critères d'acceptation**

1. Le scénario couvre les 10 étapes : inscription, connexion, import CAF, consentement, analyse, consultation, modification d'action, modification du brouillon, création d'un rappel, clôture.
2. L'appel à l'API d'IA est simulé par une réponse enregistrée (fixture), afin de garantir un test déterministe et sans coût.
3. Le test s'exécute en CI sur chaque pull request.

---

## E10 — Déploiement et exploitation

**Total : 21 points**

### US-10.1 — Environnement Docker complet (M, 5 pts)

**Critères d'acceptation**

1. `docker compose up` démarre web, worker, postgres, redis et le reverse proxy.
2. L'application est fonctionnelle à partir du seul dépôt et d'un `.env` renseigné, sans installation locale supplémentaire.
3. Les données PostgreSQL et les fichiers importés survivent à un `docker compose down && up` (volumes persistants).

### US-10.2 — Pipeline d'intégration continue (M, 5 pts)

**Critères d'acceptation**

1. Chaque pull request déclenche : installation, vérification TypeScript, lint, tests unitaires, tests d'intégration, build Docker.
2. Un échec bloque la fusion.
3. La durée totale du pipeline reste inférieure à 10 minutes.

### US-10.3 — Déploiement continu sur le VPS (M, 8 pts)

**Critères d'acceptation**

1. Une fusion sur la branche principale déclenche construction des images, connexion SSH, migrations Prisma, redémarrage Compose, vérification des health checks.
2. Un health check en échec interrompt le déploiement et laisse la version précédente en service.
3. Le service est accessible en HTTPS avec un certificat valide ; HTTP redirige vers HTTPS.

### US-10.4 — Exploitation (S, 3 pts)

**Critères d'acceptation**

1. Un endpoint `/api/sante` renvoie l'état de la base, de Redis et du worker.
2. Une sauvegarde PostgreSQL quotidienne est automatisée, avec rétention de 7 jours.
3. La procédure de restauration est documentée et **testée au moins une fois**.
4. Les conteneurs redémarrent automatiquement après un redémarrage du serveur.

---

## Récapitulatif

| Epic | Intitulé | Points | Stories |
|---|---|---|---|
| E1 | Authentification et compte | 21 | 5 |
| E2 | Import et lecture du document | 26 | 6 |
| E3 | Consentement et appel à l'IA | 34 | 6 |
| E4 | Consultation et vérification | 26 | 5 |
| E5 | Pilotage du dossier | 24 | 5 |
| E6 | Brouillon de réponse | 16 | 4 |
| E7 | Rappels et notifications | 24 | 5 |
| E8 | Sécurité et conformité | 16 | 5 |
| E9 | Qualité et tests | 18 | 4 |
| E10 | Déploiement et exploitation | 21 | 4 |
| **Total** | | **226** | **49** |

> **Alerte de capacité** : 226 points à 26 points/semaine représentent près de **9 semaines pleines**, sans aucune marge, et davantage à disponibilité partielle. L'arbitrage est traité dans `../01-cadrage/03-incoherences-et-arbitrages.md` et le backlog priorisé propose une coupe ramenant le périmètre engagé à 194 points.
