# Mise en service — VM cloud gratuite (Oracle Cloud Always Free)

> Complète la section « Déploiement » du `README.md`, qui décrit la pile
> elle-même. Ce document ne traite que de **l'obtention du serveur et de son URL
> publique**. Rien ici n'est spécifique à Oracle sauf les sections 1 à 3 : les
> sections 4 à 7 valent pour n'importe quel hébergeur.

Cible : une VM ARM64 toujours allumée, avec IP publique, à coût nul. Vérifié :
`node:20-alpine`, `postgres:17`, `redis:7-alpine` et `caddy:2-alpine` publient
tous un manifeste `linux/arm64/v8`, et `argon2` v0.44 embarque
`prebuilds/linux-arm64/argon2.armv8.musl.node`. **Aucun fichier de la pile n'est
à modifier pour ARM** : les Dockerfiles ne fixent pas de `--platform`, ils
construisent pour l'architecture de l'hôte.

---

## 0. Le calibre nécessaire, et pourquoi

Mesuré sur la pile en fonctionnement : **254 Mo de RAM** pour les six services
(back 73, worker 66, db 45, front 42, caddy 16, redis 11) et **2,7 Go d'images**.

Le fonctionnement n'est donc pas le facteur limitant. C'est le **build** :
`deploy.sh` construit les images *sur le serveur*, et `next build` plus `tsc`
sont le pic de mémoire. D'où le plancher de **4 Go de RAM**, pas 2.

| Besoin | Valeur |
|---|---|
| vCPU | 2 |
| RAM | 4 Go minimum (contrainte de build, pas de runtime) |
| Disque | 40 Go suffisent (2,7 Go d'images + volumes) |
| Ports entrants | 80 et 443 |
| Réseau | IP publique, pas de CGNAT |

---

## 1. Créer le compte — un choix irréversible

Une carte bancaire est demandée pour la vérification d'identité ; le palier
Always Free n'est pas débité, mais **relis les conditions au moment où tu crées
le compte** : elles changent sans préavis (voir l'encadré en fin de document).

> **La région d'origine (« home region ») ne peut plus être changée après la
> création du compte**, et l'allocation Always Free en Ampere A1 n'existe que
> dans cette région. Choisis donc une **région de l'UE** dès le départ —
> Frankfurt, Paris, Marseille ou Amsterdam — sinon tu héberges des données
> personnelles hors UE et il faudra refaire un compte.

---

## 2. Créer la VM

| Réglage | Valeur |
|---|---|
| Forme | `VM.Standard.A1.Flex` (Ampere, ARM64) |
| OCPU / RAM | 2 OCPU / 12 Go — le maximum Always Free depuis le 15 juin 2026 |
| Image | Canonical Ubuntu 24.04 (aarch64) |
| Volume de démarrage | 50 Go suffisent largement |
| Clé SSH | **colle ta clé publique** à la création ; il n'y a pas de mot de passe |

Génère la clé si tu n'en as pas :

```bash
ssh-keygen -t ed25519 -C "capclair-deploy"
cat ~/.ssh/id_ed25519.pub   # c'est ce contenu qu'on colle dans la console Oracle
```

Note l'**IP publique** affichée après la création. L'utilisateur de connexion
est `ubuntu` :

```bash
ssh ubuntu@<IP>
```

**Si la création échoue en « Out of capacity » :** c'est courant sur la forme
A1, l'allocation gratuite étant très demandée. Réessaie à des heures creuses, ou
change de domaine de disponibilité dans la même région. Ne change pas de région
d'origine pour contourner : tu perdrais le bénéfice UE.

---

## 3. Ouvrir 80 et 443 — il y a DEUX pare-feux

C'est le piège classique d'Oracle Cloud, et la cause n°1 des « Caddy n'obtient
pas son certificat ». Le réseau virtuel **et** le pare-feu local de l'image
Ubuntu bloquent tous les deux. Ouvrir un seul des deux ne donne rien.

**3a — Côté réseau virtuel (console Oracle).** Dans le VCN, sur la *security
list* (ou le *network security group*) du sous-réseau de la VM, ajouter deux
règles d'entrée :

| Source | Protocole | Port de destination |
|---|---|---|
| `0.0.0.0/0` | TCP | 80 |
| `0.0.0.0/0` | TCP | 443 |

**3b — Côté machine (en SSH).** L'image Ubuntu d'Oracle arrive avec des règles
`iptables` qui rejettent tout sauf SSH :

```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Vérifier que les deux couches sont bien ouvertes **avant** de lancer le
déploiement, depuis ta machine :

```bash
nc -zv <IP> 80 && nc -zv <IP> 443
```

Tant que ces deux tests échouent, inutile d'aller plus loin : Caddy ne pourra
pas répondre au défi ACME de Let's Encrypt.

---

## 4. Poser l'enregistrement DNS

Chez ton registrar, un enregistrement **A** du domaine (ou d'un sous-domaine,
`app.` par exemple) vers l'IP publique de la VM. Attendre la propagation :

```bash
dig +short <domaine>    # doit renvoyer l'IP de la VM
```

**À faire avant le premier `deploy.sh`.** Sans résolution DNS correcte,
l'émission du certificat échoue, et Let's Encrypt applique une limite de débit
sur les tentatives répétées.

---

## 5. Installer Docker et le plugin Compose

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
# Se reconnecter pour que l'appartenance au groupe prenne effet :
exit && ssh ubuntu@<IP>
docker compose version   # doit répondre, sinon le plugin manque
```

---

## 6. Déployer

```bash
git clone <url-du-depot> capclair && cd capclair/07-developpement
cp .env.prod.example .env.prod
nano .env.prod          # PUBLIC_DOMAIN, POSTGRES_*, DATABASE_URL,
                        # APP_BASE_URL=https://<domaine>, ANTHROPIC_API_KEY...
./deploy.sh
```

Rappels tirés du gabarit :

- `DATABASE_URL` vise l'hôte **`db`** sur le port **5432** (réseau interne de
  Compose), jamais `localhost` ;
- `APP_BASE_URL` doit valoir `https://<PUBLIC_DOMAIN>` ;
- ne pas renseigner `COOKIE_SECURE`, `TRUST_PROXY` ni `RATE_LIMIT_REDIS` : le
  Compose les force déjà.

`deploy.sh` fait un `git pull --ff-only`. Si le dépôt est privé, pose une clé de
déploiement en lecture seule sur la VM, sinon le script échouera à la première
mise à jour.

---

## 7. Vérifier — c'est le critère de fin de sprint

Le sprint exige une URL publique « vérifiable par quelqu'un d'autre que
l'auteur ». Donc on vérifie de l'extérieur, pas depuis la VM :

```bash
curl -fsS https://<domaine>/api/sante
# attendu : {"status":"ok","db":"ok","redis":"ok",...}
```

Puis le parcours complet à la main dans un navigateur : inscription, import d'un
courrier de `05-courriers-fictifs/`, consentement fictif, consentement IA,
analyse, écran de résultat. C'est ce parcours-là qui coche l'étape 12 de T2.

---

## Pannes connues, et ce qu'elles veulent dire

| Symptôme | Cause la plus probable |
|---|---|
| `nc -zv <IP> 80` échoue | Une seule des deux couches de la section 3 est ouverte |
| Caddy boucle sur « obtaining certificate » | DNS pas encore propagé, ou 80 fermé (le défi ACME passe par 80) |
| Le build est tué pendant `next build` | Pas assez de RAM. Avec 12 Go ce ne doit pas arriver ; sur une machine plus petite, ajouter du swap |
| `Out of capacity` à la création | Forme A1 saturée ; réessayer plus tard ou changer de domaine de disponibilité |
| `permission denied` sur `./deploy.sh` | Bit exécutable perdu : `chmod +x deploy.sh` |
| `./deploy.sh: bad interpreter` | Fins de ligne CRLF. `.gitattributes` l'empêche, mais vérifier que le clone est récent |

---

## Ce que « gratuit » veut dire ici

L'allocation Always Free en Ampere A1 **est passée de 4 OCPU / 24 Go à 2 OCPU /
12 Go le 15 juin 2026**, sans annonce : la documentation a simplement été mise à
jour. C'est toujours trois fois notre besoin, mais la leçon compte — ces
conditions sont révocables unilatéralement.

Conséquence à assumer : une démonstration de jury ou un entretien ne devrait pas
dépendre d'un palier gratuit susceptible d'être réduit la veille. Si l'échéance
du 25 octobre compte, garder en réserve le repli d'ADR-018 — un VPS payé à
quelques euros par mois, où rien de ce document ne change à partir de la
section 4.

Et le jour où de vrais courriers entrent en jeu, ce serveur n'est plus le bon :
données de santé, article 9 du RGPD, hébergement HDS, AIPD et politique de
sous-traitance couvrant l'envoi de texte à un prestataire d'IA hors UE. C'est
déjà consigné en Phase 2 du plan de consolidation comme bloquant.

---

## Sources

- [Oracle quietly halves Free Tier Ampere A1 limits (InfoQ, juillet 2026)](https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/)
- [OCI Always Free : allocation Ampere A1 mise à jour (Oracle Cloud Customer Connect)](https://community.oracle.com/customerconnect/discussion/970310/oci-always-free-updated-ampere-a1-compute-allocation)
- [Enabling network traffic to Ubuntu images in OCI (blog Oracle)](https://blogs.oracle.com/developers/enabling-network-traffic-to-ubuntu-images-in-oracle-cloud-infrastructure)
- [Opening up port 80 and 443 for Oracle Cloud servers](https://dev.to/armiedema/opening-up-port-80-and-443-for-oracle-cloud-servers-j35)
