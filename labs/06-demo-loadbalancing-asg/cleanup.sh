#!/bin/bash

# Script de nettoyage pour la démonstration Load Balancer et Auto Scaling
# Ce script supprime toutes les ressources créées par la stack CloudFormation

set -e

STACK_NAME="demo-alb-asg"
AWS_PROFILE="aws-labs"

echo "🧹 Nettoyage de la démonstration Load Balancer et Auto Scaling"
echo "=============================================================="

# Vérifier si la stack existe
echo "🔍 Vérification de l'existence de la stack..."
if ! aws cloudformation describe-stacks --stack-name $STACK_NAME --profile $AWS_PROFILE >/dev/null 2>&1; then
    echo "ℹ️  La stack '$STACK_NAME' n'existe pas ou a déjà été supprimée"
    exit 0
fi

# Obtenir le statut actuel de la stack
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].StackStatus' --output text --profile $AWS_PROFILE)
echo "📊 Statut actuel de la stack: $STACK_STATUS"

# Si la stack est en cours de suppression, attendre
if [[ $STACK_STATUS == *"DELETE_IN_PROGRESS"* ]]; then
    echo "⏳ La stack est déjà en cours de suppression, attente de la fin..."
    aws cloudformation wait stack-delete-complete --stack-name $STACK_NAME --profile $AWS_PROFILE
    echo "✅ Stack supprimée avec succès"
    exit 0
fi

# Afficher les ressources qui vont être supprimées
echo "📋 Ressources qui vont être supprimées:"
aws cloudformation describe-stack-resources --stack-name $STACK_NAME --profile $AWS_PROFILE --query 'StackResources[].{Type:ResourceType,LogicalId:LogicalResourceId,Status:ResourceStatus}' --output table

echo ""
read -p "❓ Êtes-vous sûr de vouloir supprimer toutes ces ressources? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Suppression annulée"
    exit 0
fi

echo "🗑️  Suppression de la stack CloudFormation..."
aws cloudformation delete-stack --stack-name $STACK_NAME --profile $AWS_PROFILE

echo "⏳ Attente de la suppression complète de la stack..."
echo "   Cela peut prendre plusieurs minutes..."

# Attendre que la stack soit complètement supprimée
if aws cloudformation wait stack-delete-complete --stack-name $STACK_NAME --profile $AWS_PROFILE; then
    echo "✅ Stack '$STACK_NAME' supprimée avec succès!"
    echo ""
    echo "🎉 Nettoyage terminé. Toutes les ressources ont été supprimées."
    echo "💰 Les coûts associés à cette démonstration ont cessé."
else
    echo "❌ Erreur lors de la suppression de la stack"
    echo "🔍 Vérifiez la console AWS CloudFormation pour plus de détails"
    exit 1
fi

echo ""
echo "📊 Résumé du nettoyage:"
echo "   ✅ VPC et subnets supprimés"
echo "   ✅ Application Load Balancer supprimé"
echo "   ✅ Auto Scaling Group et instances supprimés"
echo "   ✅ Security Groups supprimés"
echo "   ✅ Rôles IAM supprimés"
echo "   ✅ Alarmes CloudWatch supprimées"