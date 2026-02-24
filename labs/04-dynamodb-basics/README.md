# Lab 04 : Les bases de DynamoDB - Base de données NoSQL

## Objectifs d'apprentissage

À la fin de ce lab, vous serez capable de :

- Créer une table DynamoDB avec le SDK AWS pour TypeScript
- Insérer des éléments dans une table DynamoDB
- Lire et interroger des données depuis DynamoDB
- Comprendre les concepts de base de DynamoDB : tables, éléments, et clés

## Prérequis

- Avoir terminé le Lab 00 : Setup
- Session AWS SSO active (`npm run validate-sso`)
- Compréhension basique de TypeScript et des bases de données NoSQL

## Durée du Lab

**Temps estimé :** 30-45 minutes

## Aperçu

Amazon DynamoDB est un service de base de données NoSQL entièrement géré qui offre des performances rapides et prévisibles avec une évolutivité transparente. Dans ce lab, vous apprendrez à utiliser DynamoDB via le SDK AWS pour TypeScript.

---

## Partie 1 : Implémentation avec le SDK AWS pour TypeScript

### Étape 1 : Examiner le fichier TypeScript

Le fichier `src/dynamodb-operations.ts` contient des commentaires qui vous guident pour implémenter :

- **Création de table** : Créer une table DynamoDB pour stocker des cafés Starbucks
- **Activer le mode payer à la requête** : Configurer le **BillingMode** à **Pay Per Request**
- **Insertion d'éléments** : Ajouter 3 cafés avec leurs caractéristiques
- **Lecture des données** : Récupérer et afficher les éléments stockés

### Étape 2 : Implémenter les fonctions

Utilisez la documentation officielle AWS SDK v3 pour TypeScript :

- **Comment DynamoDB fonctionne**: [How it Works Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html)
- **Créer une table** : [CreateTableCommand Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/command/CreateTableCommand/)
- **Insérer des éléments** : [PutItemCommand Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/command/PutItemCommand/)
- **Lire des éléments** : [ScanCommand Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/command/ScanCommand/)
- **Authentification avec l'AWS SDK**: [Authentification with AWS SDK](https://docs.aws.amazon.com/sdkref/latest/guide/access.html)

### Étape 3 : Exécuter votre implémentation

```bash
# Naviguer vers le répertoire du lab
cd labs/04-dynamodb-basics

# Installer les dépendances DynamoDB
npm install @aws-sdk/client-dynamodb

# Compiler et exécuter le script TypeScript
npx ts-node src/dynamodb-operations.ts
```

---

## Structure des données

Votre table DynamoDB devra stocker des cafés Starbucks avec les caractéristiques suivantes :

- **id** (clé primaire) : Identifiant unique du café
- **name** : Nom du café (ex: "Espresso", "Latte", "Cappuccino")
- **size** : Taille (ex: "Tall", "Grande", "Venti")
- **price** : Prix en euros (ex: 3.50, 4.20, 4.80)

---

## Points de contrôle de validation

- [ ] Table DynamoDB créée avec succès, en mode pay per request
- [ ] 3 éléments (cafés) insérés dans la table
- [ ] Données lues et affichées correctement
- [ ] Script TypeScript exécuté sans erreur

---

## Procédures de nettoyage

**IMPORTANT** : Nettoyez toujours vos ressources pour éviter des frais !

```bash
# Le script inclut automatiquement la suppression de la table
# Vérifiez que la table a été supprimée dans la console AWS DynamoDB
```

---

## Concepts clés appris

- **Tables DynamoDB** : Conteneurs pour stocker des éléments avec une structure flexible
- **Éléments** : Enregistrements individuels dans une table DynamoDB
- **Clé primaire** : Identifiant unique pour chaque élément
- **SDK AWS v3** : Utilisation moderne du SDK pour interagir avec DynamoDB
- **Opérations CRUD** : Create (PutItem), Read (Scan/Query), Update, Delete

---

## Dépannage des problèmes courants

### Erreur : "Table already exists"

**Solution** : Ajoutez un suffixe unique au nom de la table ou supprimez la table existante.

### Erreur : "Module not found"

**Solution** :

```bash
# Installer les dépendances DynamoDB
npm install @aws-sdk/client-dynamodb
```

### Erreur : "ValidationException"

**Solution** : Vérifiez que la structure de vos éléments correspond au schéma de la table.

---

🎉 **Félicitations !** Vous avez appris les bases de Amazon DynamoDB et savez maintenant créer des tables, insérer des éléments, et lire des données !
