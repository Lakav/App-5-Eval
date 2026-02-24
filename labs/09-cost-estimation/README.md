# Lab 09 - Estimation des Coûts AWS : Projet "Catalog-Snap"

## 🎯 Objectifs Pédagogiques

À la fin de ce lab, vous serez capable de :

- Comprendre la différence entre coûts fixes (provisionnement) et coûts variables (consommation)
- Utiliser l'AWS Pricing Calculator pour estimer les coûts d'une architecture
- Identifier les principaux facteurs de coûts dans une architecture AWS
- Concevoir un schéma d'architecture complet avec tous les composants
- Analyser et optimiser les coûts d'une infrastructure cloud

## 📋 Prérequis

- Compréhension des services AWS de base (VPC, EC2, S3, RDS, ECS)
- Connaissance des concepts de haute disponibilité et Multi-AZ
- Accès à l'AWS Pricing Calculator (https://calculator.aws)
- Outil de diagramme (Draw.io, Lucidchart, ou Excalidraw)

## ⏱️ Durée Estimée

**3-4 heures** (travail en groupe de 3 étudiants)

## 📖 Contexte du Projet

### Le Scénario : "Catalog-Snap"

Une startup française souhaite lancer une plateforme web permettant aux commerçants d'uploader et de gérer leurs photos de produits. L'application doit être :

- **Hautement disponible** : Pas d'interruption de service
- **Sécurisée** : Données protégées et isolées
- **Performante** : Traitement d'images rapide
- **Scalable** : Capable de gérer une croissance du trafic

Votre mission : **Estimer le coût mensuel de cette infrastructure en région Europe (Paris)**

---

## 🏗️ Architecture à Chiffrer

### Vue d'Ensemble des Composants

L'architecture "Catalog-Snap" comprend les éléments suivants :

### 1. Réseau (VPC) 🌐

**Configuration :**

- 1 VPC avec 4 sous-réseaux :
  - 2 Sous-réseaux publics (un par zone de disponibilité)
  - 2 Sous-réseaux privés (un par zone de disponibilité)
- 2 NAT Gateways (un par AZ pour la haute disponibilité)
- Volume de données traitées par les NAT Gateways : **500 Go / mois**

**💡 Pourquoi ?**

- Les NAT Gateways permettent aux ressources privées (ECS, RDS) d'accéder à Internet
- Multi-AZ garantit la disponibilité même si une zone tombe en panne

---

### 2. Point d'Entrée & Distribution 🚪

**Configuration :**

- 1 Application Load Balancer (ALB) : distribue le trafic vers les containers ECS
- CloudFront : CDN pour mettre en cache les images et réduire la latence
- Trafic sortant vers Internet via CloudFront : **1 To / mois**

**💡 Pourquoi ?**

- L'ALB répartit la charge entre plusieurs containers
- CloudFront réduit les coûts de transfert et améliore les performances globales

---

### 3. Calcul (Compute) 💻

**Configuration ECS Fargate :**

- **Baseline (24h/24, 7j/7)** :
  - 2 tâches actives en permanence
  - Configuration par tâche : 0.5 vCPU + 1 Go RAM
- **Auto Scaling (heures de pointe)** :
  - 4 tâches pendant 8 heures par jour (heures ouvrables)
  - Même configuration : 0.5 vCPU + 1 Go RAM par tâche

**💡 Calcul du temps total :**

- Baseline : 2 tâches × 24h × 30 jours = 1 440 heures
- Peak : 2 tâches supplémentaires × 8h × 30 jours = 480 heures
- **Total : 1 920 heures de tâches Fargate par mois**

---

### 4. Stockage (S3) 📦

**Configuration :**

- Stockage des photos originales et miniatures
- Volume total stocké : **2 To**
- Requêtes mensuelles :
  - **100 000 PUT** (uploads de nouvelles photos)
  - **1 000 000 GET** (lectures/téléchargements)

**💡 Pourquoi ?**

- S3 est idéal pour le stockage d'objets (images)
- Coût basé sur le volume stocké + nombre de requêtes

---

### 5. Base de Données (RDS) 🗄️

**Configuration :**

- Type : RDS MySQL
- Instance : **db.t3.medium**
- Déploiement : **Multi-AZ** (haute disponibilité)
- Stockage : **100 Go** (General Purpose SSD - gp3)

**💡 Pourquoi Multi-AZ ?**

- AWS maintient une copie synchrone dans une autre zone
- Basculement automatique en cas de panne
- ⚠️ Le Multi-AZ double presque le coût de l'instance

---

### 6. Traitement par Lots (Batch Jobs) ⚙️

**Configuration :**

- Job de maintenance et d'archivage : **4 jours par mois**
- Pendant ces 4 jours :
  - 3 instances EC2 **t3.large** (On-Demand)
  - Durée : **10 heures par jour**

**💡 Calcul du temps total :**

- 3 instances × 10 heures × 4 jours = **120 heures d'EC2 t3.large par mois**

---

## 📊 Livrables Attendus

### Livrable 1 : Schéma d'Architecture (40% de la note)

Créez un diagramme complet montrant :

**Éléments obligatoires :**

1. Les 2 zones de disponibilité (AZ-A et AZ-B)
2. Le VPC avec les 4 sous-réseaux (2 publics, 2 privés)
3. Les 2 NAT Gateways dans les sous-réseaux publics
4. L'Internet Gateway
5. CloudFront (en dehors du VPC)
6. L'Application Load Balancer (dans les sous-réseaux publics)
7. Les tâches ECS Fargate (dans les sous-réseaux privés)
8. La base RDS Multi-AZ (dans les sous-réseaux privés)
9. Le bucket S3 (service régional)
10. Les instances EC2 pour les jobs (dans les sous-réseaux privés)

**Flux de données à représenter :**

```
Utilisateur
    ↓
CloudFront (cache)
    ↓
Application Load Balancer
    ↓
ECS Fargate (API)
    ↓
├─→ RDS MySQL (métadonnées)
└─→ S3 (stockage images)
```

**Outils recommandés :**

- Draw.io (gratuit) : https://app.diagrams.net
- Lucidchart (version étudiante)
- Excalidraw (simple et rapide) : https://excalidraw.com

---

### Livrable 2 : Estimation Budgétaire (60% de la note)

Utilisez l'**AWS Pricing Calculator** : https://calculator.aws

**⚠️ Important : Sélectionnez la région "Europe (Paris)" pour tous les services**

#### Tableau Récapitulatif à Compléter

| Service                       | Unité de Mesure       | Détails Configuration               | Coût Mensuel ($) |
| ----------------------------- | --------------------- | ----------------------------------- | ---------------- |
| **NAT Gateway**               | Heures + Go traités   | 2 NAT × 730h + 500 Go               | ?                |
| **Application Load Balancer** | Heures + LCU          | 730h + trafic estimé                | ?                |
| **ECS Fargate**               | vCPU-h + GB-h         | 1920 tâches-heures (0.5 vCPU, 1 GB) | ?                |
| **RDS MySQL**                 | Instance + Stockage   | db.t3.medium Multi-AZ + 100 Go gp3  | ?                |
| **S3**                        | Go stockés + Requêtes | 2 To + 100k PUT + 1M GET            | ?                |
| **CloudFront**                | Transfert données     | 1 To sortant vers Internet          | ?                |
| **EC2 (Jobs)**                | Heures instances      | 120h de t3.large On-Demand          | ?                |
| **TOTAL MENSUEL**             |                       |                                     | **? $**          |

---

## 🔍 Guide Méthodologique

### Étape 1 : Comprendre les Types de Coûts

**Coûts Fixes (Provisionnement) :**

- Ressources qui tournent en continu (RDS, NAT Gateway, ALB)
- Facturés à l'heure, même sans utilisation
- Exemple : RDS Multi-AZ tourne 24h/24

**Coûts Variables (Consommation) :**

- Basés sur l'utilisation réelle (S3 storage, requêtes, transfert de données)
- Exemple : Vous payez pour les Go stockés dans S3

---

### Étape 2 : Utiliser l'AWS Pricing Calculator

1. **Accédez au calculateur** : https://calculator.aws
2. **Créez une nouvelle estimation** : "Catalog-Snap Architecture"
3. **Ajoutez chaque service un par un** :

#### Exemple : Ajouter NAT Gateway

```
1. Cliquez sur "Add service"
2. Recherchez "NAT Gateway"
3. Sélectionnez la région : Europe (Paris)
4. Configuration :
   - Number of NAT Gateways : 2
   - Data processed : 500 GB per month
5. Cliquez sur "Save and add service"
```

#### Exemple : Ajouter ECS Fargate

```
1. Recherchez "Fargate"
2. Région : Europe (Paris)
3. Configuration :
   - Operating system : Linux
   - CPU Architecture : x86
   - Average duration : 1920 task-hours per month
   - vCPU : 0.5
   - Memory : 1 GB
4. Sauvegardez
```

---

### Étape 3 : Points d'Attention (Pièges Classiques)

#### ⚠️ Piège 1 : Le NAT Gateway

Le NAT Gateway a **deux composantes de coût** :

- Coût horaire : 730 heures × 2 NAT Gateways
- Coût par Go traité : 500 Go

**Beaucoup d'étudiants oublient le coût par Go !**

---

#### ⚠️ Piège 2 : Le Multi-AZ sur RDS

Le Multi-AZ **double presque le prix** de l'instance RDS :

- AWS maintient une instance miroir dans une autre AZ
- Vous payez pour 2 instances, même si vous n'utilisez qu'une seule

---

#### ⚠️ Piège 3 : Le Transfert de Données

**Règles importantes :**

- Transfert ENTRANT vers AWS : **GRATUIT**
- Transfert SORTANT vers Internet : **PAYANT**
- CloudFront réduit les coûts de sortie par rapport à l'ALB direct

**Exemple :**

- Upload d'images vers S3 : gratuit
- Téléchargement d'images via CloudFront : payant (mais moins cher qu'en direct)

---

#### ⚠️ Piège 4 : Le Calcul des Heures EC2

Pour les jobs batch :

- 3 instances × 10 heures × 4 jours = **120 heures**
- Prix On-Demand de t3.large en région Paris : ~0.0928 $/heure
- Coût estimé : 120 × 0.0928 = **~11.14 $**

---

## 📝 Méthodologie de Travail en Groupe

### Répartition des Rôles (3 étudiants)

**Étudiant 1 : Architecte Réseau**

- Dessine le VPC, sous-réseaux, NAT Gateways
- Estime les coûts : NAT Gateway, ALB, CloudFront

**Étudiant 2 : Architecte Compute & Storage**

- Dessine ECS Fargate, EC2, S3
- Estime les coûts : ECS, EC2, S3

**Étudiant 3 : Architecte Base de Données**

- Dessine RDS Multi-AZ
- Estime les coûts : RDS
- Consolide le tableau final et vérifie la cohérence

---

## 🎓 Questions de Réflexion

Après avoir complété l'estimation, répondez à ces questions dans votre rapport :

1. **Quel est le service le plus coûteux de l'architecture ? Pourquoi ?**

2. **Comment pourriez-vous réduire les coûts de 20% sans impacter la disponibilité ?**

3. **Que se passerait-il si vous supprimiez le Multi-AZ sur RDS ? Quels seraient les risques ?**

4. **Pourquoi utiliser CloudFront plutôt que servir les images directement depuis S3 ?**

5. **Les jobs EC2 tournent 4 jours par mois. Serait-il plus économique d'utiliser des instances Reserved ou Spot ? Justifiez.**

---

## 📤 Format de Rendu

### Document à Rendre (PDF)

**Page 1 : Page de Garde**

- Titre : "Estimation de Coûts AWS - Projet Catalog-Snap"
- Noms des 3 étudiants
- Date

**Pages 2-3 : Schéma d'Architecture**

- Diagramme complet en haute résolution
- Légende claire des composants

**Page 4 : Tableau d'Estimation**

- Tableau complété avec tous les coûts
- Capture d'écran de l'AWS Pricing Calculator

**Page 5 : Réponses aux Questions de Réflexion**

- Réponses argumentées (1-2 paragraphes par question)

**Page 6 : Lien vers l'Estimation AWS**

- Exportez votre estimation depuis AWS Pricing Calculator
- Incluez le lien de partage public

---

## 🎯 Critères d'Évaluation

| Critère                   | Points | Détails                                                     |
| ------------------------- | ------ | ----------------------------------------------------------- |
| **Schéma d'Architecture** | 40     | Complétude, clarté, respect des conventions AWS             |
| **Précision des Coûts**   | 30     | Exactitude des calculs, utilisation correcte du calculateur |
| **Analyse et Réflexion**  | 20     | Qualité des réponses, compréhension des enjeux              |
| **Présentation**          | 10     | Clarté du document, professionnalisme                       |
| **TOTAL**                 | 100    |                                                             |

---

## 💡 Conseils pour Réussir

1. **Commencez par le schéma** : Visualiser l'architecture aide à comprendre les flux
2. **Vérifiez la région** : Toujours "Europe (Paris)" dans le calculateur
3. **Notez vos hypothèses** : Si vous devez faire des estimations, documentez-les
4. **Comparez vos résultats** : Discutez avec d'autres groupes pour valider
5. **Utilisez les unités correctes** : Go vs GB, heures vs jours, etc.

---

## 🔗 Ressources Utiles

- **AWS Pricing Calculator** : https://calculator.aws
- **AWS Pricing Documentation** : https://aws.amazon.com/pricing/
- **AWS Architecture Icons** : https://aws.amazon.com/architecture/icons/
- **AWS Well-Architected Framework** : https://aws.amazon.com/architecture/well-architected/

---

## ⏰ Planning Suggéré (4 heures)

| Temps  | Activité                                           |
| ------ | -------------------------------------------------- |
| 30 min | Lecture du sujet et répartition des rôles          |
| 1h00   | Création du schéma d'architecture                  |
| 1h00   | Estimation des coûts avec AWS Pricing Calculator   |
| 30 min | Réponses aux questions et finalisation du document |

---

## 🚀 Pour Aller Plus Loin (Bonus)

Si vous terminez en avance, explorez ces optimisations :

1. **Calculez le coût avec des Reserved Instances** pour RDS (engagement 1 an)
2. **Estimez le coût avec S3 Intelligent-Tiering** au lieu de S3 Standard
3. **Comparez le coût ECS Fargate vs EC2** pour l'API
4. **Ajoutez AWS Backup** pour RDS et calculez le coût de rétention (30 jours)

---

## 📞 Support

En cas de difficulté :

- Consultez la documentation AWS Pricing
- Demandez de l'aide à votre enseignant
- Collaborez avec d'autres groupes (partage d'idées, pas de copie !)

---

**Bonne chance ! 🎉**

Ce lab vous prépare à des situations réelles où l'estimation des coûts est cruciale avant tout déploiement en production.
