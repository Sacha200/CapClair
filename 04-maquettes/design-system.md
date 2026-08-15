# Design System — CapClair

Documentation de référence du système de design. La source visuelle vivante est la page **🎨 Design
System** du fichier Figma : [CapClair — Wireframes MVP](https://www.figma.com/design/ikpl3eoij9BEAwIYsfSLNO).

## Positionnement — inspiré du DSFR, sans en être

CapClair traite des courriers de l'administration : s'ancrer visuellement dans cet univers rassure
l'utilisateur. On s'inspire du **Système de Design de l'État (DSFR)** — typographies, échelle
d'espacement, contrastes AA, bleu institutionnel — **sans l'utiliser tel quel** :

1. **Juridique** — les conditions d'utilisation du DSFR le réservent aux sites de l'État et de ses
   opérateurs ; un service privé n'y a pas droit.
2. **Positionnement** — le bloc-marque « Marianne / République Française » garantit à l'usager un site
   *officiel*. CapClair doit affirmer l'inverse. Aucun logo RF, aucun bloc-marque officiel.

## Tokens de couleur

Collection Figma `CapClair · Tokens`. Tous les fills des composants sont **liés à ces variables**.

| Groupe | Token | Hex | Usage |
|---|---|---|---|
| Marque | `primary` | `#1F5F8B` | Actions principales, liens, éléments actifs |
| Marque | `primary-hover` | `#184C6F` | Survol du primaire |
| Marque | `primary-active` | `#12384F` | Pressé |
| Marque | `primary-light` | `#EAF2F8` | Fonds accentués, survol secondaire |
| Sémantique | `success` / `success-light` | `#2E7D46` / `#E6F2EA` | Statut « terminé », succès |
| Sémantique | `warning` / `warning-light` | `#C8611A` / `#FBEBDD` | « À vérifier », action requise |
| Sémantique | `error` / `error-light` | `#B42318` / `#FCEBEA` | Erreurs, échecs |
| Texte | `text-strong` | `#1B2733` | Titres |
| Texte | `text-default` | `#2A3441` | Texte courant |
| Texte | `text-muted` | `#5A6472` | Métadonnées, aides |
| Texte | `text-on-primary` | `#FFFFFF` | Texte sur fond primaire |
| Surface | `bg-page` / `bg-surface` / `bg-subtle` | `#F5F7FA` / `#FFFFFF` / `#EEF2F6` | Fonds |
| Bordure | `border` / `border-strong` | `#D4DAE0` / `#A9B3BE` | Séparateurs, contours |

Contrastes texte/fond conformes **WCAG 2.1 AA**.

## Typographie

**Marianne** pour les titres et l'interface, **Spectral** pour le texte de lecture (résumés, contenu
de courriers, mentions légales). ⚠️ Marianne étant indisponible dans l'environnement Figma, elle est
**substituée par Mulish** dans la maquette ; **la production utilise la vraie Marianne**.

| Style | Police | Taille / interligne | Usage |
|---|---|---|---|
| Display | Marianne ExtraBold | 32 / 40 | Grands titres |
| Heading/H1 | Marianne Bold | 26 / 32 | Titre d'écran |
| Heading/H2 | Marianne Bold | 20 / 28 | Titre de section |
| Heading/H3 | Marianne SemiBold | 16 / 22 | Titre de carte |
| Label/Strong | Marianne SemiBold | 14 / 20 | Libellé accentué |
| Label/Default | Marianne Medium | 14 / 20 | Libellé |
| UI/Default | Marianne Regular | 14 / 20 | Texte d'interface |
| UI/Small | Marianne Regular | 12 / 18 | Métadonnées, aides |
| UI/Button | Marianne SemiBold | 14 / 16 | Texte de bouton |
| Reading/Default | Spectral Regular | 16 / 26 | Texte de lecture |
| Reading/Small | Spectral Regular | 14 / 22 | Note de lecture |

## Espacement, rayons, élévation

**Espacement** — échelle base 4 px : 4 (xs), 8 (sm), 12 (md), 16 (lg), 20 (xl), 24 (2xl), 32 (3xl),
40 (4xl), 48 (5xl).

**Rayons** — 4 (champs), 6 (boutons), 8 (lignes/chips), 10 (cartes internes), 12 (cartes), 16
(conteneurs), 20 (pastilles/pills).

**Élévation** — trois styles d'ombre : `sm` (cartes au repos), `md` (survol / avant-plan), `lg` (modales).

## Composants

| Composant | Variants / états | Tokens principaux | Accessibilité |
|---|---|---|---|
| **Bouton** | Primaire / Secondaire / Tertiaire × Default / Hover, + Désactivé | `primary`, `primary-hover`, `primary-light`, `on-primary` | Focus clavier visible, cible ≥ 44 px, `role=button` |
| **Champ de saisie** | Default / Focus / Filled | `surface`, `border`, `primary` (focus 2 px) | Label associé, bordure focus accentuée |
| **Case à cocher** | Décochée / Cochée | `surface`, `border-strong`, `primary` | `role=checkbox`, cochable au clavier |
| **Bouton radio** | Non sélectionné / Sélectionné | `border-strong`, `primary` | `role=radio`, groupe navigable aux flèches |
| **Interrupteur** | Off / On | `border-strong`, `primary` | `role=switch`, état annoncé |
| **Badge de statut** | 4 statuts (À analyser, À faire, En attente de réponse, Terminé) — réduit de 6 après tests (D9) | `bg-subtle`, pastille colorée | Pastille **+ libellé texte** — jamais la couleur seule |
| **Badge de confiance** | « À vérifier » | `warning-light`, `warning` | Icône **+ texte** explicite |
| **Alerte** | Info / Succès / Attention / Erreur | tints sémantiques | Icône + titre + texte, couleur non porteuse seule d'information |
| **Header / Footer** | — | `surface`, `subtle`, `border`, `primary` | Nav au clavier, item actif souligné |

### Principe d'accessibilité transverse

L'information n'est **jamais portée par la couleur seule** : chaque statut, alerte ou niveau de
confiance associe une forme (pastille, icône) et un libellé texte. Cible tactile minimale 44 px.
Contrastes AA. Ces règles servent le persona principal (Nadia, faible aisance numérique).

## Iconographie

Bibliothèque **Remix Icon** (open source, licence Apache 2.0) — **la même que le Système de Design de
l'État (DSFR)**, cohérent avec notre parti pris d'inspiration DSFR. Rendue en React via `@remixicon/react`.
Icônes 24×24. Le champ `icon` de la table `Category` **stocke le nom Remix** (ex. `ri-calendar-line`),
ce qui découple le code métier du rendu.

Mapping des catégories d'information :

| Code catégorie | Icône Remix | Usage |
|---|---|---|
| `REFERENCE` | `ri-hashtag` | Référence, n° de dossier |
| `MONTANT` | `ri-money-euro-circle-line` | Montants |
| `DATE` | `ri-calendar-line` | Dates, échéances |
| `IDENTITE` | `ri-user-line` | Identité |
| `CONTACT` | `ri-phone-line` | Coordonnées |
| `AUTRE` | `ri-information-line` | Autre information |

Icônes d'interface clés : `ri-alert-line` (confiance faible / à vérifier), `ri-checkbox-circle-line`
(terminé), `ri-folder-line` (dossier), `ri-upload-2-line` (importer). Documentées dans la section
**Iconographie** de la page Figma (les glyphes affichés y sont indicatifs ; le rendu final utilise les
vraies icônes Remix).

> Convention : variantes **`-line`** (contour) par défaut, cohérentes avec le trait de l'interface ;
> les variantes `-fill` sont réservées aux états actifs si besoin. Le champ `icon` restant agnostique,
> un changement de bibliothèque n'impacterait que le rendu.

## État

La charte est appliquée aux **10 écrans** de la page ✨ Hi-Fi. Reste possible pour plus tard :
documenter les états d'interaction (hover, focus clavier) et brancher un prototype cliquable.
