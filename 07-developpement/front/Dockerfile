# Contexte de build attendu : 07-developpement/ (le workspace, pas front/).
#   docker build -f front/Dockerfile .
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY contract/package.json ./contract/
COPY back/package.json ./back/
COPY front/package.json ./front/
RUN npm ci --ignore-scripts

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# BACK_ORIGIN n'est pas figé ici : en sortie autonome, next.config.ts est
# réévalué au démarrage du serveur (vérifié : « Running next.config » au boot),
# donc la destination du rewrite est lue au runtime.
RUN npm run build --workspace @capclair/contract \
 && npm run build --workspace front

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Disposition de la sortie autonome vérifiée en local : `outputFileTracingRoot`
# pointant sur le workspace, server.js atterrit sous front/ et node_modules à la
# racine. `@capclair/contract` n'y figure pas comme paquet : transpilePackages
# l'inline dans les chunks serveur (vérifié, ses messages FR y sont présents).
COPY --from=build /app/front/.next/standalone ./
COPY --from=build /app/front/.next/static ./front/.next/static
COPY --from=build /app/front/public ./front/public
USER node
EXPOSE 3000
CMD ["node", "front/server.js"]
