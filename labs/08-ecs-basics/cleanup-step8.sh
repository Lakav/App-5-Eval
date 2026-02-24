#!/bin/bash

# Script de nettoyage pour l'Étape 8 - Suppression du service web et de l'ALB
# Ce script supprime le service web ECS et l'Application Load Balancer

set -e

echo "🧹 Nettoyage du service web et de l'ALB (Étape 8)..."

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérification du profil AWS
if [ -z "$AWS_PROFILE" ] || [ "$AWS_PROFILE" != "aws-labs" ]; then
    log_warning "AWS_PROFILE n'est pas défini sur 'aws-labs'"
    export AWS_PROFILE=aws-labs
fi

log_info "Utilisation du profil AWS: $AWS_PROFILE"

# Fonction pour vérifier si le service existe
service_exists() {
    aws ecs describe-services \
        --cluster ecs-lab-cluster \
        --services web-service \
        --query 'services[0].status' \
        --output text \
        --profile aws-labs 2>/dev/null | grep -q "ACTIVE"
}

# 1. Arrêt et suppression du service ECS web-service
log_info "Vérification du service web-service..."

if service_exists; then
    log_info "Réduction du nombre de tâches à 0..."
    
    # Réduit le nombre de tâches à 0
    aws ecs update-service \
        --cluster ecs-lab-cluster \
        --service web-service \
        --desired-count 0 \
        --profile aws-labs
    
    # Attend que les tâches s'arrêtent
    log_info "Attente de l'arrêt des tâches (cela peut prendre 1-2 minutes)..."
    aws ecs wait services-stable \
        --cluster ecs-lab-cluster \
        --services web-service \
        --profile aws-labs || log_warning "Timeout lors de l'attente"
    
    # Supprime le service
    log_info "Suppression du service web-service..."
    aws ecs delete-service \
        --cluster ecs-lab-cluster \
        --service web-service \
        --profile aws-labs
    
    log_info "✅ Service web-service supprimé avec succès"
else
    log_warning "Le service web-service n'existe pas ou est déjà supprimé"
fi

# 2. Récupération des informations de l'ALB depuis CloudFormation
log_info "Récupération des informations de l'Application Load Balancer..."

ALB_ARN=$(aws cloudformation describe-stacks \
    --stack-name ecs-lab-infrastructure \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
    --output text \
    --profile aws-labs 2>/dev/null || echo "")

if [ ! -z "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
    # Récupère l'ARN complet de l'ALB
    ALB_FULL_ARN=$(aws elbv2 describe-load-balancers \
        --query "LoadBalancers[?DNSName=='$ALB_ARN'].LoadBalancerArn" \
        --output text \
        --profile aws-labs 2>/dev/null || echo "")
    
    if [ ! -z "$ALB_FULL_ARN" ] && [ "$ALB_FULL_ARN" != "None" ]; then
        log_info "Suppression des listeners de l'ALB..."
        
        # Liste et supprime tous les listeners
        LISTENERS=$(aws elbv2 describe-listeners \
            --load-balancer-arn "$ALB_FULL_ARN" \
            --query 'Listeners[].ListenerArn' \
            --output text \
            --profile aws-labs 2>/dev/null || echo "")
        
        if [ ! -z "$LISTENERS" ] && [ "$LISTENERS" != "None" ]; then
            for listener in $LISTENERS; do
                log_info "Suppression du listener: $listener"
                aws elbv2 delete-listener \
                    --listener-arn "$listener" \
                    --profile aws-labs || log_warning "Impossible de supprimer le listener"
            done
        fi
        
        log_info "Suppression de l'Application Load Balancer..."
        aws elbv2 delete-load-balancer \
            --load-balancer-arn "$ALB_FULL_ARN" \
            --profile aws-labs || log_warning "Impossible de supprimer l'ALB"
        
        log_info "✅ Application Load Balancer supprimé"
    else
        log_warning "Impossible de trouver l'ARN de l'ALB"
    fi
else
    log_warning "Aucun ALB trouvé dans la stack CloudFormation"
fi

# 3. Suppression du Target Group (après un délai pour permettre la suppression de l'ALB)
log_info "Attente de la suppression complète de l'ALB (30 secondes)..."
sleep 30

log_info "Suppression du Target Group..."
TARGET_GROUP_ARN=$(aws cloudformation describe-stacks \
    --stack-name ecs-lab-infrastructure \
    --query 'Stacks[0].Outputs[?OutputKey==`TargetGroup`].OutputValue' \
    --output text \
    --profile aws-labs 2>/dev/null || echo "")

if [ ! -z "$TARGET_GROUP_ARN" ] && [ "$TARGET_GROUP_ARN" != "None" ]; then
    aws elbv2 delete-target-group \
        --target-group-arn "$TARGET_GROUP_ARN" \
        --profile aws-labs 2>/dev/null || log_warning "Impossible de supprimer le Target Group (peut-être déjà supprimé)"
    
    log_info "✅ Target Group supprimé"
else
    log_warning "Aucun Target Group trouvé"
fi

log_info ""
log_info "✅ Nettoyage de l'Étape 8 terminé!"
log_info ""
log_info "📋 Ce qui a été supprimé:"
log_info "   • Service ECS web-service"
log_info "   • Tâches ECS associées au service"
log_info "   • Application Load Balancer (ALB)"
log_info "   • Listeners de l'ALB"
log_info "   • Target Group"
log_info ""
log_info "📋 Ce qui est CONSERVÉ (pour la Partie 2):"
log_info "   • Cluster ECS (ecs-lab-cluster)"
log_info "   • Bucket S3 pour les images"
log_info "   • Repositories ECR (web-app et image-classifier)"
log_info "   • Security Groups"
log_info "   • CloudWatch Log Groups"
log_info "   • Rôles IAM"
log_info ""
log_info "🎯 Vous pouvez maintenant passer à la Partie 2 (Classification d'images)"
log_info "💡 Pour nettoyer TOUTES les ressources à la fin du lab, utilisez: ./cleanup.sh"

echo ""
echo "🎉 Prêt pour la Partie 2!"
