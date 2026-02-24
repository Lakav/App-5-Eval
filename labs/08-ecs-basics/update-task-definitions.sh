#!/bin/bash

# Script pour mettre à jour les task definitions avec les ARN corrects
# Ce script récupère les ARN depuis CloudFormation et met à jour les fichiers JSON

set -e

echo "🔄 Mise à jour des task definitions avec les ARN corrects..."

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Vérification du profil AWS
if [ -z "$AWS_PROFILE" ] || [ "$AWS_PROFILE" != "aws-labs" ]; then
    log_warning "AWS_PROFILE n'est pas défini sur 'aws-labs'"
    export AWS_PROFILE=aws-labs
fi

log_info "Utilisation du profil AWS: $AWS_PROFILE"

# Récupération de l'ID du compte AWS
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile aws-labs)
log_info "Account ID: $ACCOUNT_ID"

# Récupération des ARN des rôles depuis CloudFormation
log_info "Récupération des ARN des rôles IAM..."

TASK_EXECUTION_ROLE_ARN=$(aws cloudformation describe-stacks \
    --stack-name ecs-lab-iam-roles \
    --query 'Stacks[0].Outputs[?OutputKey==`ECSTaskExecutionRoleArn`].OutputValue' \
    --output text \
    --profile aws-labs)

WEB_APP_TASK_ROLE_ARN=$(aws cloudformation describe-stacks \
    --stack-name ecs-lab-iam-roles \
    --query 'Stacks[0].Outputs[?OutputKey==`WebAppTaskRoleArn`].OutputValue' \
    --output text \
    --profile aws-labs)

IMAGE_CLASSIFIER_TASK_ROLE_ARN=$(aws cloudformation describe-stacks \
    --stack-name ecs-lab-iam-roles \
    --query 'Stacks[0].Outputs[?OutputKey==`ImageClassifierTaskRoleArn`].OutputValue' \
    --output text \
    --profile aws-labs)

log_info "Task Execution Role ARN: $TASK_EXECUTION_ROLE_ARN"
log_info "Web App Task Role ARN: $WEB_APP_TASK_ROLE_ARN"
log_info "Image Classifier Task Role ARN: $IMAGE_CLASSIFIER_TASK_ROLE_ARN"

# Mise à jour de la task definition web-service
log_info "Mise à jour de web-service-task-definition.json..."

# Crée une copie de sauvegarde
cp resources/web-service-task-definition.json resources/web-service-task-definition.json.backup

# Met à jour les ARN dans le fichier JSON
sed -i.tmp "s|arn:aws:iam::ACCOUNT_ID:role/ecs-lab-task-execution-role|$TASK_EXECUTION_ROLE_ARN|g" resources/web-service-task-definition.json
sed -i.tmp "s|arn:aws:iam::ACCOUNT_ID:role/ecs-lab-web-app-task-role|$WEB_APP_TASK_ROLE_ARN|g" resources/web-service-task-definition.json

# Supprime le fichier temporaire créé par sed sur macOS
rm -f resources/web-service-task-definition.json.tmp

log_info "✅ web-service-task-definition.json mis à jour"

# Affichage des fichiers mis à jour
log_info "📋 Résumé des modifications:"
log_info "   • Task definition web-service mise à jour avec les ARN corrects"
log_info "   • Fichier de sauvegarde créé (.backup)"
log_info ""
log_warning "⚠️  N'oubliez pas de mettre à jour l'URI ECR avant d'enregistrer la task definition!"
log_info ""
log_info "ℹ️  Pour la partie 2 (classificateur d'images), les étudiants créeront"
log_info "   la task definition programmatiquement dans leur implémentation TypeScript."

echo "🎉 Mise à jour des task definitions terminée!"