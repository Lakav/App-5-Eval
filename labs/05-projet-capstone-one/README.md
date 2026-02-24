# Projet Capstone One - Architecture API Gateway + DynamoDB + S3

## Objectifs d'apprentissage

À la fin de ce projet, vous serez capable de :

- Concevoir et implémenter une architecture serverless complète
- Intégrer API Gateway avec DynamoDB et S3
- Gérer l'authentification et les autorisations
- Implémenter des opérations CRUD complètes
- Gérer le stockage de fichiers avec S3
- Appliquer les bonnes pratiques de sécurité AWS

## Prérequis

- Avoir complété les labs 01 (EC2), 02 (S3), 03 (API Gateway), et 04 (DynamoDB)
- Maîtriser TypeScript et le SDK AWS v3
- Comprendre les concepts REST API
- Session AWS SSO active avec le profil `aws-labs`

## Durée estimée

**1 demi-journée** (4 heures)

## Architecture cible

![Architecture Diagram](./diagrams/target-architecture.png)

Consultez le diagramme d'architecture disponible dans le dossier `/diagrams` pour comprendre l'architecture cible à implémenter.

## API Endpoints à implémenter

Votre API doit exposer les endpoints suivants :

### 1. GET /ships/photo/{key}

- **Description** : Retourne la photo de profil du bateau depuis S3
- **Paramètre** : `key` - Identifiant unique de la photo
- **Réponse** : Image du bateau

### 2. GET /ships/profile/{key}

- **Description** : Retourne les données du profil du bateau depuis DynamoDB
- **Paramètre** : `key` - Identifiant unique du bateau
- **Réponse** : Objet JSON avec les informations du bateau

### 3. GET /ships

- **Description** : Retourne la liste de tous les bateaux depuis DynamoDB
- **Réponse** : Array JSON avec la liste des bateaux

## Services AWS et Rôles IAM

### Services AWS utilisés

- **API Gateway** : Point d'entrée REST API
- **DynamoDB** : Base de données NoSQL pour les métadonnées
- **S3** : Stockage des fichiers
- **IAM** : Gestion des permissions

### Rôles IAM requis

Votre API Gateway nécessite deux rôles d'exécution spécifiques :

#### 1. APIGatewayDynamoDBServiceRole

- **Usage** : Rôle d'exécution pour les ressources/méthodes qui interrogent DynamoDB
- **Permissions** : Accès en lecture/écriture à DynamoDB
- **Endpoints concernés** : `GET /ships/profile/{key}` et `GET /ships`

#### 2. APIGatewayS3ServiceRole

- **Usage** : Rôle d'exécution pour les ressources/méthodes qui interrogent S3
- **Permissions** : Accès en lecture aux objets S3
- **Endpoints concernés** : `GET /ships/photo/{key}`

#### Récupération des ARN des rôles avec AWS CLI

Pour obtenir l'ARN d'un rôle IAM, utilisez les commandes suivantes :

Vous en aurez besoin pour obtenir les rôles à configurer dans API Gateway, comme dans le lab 03.

```bash
# Récupérer l'ARN du rôle DynamoDB
aws iam get-role --role-name APIGatewayDynamoDBServiceRole --query 'Role.Arn' --output text --profile aws-labs

# Récupérer l'ARN du rôle S3
aws iam get-role --role-name APIGatewayS3ServiceRole --query 'Role.Arn' --output text --profile aws-labs
```

## Exigences techniques

### ✅ Configuration CORS

- CORS doit être configuré pour permettre les requêtes depuis l'interface web

### ✅ Déploiement automatisé

- Le projet doit être déployable avec la commande :

```bash
npx ts-node src/deploy-project.ts
```

### ✅ Interface de test fonctionnelle

- L'API doit fonctionner depuis la page web `checker/index.html`
- Utilisez Live Server pour tester l'interface

### ✅ Destruction automatisée

- Le projet doit être destructible avec la commande :

```bash
npx ts-node src/destroy-project.ts
```

## Ressources disponibles

### Template de départ

- Le template de base est disponible dans `labs/05-project-capstone-one`

### Images des bateaux

- Les images sont disponibles dans le dossier `labs/05-project-capstone-one/assets`

### Format des données

- Le format de la table DynamoDB et les données d'exemple sont disponibles dans `labs/05-project-capstone-one/data`

## Grille de notation

| Critère                                                                | Points |
| ---------------------------------------------------------------------- | ------ |
| Création et Remplissage du Bucket S3                                   | 2      |
| Création de la Table DynamoDB                                          | 1      |
| Insertion des Items dans DynamoDB                                      | 3      |
| Suppression d'un Item dans DynamoDB                                    | 2      |
| Fonction spécifique pour supprimer toutes les ressources               | 2      |
| Qualité du code (Diagramme d'architecture, Commentaires, clarté, logs) | 5      |
| Intégration avec API Gateway pour S3                                   | 1      |
| Intégration avec API Gateway pour DynamoDB                             | 4      |
| **Total**                                                              | **20** |

## Instructions étape par étape

### Étape 1 : Configuration de l'environnement

1. Vérifiez votre configuration AWS :

```bash
npm run validate-setup
```

2. Installez les dépendances :

```bash
cd labs/05-projet-capstone-one
npm install
```

### Étape 2 : Analyse des ressources

1. Examinez le diagramme d'architecture dans `./diagrams/target-architecture.png`
2. Consultez les données d'exemple dans `./data/ships.json`
3. Explorez les images disponibles dans `./assets/`
4. Testez l'interface web dans `./checker/index.html`

### Étape 3 : Implémentation

1. **Implémentez le script de déploiement** (`src/deploy-project.ts`) :
   - Création du bucket S3
   - Upload des images depuis `./assets/`
   - Création de la table DynamoDB
   - Insertion des données depuis `./data/ships.json`
   - Configuration d'API Gateway avec CORS
   - Création des endpoints requis

2. **Implémentez le script de destruction** (`src/destroy-project.ts`) :
   - Suppression de tous les items DynamoDB
   - Suppression de la table DynamoDB
   - Vidage et suppression du bucket S3
   - Suppression de l'API Gateway

### Étape 4 : Test et validation

1. Déployez votre projet :

```bash
npx ts-node src/deploy-project.ts
```

2. Testez l'API avec l'interface web :
   - Ouvrez `checker/index.html` avec Live Server
   - Vérifiez que tous les endpoints fonctionnent

3. Nettoyez les ressources :

```bash
npx ts-node src/destroy-project.ts
```

## Bonnes pratiques à respecter

- **Sécurité** : Utilisez les rôles IAM appropriés
- **Nommage** : Suivez les conventions de nommage AWS
- **Logging** : Ajoutez des logs détaillés pour le debugging
- **Gestion d'erreurs** : Implémentez une gestion d'erreurs robuste
- **Documentation** : Commentez votre code de manière claire
- **Tags** : Appliquez les tags requis selon les standards du projet

## Troubleshooting

### Problèmes courants

1. **Erreur CORS** : Vérifiez la configuration CORS d'API Gateway
2. **Permissions IAM** : Assurez-vous que les rôles APIGatewayDynamoDBServiceRole et APIGatewayS3ServiceRole ont les bonnes permissions
3. **Timeout** : Augmentez les timeouts si nécessaire pour les opérations S3/DynamoDB
4. **Noms de ressources** : Utilisez des noms uniques pour éviter les conflits

### Validation

- Tous les tests doivent passer
- L'interface web doit fonctionner sans erreurs
- Les ressources doivent être correctement nettoyées après destruction

## Livrables

1. Code source complet et fonctionnel
2. Scripts de déploiement et destruction opérationnels
3. Documentation claire dans le code
4. Validation que l'interface web fonctionne correctement

Bonne chance ! 🚢
