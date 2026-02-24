# Utiliser l'image de base AWS Lambda pour Node.js 24
FROM public.ecr.aws/lambda/nodejs:24

# Définir le répertoire de travail
WORKDIR ${LAMBDA_TASK_ROOT}

# Copier le package.json et installer les dépendances
COPY package*.json ./
RUN npm ci --only=production

# Copier tout le code source compilé
COPY dist/ ./

# Vérifier que le fichier handler existe (pour debug)
RUN ls -la dynamodb-stream-processor.js || echo "Handler file not found!"

# Définir le handler
CMD [ "dynamodb-stream-processor.handler" ]