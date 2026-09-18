#!/usr/bin/env bash
# Déploiement manuel (décision #6 : pas de CD ce sprint).
# Usage, depuis 07-developpement/ sur le serveur : ./deploy.sh
set -euo pipefail

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)

if [ ! -f .env.prod ]; then
  echo "Erreur : .env.prod absent. Copier .env.prod.example et le renseigner." >&2
  exit 1
fi

# PUBLIC_DOMAIN sert à la sonde finale. Il est lu depuis .env.prod plutôt
# qu'attendu dans l'environnement du shell : le script est lancé sans préambule.
PUBLIC_DOMAIN=$(grep -E '^PUBLIC_DOMAIN=' .env.prod | head -1 | cut -d= -f2-)
if [ -z "${PUBLIC_DOMAIN}" ]; then
  echo "Erreur : PUBLIC_DOMAIN vide dans .env.prod." >&2
  exit 1
fi

echo "== Récupération du code =="
git pull --ff-only

echo "== Construction des images =="
"${COMPOSE[@]}" build

echo "== Démarrage (migrations appliquées par le service back) =="
"${COMPOSE[@]}" up -d --wait

echo "== État =="
"${COMPOSE[@]}" ps

echo "== Sonde de santé =="
# `--wait` a déjà attendu que back et front soient sains ; cette sonde vérifie
# en plus la chaîne complète TLS + Caddy, vue de l'extérieur.
curl -fsS "https://${PUBLIC_DOMAIN}/api/sante" && echo " -> OK"
