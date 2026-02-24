# Utilise l'image officielle Node.js 18 Alpine pour une taille réduite
FROM node:18-alpine

# Définit le répertoire de travail dans le conteneur
WORKDIR /app

# Copie les fichiers package.json
COPY package.json ./

# Installe les dépendances
RUN npm install --omit=dev && npm cache clean --force

# Copie le code source de l'application
COPY server.js ./

# Crée un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change la propriété des fichiers vers l'utilisateur nodejs
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose le port 3000
EXPOSE 3000

# Définit les variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000

# Commande de santé pour Docker
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { host: 'localhost', port: process.env.PORT || 3000, path: '/health', timeout: 2000 }; \
    const request = http.request(options, (res) => { \
      if (res.statusCode == 200) process.exit(0); else process.exit(1); \
    }); \
    request.on('error', () => process.exit(1)); \
    request.end();"

# Commande pour démarrer l'application
CMD ["npm", "start"]