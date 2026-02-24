# Lab 8: Amazon ECS (Elastic Container Service) Basics

## Objectifs d'apprentissage

À la fin de ce lab, vous serez capable de :

- Comprendre les concepts fondamentaux d'Amazon ECS
- Créer et gérer un cluster ECS
- Déployer un service web avec load balancer
- Créer et exécuter des tâches ECS pour le traitement d'images
- Utiliser ECR (Elastic Container Registry) pour stocker des images Docker
- Tester des conteneurs localement avant déploiement

## Prérequis

- Avoir complété le lab 00-setup
- Session AWS SSO active (`aws-labs` profile)
- Docker installé et fonctionnel
- Connaissances de base sur les conteneurs Docker

## Durée estimée

90-120 minutes

## Architecture du lab

Ce lab utilise le **VPC par défaut** pour réduire les coûts (pas de NAT Gateway ni d'Elastic IP).

Ce lab est divisé en deux parties :

### Partie 1: Service Web avec Load Balancer

- Déploiement d'un service web simple sur ECS
- Configuration d'un Application Load Balancer
- Auto-scaling et haute disponibilité

### Partie 2: Tâche de Classification d'Images

- Traitement d'images stockées dans S3
- Classification avec le modèle Xenova/mobilenet_v3_small
- Exécution de tâches à la demande

## Structure du lab

```
labs/08-ecs-basics/
├── README.md                           # Ce fichier
├── resources/
│   ├── infrastructure.yaml             # Infrastructure de base (S3, ECR, utilise VPC par défaut)
│   ├── iam-roles.yaml                 # Rôles IAM pour ECS
│   └── web-service-task-definition.json # Task definition pour le service web
├── src/
│   ├── ecs-operations.ts              # Utilitaires ECS (déjà implémenté)
│   ├── image-classifier-operations.ts # À IMPLÉMENTER par les étudiants
│   ├── web-app/                       # Application web simple
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── server.js
│   └── image-classifier/              # Application de classification
│       ├── Dockerfile
│       ├── package.json
│       └── classifier.js
├── solutions/
│   ├── README.md                      # Solutions détaillées avec explications
│   └── image-classifier-operations.ts # Solution de référence complète
├── __tests__/
│   └── ecs-operations.test.ts
├── setup-test-image.sh                # Script pour télécharger image de test
├── update-task-definitions.sh         # Script de mise à jour des ARN
├── cleanup.sh
└── package.json
```

## Étape 1: Validation de l'environnement

Avant de commencer, **depuis la racine du repository**, validez votre environnement :

```bash
# Vérifiez votre session AWS
npm run validate-sso

# Vérifiez que Docker est installé et fonctionne
docker --version
docker ps

# Installez les dépendances du lab
cd labs/08-ecs-basics
npm install
```

## Étape 2: Déploiement de l'infrastructure de base

Lors du déploiement, vous devrez fournir:

- **VpcId**: Sélectionnez votre VPC par défaut
- **SubnetIds**: Sélectionnez au moins 2 subnets dans différentes zones de disponibilité

### Déploiement automatique avec le VPC par défaut

Utilisez ce script helper pour déployer automatiquement avec le VPC par défaut:

```bash
# Récupérez automatiquement le VPC par défaut et ses subnets (exporte les variables d'environnement)
chmod +x get-default-vpc.sh
source ./get-default-vpc.sh

# Déployez avec les variables d'environnement
aws cloudformation deploy \
  --template-file resources/infrastructure.yaml \
  --stack-name ecs-lab-infrastructure \
  --capabilities CAPABILITY_IAM \
  --profile aws-labs \
  --parameter-overrides \
    ProjectName=ecs-lab \
    VpcId=$DEFAULT_VPC_ID \
    SubnetIds=$DEFAULT_SUBNET_IDS
```

**Note**: Utilisez `source ./get-default-vpc.sh` (et non `./get-default-vpc.sh`) pour que les variables d'environnement soient exportées dans votre shell actuel.

### Déploiement des rôles IAM

```bash
# Déployez les rôles IAM
aws cloudformation deploy \
  --template-file resources/iam-roles.yaml \
  --stack-name ecs-lab-iam-roles \
  --capabilities CAPABILITY_NAMED_IAM \
  --profile aws-labs
```

## Étape 3: Création du cluster ECS

Créez votre cluster ECS en utilisant l'AWS CLI :

```bash
# Créez le cluster ECS
aws ecs create-cluster \
  --cluster-name ecs-lab-cluster \
  --capacity-providers FARGATE \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
  --profile aws-labs
```

## Partie 1: Service Web avec Load Balancer

### Étape 4: Construction et push de l'image web

```bash
# Récupérez l'URI du repository ECR
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name ecs-lab-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`WebAppECRRepository`].OutputValue' \
  --output text \
  --profile aws-labs)

# Connectez-vous à ECR
aws ecr get-login-password --region eu-west-1 --profile aws-labs | \
  docker login --username AWS --password-stdin $ECR_URI

# Construisez et poussez l'image web (compatible linux/amd64 pour Fargate)
cd src/web-app
docker buildx build --platform linux/amd64 -t $ECR_URI:latest --push .
cd ../..
```

**Note**: Nous utilisons `docker buildx build --platform linux/amd64` pour garantir la compatibilité avec AWS Fargate, qui nécessite des images linux/amd64, même si vous développez sur un Mac Apple Silicon (ARM).

### Étape 5: Enregistrement de la task definition web

```bash
# Récupérez votre Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile aws-labs)

# Mettez à jour la task definition avec l'URI ECR correcte et l'Account ID
sed -i "s|<ECR_WEB_URI>|$ECR_URI:latest|g" resources/web-service-task-definition.json
sed -i "s|ACCOUNT_ID|$ACCOUNT_ID|g" resources/web-service-task-definition.json

# Enregistrez la task definition
aws ecs register-task-definition \
  --cli-input-json file://resources/web-service-task-definition.json \
  --profile aws-labs
```

### Étape 6: Création du service web

```bash
# Récupérez les informations nécessaires depuis CloudFormation
SUBNETS=$(aws cloudformation describe-stacks \
  --stack-name ecs-lab-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`SubnetIds`].OutputValue' \
  --output text \
  --profile aws-labs)

# Convertir la liste de subnets en format pour ECS (prendre les 2 premiers)
SUBNET_1=$(echo $SUBNETS | cut -d',' -f1)
SUBNET_2=$(echo $SUBNETS | cut -d',' -f2)

SECURITY_GROUP=$(aws cloudformation describe-stacks \
  --stack-name ecs-lab-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroup`].OutputValue' \
  --output text \
  --profile aws-labs)

TARGET_GROUP=$(aws cloudformation describe-stacks \
  --stack-name ecs-lab-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`TargetGroup`].OutputValue' \
  --output text \
  --profile aws-labs)

# Créez le service (avec assignPublicIp=ENABLED car on utilise le VPC par défaut)
aws ecs create-service \
  --cluster ecs-lab-cluster \
  --service-name web-service \
  --task-definition ecs-web-app:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TARGET_GROUP,containerName=web-app,containerPort=3000" \
  --profile aws-labs
```

**Note importante**: Avec le VPC par défaut, nous utilisons `assignPublicIp=ENABLED` pour que les tâches ECS puissent accéder à Internet (pour télécharger les images depuis ECR).

### Étape 7: Test du service web

```bash
# Récupérez l'URL du load balancer
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name ecs-lab-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text \
  --profile aws-labs)

echo "Service web accessible à: http://$ALB_DNS"

# Testez le service (attendez quelques minutes pour que les tâches soient prêtes)
curl http://$ALB_DNS
```

### Étape 8: Nettoyage du service web et de l'ALB (OBLIGATOIRE)

⚠️ **IMPORTANT** : Avant de passer à la Partie 2, vous devez supprimer le service web et l'Application Load Balancer pour éviter les conflits de ressources et les coûts inutiles.

**Option 1: Script automatique (Recommandé)**

```bash
# Utilisez le script de nettoyage de l'Étape 8
./cleanup-step8.sh
```

**Option 2: Commandes manuelles**

```bash
# 1. Supprimez le service web
aws ecs update-service \
  --cluster ecs-lab-cluster \
  --service web-service \
  --desired-count 0 \
  --profile aws-labs

# 2. Attendez que les tâches se terminent
aws ecs wait services-stable \
  --cluster ecs-lab-cluster \
  --services web-service \
  --profile aws-labs

# 3. Supprimez définitivement le service
aws ecs delete-service \
  --cluster ecs-lab-cluster \
  --service web-service \
  --profile aws-labs

# 4. Récupérez l'ARN de l'ALB
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --query "LoadBalancers[?LoadBalancerName=='ecs-lab-alb'].LoadBalancerArn" \
  --output text \
  --profile aws-labs)

# 5. Supprimez les listeners
aws elbv2 describe-listeners \
  --load-balancer-arn "$ALB_ARN" \
  --query 'Listeners[].ListenerArn' \
  --output text \
  --profile aws-labs | xargs -n1 aws elbv2 delete-listener --listener-arn --profile aws-labs

# 6. Supprimez l'ALB
aws elbv2 delete-load-balancer \
  --load-balancer-arn "$ALB_ARN" \
  --profile aws-labs

# 7. Attendez 30 secondes puis supprimez le Target Group
sleep 30
TARGET_GROUP_ARN=$(aws cloudformation describe-stacks \
  --stack-name ecs-lab-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`TargetGroup`].OutputValue' \
  --output text \
  --profile aws-labs)

aws elbv2 delete-target-group \
  --target-group-arn "$TARGET_GROUP_ARN" \
  --profile aws-labs

echo "Service web et ALB supprimés avec succès. Vous pouvez maintenant passer à la Partie 2."
```

**Pourquoi cette étape est-elle nécessaire ?**

- Évite les conflits de ressources entre les deux parties du lab
- Réduit les coûts en libérant les ressources Fargate et l'ALB inutilisés
- Permet de se concentrer sur la classification d'images sans interférences
- L'ALB n'est pas nécessaire pour la Partie 2 (tâches ECS à la demande)

**Ce qui est supprimé :** Service ECS web-service, Application Load Balancer, Listeners, Target Group

**Ce qui est CONSERVÉ :** Cluster ECS, S3, ECR, Security Groups, IAM Roles (nécessaires pour la Partie 2)

## Partie 2: Tâche de Classification d'Images (À IMPLÉMENTER)

Dans cette partie, vous allez implémenter vous-même le déploiement et l'exécution d'une tâche ECS pour classifier des images en utilisant le modèle Xenova/mobilenet_v3_small.

### Étape 9: Test local du classificateur d'images

Avant de déployer sur ECS, testons le conteneur localement :

```bash
# Téléchargez une image de test
export IMAGE_1=https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg
export IMAGE_2=http://images.cocodataset.org/val2017/000000039769.jpg
export IMAGE_3=https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Motorboat_at_Kankaria_lake.JPG/960px-Motorboat_at_Kankaria_lake.JPG

# Construisez l'image du classificateur
cd src/image-classifier

# Si vous êtes sur Mac Intel (x86_64):
docker build --platform linux/amd64 -t image-classifier .

# Testez le conteneur localement (l'émulation amd64 est automatique)
docker run --rm --platform linux/amd64 -v $(pwd)/../../test-images:/app/images image-classifier node classifier.js $IMAGE_1
docker run --rm --platform linux/amd64 -v $(pwd)/../../test-images:/app/images image-classifier node classifier.js $IMAGE_2
docker run --rm --platform linux/amd64 -v $(pwd)/../../test-images:/app/images image-classifier node classifier.js $IMAGE_3

cd ../..
```

### Étape 10: Push de l'image classificateur vers ECR

**À FAIRE PAR L'ÉTUDIANT** : Vous devez maintenant pousser l'image du classificateur vers ECR.

**IMPORTANT**: L'image doit être construite pour `linux/amd64` (déjà fait à l'étape 9).

Utilisez les commandes suivantes comme guide :

```bash
# 1. Récupérez l'URI du repository ECR pour le classificateur
ECR_CLASSIFIER_URI=$(aws cloudformation describe-stacks \
  --stack-name ecs-lab-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`ClassifierECRRepository`].OutputValue' \
  --output text \
  --profile aws-labs)

# 2. Connectez-vous à ECR
# TODO: Implémentez la commande de connexion ECR

# 3. Taguez et poussez l'image
# TODO: Implémentez les commandes de tag et push
```

**Ressources utiles :**

- [Documentation ECR - Pushing an image](https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-push-ecr-image.html)
- [AWS CLI ECR get-login-password](https://docs.aws.amazon.com/cli/latest/reference/ecr/get-login-password.html)

### Étape 11: Implémentation des opérations ECS

Le fichier `src/image-classifier-operations.ts` contient des commentaires qui vous guident pour implémenter :

- **Push de l'image vers ECR** : Authentification et push de l'image Docker
- **Enregistrement de task definition** : Créer une task definition pour le classificateur
- **Exécution de tâche** : Lancer une tâche ECS avec les bonnes configurations
- **Surveillance** : Monitorer l'exécution de la tâche

Utilisez la documentation officielle AWS SDK v3 pour TypeScript :

- **ECR Authentication** : [ECR get-login-password Documentation](https://docs.aws.amazon.com/cli/latest/reference/ecr/get-login-password.html)
- **Task Definition** : [RegisterTaskDefinitionCommand Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ecs/command/RegisterTaskDefinitionCommand/)
- **Exécution de tâche** : [RunTaskCommand Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ecs/command/RunTaskCommand/)
- **Surveillance** : [DescribeTasksCommand Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ecs/command/DescribeTasksCommand/)

### Étape 12: Exécution de votre implémentation

```bash
# Compiler et exécuter le script TypeScript
npx ts-node src/image-classifier-operations.ts
```

### Points de contrôle de validation

- [ ] Image Docker construite et testée localement
- [ ] Image poussée vers ECR avec succès
- [ ] Task definition créée avec succès pour le classificateur
- [ ] Tâche ECS lancée avec les bonnes variables d'environnement
- [ ] Surveillance de la tâche implémentée correctement
- [ ] Résultat de classification téléchargé et affiché
- [ ] Script TypeScript exécuté sans erreur

## 🎁 Bonus: Classification d'images depuis S3

**Objectif**: Modifier le classificateur pour qu'il lise une image depuis S3 et écrive le résultat dans S3 au lieu d'utiliser une URL HTTPS.

### Pourquoi ce bonus ?

Ce bonus vous permet de :

- Comprendre comment intégrer S3 avec ECS pour le traitement de fichiers
- Apprendre à passer des paramètres S3 aux tâches ECS
- Pratiquer la modification d'une application conteneurisée existante

### Étape Bonus 1: Modifier le classificateur pour supporter S3

Modifiez `src/image-classifier/classifier.js` pour :

1. Accepter deux modes de fonctionnement :
   - **Mode URL** (actuel) : `node classifier.js https://...`
   - **Mode S3** (nouveau) : `node classifier.js s3://bucket-name/input/image.jpg s3://bucket-name/output/result.json`

2. Ajouter les dépendances AWS SDK pour S3 :

```bash
cd src/image-classifier
npm install @aws-sdk/client-s3
```

3. Implémenter la logique pour :
   - Détecter si l'argument est une URL S3 (`s3://...`)
   - Télécharger l'image depuis S3
   - Classifier l'image
   - Uploader le résultat JSON vers S3

**Indices** :

- Utilisez `@aws-sdk/client-s3` avec `GetObjectCommand` et `PutObjectCommand`
- Parsez les URLs S3 pour extraire le bucket et la clé
- Le conteneur a déjà les permissions IAM nécessaires via le task role

### Étape Bonus 2: Tester localement avec S3

```bash
# 1. Uploadez une image de test dans S3
aws s3 cp test-images/ship.jpg s3://ecs-lab-images-ACCOUNT-REGION/input/ship.jpg --profile aws-labs

# 2. Testez le conteneur localement (nécessite AWS credentials)
docker run --rm \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  -e AWS_SESSION_TOKEN \
  -e AWS_DEFAULT_REGION=eu-west-1 \
  image-classifier \
  node classifier.js \
  s3://ecs-lab-images-ACCOUNT-REGION/input/ship.jpg \
  s3://ecs-lab-images-ACCOUNT-REGION/output/result.json

# 3. Vérifiez le résultat
aws s3 cp s3://ecs-lab-images-ACCOUNT-REGION/output/result.json - --profile aws-labs
```

### Étape Bonus 3: Modifier le code TypeScript

Modifiez `src/image-classifier-operations.ts` pour passer les URLs S3 au lieu d'une URL HTTPS :

```typescript
// Dans runImageClassificationTask, changez le command override :
overrides: {
  containerOverrides: [
    {
      name: 'image-classifier',
      command: [
        'node',
        'classifier.js',
        `s3://${bucketName}/input/image.jpg`,
        `s3://${bucketName}/output/result.json`
      ],
    },
  ],
}
```

### Étape Bonus 4: Rebuild et redéployer

```bash
# 1. Rebuild l'image Docker
cd src/image-classifier
docker build --platform linux/amd64 -t image-classifier .

# 2. Tag et push vers ECR
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name ecs-lab-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`ClassifierECRRepository`].OutputValue' \
  --output text \
  --profile aws-labs)

docker tag image-classifier:latest $ECR_URI:latest
docker push $ECR_URI:latest

# 3. Exécutez votre code TypeScript modifié
cd ../..
npx ts-node src/image-classifier-operations.ts
```

### Validation du bonus

- [ ] Le classificateur accepte les URLs S3 en arguments
- [ ] L'image est téléchargée depuis S3
- [ ] Le résultat JSON est uploadé dans S3
- [ ] La tâche ECS se termine avec succès (exit code 0)
- [ ] Le fichier résultat est accessible dans S3

### Avantages de l'approche S3

- **Persistance** : Les résultats sont stockés de manière durable
- **Scalabilité** : Peut traiter de grandes images sans limite de taille d'URL
- **Traçabilité** : Historique complet des images traitées et résultats
- **Intégration** : Peut déclencher d'autres workflows via S3 Events

## Solutions de référence

Si vous rencontrez des difficultés, consultez le dossier `solutions/` qui contient :

- `README.md` : Solutions détaillées avec explications pour chaque étape
- `image-classifier-operations.ts` : Implémentation complète de référence

⚠️ **Conseil pédagogique** : Essayez d'implémenter par vous-même avant de consulter les solutions !

## Nettoyage des ressources

⚠️ **Important** : N'oubliez pas de nettoyer vos ressources pour éviter les coûts :

```bash
./cleanup.sh
```

## Dépannage

### Problèmes courants

1. **Erreur de connexion ECR** : Vérifiez que vous êtes connecté à ECR avec `aws ecr get-login-password`
2. **Tâches qui ne démarrent pas** : Vérifiez les logs CloudWatch et les rôles IAM
3. **Service web inaccessible** : Vérifiez que les security groups autorisent le trafic HTTP
4. **Classification échoue** : Vérifiez que l'image existe dans S3 et que les permissions sont correctes

### Commandes utiles pour le debug

```bash
# Vérifier le statut du cluster
aws ecs describe-clusters --clusters ecs-lab-cluster --profile aws-labs

# Vérifier les services
aws ecs describe-services --cluster ecs-lab-cluster --services web-service --profile aws-labs

# Vérifier les tâches en cours
aws ecs list-tasks --cluster ecs-lab-cluster --profile aws-labs

# Voir les logs d'une tâche
aws logs get-log-events --log-group-name "/ecs/web-app" --log-stream-name "ecs/web-app/[TASK-ID]" --profile aws-labs
```

## Concepts clés appris

- **ECS Clusters** : Groupement logique de ressources de calcul
- **Task Definitions** : Blueprints pour vos conteneurs
- **Services** : Maintiennent un nombre désiré de tâches en cours d'exécution
- **Tasks** : Instances d'exécution de vos task definitions
- **Fargate** : Compute engine serverless pour conteneurs
- **ECR** : Registry Docker managé par AWS
- **Load Balancing** : Distribution du trafic entre plusieurs tâches

## Ressources supplémentaires

- [Documentation Amazon ECS](https://docs.aws.amazon.com/ecs/)
- [Guide Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)
- [ECR User Guide](https://docs.aws.amazon.com/AmazonECR/latest/userguide/)
