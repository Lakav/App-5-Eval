# Utilise l'image officielle Node.js 20 pour une meilleure compatibilité et support à long terme
FROM node:20-slim

# Définit le répertoire de travail
WORKDIR /app

# Copie les fichiers package.json et package-lock.json
COPY package*.json ./

# Installe les dépendances Node.js
RUN npm install --omit=dev && npm cache clean --force

# Copie le code source
COPY classifier.js ./

# Crée un utilisateur non-root pour la sécurité
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Change la propriété des fichiers
RUN chown -R nodejs:nodejs /app
USER nodejs

# Variables d'environnement par défaut
ENV NODE_ENV=production

# Commande par défaut
CMD ["node", "classifier.js"]