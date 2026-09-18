# Image commune API + worker : même code, commandes différentes.
# Contexte de build attendu : 07-developpement/ (le workspace, pas back/).
#   docker build -f back/Dockerfile .
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY contract/package.json ./contract/
COPY back/package.json ./back/
COPY front/package.json ./front/
# --ignore-scripts : le postinstall de Prisma aurait besoin du schéma, absent à
# ce stade. Sans risque pour argon2 : la v0.44 embarque ses binaires précompilés
# (prebuilds/linux-x64/argon2.musl.node), elle ne compile rien à l'installation.
RUN npm ci --ignore-scripts

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prisma generate` charge prisma.config.ts, qui résout env("DATABASE_URL") au
# chargement : sans valeur, PrismaConfigEnvError. La génération ne se connecte
# pas — cette URL factice n'est jamais utilisée, la vraie vient de .env.prod.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
RUN npm run build --workspace @capclair/contract \
 && npm run build --workspace capclair-back

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# node_modules complet, dépendances de développement comprises : le service back
# lance `prisma migrate deploy` au démarrage, ce qui exige la CLI `prisma`
# (devDependency) et le chargeur TypeScript qu'elle embarque pour prisma.config.ts.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/contract/dist ./contract/dist
COPY --from=build /app/contract/package.json ./contract/package.json
COPY --from=build /app/back/dist ./back/dist
COPY --from=build /app/back/package.json ./back/package.json
COPY --from=build /app/back/prisma ./back/prisma
COPY --from=build /app/back/prisma.config.ts ./back/prisma.config.ts
WORKDIR /app/back
# Volume de stockage des PDF (ADR-012). Monté depuis l'hôte en production.
RUN mkdir -p /app/back/storage && chown -R node:node /app/back/storage
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
