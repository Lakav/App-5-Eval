#!/bin/bash

# Script pour récupérer automatiquement le VPC par défaut et ses subnets
# Exporte les variables d'environnement pour le déploiement CloudFormation
# Usage: source ./get-default-vpc.sh

set -e

echo "🔍 Récupération du VPC par défaut..."

# Récupérer le VPC par défaut
export DEFAULT_VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query 'Vpcs[0].VpcId' \
  --output text \
  --profile aws-labs)

if [ "$DEFAULT_VPC_ID" == "None" ] || [ -z "$DEFAULT_VPC_ID" ]; then
  echo "❌ Aucun VPC par défaut trouvé!"
  echo "💡 Créez un VPC par défaut avec: aws ec2 create-default-vpc --profile aws-labs"
  return 1 2>/dev/null || exit 1
fi

echo "✅ VPC par défaut trouvé: $DEFAULT_VPC_ID"

# Récupérer tous les subnets du VPC par défaut
SUBNETS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$DEFAULT_VPC_ID" \
  --query 'Subnets[*].SubnetId' \
  --output text \
  --profile aws-labs)

if [ -z "$SUBNETS" ]; then
  echo "❌ Aucun subnet trouvé dans le VPC par défaut!"
  return 1 2>/dev/null || exit 1
fi

# Convertir en liste séparée par des virgules
export DEFAULT_SUBNET_IDS=$(echo $SUBNETS | tr ' ' ',')
SUBNET_COUNT=$(echo $SUBNETS | wc -w)

echo "✅ $SUBNET_COUNT subnet(s) trouvé(s): $DEFAULT_SUBNET_IDS"

if [ $SUBNET_COUNT -lt 2 ]; then
  echo "⚠️  Attention: Le VPC par défaut doit avoir au moins 2 subnets dans différentes zones de disponibilité"
  echo "   pour le Load Balancer. Vous avez seulement $SUBNET_COUNT subnet(s)."
  return 1 2>/dev/null || exit 1
fi

echo ""
echo "📝 Variables d'environnement exportées:"
echo "   DEFAULT_VPC_ID=$DEFAULT_VPC_ID"
echo "   DEFAULT_SUBNET_IDS=$DEFAULT_SUBNET_IDS"
echo ""
echo "✅ Prêt pour le déploiement CloudFormation!"
echo ""
echo "Utilisez cette commande pour déployer:"
echo ""
echo "aws cloudformation deploy \\"
echo "  --template-file resources/infrastructure.yaml \\"
echo "  --stack-name ecs-lab-infrastructure \\"
echo "  --capabilities CAPABILITY_IAM \\"
echo "  --profile aws-labs \\"
echo "  --parameter-overrides \\"
echo "    ProjectName=ecs-lab \\"
echo "    VpcId=\$DEFAULT_VPC_ID \\"
echo "    SubnetIds=\$DEFAULT_SUBNET_IDS"
