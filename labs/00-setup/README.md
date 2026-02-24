# Lab 00 : Configuration de l'environnement AWS

## Objectifs d'apprentissage

À la fin de ce lab, vous serez capable de :

- Ouvrir et configurer l'environnement de développement AWS Labs à l'aide des **Dev Containers** de VS Code.
- Configurer l'authentification **AWS SSO** pour un accès sécurisé aux services AWS.
- Comprendre les bonnes pratiques de sécurité liées à AWS SSO.
- Valider votre configuration à l'aide d'outils automatisés.
- Configurer les variables d'environnement pour un accès fluide à AWS.

## Prérequis

- **VS Code** avec l'extension **Dev Containers** installée.
- **Docker Desktop** en cours d'exécution sur votre machine.
- Une connexion Internet.
- Un accès à un compte AWS avec SSO configuré (fourni par votre instructeur).
- Une connaissance de base de VS Code et du terminal.

## Durée du Lab

**Temps estimé :** 15-20 minutes

## Partie 1 : Ouvrir l'environnement de développement

Le dépôt AWS Labs utilise un **Dev Container** qui fournit un environnement préconfiguré avec tous les outils nécessaires, notamment :

- ✅ AWS CLI v2
- ✅ AWS SSO CLI
- ✅ Node.js LTS
- ✅ Toutes les dépendances du projet

### Étape 0 : Préparation de l'hôte (Windows, macOS ou Linux)

Avant d'ouvrir VS Code, vous devez vous assurer que le dossier `.aws` existe dans votre répertoire personnel. Cela permet au **Dev Container** de lier ce dossier local au dossier interne du conteneur.

### Pour Windows (PowerShell)

Ouvrez PowerShell et exécutez la commande suivante :

```powershell
if (!(Test-Path ~\.aws)) { New-Item -Type Directory -Path ~\.aws }

```

### Pour macOS / Linux (Terminal)

Ouvrez votre terminal et exécutez :

```bash
mkdir -p ~/.aws

```

Une fois le dossier créé, vous pouvez vérifier qu'il est bien là :

- **Windows :**

```bash
ls $HOME\.aws

```

- **macOS/Linux :**

```bash
ls -a ~ | grep .aws

```

### Étape 1 : Ouvrir dans le Dev Container

1. **Ouvrez VS Code** et assurez-vous que Docker Desktop fonctionne.
2. **Ouvrez le dossier du dépôt** dans VS Code :

- Fichier → Ouvrir le dossier → Sélectionnez le dossier `develop-for-the-cloud-labs`.

3. **Ouvrir dans le Dev Container :**

- VS Code devrait détecter automatiquement la configuration du conteneur.
- Cliquez sur **"Reopen in Container"** (Rouvrir dans le conteneur) lorsque l'invite apparaît.
- **OU** utilisez la palette de commandes (Ctrl/Cmd+Shift+P) → "Dev Containers: Reopen in Container".

4. **Attendez la configuration :**

- La première fois, le téléchargement et la construction du conteneur prendront quelques minutes.
- Les dépendances seront installées automatiquement via `npm install`.
- ✅ **Indicateur de succès :** Vous verrez "Dev container: Ubuntu" en bas à gauche de la fenêtre.

### Étape 2 : Vérifier les outils préinstallés

Ouvrez le terminal intégré dans VS Code (Ctrl/Cmd+`) et vérifiez que les outils sont disponibles :

```bash
# Vérifier AWS CLI
aws --version

# Vérifier Node.js
node --version

# Vérifier npm
npm --version

```

✅ **Résultat attendu :**

- AWS CLI v2.x.x
- Node.js v18+ (LTS)
- npm v9+

## Partie 2 : Configurer AWS SSO

Votre répertoire local `~/.aws` est automatiquement monté dans le conteneur. Toute configuration AWS que vous créez persistera donc entre les sessions du conteneur.

### Étape 1 : Configuration initiale du SSO

1. **Lancez la configuration SSO :**

```bash
aws configure sso

```

2. **Entrez le nom de la session** (fournie par votre instructeur) :

```
SSO session name (Recommended): sso-session

```

3. **Entrez l'URL de démarrage SSO** (fournie par votre instructeur) :

```
SSO start URL [None]: https://votre-organisation.awsapps.com/start

```

📝 **Note :** Remplacez par l'URL réelle fournie par votre instructeur.

3. **Entrez la région SSO** (généralement celle où le SSO de votre organisation est configuré) :

```
SSO region [None]: eu-west-1

```

4. **Spécifier le scope** (sso:account:access) :

```
SSO registration scopes [sso:account:access]:

```

5. **Complétez l'authentification dans le navigateur :**

- Le CLI ouvrira votre navigateur web par défaut.
- Connectez-vous avec les identifiants fournis.
- Autorisez l'application AWS CLI lorsque cela vous est demandé.
- ✅ **Indicateur de succès :** Vous verrez "Successfully logged into Start URL".

5. **Sélectionnez votre compte :**

- Choisissez le compte AWS fourni pour les labs.
- 📝 **Note :** Si plusieurs comptes apparaissent, sélectionnez celui désigné pour votre cours.

6. **Sélectionnez votre rôle :**

- Choisissez le rôle approprié (généralement `StudentAccess`).
- Ce rôle détermine vos permissions dans AWS.

7. **Configurez le profil CLI :**

```
CLI default client Region [None]: eu-west-1
CLI default output format [None]: json
CLI profile name [default]: aws-labs

```

⚠️ **Important :** Utilisez `aws-labs` comme nom de profil pour garantir la cohérence entre tous les labs.

### Étape 2 : Définir la variable d'environnement (Étape critique)

Cette étape est cruciale pour un accès fluide à AWS tout au long des travaux pratiques.

**Dans le terminal VS Code (environnement Linux) :**

```bash
export AWS_PROFILE=aws-labs

```

**Pour rendre ce paramètre permanent pour la session du conteneur :**

Ajoutez la variable d'environnement à la configuration de votre shell :

```bash
echo 'export AWS_PROFILE=aws-labs' >> ~/.bashrc
source ~/.bashrc

```

📝 **Note :** Ce paramètre persistera dans vos sessions de conteneur mais est normalement géré automatiquement par la configuration du dev container.

### Étape 3 : Connexion à la session SSO

```bash
aws sso login

```

✅ **Indicateur de succès :** Le navigateur s'ouvre et affiche "Successfully logged in".

## Partie 3 : Valider votre configuration

Nous allons maintenant utiliser les outils de validation automatisés pour nous assurer que tout est correctement configuré.

### Exécuter la validation complète

```bash
npm run validate-setup

```

**Ce que cela vérifie :**

- ✅ Installation et version de l'AWS CLI
- ✅ Configuration du profil AWS SSO
- ✅ Statut de la session SSO
- ✅ Installation de Node.js et npm
- ✅ Dépendances du projet
- ✅ Accès aux services AWS
- ✅ Variables d'environnement

**Résultat attendu pour une configuration réussie :**

```
🎉 All checks passed! (7/7)
You are ready to start working with the AWS labs!

```

### Vérification rapide du statut SSO

```bash
npm run validate-sso

```

**Utilisez cette commande :**

- Avant de commencer chaque session de lab.
- Lorsque vous rencontrez des erreurs d'authentification.
- Pour vérifier si votre session SSO est toujours active.

**Résultat attendu une fois connecté :**

```
✅ SSO session is active
Logged in as: votre-nom-utilisateur
Account: 123456789012

```

## Partie 4 : Tester l'accès AWS

Vérifions que vous pouvez accéder aux services AWS avec votre configuration.

### Tester les commandes AWS de base

1. **Vérifier votre identité :**

```bash
aws sts get-caller-identity

```

✅ **Résultat attendu :**

```json
{
  "UserId": "AIDACKCEVSQ6C2EXAMPLE",
  "Account": "123456789012",
  "Arn": "arn:aws:sts::123456789012:assumed-role/StudentRole/votre-nom-utilisateur"
}
```

2. **Vérifier les régions disponibles :**

```bash
aws ec2 describe-regions --query 'Regions[].RegionName' --output table

```

✅ **Résultat attendu :** Un tableau des régions AWS.

## Dépannage des problèmes courants

### Problème : "Dev Container failed to start"

**Solutions :**

1. **Vérifiez que Docker Desktop est lancé :**

```bash
docker --version

```

2. **Reconstruisez le conteneur :**

- Palette de commandes → "Dev Containers: Rebuild Container".

3. **Vérifiez les ressources Docker :**

- Assurez-vous que Docker dispose de suffisamment de mémoire (4 Go+ recommandés).

### Problème : "SSO session has expired"

**Solution :**

```bash
aws sso login
npm run validate-sso

```

### Problème : "Unable to locate credentials"

**Solutions :**

1. Vérifiez la variable d'environnement :

```bash
echo $AWS_PROFILE

```

2. Si elle n'est pas définie :

```bash
export AWS_PROFILE=aws-labs
echo 'export AWS_PROFILE=aws-labs' >> ~/.bashrc

```

3. Reconnectez-vous : `aws sso login`.

### Problème : Erreurs "Access Denied"

**Solutions :**

1. Vérifiez que vous utilisez le bon rôle et le bon compte.
2. Contactez votre instructeur pour vérifier vos permissions.
3. Vérifiez que vous êtes dans la bonne région AWS.

### Problème : Le navigateur ne s'ouvre pas pour le login SSO

**Solutions :**

1. **Copiez l'URL manuellement :** Le CLI affichera une URL si le navigateur ne s'ouvre pas.
2. **Vérifiez si vous êtes dans le conteneur :** Le conteneur redirige la requête vers le navigateur de votre machine hôte.

## Liste de contrôle de fin de lab

Avant de passer aux autres labs, assurez-vous d'avoir terminé :

- [ ] ✅ Dev container ouvert avec succès dans VS Code.
- [ ] ✅ AWS CLI v2 disponible (`aws --version` affiche v2.x.x).
- [ ] ✅ AWS SSO configuré avec le nom de profil `aws-labs`.
- [ ] ✅ Variable d'environnement `AWS_PROFILE=aws-labs` définie.
- [ ] ✅ Session SSO active (`aws sso login` réussi).
- [ ] ✅ Node.js v18+ et npm disponibles dans le conteneur.
- [ ] ✅ Dépendances installées (automatique via le dev container).
- [ ] ✅ Validation complète réussie (`npm run validate-setup`).
- [ ] ✅ Identité AWS vérifiée (`aws sts get-caller-identity`).
- [ ] ✅ Commandes AWS de base fonctionnelles sans le flag `--profile`.

## Bonnes pratiques de sécurité apprises

🔒 **Ce que vous avez mis en œuvre :**

- ✅ **Isolation par Dev Container :** Environnement de développement sécurisé et reproductible.
- ✅ **Authentification SSO :** Méthode moderne et sécurisée pour accéder à AWS.
- ✅ **Identifiants temporaires :** Aucune clé d'accès à long terme n'est stockée.
- ✅ **Variables d'environnement :** Gestion sécurisée des accès.
- ✅ **Accès par profil :** Configurations AWS isolées.

🚫 **Ce qu'il faut éviter :**

- ❌ Ne jamais coder d'identifiants AWS en dur dans le code source.
- ❌ Ne jamais partager vos identifiants AWS.
- ❌ Ne jamais commiter d'identifiants dans un système de contrôle de version.
- ❌ Ne pas laisser de ressources fonctionner inutilement.

3. **Rappel pour chaque session :**

- Votre dev container conserve votre configuration AWS.
- Lancez `npm run validate-sso` avant de commencer.
- Utilisez `aws sso login` si la session a expiré.

---

🎉 **Félicitations !** Vous avez configuré avec succès votre environnement de développement AWS et vous êtes prêt à commencer vos travaux pratiques sur le cloud !

---
