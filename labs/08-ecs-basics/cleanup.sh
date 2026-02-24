#!/bin/bash

# Script de nettoyage pour le lab ECS
# Ce script supprime toutes les ressources créées pendant le lab

set -e

echo "🧹 Début du nettoyage des ressources ECS Lab..."

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

# Fonction pour vérifier si une ressource existe
resource_exists() {
    local resource_type=$1
    local resource_name=$2
    
    case $resource_type in
        "cluster")
            aws ecs describe-clusters --clusters "$resource_name" --query 'clusters[0].status' --output text 2>/dev/null | grep -q "ACTIVE"
            ;;
        "service")
            aws ecs describe-services --cluster ecs-lab-cluster --services "$resource_name" --query 'services[0].status' --output text 2>/dev/null | grep -q "ACTIVE"
            ;;
        "stack")
            aws cloudformation describe-stacks --stack-name "$resource_name" --query 'Stacks[0].StackStatus' --output text 2>/dev/null | grep -q -E "(CREATE_COMPLETE|UPDATE_COMPLETE)"
            ;;
    esac
}

# 1. Arrêt et suppression du service ECS (si il existe)
log_info "Vérification du service ECS..."
if resource_exists "service" "web-service"; then
    log_info "Arrêt du service web-service..."
    
    # Réduit le nombre de tâches à 0
    aws ecs update-service \
        --cluster ecs-lab-cluster \
        --service web-service \
        --desired-count 0 \
        --profile aws-labs || log_warning "Impossible de mettre à jour le service"
    
    # Attend que les tâches s'arrêtent
    log_info "Attente de l'arrêt des tâches..."
    aws ecs wait services-stable \
        --cluster ecs-lab-cluster \
        --services web-service \
        --profile aws-labs || log_warning "Timeout lors de l'attente"
    
    # Supprime le service
    log_info "Suppression du service..."
    aws ecs delete-service \
        --cluster ecs-lab-cluster \
        --service web-service \
        --profile aws-labs || log_warning "Impossible de supprimer le service"
    
    log_info "Service supprimé avec succès"
else
    log_info "Aucun service ECS à supprimer"
fi

# 2. Arrêt des tâches en cours (si il y en a)
log_info "Vérification des tâches en cours..."
RUNNING_TASKS=$(aws ecs list-tasks \
    --cluster ecs-lab-cluster \
    --desired-status RUNNING \
    --query 'taskArns' \
    --output text \
    --profile aws-labs 2>/dev/null || echo "")

if [ ! -z "$RUNNING_TASKS" ] && [ "$RUNNING_TASKS" != "None" ]; then
    log_info "Arrêt des tâches en cours..."
    for task in $RUNNING_TASKS; do
        aws ecs stop-task \
            --cluster ecs-lab-cluster \
            --task "$task" \
            --profile aws-labs || log_warning "Impossible d'arrêter la tâche $task"
    done
    log_info "Tâches arrêtées"
else
    log_info "Aucune tâche en cours à arrêter"
fi

# 3. Suppression du cluster ECS
log_info "Suppression du cluster ECS..."
if resource_exists "cluster" "ecs-lab-cluster"; then
    aws ecs delete-cluster \
        --cluster ecs-lab-cluster \
        --profile aws-labs || log_warning "Impossible de supprimer le cluster"
    log_info "Cluster ECS supprimé"
else
    log_info "Cluster ECS déjà supprimé ou n'existe pas"
fi

# 4. Vidage du bucket S3 (si il existe)
log_info "Nettoyage du bucket S3..."
S3_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name ecs-lab-infrastructure \
    --query 'Stacks[0].Outputs[?OutputKey==`S3Bucket`].OutputValue' \
    --output text \
    --profile aws-labs 2>/dev/null || echo "")

if [ ! -z "$S3_BUCKET" ] && [ "$S3_BUCKET" != "None" ]; then
    log_info "Vidage du bucket S3: $S3_BUCKET"
    
    # Supprime tous les objets du bucket
    aws s3 rm "s3://$S3_BUCKET" --recursive --profile aws-labs || log_warning "Erreur lors du vidage du bucket"
    
    # Supprime les versions d'objets (si versioning activé)
    aws s3api delete-objects \
        --bucket "$S3_BUCKET" \
        --delete "$(aws s3api list-object-versions \
            --bucket "$S3_BUCKET" \
            --output json \
            --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
            --profile aws-labs)" \
        --profile aws-labs 2>/dev/null || log_info "Aucune version d'objet à supprimer"
    
    log_info "Bucket S3 vidé"
else
    log_info "Aucun bucket S3 à vider"
fi

# 5. Suppression des images ECR
log_info "Nettoyage des repositories ECR..."

# Repository web-app
ECR_WEB_REPO=$(aws cloudformation describe-stacks \
    --stack-name ecs-lab-infrastructure \
    --query 'Stacks[0].Outputs[?OutputKey==`WebAppECRRepository`].OutputValue' \
    --output text \
    --profile aws-labs 2>/dev/null || echo "")

if [ ! -z "$ECR_WEB_REPO" ] && [ "$ECR_WEB_REPO" != "None" ]; then
    REPO_NAME=$(echo "$ECR_WEB_REPO" | cut -d'/' -f2)
    log_info "Suppression des images du repository: $REPO_NAME"
    
    # Liste et supprime toutes les images
    IMAGE_IDS=$(aws ecr list-images \
        --repository-name "$REPO_NAME" \
        --query 'imageIds[*]' \
        --output json \
        --profile aws-labs 2>/dev/null || echo "[]")
    
    if [ "$IMAGE_IDS" != "[]" ] && [ ! -z "$IMAGE_IDS" ]; then
        aws ecr batch-delete-image \
            --repository-name "$REPO_NAME" \
            --image-ids "$IMAGE_IDS" \
            --profile aws-labs 2>/dev/null || log_info "Aucune image à supprimer dans $REPO_NAME"
        log_info "Images supprimées du repository $REPO_NAME"
    else
        log_info "Aucune image trouvée dans $REPO_NAME"
    fi
fi

# Repository image-classifier
ECR_CLASSIFIER_REPO=$(aws cloudformation describe-stacks \
    --stack-name ecs-lab-infrastructure \
    --query 'Stacks[0].Outputs[?OutputKey==`ClassifierECRRepository`].OutputValue' \
    --output text \
    --profile aws-labs 2>/dev/null || echo "")

if [ ! -z "$ECR_CLASSIFIER_REPO" ] && [ "$ECR_CLASSIFIER_REPO" != "None" ]; then
    REPO_NAME=$(echo "$ECR_CLASSIFIER_REPO" | cut -d'/' -f2)
    log_info "Suppression des images du repository: $REPO_NAME"
    
    # Liste et supprime toutes les images
    IMAGE_IDS=$(aws ecr list-images \
        --repository-name "$REPO_NAME" \
        --query 'imageIds[*]' \
        --output json \
        --profile aws-labs 2>/dev/null || echo "[]")
    
    if [ "$IMAGE_IDS" != "[]" ] && [ ! -z "$IMAGE_IDS" ]; then
        aws ecr batch-delete-image \
            --repository-name "$REPO_NAME" \
            --image-ids "$IMAGE_IDS" \
            --profile aws-labs 2>/dev/null || log_info "Aucune image à supprimer dans $REPO_NAME"
        log_info "Images supprimées du repository $REPO_NAME"
    else
        log_info "Aucune image trouvée dans $REPO_NAME"
    fi
fi

# 6. Suppression des stacks CloudFormation
log_info "Suppression des stacks CloudFormation..."

# Stack IAM roles
if resource_exists "stack" "ecs-lab-iam-roles"; then
    log_info "Suppression de la stack IAM roles..."
    aws cloudformation delete-stack \
        --stack-name ecs-lab-iam-roles \
        --profile aws-labs
    
    log_info "Attente de la suppression de la stack IAM..."
    aws cloudformation wait stack-delete-complete \
        --stack-name ecs-lab-iam-roles \
        --profile aws-labs || log_warning "Timeout lors de la suppression de la stack IAM"
    
    log_info "Stack IAM supprimée"
else
    log_info "Stack IAM déjà supprimée ou n'existe pas"
fi

# Stack infrastructure
if resource_exists "stack" "ecs-lab-infrastructure"; then
    log_info "Suppression de la stack infrastructure..."
    aws cloudformation delete-stack \
        --stack-name ecs-lab-infrastructure \
        --profile aws-labs
    
    log_info "Attente de la suppression de la stack infrastructure..."
    aws cloudformation wait stack-delete-complete \
        --stack-name ecs-lab-infrastructure \
        --profile aws-labs || log_warning "Timeout lors de la suppression de la stack infrastructure"
    
    log_info "Stack infrastructure supprimée"
else
    log_info "Stack infrastructure déjà supprimée ou n'existe pas"
fi

# 7. Nettoyage des images Docker locales (optionnel)
log_info "Nettoyage des images Docker locales..."
docker rmi ecs-web-app:latest 2>/dev/null || log_info "Image ecs-web-app pas trouvée localement"
docker rmi image-classifier:latest 2>/dev/null || log_info "Image image-classifier pas trouvée localement"

# Nettoyage des images Docker non utilisées
docker image prune -f 2>/dev/null || log_info "Aucune image Docker à nettoyer"

log_info "✅ Nettoyage terminé!"
log_info ""
log_info "📋 Résumé des actions effectuées:"
log_info "   • Service ECS arrêté et supprimé"
log_info "   • Tâches ECS arrêtées"
log_info "   • Cluster ECS supprimé"
log_info "   • Bucket S3 vidé"
log_info "   • Images ECR supprimées"
log_info "   • Stacks CloudFormation supprimées"
log_info "   • Images Docker locales nettoyées"
log_info ""
log_warning "⚠️  Vérifiez votre console AWS pour confirmer que toutes les ressources ont été supprimées"
log_info "💰 Cela devrait éviter tous les coûts liés à ce lab"

echo "🎉 Nettoyage du lab ECS terminé avec succès!"