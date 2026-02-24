#!/bin/bash

# Script de nettoyage pour le Lab 07 - Lambda Basics
# Ce script supprime toutes les ressources créées pendant le lab

set -e

echo "🧹 Début du nettoyage du Lab 07 - Lambda Basics"

# Vérifier que le profil AWS est configuré
if [ -z "$AWS_PROFILE" ]; then
    echo "⚠️  Variable AWS_PROFILE non définie. Utilisation du profil par défaut."
    export AWS_PROFILE=aws-labs
fi

echo "📋 Utilisation du profil AWS: $AWS_PROFILE"

# Fonction pour vérifier si une ressource existe
check_resource_exists() {
    local resource_type=$1
    local resource_name=$2
    local check_command=$3
    
    if eval "$check_command" >/dev/null 2>&1; then
        echo "✅ $resource_type '$resource_name' trouvé"
        return 0
    else
        echo "ℹ️  $resource_type '$resource_name' non trouvé"
        return 1
    fi
}

# Nettoyage Partie 1: EventBridge et S3
echo ""
echo "🔧 Nettoyage Partie 1: EventBridge et S3"

# Supprimer la fonction Lambda s3-file-processor
if check_resource_exists "Fonction Lambda" "s3-file-processor" "aws lambda get-function --function-name s3-file-processor --profile $AWS_PROFILE"; then
    echo "🗑️  Suppression de la fonction Lambda s3-file-processor..."
    aws lambda delete-function --function-name s3-file-processor --profile $AWS_PROFILE
    echo "✅ Fonction Lambda s3-file-processor supprimée"
fi

# Supprimer les cibles EventBridge
if check_resource_exists "Règle EventBridge" "s3-file-created-rule" "aws events describe-rule --name s3-file-created-rule --profile $AWS_PROFILE"; then
    echo "🗑️  Suppression des cibles EventBridge..."
    aws events remove-targets --rule s3-file-created-rule --ids 1 --profile $AWS_PROFILE 2>/dev/null || true
    
    echo "🗑️  Suppression de la règle EventBridge..."
    aws events delete-rule --name s3-file-created-rule --profile $AWS_PROFILE
    echo "✅ Règle EventBridge supprimée"
fi

# Supprimer la stack CloudFormation partie 1
if check_resource_exists "Stack CloudFormation" "lambda-basics-part1" "aws cloudformation describe-stacks --stack-name lambda-basics-part1 --profile $AWS_PROFILE"; then
    echo "🗑️  Suppression de la stack CloudFormation lambda-basics-part1..."
    
    # Vider complètement le bucket S3 avant de supprimer la stack
    BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name lambda-basics-part1 --profile $AWS_PROFILE --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text 2>/dev/null || echo "")
    
    if [ ! -z "$BUCKET_NAME" ]; then
        echo "🗑️  Vidage complet du bucket S3: $BUCKET_NAME"
        
        # Supprimer tous les objets (versions actuelles)
        aws s3 rm s3://$BUCKET_NAME --recursive --profile $AWS_PROFILE 2>/dev/null || true
        
        # Supprimer toutes les versions d'objets et delete markers
        aws s3api list-object-versions --bucket $BUCKET_NAME --profile $AWS_PROFILE --query 'Versions[].{Key:Key,VersionId:VersionId}' --output text 2>/dev/null | while read key version; do
            if [ ! -z "$key" ] && [ ! -z "$version" ]; then
                aws s3api delete-object --bucket $BUCKET_NAME --key "$key" --version-id "$version" --profile $AWS_PROFILE 2>/dev/null || true
            fi
        done
        
        # Supprimer tous les delete markers
        aws s3api list-object-versions --bucket $BUCKET_NAME --profile $AWS_PROFILE --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' --output text 2>/dev/null | while read key version; do
            if [ ! -z "$key" ] && [ ! -z "$version" ]; then
                aws s3api delete-object --bucket $BUCKET_NAME --key "$key" --version-id "$version" --profile $AWS_PROFILE 2>/dev/null || true
            fi
        done
        
        echo "✅ Bucket S3 vidé complètement"
    fi
    
    aws cloudformation delete-stack --stack-name lambda-basics-part1 --profile $AWS_PROFILE
    echo "⏳ Attente de la suppression de la stack lambda-basics-part1..."
    aws cloudformation wait stack-delete-complete --stack-name lambda-basics-part1 --profile $AWS_PROFILE
    echo "✅ Stack lambda-basics-part1 supprimée"
fi

# Nettoyage Partie 2: DynamoDB Streams et Conteneur
echo ""
echo "🔧 Nettoyage Partie 2: DynamoDB Streams et Conteneur"

# Supprimer la fonction Lambda dynamodb-stream-processor
if check_resource_exists "Fonction Lambda" "dynamodb-stream-processor" "aws lambda get-function --function-name dynamodb-stream-processor --profile $AWS_PROFILE"; then
    echo "🗑️  Suppression des event source mappings..."
    EVENT_SOURCE_MAPPINGS=$(aws lambda list-event-source-mappings --function-name dynamodb-stream-processor --profile $AWS_PROFILE --query 'EventSourceMappings[].UUID' --output text 2>/dev/null || echo "")
    
    if [ ! -z "$EVENT_SOURCE_MAPPINGS" ]; then
        for uuid in $EVENT_SOURCE_MAPPINGS; do
            echo "🗑️  Suppression du mapping: $uuid"
            aws lambda delete-event-source-mapping --uuid $uuid --profile $AWS_PROFILE 2>/dev/null || true
        done
    fi
    
    echo "🗑️  Suppression de la fonction Lambda dynamodb-stream-processor..."
    aws lambda delete-function --function-name dynamodb-stream-processor --profile $AWS_PROFILE
    echo "✅ Fonction Lambda dynamodb-stream-processor supprimée"
fi

# Supprimer la stack CloudFormation partie 2
if check_resource_exists "Stack CloudFormation" "lambda-basics-part2" "aws cloudformation describe-stacks --stack-name lambda-basics-part2 --profile $AWS_PROFILE"; then
    echo "🗑️  Suppression de la stack CloudFormation lambda-basics-part2..."
    
    # Vider complètement le bucket S3 d'historique avant de supprimer la stack
    HISTORY_BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name lambda-basics-part2 --profile $AWS_PROFILE --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text 2>/dev/null || echo "")
    
    if [ ! -z "$HISTORY_BUCKET_NAME" ]; then
        echo "🗑️  Vidage complet du bucket S3 d'historique: $HISTORY_BUCKET_NAME"
        
        # Supprimer tous les objets (versions actuelles)
        aws s3 rm s3://$HISTORY_BUCKET_NAME --recursive --profile $AWS_PROFILE 2>/dev/null || true
        
        # Supprimer toutes les versions d'objets et delete markers
        aws s3api list-object-versions --bucket $HISTORY_BUCKET_NAME --profile $AWS_PROFILE --query 'Versions[].{Key:Key,VersionId:VersionId}' --output text 2>/dev/null | while read key version; do
            if [ ! -z "$key" ] && [ ! -z "$version" ]; then
                aws s3api delete-object --bucket $HISTORY_BUCKET_NAME --key "$key" --version-id "$version" --profile $AWS_PROFILE 2>/dev/null || true
            fi
        done
        
        # Supprimer tous les delete markers
        aws s3api list-object-versions --bucket $HISTORY_BUCKET_NAME --profile $AWS_PROFILE --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' --output text 2>/dev/null | while read key version; do
            if [ ! -z "$key" ] && [ ! -z "$version" ]; then
                aws s3api delete-object --bucket $HISTORY_BUCKET_NAME --key "$key" --version-id "$version" --profile $AWS_PROFILE 2>/dev/null || true
            fi
        done
        
        echo "✅ Bucket S3 d'historique vidé complètement"
    fi
    
    # Supprimer toutes les images du repository ECR
    ECR_REPO_NAME=$(aws cloudformation describe-stacks --stack-name lambda-basics-part2 --profile $AWS_PROFILE --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryUri`].OutputValue' --output text 2>/dev/null | cut -d'/' -f2 || echo "")
    
    if [ ! -z "$ECR_REPO_NAME" ]; then
        echo "🗑️  Suppression de toutes les images ECR du repository: $ECR_REPO_NAME"
        
        # Lister et supprimer toutes les images (tagged et untagged)
        IMAGE_IDS=$(aws ecr list-images --repository-name $ECR_REPO_NAME --profile $AWS_PROFILE --query 'imageIds[*]' --output json 2>/dev/null || echo "[]")
        
        if [ "$IMAGE_IDS" != "[]" ] && [ ! -z "$IMAGE_IDS" ]; then
            echo "🗑️  Suppression des images ECR..."
            aws ecr batch-delete-image --repository-name $ECR_REPO_NAME --image-ids "$IMAGE_IDS" --profile $AWS_PROFILE 2>/dev/null || true
            echo "✅ Images ECR supprimées"
        else
            echo "ℹ️  Aucune image trouvée dans le repository ECR"
        fi
    fi
    
    aws cloudformation delete-stack --stack-name lambda-basics-part2 --profile $AWS_PROFILE
    echo "⏳ Attente de la suppression de la stack lambda-basics-part2..."
    aws cloudformation wait stack-delete-complete --stack-name lambda-basics-part2 --profile $AWS_PROFILE
    echo "✅ Stack lambda-basics-part2 supprimée"
fi

# Nettoyage des artefacts locaux
echo ""
echo "🔧 Nettoyage des artefacts locaux"

# Supprimer les fichiers de build
if [ -d "dist" ]; then
    echo "🗑️  Suppression du dossier dist/"
    rm -rf dist
    echo "✅ Dossier dist/ supprimé"
fi

# Supprimer les images Docker locales
echo "🗑️  Suppression des images Docker locales..."
docker rmi lambda-dynamodb-processor:latest 2>/dev/null || echo "ℹ️  Image Docker lambda-dynamodb-processor:latest non trouvée"

# Supprimer les node_modules si présents (optionnel)
if [ -d "node_modules" ]; then
    read -p "🤔 Voulez-vous supprimer node_modules/ ? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Suppression du dossier node_modules/"
        rm -rf node_modules
        echo "✅ Dossier node_modules/ supprimé"
    fi
fi

echo ""
echo "✅ Nettoyage terminé avec succès!"
echo ""
echo "📋 Résumé des actions effectuées:"
echo "   - Fonctions Lambda supprimées"
echo "   - Règles EventBridge supprimées"
echo "   - Event source mappings supprimés"
echo "   - Stacks CloudFormation supprimées"
echo "   - Buckets S3 vidés"
echo "   - Images ECR supprimées"
echo "   - Artefacts locaux nettoyés"
echo ""
echo "💡 Conseil: Vérifiez votre console AWS pour confirmer que toutes les ressources ont été supprimées."