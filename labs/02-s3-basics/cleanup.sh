#!/bin/bash

# Script de nettoyage pour le Lab 02 - S3 Basics
# Ce script supprime tous les buckets créés pendant le lab

echo "🧹 Nettoyage des ressources S3 du Lab 02..."

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour supprimer un bucket et ses objets
cleanup_bucket() {
    local bucket_name=$1
    
    if aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
        echo -e "${YELLOW}📦 Nettoyage du bucket: $bucket_name${NC}"
        
        # Supprimer tous les objets du bucket
        echo "  🗑️  Suppression des objets..."
        aws s3 rm "s3://$bucket_name" --recursive --quiet
        
        # Supprimer le bucket
        echo "  🗑️  Suppression du bucket..."
        aws s3 rb "s3://$bucket_name"
        
        if [ $? -eq 0 ]; then
            echo -e "  ${GREEN}✅ Bucket $bucket_name supprimé avec succès${NC}"
        else
            echo -e "  ${RED}❌ Erreur lors de la suppression du bucket $bucket_name${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Bucket $bucket_name n'existe pas ou n'est pas accessible${NC}"
    fi
}

# Nettoyer les fichiers locaux
echo "🗑️  Nettoyage des fichiers locaux..."
rm -f test-cli.txt test-cli-downloaded.txt
rm -f test-sdk.txt test-sdk-downloaded.txt
rm -f test-upload.txt test-download.txt
rm -rf website/

# Lister tous les buckets S3 qui correspondent aux patterns du lab
echo "🔍 Recherche des buckets créés pendant le lab..."

# Patterns de buckets créés pendant le lab
patterns=(
    "s3-lab-cli-"
    "s3-lab-sdk-"
    "mon-site-web-s3-"
    "s3-test-bucket-"
)

# Obtenir la liste de tous les buckets
all_buckets=$(aws s3api list-buckets --query 'Buckets[].Name' --output text)

if [ -z "$all_buckets" ]; then
    echo -e "${YELLOW}⚠️  Aucun bucket trouvé ou erreur d'accès${NC}"
    exit 1
fi

# Chercher et nettoyer les buckets correspondant aux patterns
found_buckets=false

for bucket in $all_buckets; do
    for pattern in "${patterns[@]}"; do
        if [[ $bucket == *"$pattern"* ]]; then
            found_buckets=true
            cleanup_bucket "$bucket"
        fi
    done
done

if [ "$found_buckets" = false ]; then
    echo -e "${GREEN}✅ Aucun bucket du lab trouvé - nettoyage déjà effectué${NC}"
else
    echo ""
    echo -e "${GREEN}🎉 Nettoyage terminé !${NC}"
fi

# Vérification finale
echo ""
echo "🔍 Vérification finale - Buckets restants avec les patterns du lab:"
remaining_buckets=false

for bucket in $(aws s3api list-buckets --query 'Buckets[].Name' --output text 2>/dev/null); do
    for pattern in "${patterns[@]}"; do
        if [[ $bucket == *"$pattern"* ]]; then
            echo -e "${RED}⚠️  Bucket restant: $bucket${NC}"
            remaining_buckets=true
        fi
    done
done

if [ "$remaining_buckets" = false ]; then
    echo -e "${GREEN}✅ Aucun bucket du lab restant${NC}"
fi

echo ""
echo -e "${GREEN}🏁 Script de nettoyage terminé${NC}"