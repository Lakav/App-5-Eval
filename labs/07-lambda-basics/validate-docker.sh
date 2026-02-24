#!/bin/bash

# Script de validation Docker pour le Lab 07 - Partie 2
# Vérifie que Docker est installé et fonctionnel

set -e

echo "🐳 Validation de l'environnement Docker pour le Lab 07 - Partie 2"

# Détecter l'environnement
if [ -f /.dockerenv ] || [ -n "$CODESPACES" ] || [ -n "$DEVCONTAINER" ]; then
    echo "📋 Environnement dev container détecté"
    echo "💡 Utilisez plutôt: ./setup-docker-devcontainer.sh"
    echo ""
fi

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé ou n'est pas dans le PATH"
    if [ -f /.dockerenv ] || [ -n "$CODESPACES" ] || [ -n "$DEVCONTAINER" ]; then
        echo "📋 Pour dev container: Reconstruisez avec la feature docker-in-docker"
    else
        echo "📋 Pour environnement local: Installez Docker Desktop depuis https://www.docker.com/products/docker-desktop"
    fi
    exit 1
fi

echo "✅ Docker CLI trouvé: $(docker --version)"

# Vérifier que Docker daemon est en cours d'exécution
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon n'est pas en cours d'exécution"
    if [ -f /.dockerenv ] || [ -n "$CODESPACES" ] || [ -n "$DEVCONTAINER" ]; then
        echo "📋 Pour dev container: Exécutez 'sudo service docker start' ou utilisez ./setup-docker-devcontainer.sh"
    else
        echo "📋 Pour environnement local: Démarrez Docker Desktop"
    fi
    exit 1
fi

echo "✅ Docker daemon est en cours d'exécution"

# Vérifier que nous pouvons construire une image simple
echo "🔧 Test de construction d'image Docker..."
cat > Dockerfile.test << EOF
FROM public.ecr.aws/lambda/nodejs:24
CMD [ "echo", "test" ]
EOF

if docker build -t lambda-test -f Dockerfile.test . &> /dev/null; then
    echo "✅ Construction d'image Docker réussie"
    docker rmi lambda-test &> /dev/null || true
else
    echo "❌ Échec de la construction d'image Docker"
    exit 1
fi

# Nettoyer le fichier de test
rm -f Dockerfile.test

# Vérifier l'accès à ECR public
echo "🔧 Test d'accès à ECR public..."
if docker pull public.ecr.aws/lambda/nodejs:24 &> /dev/null; then
    echo "✅ Accès à ECR public réussi"
else
    echo "⚠️  Impossible d'accéder à ECR public (peut nécessiter une connexion internet)"
fi

echo ""
echo "✅ Environnement Docker validé avec succès!"
echo "📋 Vous pouvez maintenant procéder à la Partie 2 du Lab 07"