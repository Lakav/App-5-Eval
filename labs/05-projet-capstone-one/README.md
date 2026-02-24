# Projet Capstone One

Ce projet déploie une API REST sur API Gateway qui lit des données de bateaux dans DynamoDB et récupère leurs photos depuis S3.

Le déploiement et la suppression des ressources sont faits en TypeScript avec le SDK AWS v3.

## Vue d'ensemble

Architecture visée

![Architecture Diagram](./diagrams/target-architecture.png)

Ressources créées

- un bucket S3 pour les images
- une table DynamoDB pour les profils de bateaux
- une API Gateway REST avec les routes de consultation
- un stage `dev` pour exposer l’API

## Contrat API

### `GET /ships`

Retourne la liste des bateaux depuis DynamoDB.

Exemple de réponse

```json
{
  "ships": [
    {
      "id": "B-001",
      "nom": "Le Vigilant",
      "type": "Pêcheur",
      "pavillon": "France",
      "taille": "12.5",
      "nombre_marins": "4",
      "s3_image_key": "pecheur-b-001.jpg"
    }
  ]
}
```

### `GET /ships/profile/{key}`

Retourne le profil d’un bateau depuis DynamoDB.

Exemple

`GET /ships/profile/B-001`

### `GET /ships/photo/{key}`

Retourne l’image du bateau depuis S3.

Exemple

`GET /ships/photo/pecheur-b-001.jpg`

## Correspondance obligatoire entre données et fichiers

Le champ `s3_image_key` de `data/ships.json` doit correspondre exactement à un fichier présent dans `assets`.

Correspondance actuelle

- `B-001` -> `pecheur-b-001.jpg`
- `B-002` -> `tanker-b-002.jpg`

Le script de déploiement vérifie cette correspondance avant d’envoyer les fichiers dans S3 et avant d’insérer les items dans DynamoDB.

## Prérequis

- session AWS SSO active
- droits suffisants pour S3, DynamoDB, API Gateway et IAM
- Node.js et npm

Rôles IAM attendus pour les intégrations API Gateway

- `APIGatewayDynamoDBServiceRole`
- `APIGatewayS3ServiceRole`

## Installation

```bash
cd labs/05-projet-capstone-one
npm install
```

## Déployer

```bash
npx ts-node src/deploy-project.ts
```

Le script crée les ressources, configure CORS, déploie l’API sur le stage `dev` puis affiche l’URL finale.

Un fichier `.capstone-resources.json` est maintenu automatiquement pour mémoriser les noms de ressources et l’identifiant API.

## Tester dans l’interface web

Ouvrir `checker/index.html` avec Live Server puis renseigner l’URL API affichée pendant le déploiement.

## Détruire

```bash
npx ts-node src/destroy-project.ts
```

Le script supprime la table, le bucket et l’API Gateway puis met à jour l’état local.

## Variables d’environnement utiles

- `CAPSTONE_BUCKET_NAME` pour imposer le nom du bucket
- `CAPSTONE_TABLE_NAME` pour imposer le nom de la table
- `CAPSTONE_SUFFIX` pour suffixer les noms générés automatiquement
- `CAPSTONE_API_ID` pour forcer la suppression d’une API précise au destroy
- `AWS_ACCOUNT_ID` pour éviter la détection automatique du compte

## Dépannage

### Les photos ne s’affichent pas

- vérifier la correspondance `s3_image_key` dans `data/ships.json`
- vérifier la présence réelle des fichiers dans `assets`
- vérifier les permissions du rôle `APIGatewayS3ServiceRole`

### Erreur CORS dans le navigateur

- relancer le déploiement pour recréer une API propre
- vérifier que l’URL utilisée pointe bien vers le stage `dev`

### Erreur d’accès AWS

- relancer la connexion SSO
- vérifier l’identité active avec `aws sts get-caller-identity`

### Erreur S3 `403` ou `OperationAborted` au déploiement

- relancer simplement `npx ts-node src/deploy-project.ts`
- le script régénère automatiquement un nom de bucket si le nom courant n’est pas utilisable
- vérifier qu’aucun nom de bucket réutilisé n’est partagé entre plusieurs étudiants

## Fichiers importants

- `src/deploy-project.ts` orchestration du déploiement
- `src/destroy-project.ts` suppression des ressources
- `data/ships.json` dataset DynamoDB
- `assets/` images utilisées par l’API
- `checker/index.html` page de vérification fonctionnelle
