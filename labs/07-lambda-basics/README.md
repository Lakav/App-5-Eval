# Lab 07 - AWS Lambda Basics

## Objectifs d'apprentissage

À la fin de ce lab, vous serez capable de :

- Créer et déployer une fonction Lambda en TypeScript
- Configurer EventBridge pour déclencher une Lambda
- Lire des fichiers S3 depuis une Lambda
- Créer une Lambda avec un conteneur Docker
- Utiliser DynamoDB Streams pour déclencher une Lambda
- Gérer les logs CloudWatch pour les fonctions Lambda

## Prérequis

- Avoir complété le lab 00-setup
- Session AWS SSO active (`aws-labs` profile)
- Connaissances de base en TypeScript
- Docker installé (pour la partie 2)

## Durée estimée

90 minutes (45 min par partie)

## Architecture du Lab

### Partie 1 : Lambda avec EventBridge et S3

```
EventBridge Rule → Lambda Function → S3 Bucket → CloudWatch Logs
```

### Partie 2 : Lambda avec Conteneur et DynamoDB Streams

```
DynamoDB Table → DynamoDB Stream → Lambda Container → S3 Bucket
```

## Partie 1 : Lambda TypeScript avec EventBridge et S3

### Étape 1 : Déployer l'infrastructure

1. Déployez l'infrastructure CloudFormation :

```bash
cd labs/07-lambda-basics
aws cloudformation deploy \
  --template-file resources/part1-infrastructure.yaml \
  --stack-name lambda-basics-part1 \
  --capabilities CAPABILITY_NAMED_IAM \
  --profile aws-labs
```

2. Vérifiez que les ressources sont créées :

```bash
aws cloudformation describe-stacks \
  --stack-name lambda-basics-part1 \
  --profile aws-labs \
  --query 'Stacks[0].Outputs'
```

### Étape 2 : Préparer la fonction Lambda

1. Installez les dépendances :

```bash
npm install
```

2. Examinez le code de la fonction Lambda dans `src/s3-processor.ts`

3. Compilez le TypeScript :

```bash
npm run build
```

### Étape 3 : Créer le package de déploiement

1. Créez le fichier ZIP pour Lambda :

```bash
npm run package:part1
```

### Étape 4 : Déployer la fonction Lambda

1. Récupérez le nom du rôle IAM créé :

```bash
ROLE_ARN=$(aws cloudformation describe-stacks \
  --stack-name lambda-basics-part1 \
  --profile aws-labs \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaRoleArn`].OutputValue' \
  --output text)
```

2. Créez la fonction Lambda :

```bash
aws lambda create-function \
  --function-name s3-file-processor \
  --runtime nodejs24.x \
  --role $ROLE_ARN \
  --handler s3-processor.handler \
  --zip-file fileb://dist/s3-processor.zip \
  --timeout 30 \
  --profile aws-labs
```

### Étape 5 : Configurer EventBridge

1. Récupérez l'ARN de la fonction Lambda :

```bash
LAMBDA_ARN=$(aws lambda get-function \
  --function-name s3-file-processor \
  --profile aws-labs \
  --query 'Configuration.FunctionArn' \
  --output text)
```

2. Créez la règle EventBridge :

```bash
aws events put-rule \
  --name s3-file-created-rule \
  --event-pattern file://resources/eventbridge-pattern.json \
  --profile aws-labs
```

3. Ajoutez la Lambda comme cible :

```bash
aws events put-targets \
  --rule s3-file-created-rule \
  --targets "Id"="1","Arn"="$LAMBDA_ARN" \
  --profile aws-labs
```

4. Donnez permission à EventBridge d'invoquer la Lambda :

```bash
aws lambda add-permission \
  --function-name s3-file-processor \
  --statement-id allow-eventbridge \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:eu-west-1:$(aws sts get-caller-identity --query Account --output text):rule/s3-file-created-rule \
  --profile aws-labs
```

### Étape 6 : Tester la fonction

1. Récupérez le nom du bucket S3 :

```bash
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name lambda-basics-part1 \
  --profile aws-labs \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
  --output text)
```

2. Uploadez le fichier de test :

```bash
aws s3 cp data/sample-data.json s3://$BUCKET_NAME/data.json --profile aws-labs
```

3. Vérifiez les logs CloudWatch :

```bash
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/s3-file-processor \
  --profile aws-labs
```

4. Consultez les logs récents :

```bash
aws logs tail /aws/lambda/s3-file-processor --follow --profile aws-labs
```

## Partie 2 : Lambda avec Conteneur et DynamoDB Streams

### Étape 7 : Valider l'environnement Docker

Avant de commencer la partie 2, vérifiez que Docker est installé et fonctionnel :

#### Pour les utilisateurs de Dev Container

Si vous utilisez un dev container, utilisez le script de configuration spécialisé :

```bash
./setup-docker-devcontainer.sh
```

Ce script va :

- Vérifier que Docker-in-Docker est configuré
- Démarrer le service Docker si nécessaire
- Configurer les permissions utilisateur
- Tester la construction d'images Docker

#### Pour les utilisateurs locaux

```bash
./validate-docker.sh
```

Si Docker n'est pas installé, téléchargez Docker Desktop depuis [docker.com](https://www.docker.com/products/docker-desktop).

#### Dépannage Dev Container

Si vous rencontrez des problèmes avec Docker dans votre dev container :

1. **Reconstruire le dev container** : Votre `.devcontainer/devcontainer.json` doit inclure la feature `docker-in-docker`
2. **Redémarrer le terminal** après l'ajout au groupe docker
3. **Vérifier les permissions** : `docker ps` doit fonctionner sans sudo

### Étape 8 : Déployer l'infrastructure pour la partie 2

```bash
aws cloudformation deploy \
  --template-file resources/part2-infrastructure.yaml \
  --stack-name lambda-basics-part2 \
  --capabilities CAPABILITY_NAMED_IAM \
  --profile aws-labs
```

### Étape 9 : Construire l'image Docker

1. Examinez le Dockerfile et le code dans `src/dynamodb-stream-processor.ts`

2. Construisez l'image Docker avec les paramètres de compatibilité Lambda :

```bash
# Méthode recommandée : Utiliser le script npm
npm run build:docker

# Si vous obtenez une erreur de plateforme, essayez d'abord :
docker pull --platform linux/amd64 public.ecr.aws/lambda/nodejs:24

# Alternative manuelle si le script npm ne fonctionne pas
DOCKER_BUILDKIT=0 docker build --platform linux/amd64 -t lambda-dynamodb-processor .

# En cas de problème persistant avec Node.js 24, utilisez Node.js 22
sed -i 's/nodejs:24/nodejs:22/g' Dockerfile
DOCKER_BUILDKIT=0 docker build --platform linux/amd64 -t lambda-dynamodb-processor .
```

**Important** :

- `DOCKER_BUILDKIT=0` force l'utilisation du builder classique
- `--platform linux/amd64` assure la compatibilité avec Lambda
- Si Node.js 24 n'est pas disponible pour votre plateforme, Node.js 22 est une alternative stable
- En cas d'erreur de plateforme, nettoyez le cache Docker avec `docker system prune -a -f`

### Étape 10 : Pousser l'image vers ECR

1. Récupérez l'URI du repository ECR :

```bash
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name lambda-basics-part2 \
  --profile aws-labs \
  --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryUri`].OutputValue' \
  --output text)
```

2. Connectez-vous à ECR :

```bash
aws ecr get-login-password --region eu-west-1 --profile aws-labs | \
docker login --username AWS --password-stdin $ECR_URI
```

3. Taguez et poussez l'image avec les bonnes options :

```bash
# Taguer l'image pour ECR
docker tag lambda-dynamodb-processor:latest $ECR_URI:latest

# Pousser l'image vers ECR avec le bon format de manifest
docker push $ECR_URI:latest
```

### Étape 11 : Créer la fonction Lambda avec conteneur

1. Récupérez le rôle IAM pour la partie 2 :

```bash
ROLE_ARN_P2=$(aws cloudformation describe-stacks \
  --stack-name lambda-basics-part2 \
  --profile aws-labs \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaRoleArn`].OutputValue' \
  --output text)
```

2. Créez la fonction Lambda :

```bash
# Récupérer le nom du bucket S3 pour l'historique
BUCKET_NAME_P2=$(aws cloudformation describe-stacks \
  --stack-name lambda-basics-part2 \
  --profile aws-labs \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
  --output text)

aws lambda create-function \
  --function-name dynamodb-stream-processor \
  --role $ROLE_ARN_P2 \
  --code ImageUri=$ECR_URI:latest \
  --package-type Image \
  --timeout 60 \
  --environment Variables="{HISTORY_BUCKET_NAME=$BUCKET_NAME_P2}" \
  --profile aws-labs
```

### Étape 12 : Configurer le trigger DynamoDB Stream

1. Récupérez l'ARN du stream DynamoDB :

```bash
STREAM_ARN=$(aws cloudformation describe-stacks \
  --stack-name lambda-basics-part2 \
  --profile aws-labs \
  --query 'Stacks[0].Outputs[?OutputKey==`DynamoDBStreamArn`].OutputValue' \
  --output text)
```

2. Créez le mapping d'événements :

```bash
aws lambda create-event-source-mapping \
  --function-name dynamodb-stream-processor \
  --event-source-arn $STREAM_ARN \
  --starting-position LATEST \
  --profile aws-labs
```

### Étape 13 : Tester avec DynamoDB

1. Récupérez le nom de la table DynamoDB :

```bash
TABLE_NAME=$(aws cloudformation describe-stacks \
  --stack-name lambda-basics-part2 \
  --profile aws-labs \
  --query 'Stacks[0].Outputs[?OutputKey==`DynamoDBTableName`].OutputValue' \
  --output text)
```

2. Ajoutez un élément à la table :

```bash
aws dynamodb put-item \
  --table-name $TABLE_NAME \
  --item file://data/sample-item.json \
  --profile aws-labs
```

3. Modifiez l'élément :

```bash
aws dynamodb update-item \
  --table-name $TABLE_NAME \
  --key '{"id":{"S":"test-item-1"}}' \
  --update-expression "SET #status = :status" \
  --expression-attribute-names '{"#status":"status"}' \
  --expression-attribute-values '{":status":{"S":"updated"}}' \
  --profile aws-labs
```

4. Vérifiez les logs de la Lambda conteneur :

```bash
aws logs tail /aws/lambda/dynamodb-stream-processor --follow --profile aws-labs
```

5. Vérifiez que le fichier historique a été créé dans S3 :

```bash
BUCKET_NAME_P2=$(aws cloudformation describe-stacks \
  --stack-name lambda-basics-part2 \
  --profile aws-labs \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
  --output text)

aws s3 ls s3://$BUCKET_NAME_P2/history/ --profile aws-labs
```

## Validation

### Partie 1

- [ ] La fonction Lambda s3-file-processor est créée
- [ ] EventBridge déclenche la Lambda quand un fichier est uploadé
- [ ] Les logs CloudWatch montrent le contenu du fichier JSON
- [ ] Aucune erreur dans les logs

### Partie 2

- [ ] L'image Docker est construite et poussée vers ECR
- [ ] La fonction Lambda conteneur est créée
- [ ] DynamoDB Stream déclenche la Lambda
- [ ] Les fichiers d'historique sont créés dans S3
- [ ] Les logs montrent les changements OLD/NEW

### Nettoyage automatique

Le script de nettoyage automatique gère tous les aspects du nettoyage :

```bash
./cleanup.sh
```

**Important**: Le script s'arrête sur certains retours de commande, appuyer sur Q à chaque fois après avoir vérifier que l'action a eu lieu.

## Nettoyage

```bash
# Supprimer les fonctions Lambda
aws lambda delete-function --function-name s3-file-processor --profile aws-labs
aws lambda delete-function --function-name dynamodb-stream-processor --profile aws-labs

# Supprimer les règles EventBridge
aws events remove-targets --rule s3-file-created-rule --ids 1 --profile aws-labs
aws events delete-rule --name s3-file-created-rule --profile aws-labs

# Supprimer les stacks CloudFormation
aws cloudformation delete-stack --stack-name lambda-basics-part1 --profile aws-labs
aws cloudformation delete-stack --stack-name lambda-basics-part2 --profile aws-labs

# Nettoyer les images Docker locales
docker rmi lambda-dynamodb-processor:latest
```

### Nettoyage manuel en cas d'erreur S3 ou ECR

Si vous obtenez des erreurs de ressources non vides, nettoyez manuellement :

**Erreur S3 "bucket not empty" :**

```bash
# Pour la partie 1
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name lambda-basics-part1 --profile aws-labs --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text)

# Supprimer tous les objets et versions
aws s3 rm s3://$BUCKET_NAME --recursive --profile aws-labs
aws s3api list-object-versions --bucket $BUCKET_NAME --profile aws-labs --query 'Versions[].{Key:Key,VersionId:VersionId}' --output text | while read key version; do
    aws s3api delete-object --bucket $BUCKET_NAME --key "$key" --version-id "$version" --profile aws-labs
done

# Pour la partie 2
HISTORY_BUCKET=$(aws cloudformation describe-stacks --stack-name lambda-basics-part2 --profile aws-labs --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text)

aws s3 rm s3://$HISTORY_BUCKET --recursive --profile aws-labs
aws s3api list-object-versions --bucket $HISTORY_BUCKET --profile aws-labs --query 'Versions[].{Key:Key,VersionId:VersionId}' --output text | while read key version; do
    aws s3api delete-object --bucket $HISTORY_BUCKET --key "$key" --version-id "$version" --profile aws-labs
done
```

**Erreur ECR "repository contains images" :**

```bash
# Récupérer le nom du repository ECR
ECR_REPO_NAME=$(aws cloudformation describe-stacks --stack-name lambda-basics-part2 --profile aws-labs --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryUri`].OutputValue' --output text | cut -d'/' -f2)

# Lister toutes les images
aws ecr list-images --repository-name $ECR_REPO_NAME --profile aws-labs

# Supprimer toutes les images
IMAGE_IDS=$(aws ecr list-images --repository-name $ECR_REPO_NAME --profile aws-labs --query 'imageIds[*]' --output json)
aws ecr batch-delete-image --repository-name $ECR_REPO_NAME --image-ids "$IMAGE_IDS" --profile aws-labs
```

**Puis supprimer les stacks :**

```bash
aws cloudformation delete-stack --stack-name lambda-basics-part1 --profile aws-labs
aws cloudformation delete-stack --stack-name lambda-basics-part2 --profile aws-labs
```

## Dépannage

### Problèmes courants

1. **Lambda timeout** : Augmentez le timeout de la fonction
2. **Permissions IAM** : Vérifiez que les rôles ont les bonnes permissions
3. **EventBridge ne déclenche pas** : Vérifiez le pattern d'événements
4. **Docker build échoue** : Vérifiez que Docker est démarré
5. **ECR push échoue** : Vérifiez l'authentification ECR
6. **Erreur "image manifest not supported"** :
   - Utilisez `DOCKER_BUILDKIT=0` et `--platform linux/amd64` lors du build Docker
   - Reconstruisez et repoussez l'image avec les bons paramètres
   - Supprimez l'ancienne fonction Lambda et recréez-la
7. **Erreur "Runtime.InvalidEntrypoint"** :
   - Vérifiez que le code TypeScript est compilé : `npm run build`
   - Vérifiez que le fichier `dist/dynamodb-stream-processor.js` existe
   - Reconstruisez l'image Docker après compilation
   - Vérifiez que le handler est exporté correctement

### Solutions pour l'erreur de manifest Docker

Si vous obtenez l'erreur "image manifest, config or layer media type not supported" :

```bash
# 1. Supprimer l'ancienne fonction Lambda
aws lambda delete-function --function-name dynamodb-stream-processor --profile aws-labs

# 2. Supprimer l'image ECR existante
aws ecr batch-delete-image \
  --repository-name lambda-basics-part2-lambda-container \
  --image-ids imageTag=latest \
  --profile aws-labs

# 3. Nettoyer les images Docker locales
docker rmi lambda-dynamodb-processor:latest || true
docker rmi $ECR_URI:latest || true

# 4. Reconstruire avec le format de manifest compatible
DOCKER_BUILDKIT=0 docker build --platform linux/amd64 -t lambda-dynamodb-processor .

# 5. Vérifier l'image construite
docker inspect lambda-dynamodb-processor:latest

# 6. Retagger et repousser
docker tag lambda-dynamodb-processor:latest $ECR_URI:latest
docker push $ECR_URI:latest

# 7. Recréer la fonction Lambda
aws lambda create-function \
  --function-name dynamodb-stream-processor \
  --role $ROLE_ARN_P2 \
  --code ImageUri=$ECR_URI:latest \
  --package-type Image \
  --timeout 60 \
  --environment Variables="{HISTORY_BUCKET_NAME=$BUCKET_NAME_P2}" \
  --profile aws-labs
```

#### Alternative avec Docker Buildx désactivé

Si le problème persiste, désactivez complètement Docker Buildx :

```bash
# Désactiver buildx temporairement
docker buildx uninstall

# Construire avec le builder classique
docker build --platform linux/amd64 -t lambda-dynamodb-processor .

# Réactiver buildx après (optionnel)
docker buildx install
```

#### Solutions pour l'erreur Runtime.InvalidEntrypoint

Si vous obtenez l'erreur "Runtime.InvalidEntrypoint", suivez ces étapes de débogage :

**Étape 1 : Vérifier la compilation TypeScript**

```bash
# 1. Nettoyer et recompiler
npm run clean
npm run build

# 2. Vérifier que le fichier JavaScript existe
ls -la dist/
ls -la dist/dynamodb-stream-processor.js

# 3. Vérifier le contenu du fichier compilé
head -30 dist/dynamodb-stream-processor.js
```

**Étape 2 : Vérifier l'export du handler**

```bash
# Vérifier que l'export est présent dans le fichier compilé
grep -n "exports.handler\|module.exports.handler" dist/dynamodb-stream-processor.js
```

**Étape 3 : Tester la compilation localement**

```bash
# Tester que le module peut être chargé
node -e "console.log(require('./dist/dynamodb-stream-processor.js'))"
```

**Étape 4 : Reconstruire l'image Docker avec debug**

```bash
# Construire avec vérification
DOCKER_BUILDKIT=0 docker build --platform linux/amd64 -t lambda-dynamodb-processor .

# Vérifier le contenu de l'image (IMPORTANT: ne pas override le CMD)
docker run --rm --platform linux/amd64 lambda-dynamodb-processor:latest --help

# Alternative pour vérifier les fichiers dans l'image
docker run --rm --entrypoint="" lambda-dynamodb-processor:latest ls -la

# Vérifier que le fichier handler existe
docker run --rm --entrypoint="" lambda-dynamodb-processor:latest ls -la dynamodb-stream-processor.js

# Vérifier le contenu du handler
docker run --rm --entrypoint="" lambda-dynamodb-processor:latest head -20 dynamodb-stream-processor.js
```

**Étape 5 : Mettre à jour la fonction Lambda**

```bash
# Retagger et repousser
docker tag lambda-dynamodb-processor:latest $ECR_URI:latest
docker push $ECR_URI:latest

# Mettre à jour la fonction
aws lambda update-function-code \
  --function-name dynamodb-stream-processor \
  --image-uri $ECR_URI:latest \
  --profile aws-labs

# Attendre que la mise à jour soit terminée
aws lambda wait function-updated \
  --function-name dynamodb-stream-processor \
  --profile aws-labs
```

**Étape 6 : Vérifier la configuration de la fonction**

```bash
# Vérifier la configuration de la fonction Lambda
aws lambda get-function-configuration \
  --function-name dynamodb-stream-processor \
  --profile aws-labs

# Tester la fonction avec un événement vide (pour vérifier l'entrypoint)
aws lambda invoke \
  --function-name dynamodb-stream-processor \
  --payload '{"Records":[]}' \
  --profile aws-labs \
  response.json

# Voir la réponse
cat response.json
```

#### Comprendre les messages Docker

**Message normal** : Si vous voyez ce message lors du test Docker, c'est bon signe !

```
WARNING: The requested image's platform (linux/amd64) does not match the detected host platform (linux/arm64/v8)
entrypoint requires the handler name to be the first argument
```

- ⚠️ **Platform warning** : Normal sur Apple Silicon (ARM64) - l'image est correctement construite pour Lambda (AMD64)
- ✅ **"entrypoint requires handler name"** : Le runtime Lambda fonctionne correctement !

**Test correct de l'image** :

```bash
# ✅ Correct : Vérifier les fichiers sans override du CMD
docker run --rm --entrypoint="" lambda-dynamodb-processor:latest ls -la

# ❌ Incorrect : Override du CMD sans handler
docker run --rm lambda-dynamodb-processor:latest ls -la
```

Si vous voyez le message "entrypoint requires the handler name", votre image Docker est prête pour Lambda ! Procédez au push vers ECR.

#### Solutions pour l'erreur de plateforme Docker

Si vous obtenez l'erreur "does not provide the specified platform (linux/amd64)" :

**Solution 1 : Nettoyer le cache Docker et forcer le pull**

```bash
# 1. Nettoyer le cache Docker
docker system prune -a -f

# 2. Forcer le pull de l'image avec la bonne plateforme
docker pull --platform linux/amd64 public.ecr.aws/lambda/nodejs:24

# 3. Vérifier que l'image est disponible
docker images | grep nodejs

# 4. Reconstruire sans cache
DOCKER_BUILDKIT=0 docker build --no-cache --platform linux/amd64 -t lambda-dynamodb-processor .
```

**Solution 2 : Utiliser Node.js 22 (plus stable)**

Si Node.js 24 pose des problèmes de plateforme, utilisez Node.js 22 :

```bash
# Modifier le Dockerfile pour utiliser Node.js 22
sed -i 's/nodejs:24/nodejs:22/g' Dockerfile

# Construire avec Node.js 22
DOCKER_BUILDKIT=0 docker build --platform linux/amd64 -t lambda-dynamodb-processor .
```

**Solution 3 : Désactiver complètement buildx**

```bash
# Désactiver buildx temporairement
docker buildx uninstall

# Construire avec le builder classique
docker build --platform linux/amd64 -t lambda-dynamodb-processor .

# Réactiver buildx après (optionnel)
docker buildx install
```

**Solution 4 : Utiliser une approche multi-étapes**

Modifiez le Dockerfile pour une approche plus robuste :

```dockerfile
# Étape 1: Build sur la plateforme native
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Étape 2: Runtime Lambda avec la bonne plateforme
FROM --platform=linux/amd64 public.ecr.aws/lambda/nodejs:22
COPY --from=builder /app/node_modules ${LAMBDA_TASK_ROOT}/node_modules
COPY package*.json ${LAMBDA_TASK_ROOT}/
COPY dist/ ${LAMBDA_TASK_ROOT}/
CMD [ "dynamodb-stream-processor.handler" ]
```

### Commandes de diagnostic

```bash
# Vérifier les logs Lambda
aws logs describe-log-groups --profile aws-labs

# Vérifier les métriques Lambda
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=s3-file-processor \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T23:59:59Z \
  --period 3600 \
  --statistics Sum \
  --profile aws-labs
```

## Ressources supplémentaires

- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- [EventBridge User Guide](https://docs.aws.amazon.com/eventbridge/)
- [DynamoDB Streams](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html)
- [Lambda Container Images](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html)
