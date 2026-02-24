# Questions Avancées - Approfondissement

## 🎯 Objectif

Ces questions permettent d'approfondir votre compréhension des coûts AWS et d'explorer des scénarios d'optimisation avancés.

---

## 📊 Partie 1 : Analyse de Sensibilité

### Question 1.1 : Impact de la Croissance

**Scénario :** Le trafic de Catalog-Snap double en 6 mois.

**Calculez l'impact sur :**

- Le coût de CloudFront (2 To au lieu de 1 To)
- Le coût de S3 (4 To au lieu de 2 To)
- Le coût des NAT Gateways (1 To au lieu de 500 Go)
- Le coût ECS (besoin de 4-8 tâches au lieu de 2-4)

**Quel est le nouveau coût total mensuel ?**

**Quel service voit son coût augmenter le plus (en %) ?**

---

### Question 1.2 : Saisonnalité

**Scénario :** Catalog-Snap a un pic d'activité en novembre-décembre (Black Friday).

**Pendant ces 2 mois :**

- Trafic CloudFront : 3 To/mois
- Tâches ECS : 6-12 au lieu de 2-4
- Jobs EC2 : 10 jours au lieu de 4

**Calculez le surcoût pour ces 2 mois.**

**Proposez une stratégie pour anticiper ce pic sans surcoût permanent.**

---

## 💰 Partie 2 : Optimisations Avancées

### Question 2.1 : Reserved Instances vs Savings Plans

**Contexte :** L'entreprise prévoit d'utiliser cette architecture pendant 3 ans.

**Comparez les options suivantes pour RDS :**

| Option         | Engagement | Paiement       | Coût Mensuel Estimé |
| -------------- | ---------- | -------------- | ------------------- |
| On-Demand      | Aucun      | Mensuel        | $113                |
| Reserved 1 an  | 1 an       | Tout en avance | ?                   |
| Reserved 1 an  | 1 an       | Partiel        | ?                   |
| Reserved 3 ans | 3 ans      | Tout en avance | ?                   |

**Calculez l'économie totale sur 3 ans pour chaque option.**

**Quelle option recommandez-vous ? Pourquoi ?**

---

### Question 2.2 : Compute Savings Plans

**Contexte :** ECS Fargate est éligible aux Compute Savings Plans.

**Baseline actuel :** 2 tâches × 24h × 30 jours = 1440h

**Avec un Compute Savings Plan 1 an (paiement partiel) :**

- Coût Fargate On-Demand : $54.51/mois
- Réduction estimée : 20%

**Calculez :**

1. Le nouveau coût mensuel ECS
2. L'économie annuelle
3. Le ROI si vous devez payer 10% d'avance

---

### Question 2.3 : S3 Intelligent-Tiering

**Contexte :** Analyse des patterns d'accès aux images :

- 30% des images : accédées fréquemment (< 30 jours)
- 50% des images : accédées occasionnellement (30-90 jours)
- 20% des images : rarement accédées (> 90 jours)

**Coûts S3 par classe de stockage (Paris) :**

- Standard : $0.024/Go
- Infrequent Access : $0.0133/Go
- Archive Instant Access : $0.005/Go

**Calculez le coût avec S3 Intelligent-Tiering :**

- 2048 Go × 30% × $0.024 = ?
- 2048 Go × 50% × $0.0133 = ?
- 2048 Go × 20% × $0.005 = ?
- Frais de monitoring : $0.0025/1000 objets

**Quelle est l'économie mensuelle ?**

---

## 🔄 Partie 3 : Architectures Alternatives

### Question 3.1 : VPC Endpoints vs NAT Gateway

**Contexte :** Les tâches ECS accèdent principalement à S3 et DynamoDB.

**Option actuelle :** NAT Gateway ($94/mois)

**Option alternative :** VPC Endpoints

- VPC Endpoint S3 (Gateway) : Gratuit
- VPC Endpoint DynamoDB (Gateway) : Gratuit
- Transfert de données : Gratuit (même région)

**Mais :** Les tâches ECS ont besoin d'accéder à des APIs externes (10% du trafic).

**Calculez :**

1. Le coût avec 1 NAT Gateway + VPC Endpoints
2. L'économie mensuelle
3. Les compromis (avantages/inconvénients)

---

### Question 3.2 : ECS Fargate vs ECS sur EC2

**Contexte :** Comparer le coût de Fargate avec ECS sur EC2.

**Option actuelle : Fargate**

- 1920 tâches-heures (0.5 vCPU, 1 GB)
- Coût : $54.51/mois

**Option alternative : ECS sur EC2**

- 2× instances t3.medium (2 vCPU, 4 GB) en continu
- Coût On-Demand : ~$60/mois
- Pas de frais ECS (gratuit)
- Mais : gestion des instances, patching, scaling

**Calculez :**

1. Le coût avec Reserved Instances 1 an (économie ~40%)
2. Le coût total de possession (TCO) incluant la gestion
3. Quelle option recommandez-vous ?

---

### Question 3.3 : CloudFront vs S3 Transfer Acceleration

**Contexte :** Comparer CloudFront avec S3 Transfer Acceleration pour les uploads.

**Option actuelle : CloudFront**

- Transfert sortant : 1 To × $0.085 = $87.04
- Requêtes : $12
- Total : $99.04

**Option alternative : S3 Transfer Acceleration**

- Uploads accélérés : 100 000 × $0.04/1000 = $4
- Transfert sortant S3 : 1 To × $0.09 = $92.16
- Total : $96.16

**Analysez :**

1. Quelle option est la moins chère ?
2. Quels sont les avantages de CloudFront au-delà du coût ?
3. Dans quel cas S3 Transfer Acceleration serait-il préférable ?

---

## 🌍 Partie 4 : Multi-Région et Disaster Recovery

### Question 4.1 : Backup et Disaster Recovery

**Contexte :** L'entreprise veut un plan de reprise après sinistre (DR).

**Stratégie proposée :**

- RDS : Snapshots automatiques quotidiens (rétention 30 jours)
- S3 : Réplication cross-région vers eu-west-1 (Irlande)
- RTO (Recovery Time Objective) : 4 heures
- RPO (Recovery Point Objective) : 1 heure

**Calculez les coûts supplémentaires :**

1. RDS Snapshots : 100 Go × 30 jours × $0.095/Go-mois = ?
2. S3 Réplication : 2 To × $0.024 (Irlande) + frais de réplication = ?
3. Coût total DR mensuel = ?

**Quel est le pourcentage d'augmentation du budget ?**

---

### Question 4.2 : Architecture Multi-Région Active-Active

**Contexte :** Pour réduire la latence globale, déployer dans 2 régions.

**Architecture :**

- Région 1 : Paris (actuelle)
- Région 2 : Irlande (nouvelle)
- Route 53 : Géolocalisation routing
- RDS : Réplication cross-région (read replica)

**Coûts supplémentaires estimés :**

- Infrastructure Irlande : ~$450 (similaire à Paris)
- RDS Read Replica : ~$100
- Route 53 : ~$1
- Transfert inter-région : 200 Go × $0.02 = $4

**Calculez :**

1. Le coût total mensuel multi-région
2. Le coût par utilisateur si 100 000 utilisateurs
3. Est-ce justifié pour une startup ?

---

## 🔐 Partie 5 : Sécurité et Conformité

### Question 5.1 : Chiffrement et KMS

**Contexte :** Ajouter le chiffrement pour la conformité RGPD.

**Services à chiffrer :**

- S3 : SSE-KMS (Server-Side Encryption with KMS)
- RDS : Encryption at rest avec KMS
- EBS (pour EC2 jobs) : Encryption avec KMS

**Coûts KMS :**

- Clé KMS : $1/mois par clé
- Requêtes API : $0.03/10 000 requêtes
- Estimé : 1 million de requêtes/mois

**Calculez :**

1. Nombre de clés nécessaires (1 par service)
2. Coût des clés : 3 × $1 = ?
3. Coût des requêtes : 1 000 000 / 10 000 × $0.03 = ?
4. Coût total KMS mensuel = ?

**Quel est l'impact sur le budget total (%) ?**

---

### Question 5.2 : WAF et Shield

**Contexte :** Protéger l'application contre les attaques DDoS et injections.

**Services de sécurité :**

- AWS Shield Standard : Gratuit (inclus)
- AWS Shield Advanced : $3 000/mois (overkill pour une startup)
- AWS WAF : $5/mois + $1/règle + $0.60/million de requêtes

**Configuration WAF proposée :**

- 5 règles (SQL injection, XSS, rate limiting, etc.)
- 10 millions de requêtes/mois

**Calculez :**

1. Coût WAF de base : $5
2. Coût des règles : 5 × $1 = ?
3. Coût des requêtes : 10 × $0.60 = ?
4. Coût total WAF mensuel = ?

**Est-ce un bon investissement pour une startup ? Justifiez.**

---

## 📈 Partie 6 : Monitoring et Observabilité

### Question 6.1 : CloudWatch et Logs

**Contexte :** Ajouter monitoring et logs pour l'observabilité.

**Services CloudWatch :**

- Logs : 50 Go ingérés/mois
- Logs : Rétention 30 jours
- Métriques custom : 100 métriques
- Alarmes : 20 alarmes
- Dashboards : 3 dashboards

**Coûts CloudWatch (Paris) :**

- Ingestion logs : $0.57/Go
- Stockage logs : $0.033/Go
- Métriques custom : $0.30/métrique
- Alarmes : $0.10/alarme
- Dashboards : $3/dashboard

**Calculez :**

1. Coût ingestion : 50 × $0.57 = ?
2. Coût stockage : 50 × $0.033 = ?
3. Coût métriques : 100 × $0.30 = ?
4. Coût alarmes : 20 × $0.10 = ?
5. Coût dashboards : 3 × $3 = ?
6. **Coût total CloudWatch mensuel = ?**

---

### Question 6.2 : X-Ray pour le Tracing

**Contexte :** Ajouter AWS X-Ray pour tracer les requêtes.

**Utilisation estimée :**

- 1 million de requêtes tracées/mois
- 1 million de traces récupérées/mois

**Coûts X-Ray :**

- Traces enregistrées : $5/million
- Traces récupérées : $0.50/million

**Calculez :**

1. Coût enregistrement : 1 × $5 = ?
2. Coût récupération : 1 × $0.50 = ?
3. **Coût total X-Ray mensuel = ?**

**Quel est le coût total Monitoring (CloudWatch + X-Ray) ?**

---

## 🎓 Partie 7 : Business Case

### Question 7.1 : Coût par Utilisateur

**Contexte :** Catalog-Snap a 10 000 utilisateurs actifs mensuels.

**Calculez :**

1. Coût infrastructure mensuel : $498
2. Coût par utilisateur : $498 / 10 000 = ?
3. Si l'entreprise facture $2/utilisateur/mois, quelle est la marge ?

**Scénario de croissance :**

- Mois 1 : 10 000 utilisateurs
- Mois 6 : 50 000 utilisateurs
- Mois 12 : 100 000 utilisateurs

**Estimez le coût infrastructure pour chaque étape.**

---

### Question 7.2 : Break-Even Analysis

**Contexte :** Coûts totaux mensuels (infrastructure + équipe).

**Coûts :**

- Infrastructure AWS : $498
- Équipe (2 devs) : $10 000
- Marketing : $2 000
- Autres : $500
- **Total : $13 000/mois**

**Revenus :**

- Abonnement : $2/utilisateur/mois

**Calculez :**

1. Nombre d'utilisateurs pour le break-even : $13 000 / $2 = ?
2. Combien de mois pour atteindre ce seuil (croissance 20%/mois) ?

---

### Question 7.3 : ROI de l'Optimisation

**Contexte :** Investir du temps pour optimiser l'architecture.

**Optimisations possibles :**

- Reserved Instances RDS : Économie $38/mois (2h de travail)
- S3 Intelligent-Tiering : Économie $15/mois (1h de travail)
- VPC Endpoints : Économie $47/mois (3h de travail)
- **Total économies : $100/mois**

**Coût du temps ingénieur : $50/heure**

**Calculez :**

1. Coût de l'optimisation : (2+1+3) × $50 = ?
2. Économie annuelle : $100 × 12 = ?
3. ROI : (Économie - Coût) / Coût × 100 = ?
4. Temps de retour sur investissement (mois) = ?

---

## 🌟 Partie 8 : Innovation et Futur

### Question 8.1 : Serverless vs Containers

**Contexte :** Réécrire l'API en Lambda au lieu d'ECS Fargate.

**Architecture Lambda :**

- 1 million d'invocations/mois
- Durée moyenne : 500 ms
- Mémoire : 1024 MB

**Coûts Lambda (Paris) :**

- Invocations : $0.20/million
- Compute : $0.0000166667/GB-seconde

**Calculez :**

1. Coût invocations : 1 × $0.20 = ?
2. Coût compute : 1M × 0.5s × 1GB × $0.0000166667 = ?
3. **Coût total Lambda = ?**

**Comparez avec ECS Fargate ($54.51). Quelle option est la moins chère ?**

---

### Question 8.2 : AI/ML pour l'Optimisation d'Images

**Contexte :** Ajouter AWS Rekognition pour taguer automatiquement les images.

**Utilisation :**

- 100 000 images analysées/mois
- Détection d'objets et de texte

**Coûts Rekognition :**

- Détection d'objets : $1/1000 images
- Détection de texte : $1.50/1000 images

**Calculez :**

1. Coût détection objets : 100 × $1 = ?
2. Coût détection texte : 100 × $1.50 = ?
3. **Coût total Rekognition = ?**

**Quel est l'impact sur le coût total (%) ?**

**Quelle valeur ajoutée pour les utilisateurs ?**

---

## 📝 Format de Rendu (Questions Avancées)

Si vous choisissez de répondre à ces questions (bonus) :

1. Sélectionnez 3-5 questions qui vous intéressent
2. Répondez de manière détaillée avec calculs
3. Ajoutez une section "Questions Avancées" à votre rapport
4. Justifiez vos choix et recommandations

**Points bonus : +10 à +20 selon la qualité des réponses**

---

## 🎯 Objectifs Pédagogiques Avancés

Ces questions vous permettent de :

- Comprendre l'impact de la croissance sur les coûts
- Maîtriser les stratégies d'optimisation (Reserved, Savings Plans)
- Analyser les compromis entre différentes architectures
- Intégrer sécurité et conformité dans le budget
- Penser en termes de business case et ROI
- Explorer les innovations (serverless, AI/ML)

**Bonne chance pour l'approfondissement ! 🚀**
