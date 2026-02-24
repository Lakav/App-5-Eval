# Solutions - Lab 8: Amazon ECS Basics

Ce dossier contient les solutions de référence pour la partie 2 du lab ECS.

## Solution pour l'Étape 9: Push de l'image classificateur vers ECR

### Commandes complètes

```bash
# 1. Récupérez l'URI du repository ECR pour le classificateur
ECR_CLASSIFIER_URI=$(aws cloudformation describe-stacks \
  --stack-name ecs-lab-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`ClassifierECRRepository`].OutputValue' \
  --output text \
  --profile aws-labs)

echo "URI ECR: $ECR_CLASSIFIER_URI"

# 2. Connectez-vous à ECR
aws ecr get-login-password --region eu-west-1 --profile aws-labs | \
  docker login --username AWS --password-stdin $ECR_CLASSIFIER_URI

# 3. Taguez l'image avec l'URI ECR
docker tag image-classifier:latest $ECR_CLASSIFIER_URI:latest

# 4. Poussez l'image vers ECR
docker push $ECR_CLASSIFIER_URI:latest
```

### Explication des commandes

1. **Récupération de l'URI ECR** : Utilise AWS CLI pour récupérer l'URI du repository depuis CloudFormation
2. **Authentification ECR** : `get-login-password` génère un token temporaire pour Docker
3. **Tag de l'image** : Associe l'image locale avec l'URI ECR distant
4. **Push vers ECR** : Upload l'image vers le registry AWS

### Vérification

Pour vérifier que l'image a été poussée avec succès :

```bash
# Listez les images dans le repository
aws ecr list-images \
  --repository-name ecs-lab/image-classifier \
  --profile aws-labs
```

## Solution TypeScript complète

Le fichier `image-classifier-operations.ts` dans ce dossier contient l'implémentation complète avec :

### 1. Enregistrement de Task Definition

```typescript
async registerImageClassifierTaskDefinition(
  ecrUri: string,
  taskRoleArn: string,
  executionRoleArn: string
): Promise<string> {
  const taskDefinition = {
    family: 'image-classifier',
    networkMode: 'awsvpc' as const,
    requiresCompatibilities: ['FARGATE'],
    cpu: '1024',
    memory: '2048',
    executionRoleArn: executionRoleArn,
    taskRoleArn: taskRoleArn,
    containerDefinitions: [
      {
        name: 'image-classifier',
        image: ecrUri,
        essential: true,
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-group': '/ecs/ecs-lab/image-classifier',
            'awslogs-region': this.region,
            'awslogs-stream-prefix': 'ecs',
          },
        },
        environment: [
          {
            name: 'NODE_ENV',
            value: 'production',
          },
          {
            name: 'AWS_DEFAULT_REGION',
            value: this.region,
          },
        ],
      },
    ],
    // Tags pour la gouvernance
    tags: [
      { key: 'git-repository', value: 'https://github.com/soraskills/develop-for-the-cloud-labs.git' },
      { key: 'project', value: 'ecs-lab' },
      { key: 'environment', value: 'development' },
      { key: 'managed-by', value: 'aws-sdk' },
    ],
  };

  const command = new RegisterTaskDefinitionCommand(taskDefinition);
  const response = await this.ecsClient.send(command);
  return response.taskDefinition?.taskDefinitionArn || '';
}
```

### 2. Exécution de Tâche ECS

```typescript
async runImageClassificationTask(
  clusterName: string,
  taskDefinitionArn: string,
  subnetIds: string[],
  securityGroupId: string,
  bucketName: string,
  inputKey: string,
  outputKey: string
): Promise<string> {
  const command = new RunTaskCommand({
    cluster: clusterName,
    taskDefinition: taskDefinitionArn,
    launchType: 'FARGATE',
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: subnetIds,
        securityGroups: [securityGroupId],
        assignPublicIp: 'ENABLED', // Nécessaire pour télécharger les modèles
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: 'image-classifier',
          environment: [
            { name: 'S3_BUCKET', value: bucketName },
            { name: 'INPUT_KEY', value: inputKey },
            { name: 'OUTPUT_KEY', value: outputKey },
          ],
        },
      ],
    },
    tags: [
      { key: 'git-repository', value: 'https://github.com/soraskills/develop-for-the-cloud-labs.git' },
      { key: 'project', value: 'ecs-lab' },
      { key: 'environment', value: 'development' },
      { key: 'managed-by', value: 'aws-sdk' },
    ],
  });

  const response = await this.ecsClient.send(command);

  if (response.tasks && response.tasks.length > 0) {
    const task = response.tasks[0];
    return task.taskArn || '';
  }

  throw new Error('Aucune tâche créée');
}
```

### 3. Surveillance de Tâche

```typescript
async monitorTask(clusterName: string, taskArn: string): Promise<void> {
  const maxAttempts = 30; // 15 minutes maximum
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await this.ecsClient.send(
      new DescribeTasksCommand({
        cluster: clusterName,
        tasks: [taskArn],
      })
    );

    if (response.tasks && response.tasks.length > 0) {
      const task = response.tasks[0];
      const status = task.lastStatus;

      console.log(`📊 Status de la tâche: ${status}`);

      if (status === 'STOPPED') {
        const exitCode = task.containers?.[0]?.exitCode;
        if (exitCode === 0) {
          console.log('✅ Tâche terminée avec succès!');
          return;
        } else {
          console.log(`❌ Tâche échouée avec le code: ${exitCode}`);
          return;
        }
      }

      if (status === 'RUNNING') {
        console.log('🔄 Tâche en cours d\'exécution...');
      }
    }

    // Attendre 30 secondes avant la prochaine vérification
    await new Promise((resolve) => setTimeout(resolve, 30000));
    attempts++;
  }

  console.log('⏰ Timeout de surveillance atteint');
}
```

## Points clés de l'implémentation

### Configuration réseau

- **assignPublicIp: 'ENABLED'** : Nécessaire pour que Fargate puisse télécharger les modèles depuis Hugging Face
- **Subnets privés** : Utilisés pour la sécurité, mais avec NAT Gateway pour l'accès internet

### Variables d'environnement

- **S3_BUCKET** : Nom du bucket pour les images d'entrée et de sortie
- **INPUT_KEY** : Clé S3 de l'image à classifier
- **OUTPUT_KEY** : Clé S3 pour sauvegarder le résultat JSON

### Gestion des erreurs

- Vérification des codes de sortie des conteneurs
- Timeout pour éviter les boucles infinies
- Gestion des cas où les tâches ne démarrent pas

### Bonnes pratiques

- **Tags AWS** : Appliqués à toutes les ressources pour la gouvernance
- **Logs CloudWatch** : Configuration automatique pour le debugging
- **Rôles IAM** : Séparation entre execution role et task role
- **Ressources appropriées** : 1024 CPU / 2048 MB pour le traitement IA

## Dépannage courant

### Erreur "Task failed to start"

- Vérifiez que l'image ECR existe et est accessible
- Vérifiez les rôles IAM (execution role pour ECR, task role pour S3)

### Erreur "Cannot pull container image"

- Vérifiez la connexion ECR avec `docker login`
- Vérifiez que l'image a été poussée avec le bon tag

### Tâche bloquée en "PENDING"

- Vérifiez les quotas Fargate dans votre région
- Vérifiez la configuration réseau (subnets, security groups)

### Classification échoue

- Vérifiez que l'image existe dans S3
- Vérifiez les permissions S3 du task role
- Consultez les logs CloudWatch pour plus de détails
