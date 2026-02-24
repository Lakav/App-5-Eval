# Lab 07 - Démonstration Load Balancer et Auto Scaling

## Objectifs d'apprentissage

À la fin de ce lab, vous serez capable de :

- Déployer un Application Load Balancer (ALB) avec plusieurs serveurs web
- Configurer un Auto Scaling Group (ASG) pour gérer automatiquement le nombre d'instances
- Comprendre la répartition de charge entre plusieurs zones de disponibilité
- Simuler une charge élevée pour déclencher l'auto-scaling
- Monitorer le comportement de l'infrastructure sous charge

## Prérequis

- AWS CLI configuré avec le profil `aws-labs`
- Session AWS SSO active
- Connaissances de base sur EC2 et les réseaux AWS

## Durée estimée

45-60 minutes

## Architecture de la démonstration

Cette démonstration déploie :

- 1 VPC avec 3 subnets publics dans différentes AZ
- 1 Application Load Balancer
- 1 Auto Scaling Group avec 3 instances EC2 minimum
- 3 serveurs web simples affichant leur nom et zone de disponibilité
- Scripts de simulation de charge sur chaque instance

## Instructions étape par étape

### Étape 1 : Validation de l'environnement

```bash
# Vérifier la configuration AWS
npm run validate-setup

# S'assurer que la session SSO est active
aws sts get-caller-identity --profile aws-labs
```

### Étape 2 : Déploiement de l'infrastructure

```bash
# Déployer la stack CloudFormation
npm run deploy
```

Le déploiement prend environ 5-10 minutes.

### Étape 3 : Tester la répartition de charge

1. Récupérer l'URL du Load Balancer depuis les outputs de la stack
2. Ouvrir l'URL dans un navigateur
3. Rafraîchir plusieurs fois pour voir la répartition entre les serveurs

### Étape 4 : Simuler une charge élevée

```bash
# Se connecter à une instance et lancer la simulation de charge
npm run simulate-load
```

### Étape 5 : Observer l'auto-scaling

1. Surveiller les métriques CloudWatch
2. Observer la création de nouvelles instances
3. Vérifier que le Load Balancer intègre les nouvelles instances

### Étape 6 : Nettoyage

```bash
# Supprimer toutes les ressources
npm run cleanup
```

## Validation

- [ ] Le Load Balancer distribue les requêtes entre les 3 instances initiales
- [ ] Chaque page web affiche le nom du serveur et sa zone de disponibilité
- [ ] La simulation de charge déclenche la création de nouvelles instances
- [ ] Les nouvelles instances sont automatiquement ajoutées au Load Balancer
- [ ] Toutes les ressources sont supprimées après le nettoyage

## Troubleshooting

### Problème : Les instances ne démarrent pas

- Vérifier les logs CloudFormation
- S'assurer que les AMI sont disponibles dans votre région

### Problème : L'auto-scaling ne se déclenche pas

- Vérifier les métriques CloudWatch
- Attendre 5-10 minutes pour que les métriques se stabilisent

### Problème : Le Load Balancer retourne des erreurs 502/503

- Vérifier que les instances sont en état "healthy"
- Contrôler les security groups

## Concepts clés

- **Application Load Balancer** : Répartit le trafic HTTP/HTTPS entre plusieurs instances
- **Auto Scaling Group** : Ajuste automatiquement le nombre d'instances selon la charge
- **Health Checks** : Vérifie que les instances sont opérationnelles
- **Target Groups** : Groupe les instances pour le Load Balancer
- **CloudWatch Metrics** : Surveille les performances et déclenche l'auto-scaling

## Coûts estimés

- EC2 instances (t3.micro) : ~$0.01/heure par instance
- Application Load Balancer : ~$0.025/heure
- Coût total estimé : ~$0.05-0.10/heure pendant la démonstration
