# Lab 1 : Les bases d'EC2 - Lancer votre première instance

## Objectifs d'apprentissage

À la fin de ce lab, vous serez capable de :

- Lancer une instance EC2 via la console de gestion AWS.
- Lancer une instance EC2 en utilisant AWS CloudFormation.
- Se connecter à votre instance EC2 via SSH.
- Comprendre les types d'instances EC2, les AMI et les groupes de sécurité.
- Terminer correctement les instances pour éviter des frais inutiles.

## Prérequis

- Avoir terminé le Lab 00 : Setup.
- Session AWS SSO active (`npm run validate-sso`).
- Compréhension basique de SSH et de la ligne de commande.

## Durée du Lab

Temps d'achèvement estimé : 45-60 minutes.

## Aperçu

Amazon Elastic Compute Cloud (EC2) fournit une capacité de calcul évolutive dans le cloud AWS. Dans ce lab, vous apprendrez deux méthodes pour lancer des instances EC2 : via la console web (interface graphique) et de manière programmatique avec AWS CloudFormation.

---

## Partie 1 : Lancer une instance EC2 via la console AWS

### Étape 1 : Accéder à la console EC2

1. Ouvrez la console de gestion AWS.
2. Naviguez vers le service EC2 (recherchez "EC2" dans le menu des services).
3. Assurez-vous d'être dans la bonne région (vérifiez dans le coin supérieur droit).

### Étape 2 : Assistant de lancement d'instance

1. Cliquez sur le bouton "Lancer une instance".
2. Configurez les paramètres suivants :

**Nom et balises (Tags) :**

- Nom : `my-first-ec2-instance`

**Images d'application et de système d'exploitation (AMI) :**

- Sélectionnez "Amazon Linux 2023 AMI" (Éligible au offre gratuite).
- Architecture : 64 bits (x86).

**Type d'instance :**

- Sélectionnez `t3.small`.

**Paire de clés (Key pair) :**

- Créez une nouvelle paire de clés ou sélectionnez-en une existante.
- Nom : `ec2-lab-keypair`
- Type : RSA
- Format : .pem (pour SSH)
- **Important :** Téléchargez et sauvegardez le fichier .pem en lieu sûr – vous en aurez besoin pour vous connecter.

**Paramètres réseau :**

- VPC : VPC par défaut (Default VPC).
- Sous-réseau : Sous-réseau par défaut.
- Attribution automatique d'IP publique : Activer.
- Groupe de sécurité : Créer un nouveau groupe.
- Nom : `ec2-lab-sg`
- Description : `Security group for EC2 lab`
- Règle SSH : Autoriser SSH (port 22) depuis votre IP.

**Stockage :**

- Conservez le volume racine par défaut de 8 Go gp3.

### Étape 3 : Lancement et vérification

1. Révisez la configuration et cliquez sur "Lancer l'instance".
2. Attendez que l'instance passe à l'état "En cours d'exécution" (Running).
3. Notez l'adresse IPv4 publique.

### Étape 4 : Se connecter à votre instance

```bash
# Récupérez l'adresse IP publique et le nom DNS depuis la console EC2

# Sécurisez le fichier de clé (macOS/Linux)
chmod 400 /chemin/vers/ec2-lab-keypair.pem

# Connexion via SSH en utilisant l'IP publique
ssh -i /chemin/vers/ec2-lab-keypair.pem ec2-user@VOTRE_IP_PUBLIQUE

# Ou connexion via le nom DNS public
ssh -i /chemin/vers/ec2-lab-keypair.pem ec2-user@VOTRE_NOM_DNS_PUBLIC

```

**Obtenir les informations de l'instance :**

- **Via la console AWS :** Console EC2 → Instances → Sélectionner l'instance → Onglet Détails.
- Adresse IPv4 publique : Affiche l'IP publique.
- DNS IPv4 public : Affiche le nom DNS type `ec2-xx-xx-xx-xx.compute-1.amazonaws.com`.

- **ID de l'instance :** Commence par `i-` suivi de caractères alphanumériques.

### Étape 5 : Exploration basique de l'instance

Une fois connecté, exécutez ces commandes :

```bash
# Vérifier les infos système
uname -a
df -h
free -h

```

---

## Partie 2 : Lancer une instance EC2 via AWS CloudFormation

### Étape 1 : Examiner le modèle CloudFormation

Le modèle CloudFormation se trouve dans `resources/templates/ec2-instance.yaml`. Ce modèle va :

- Créer un VPC avec un sous-réseau public et une passerelle Internet (IGW).
- Créer un groupe de sécurité autorisant l'accès SSH.
- Lancer une instance EC2 avec Amazon Linux 2023.
- Afficher en sortie (Output) l'ID de l'instance, l'IP publique et la commande SSH.

### Étape 2 : Vérifier les prérequis de Session Manager

Session Manager ne nécessite pas de paires de clés ni de ports SSH ouverts. Assurez-vous d'avoir :

```bash
# Vérifier que l'AWS CLI est installé et configuré
aws --version

# Vérifier que le plugin Session Manager est installé
session-manager-plugin

```

Il se peut que l'installation est mal marché, dans ce cas:

```bash
ARCH=$(uname -m) && if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then URL="https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_arm64/session-manager-plugin.deb"; else URL="https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb"; fi && curl -sL "$URL" -o "plugin.deb" && sudo dpkg -i plugin.deb

```

### Étape 3 : Déployer la pile (Stack) CloudFormation

**Notes importantes :**

- Remplacez `jean-dupond` par votre nom réel (lettres, chiffres, traits d'union uniquement).
- Aucune clé SSH requise - utilise AWS Session Manager pour un accès sécurisé.

```bash
# Déploiement via AWS CLI avec votre nom d'étudiant
aws cloudformation create-stack \
  --stack-name ec2-lab-stack \
  --template-body file://resources/templates/ec2-instance.yaml \
  --parameters ParameterKey=StudentName,ParameterValue=jean-dupond \
  --capabilities CAPABILITY_NAMED_IAM

```

### Étape 4 : Surveiller le déploiement

```bash
# Vérifier le statut de la pile
aws cloudformation describe-stacks --stack-name ec2-lab-stack

# Attendre que la création soit terminée
aws cloudformation wait stack-create-complete --stack-name ec2-lab-stack

```

### Étape 5 : Récupérer les sorties (Outputs) de la pile

On va avoir besoin de l'`InstanceID` et de l'URL du site web (output `WebServerURL`)

```bash
# Obtenir toutes les sorties
aws cloudformation describe-stacks \
  --stack-name ec2-lab-stack \
  --query 'Stacks[0].Outputs'

```

### Étape 6 : Afficher le site web déployé

Ouvrez le `WebServerURL` dans votre navigateur.
Nous allons regarder ensemble les informations affichées.

### Étape 7 : Se connecter à l'instance CloudFormation

```bash
# Récupérer l'ID de l'instance
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name ec2-lab-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' \
  --output text)

# Connexion via Session Manager
aws ssm start-session --target $INSTANCE_ID

```

Nous allons parcourir quelque éléments tous ensemble.

---

## Points de contrôle de validation

### Validation de l'instance Console

- [ ] L'instance est à l'état "Running".
- [ ] Connexion SSH réussie avec la paire de clés.
- [ ] Le groupe de sécurité limite le SSH à votre IP.

### Validation de l'instance CloudFormation

- [ ] Le déploiement affiche `CREATE_COMPLETE`.
- [ ] Connexion réussie via Session Manager.

---

## Procédures de nettoyage

**IMPORTANT :** Nettoyez toujours vos ressources pour éviter des frais !

### Nettoyage de l'instance Console

1. Allez dans la Console EC2.
2. Sélectionnez `my-first-ec2-instance`.
3. État de l'instance → Résilier l'instance (Terminate).
4. Supprimez le groupe de sécurité `ec2-lab-sg`.
5. Supprimez la paire de clés `ec2-lab-keypair`.

### Nettoyage de l'instance CloudFormation

```bash
# Supprimer la pile CloudFormation
aws cloudformation delete-stack --stack-name ec2-lab-stack

# Vérifier la suppression
aws cloudformation wait stack-delete-complete --stack-name ec2-lab-stack

```

---

## Concepts clés appris

- **Types d'instances EC2 :** Différentes capacités de calcul, mémoire et réseau.
- **AMI (Amazon Machine Images) :** Modèles de systèmes d'exploitation préconfigurés.
- **Groupes de sécurité :** Pare-feu virtuels contrôlant l'accès réseau.
- **Infrastructure as Code (IaC) :** Utilisation de CloudFormation pour définir les ressources.
- **Gestion des ressources :** Importance du nettoyage pour contrôler les coûts.
