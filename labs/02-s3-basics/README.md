# Lab 02 : Les bases de S3 - Stockage d'objets dans le cloud

## Objectifs d'apprentissage

À la fin de ce lab, vous serez capable de :

- Créer et gérer des buckets S3 avec AWS CLI
- Déposer et récupérer des objets dans S3 avec AWS CLI
- Utiliser le SDK AWS pour TypeScript pour interagir avec S3
- Configurer un bucket S3 pour héberger un site web statique
- Comprendre les concepts de base de S3 : buckets, objets, et permissions

## Prérequis

- Avoir terminé le Lab 00 : Setup
- Session AWS SSO active (`npm run validate-sso`)
- Compréhension basique de la ligne de commande et de TypeScript

## Durée du Lab

**Temps estimé :** 45-60 minutes

## Aperçu

Amazon Simple Storage Service (S3) est un service de stockage d'objets qui offre une évolutivité, une disponibilité des données, une sécurité et des performances de pointe. Dans ce lab, vous apprendrez à utiliser S3 via AWS CLI, le SDK TypeScript, et la console AWS.

---

## Partie 1 : Gestion de S3 avec AWS CLI

### Étape 1 : Créer un bucket S3

Les noms de buckets S3 doivent être uniques globalement. Utilisez votre nom pour garantir l'unicité.

```bash
# Remplacez 'votre-nom' par votre nom réel (lettres minuscules, chiffres, tirets uniquement)
BUCKET_NAME="s3-lab-cli-votre-nom-$(date +%s)"
echo "Nom du bucket: $BUCKET_NAME"

# Créer le bucket
aws s3 mb s3://$BUCKET_NAME

# Vérifier que le bucket a été créé
aws s3 ls | grep $BUCKET_NAME
```

### Étape 2 : Créer un fichier texte local

```bash
# Créer un fichier de test
echo "Bonjour depuis AWS CLI!" > test-cli.txt
echo "Ce fichier a été créé le $(date)" >> test-cli.txt
echo "Étudiant: $(whoami)" >> test-cli.txt

# Vérifier le contenu
cat test-cli.txt
```

### Étape 3 : Déposer l'objet dans S3

```bash
# Copier le fichier vers S3
aws s3 cp test-cli.txt s3://$BUCKET_NAME/

# Vérifier que le fichier a été uploadé
aws s3 ls s3://$BUCKET_NAME/
```

### Étape 4 : Récupérer l'objet depuis S3

```bash
# Supprimer le fichier local pour tester la récupération
rm test-cli.txt

# Vérifier que le fichier n'existe plus localement
ls -la test-cli.txt 2>/dev/null || echo "Fichier local supprimé"

# Télécharger le fichier depuis S3
aws s3 cp s3://$BUCKET_NAME/test-cli.txt ./test-cli-downloaded.txt

# Vérifier le contenu du fichier téléchargé
cat test-cli-downloaded.txt
```

### Étape 5 : Explorer les métadonnées de l'objet

```bash
# Obtenir des informations détaillées sur l'objet
aws s3api head-object --bucket $BUCKET_NAME --key test-cli.txt

# Lister les objets avec plus de détails
aws s3 ls s3://$BUCKET_NAME/ --human-readable --summarize
```

---

## Partie 2 : Utilisation du SDK AWS pour TypeScript

### Étape 1 : Examiner le code TypeScript

Le fichier `src/s3-operations.ts` contient toutes les fonctions nécessaires pour interagir avec S3 :

- **createBucket()** : Créer un bucket S3
- **uploadFile()** : Uploader un fichier vers S3
- **listObjects()** : Lister les objets dans un bucket
- **downloadFile()** : Télécharger un fichier depuis S3

### Étape 2 : Exécuter le script TypeScript

```bash
# Naviguer vers le répertoire du lab
cd labs/02-s3-basics

# Compiler et exécuter le script TypeScript
npx ts-node src/s3-operations.ts
```

### Étape 3 : Comprendre le code

Le script TypeScript démontre :

- **Création de bucket** : Utilisation de `CreateBucketCommand`
- **Upload d'objet** : Utilisation de `PutObjectCommand` avec un fichier local
- **Liste des objets** : Utilisation de `ListObjectsV2Command`
- **Téléchargement d'objet** : Utilisation de `GetObjectCommand` avec gestion des streams
- **Gestion d'erreurs** : Try/catch pour une gestion robuste des erreurs

---

## Partie 3 : Hébergement de site web statique avec S3

### Étape 1 : Créer les fichiers du site web

```bash
# Créer le répertoire pour le site web
mkdir -p website

# Créer la page d'accueil
cat > website/index.html << 'EOF'
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mon Premier Site S3</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #232f3e;
            text-align: center;
        }
        .aws-logo {
            text-align: center;
            font-size: 2em;
            color: #ff9900;
            margin: 20px 0;
        }
        .info {
            background-color: #e8f4fd;
            padding: 15px;
            border-left: 4px solid #0073bb;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎉 Hello World depuis Amazon S3!</h1>

        <div class="aws-logo">☁️ AWS S3</div>

        <div class="info">
            <h3>Informations sur ce site :</h3>
            <ul>
                <li><strong>Hébergé sur :</strong> Amazon S3</li>
                <li><strong>Type :</strong> Site web statique</li>
                <li><strong>Créé le :</strong> <span id="date"></span></li>
                <li><strong>Lab :</strong> 02-s3-basics</li>
            </ul>
        </div>

        <p>Ce site web simple démontre comment Amazon S3 peut héberger des sites web statiques de manière simple et économique.</p>

        <h3>Fonctionnalités S3 utilisées :</h3>
        <ul>
            <li>✅ Hébergement de site web statique</li>
            <li>✅ Configuration d'accès public</li>
            <li>✅ Page d'index personnalisée</li>
            <li>✅ Page d'erreur personnalisée</li>
        </ul>
    </div>

    <script>
        document.getElementById('date').textContent = new Date().toLocaleDateString('fr-FR');
    </script>
</body>
</html>
EOF

# Créer une page d'erreur
cat > website/error.html << 'EOF'
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page non trouvée - Site S3</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            text-align: center;
            background-color: #f5f5f5;
        }
        .error-container {
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #d13212;
            font-size: 3em;
        }
        .back-link {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 20px;
            background-color: #232f3e;
            color: white;
            text-decoration: none;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>404</h1>
        <h2>Page non trouvée</h2>
        <p>Désolé, la page que vous cherchez n'existe pas sur ce site S3.</p>
        <a href="/" class="back-link">← Retour à l'accueil</a>
    </div>
</body>
</html>
EOF

echo "✅ Fichiers du site web créés dans le répertoire 'website/'"
```

### Étape 2 : Créer un bucket pour le site web via la console AWS

1. **Ouvrir la console S3** :
   - Allez sur la console AWS
   - Naviguez vers le service S3

2. **Créer un nouveau bucket** :
   - Cliquez sur "Créer un compartiment"
   - Nom du bucket : `mon-site-web-s3-votre-nom` (remplacez par votre nom)
   - Région : `eu-west-1`
   - **Important** : Décochez "Bloquer tout accès public" (nous configurerons les permissions plus tard)
   - Cliquez sur "Créer un bucket"

### Étape 3 : Configurer l'hébergement de site web statique

1. **Sélectionner votre bucket** et aller dans l'onglet "Propriétés"

2. **Activer l'hébergement de site web statique** :
   - Faites défiler jusqu'à "Hébergement de site web statique"
   - Cliquez sur "Modifier"
   - Sélectionnez "Activer"
   - Type d'hébergement : "Héberger un site web statique"
   - Document d'index : `index.html`
   - Document d'erreur : `error.html`
   - Cliquez sur "Enregistrer les modifications"

3. **Noter l'URL du site web** :
   - L'URL apparaîtra dans la section "Hébergement de site web statique"
   - Format : `http://nom-du-bucket.s3-website.eu-west-1.amazonaws.com`

### Étape 4 : Uploader les fichiers du site web

1. **Aller dans l'onglet "Objets"** de votre bucket

2. **Uploader les fichiers** :
   - Cliquez sur "Charger"
   - Sélectionnez les fichiers `index.html` et `error.html` du répertoire `website/`
   - Cliquez sur "Charger"

### Étape 5 : Configurer les permissions publiques

1. **Aller dans l'onglet "Autorisations"**

2. **Modifier la politique de bucket** :
   - Cliquez sur "Politique de bucket" → "Modifier"
   - Collez la politique suivante (remplacez `VOTRE-NOM-DE-BUCKET`) :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::VOTRE-NOM-DE-BUCKET/*"
    }
  ]
}
```

3. **Enregistrer les modifications**

### Étape 6 : Tester le site web

1. **Accéder à l'URL du site web** notée à l'étape 3
2. **Vérifier que la page d'accueil s'affiche correctement**
3. **Tester la page d'erreur** en ajoutant `/page-inexistante` à l'URL

---

## Points de contrôle de validation

### Validation CLI

- [ ] Bucket créé avec succès via AWS CLI
- [ ] Fichier uploadé et téléchargé avec AWS CLI
- [ ] Métadonnées de l'objet récupérées

### Validation SDK TypeScript

- [ ] Script TypeScript exécuté sans erreur
- [ ] Bucket créé via le SDK
- [ ] Fichier uploadé et téléchargé via le SDK
- [ ] Liste des objets affichée correctement

### Validation Site Web Statique

- [ ] Bucket configuré pour l'hébergement web
- [ ] Page d'accueil accessible via l'URL publique
- [ ] Page d'erreur fonctionnelle
- [ ] Permissions publiques configurées correctement

---

## Procédures de nettoyage

**IMPORTANT** : Nettoyez toujours vos ressources pour éviter des frais !

### Nettoyage des buckets CLI et SDK

```bash
# Supprimer les objets et le bucket CLI (remplacez par votre nom de bucket)
aws s3 rm s3://VOTRE-BUCKET-CLI --recursive
aws s3 rb s3://VOTRE-BUCKET-CLI

# Supprimer les objets et le bucket SDK (remplacez par votre nom de bucket)
aws s3 rm s3://VOTRE-BUCKET-SDK --recursive
aws s3 rb s3://VOTRE-BUCKET-SDK

# Nettoyer les fichiers locaux
rm -f test-cli.txt test-cli-downloaded.txt
rm -f test-sdk.txt test-sdk-downloaded.txt
```

### Nettoyage du site web statique

1. **Via la console AWS** :
   - Sélectionnez votre bucket de site web
   - Supprimez tous les objets
   - Supprimez le bucket

2. **Via AWS CLI** :

```bash
# Remplacez par le nom de votre bucket de site web
WEBSITE_BUCKET="mon-site-web-s3-votre-nom"
aws s3 rm s3://$WEBSITE_BUCKET --recursive
aws s3 rb s3://$WEBSITE_BUCKET
```

3. **Nettoyer les fichiers locaux** :

```bash
rm -rf website/
```

### Script de nettoyage automatique

```bash
# Utiliser le script de nettoyage fourni
./cleanup.sh
```

---

## Concepts clés appris

- **Buckets S3** : Conteneurs pour stocker des objets avec des noms uniques globalement
- **Objets S3** : Fichiers stockés dans les buckets avec des métadonnées
- **AWS CLI** : Interface en ligne de commande pour interagir avec les services AWS
- **SDK AWS v3** : Bibliothèque moderne pour intégrer AWS dans les applications TypeScript/JavaScript
- **Hébergement web statique** : Capacité de S3 à servir des sites web HTML/CSS/JS
- **Politiques de bucket** : Contrôle d'accès granulaire pour les ressources S3
- **Gestion des coûts** : Importance de nettoyer les ressources inutilisées

---

## Dépannage des problèmes courants

### Erreur : "Bucket name already exists"

**Solution** : Les noms de buckets S3 sont uniques globalement. Ajoutez un suffixe unique :

```bash
BUCKET_NAME="s3-lab-cli-votre-nom-$(date +%s)"
```

### Erreur : "Access Denied" lors de l'accès au site web

**Solutions** :

1. Vérifiez que l'accès public est autorisé sur le bucket
2. Vérifiez que la politique de bucket est correctement configurée
3. Assurez-vous que l'hébergement web statique est activé

### Erreur : "Module not found" avec TypeScript

**Solution** :

```bash
# Installer les dépendances AWS SDK
npm install @aws-sdk/client-s3
npm install -D @types/node ts-node typescript
```

### Site web inaccessible

**Solutions** :

1. Vérifiez l'URL du site web dans les propriétés du bucket
2. Assurez-vous que `index.html` existe dans le bucket
3. Vérifiez que les permissions publiques sont configurées

---

🎉 **Félicitations !** Vous avez appris les bases de Amazon S3 et savez maintenant créer des buckets, gérer des objets, et héberger des sites web statiques !
