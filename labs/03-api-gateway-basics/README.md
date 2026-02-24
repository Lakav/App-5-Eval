# Lab 3 : Les bases d'API Gateway - Exposer du contenu S3

## Objectifs d'apprentissage

À la fin de ce lab, vous serez capable de :

- Créer et configurer AWS API Gateway via la Console AWS
- Mettre en place une authentification par clé API pour la sécurité
- Intégrer API Gateway directement avec S3 (sans Lambda)
- Construire une interface web simple pour interagir avec votre API
- Comprendre les bases de la conception d'API REST et des méthodes HTTP

## Prérequis

- Lab 0 (Configuration) complété - AWS SSO configuré
- Compréhension de base de S3 (Lab 2)
- Connaissances de base en HTML/JavaScript
- Navigateur web pour les tests

## Durée du lab

Temps estimé : 45-60 minutes

## Vue d'ensemble

Dans ce lab, vous allez créer une API REST avec AWS API Gateway qui expose directement le contenu d'un bucket S3. Vous apprendrez à :

1. Créer un bucket S3 et y télécharger des fichiers d'exemple
2. Configurer API Gateway via la Console AWS (pas de code cette fois !)
3. Mettre en place une authentification par clé API
4. Construire une page web simple pour interagir avec votre API

## Étape 1 : Créer et préparer votre bucket S3

### 1.1 Créer le bucket S3

1. Ouvrez la Console AWS et naviguez vers S3
2. Créez un nouveau bucket avec les paramètres suivants :
   - **Nom du bucket** : `student-lab-[VotreNom]-[nombre-aleatoire]` (ex : `api-gateway-lab-js-12345`)
   - **Région** : eu-west-1
   - **Bloquer tous les accès publics** : Gardez cette option ACTIVÉE pour la sécurité

### 1.2 Télécharger des fichiers d'exemple

Téléchargez quelques fichiers d'exemple pour tester votre API, ils sont situés dans le dossier **data**.

### 1.3 Noter les détails de votre bucket

Notez :

- Nom du bucket : `_________________`
- Région : `_________________`
- Noms des fichiers d'exemple : `_________________`

## Étape 2 : Configurer API Gateway (via la Console)

### 2.1 Créer une nouvelle API

1. Naviguez vers **API Gateway** dans la Console AWS
2. Cliquez sur **Create API**
3. Choisissez **REST API** (pas REST API Private)
4. Cliquez sur **Build**
5. Configurez :
   - **API name** : `s3-content-api-[VotreNom]`
   - **Description** : `API to access S3 bucket content`
   - **Endpoint Type** : Regional
   - **Security Policy** : SecurityPolicy_TLS13_1_3_2025_09 (Recommandé)
6. Cliquez sur **Create API**

### 2.2 Créer les ressources et méthodes de l'API

#### Créer la ressource /objects

1. Dans votre API, sélectionnez la ressource racine `/`
2. Cliquez sur **Create Resource**
3. Configurez :
   - **Resource Name** : `objects`
   - **Resource Path** : `/`
   - **Enable API Gateway CORS** : ✅ Cochez cette case
4. Cliquez sur **Create Resource**

#### Ajouter la méthode GET pour lister les objets

1. Sélectionnez la ressource `/objects`
2. Cliquez sur **Create Method**
3. Choisissez **GET** dans le menu déroulant et cliquez sur la coche
4. Configurez la méthode :
   - **Integration type** : AWS Service
   - **AWS Region** : eu-west-1
   - **AWS Service** : Simple Storage Service (S3)
   - **HTTP method** : GET
   - **Action Type** : Use path override
   - **Path override** : `[nom-de-votre-bucket]` (remplacez par le **nom** réel de votre bucket, pas l'**arn**)
   - **Execution role** : arn:aws:iam::[votre-account-id]:role/APIGatewayS3ServiceRole
5. Cliquez sur **Create Method**

#### Ajouter la méthode GET pour les objets individuels

1. Sélectionnez la ressource `/objects`
2. Cliquez sur **Create Resource**
3. Configurez :
   - **Resource Name** : `{key}`
   - **Resource Path** : `/objects`
   - **Enable API Gateway CORS** : ✅ Cochez cette case
4. Cliquez sur **Create Resource**
5. Sélectionnez la ressource `/{key}`
6. Cliquez sur **Actions** → **Create Method**
7. Choisissez **GET** et configurez :
   - **Integration type** : AWS Service
   - **AWS Region** : eu-west-1
   - **AWS Service** : Simple Storage Service (S3)
   - **HTTP method** : GET
   - **Action Type** : Use path override
   - **Path override** : `[nom-de-votre-bucket]/{key}`
   - **Execution role** : arn:aws:iam::[votre-account-id]:role/APIGatewayS3ServiceRole
8. Cliquez sur **Save**

#### Configurer la méthode GET pour les objets individuels

1. Sélectionnez la méthode **GET** pour la ressource `/{key}`
2. Cliquez sur **Integration Request**
3. Cliquez sur **Edit** dans l'onglet Integration request settings
4. Allez dans **URL Path Parameters**
5. Cliquez sur **Add Path Parameters**
6. Configurez :
   - **Name** : key
   - **Mapped from** : method.request.path.key
7. Cliquez sur **Save**
8. Cliquez sur **Integration Response**
9. Cliquez sur le bouton **Edit** dans l'onglet Integration response, près de **Default - Response**
10. Dans **Mapping Template**, cliquez sur **Delete**
11. Cliquez sur **Save**
12. Cliquez sur **Method Response**
13. Cliquez sur le bouton **Edit** dans l'onglet Method response, près de **Response 200**
14. Dans **Response Body**, cliquez sur **Remove**
15. Cliquez sur **Save**

### 2.3 Configurer l'authentification par clé API

#### Créer une clé API

1. Dans API Gateway, cliquez sur **API Keys** dans la barre latérale gauche
2. Cliquez sur **Create API Key**
3. Configurez :
   - **Name** : `s3-api-key`
   - **API key** : Auto Generate
4. Cliquez sur **Save**
5. **Important** : Copiez la valeur de la clé API - vous en aurez besoin plus tard !

#### Créer un plan d'utilisation

1. Cliquez sur **Usage Plans** dans la barre latérale gauche
2. Cliquez sur **Create**
3. Configurez :
   - **Name** : `s3-api-plan`
   - **Description** : `Usage plan for S3 API`
   - **Throttle** : 100 requêtes par seconde, 1000 burst
   - **Quota** : 10000 requêtes par mois
4. Cliquez sur **Create Usage Plan**

#### Associer la clé API au plan d'utilisation

1. Dans votre plan d'utilisation, cliquez sur l'onglet **API Keys**
2. Cliquez sur **Add API Key to Usage Plan**
3. Sélectionnez votre clé API
4. Cliquez sur **Save**

### 2.4 Activer l'exigence de clé API et CORS

1. Retournez à votre API
2. Pour chaque méthode (GET /objects et GET /objects/{key}) :
   - Sélectionnez la méthode
   - Cliquez sur **Method Request**
   - Définissez **API Key Required** : true
   - Cliquez sur **Save**

3. Pour chaque ressource (/objects et /objects/{key})
   - Cliquez sur la ressource
   - Cliquez sur **Enable CORS**
   - Cochez **GET** et **OPTIONS**
   - Cliquez sur **Save**

### 2.5 Configurer les types de médias binaires (Important pour les images)

**Étape critique** : API Gateway doit savoir quels types de contenu doivent être traités comme des données binaires.

1. Dans la console API Gateway, sélectionnez votre API
2. Cliquez sur **API Settings** dans la barre latérale gauche
3. Faites défiler jusqu'à **Binary Media Types**
4. Cliquez sur **Add Binary Media Type**
5. Ajoutez le type de média image :
   - `image/*`
6. Cliquez sur **Save Changes**

**Important** : Vous DEVEZ redéployer votre API après avoir ajouté les types de médias binaires !

### 2.6 Déployer votre API

1. Cliquez sur **Actions** → **Deploy API**
2. Créez un nouveau stage :
   - **Stage name** : `dev`
   - **Description** : `Development stage`
3. Cliquez sur **Deploy**
4. **Important** : Copiez l'**Invoke URL** - vous en aurez besoin !

### 2.7 Associer le plan d'utilisation au stage

1. Cliquez sur **Usage Plans**
2. Sélectionnez votre plan d'utilisation
3. Dans **Associated stages**, cliquez sur **Add API Stage**

## Étape 3 : Tester votre API

### 3.1 Tester avec les outils en ligne de commande

#### Utiliser curl (macOS/Linux)

```bash
# Définir les détails de votre API
API_URL="https://votre-api-id.execute-api.eu-west-1.amazonaws.com/dev"
API_KEY="votre-cle-api-ici"

# Tester le listage des objets
curl -H "x-api-key: $API_KEY" "$API_URL/objects"

# Tester la récupération d'un objet spécifique
curl -H "x-api-key: $API_KEY" "$API_URL/objects/hello.txt"

# Télécharger un fichier
curl -H "x-api-key: $API_KEY" "$API_URL/objects/data.json" -o downloaded-data.json
```

#### Utiliser la page web locale pour tester l'API

1. Installez l'extension **LiveServer** sur VSCode
2. Ouvrez le fichier **src/index.html** dans VSCode
3. Faites un clic droit sur le code, puis cliquez sur **Open with Live Server**
4. Configurez l'API et la clé API puis testez votre API.

## Étape 5 : Points de validation

✅ **Point de contrôle 1** : Bucket S3 créé avec des fichiers d'exemple

✅ **Point de contrôle 2** : API Gateway configuré et déployé

✅ **Point de contrôle 3** : Authentification par clé API fonctionnelle

✅ **Point de contrôle 4** : Possibilité de lister les objets S3 via curl

✅ **Point de contrôle 5** : Possibilité de récupérer des fichiers individuels via l'API

## Étape 6 : Nettoyage

### 6.1 Supprimer les ressources API Gateway

1. Dans la console API Gateway, sélectionnez votre API
2. Cliquez sur **Actions** → **Delete API**
3. Supprimez le plan d'utilisation et la clé API

### 6.2 Supprimer le rôle IAM

1. Dans la console IAM, trouvez `APIGatewayS3ReadRole`
2. Supprimez le rôle

### 6.3 Supprimer le bucket S3

1. Videz d'abord le bucket (supprimez tous les objets)
2. Supprimez le bucket

## Dépannage

### Problèmes courants

**L'API retourne 403 Forbidden**

- Vérifiez que la clé API est incluse dans les en-têtes de requête comme `x-api-key`
- Vérifiez que la clé API est associée au plan d'utilisation
- Assurez-vous que le plan d'utilisation est associé à votre stage API

**Problèmes de test de l'API**

- Utilisez curl, Postman ou la console du navigateur au lieu des interfaces web
- Assurez-vous que la clé API est incluse dans les en-têtes de requête comme `x-api-key`
- Testez avec les exemples fournis à l'étape 3

**Les images s'affichent en JSON/texte ou ne s'affichent pas**

- **Cause principale** : API Gateway non configuré pour les types de médias binaires
- **Solution** : Ajoutez `image/*` et `*/*` aux Binary Media Types dans les paramètres d'API Gateway
- **Redéploiement obligatoire** : Après avoir ajouté les types de médias binaires, redéployez votre API
- **Vérifier la réponse** : Utilisez les outils de développement du navigateur pour vérifier les en-têtes Content-Type

**Erreurs de permissions IAM**

- Vérifiez que le rôle IAM a les permissions de lecture S3
- Vérifiez que l'ARN du rôle est correctement configuré dans API Gateway

**Accès S3 refusé**

- Assurez-vous que le bucket existe et est dans la bonne région
- Vérifiez que le rôle IAM a accès à votre bucket spécifique

### Obtenir de l'aide

Si vous rencontrez des problèmes :

1. Consultez les logs AWS CloudWatch pour votre API Gateway
2. Utilisez les outils de développement du navigateur pour inspecter les requêtes réseau
3. Vérifiez que toutes les étapes de configuration ont été complétées correctement

## Résumé de l'apprentissage

Dans ce lab, vous avez appris :

- Comment configurer API Gateway via la Console AWS
- Mettre en place une authentification par clé API pour la sécurité
- Intégration directe entre API Gateway et S3 (sans Lambda)
- Construire une interface web pour consommer des API REST
- Gérer différents types de contenu et téléchargements de fichiers
- Concepts de base de sécurité et de contrôle d'accès des API

Excellent travail pour avoir complété le Lab 3 ! Vous avez maintenant une expérience pratique avec API Gateway et comprenez comment exposer des services AWS via des API REST.
