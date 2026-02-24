#!/bin/bash

# Script de configuration Docker pour Dev Container - Lab 07
# Configure Docker-in-Docker pour les utilisateurs de dev container

set -e

echo "🐳 Configuration Docker pour Dev Container - Lab 07"

# Vérifier si nous sommes dans un dev container
if [ ! -f /.dockerenv ] && [ -z "$CODESPACES" ] && [ -z "$DEVCONTAINER" ]; then
    echo "⚠️  Ce script est conçu pour les dev containers"
    echo "📋 Si vous utilisez un environnement local, utilisez ./validate-docker.sh"
    exit 1
fi

echo "✅ Environnement dev container détecté"

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé dans le dev container"
    echo "📋 Veuillez reconstruire votre dev container avec la feature Docker-in-Docker"
    exit 1
fi

echo "✅ Docker CLI trouvé: $(docker --version)"

# Démarrer le service Docker si nécessaire
if ! docker info &> /dev/null; then
    echo "🔧 Démarrage du service Docker..."
    
    # Essayer de démarrer Docker avec sudo
    if sudo service docker start &> /dev/null; then
        echo "✅ Service Docker démarré avec succès"
    else
        echo "⚠️  Tentative de démarrage du daemon Docker..."
        # Essayer de démarrer dockerd en arrière-plan
        sudo dockerd > /dev/null 2>&1 &
        sleep 5
        
        if docker info &> /dev/null; then
            echo "✅ Daemon Docker démarré avec succès"
        else
            echo "❌ Impossible de démarrer Docker"
            echo "📋 Vérifiez que la feature docker-in-docker est activée dans votre devcontainer.json"
            exit 1
        fi
    fi
else
    echo "✅ Docker daemon est déjà en cours d'exécution"
fi

# Vérifier les permissions Docker
if ! docker ps &> /dev/null; then
    echo "🔧 Configuration des permissions Docker..."
    
    # Ajouter l'utilisateur au groupe docker si nécessaire
    if ! groups | grep -q docker; then
        sudo usermod -aG docker $USER
        echo "✅ Utilisateur ajouté au groupe docker"
        echo "⚠️  Vous devrez peut-être redémarrer votre terminal ou dev container"
    fi
fi

# Test de construction d'image simple
echo "🔧 Test de construction d'image Docker..."
cat > Dockerfile.test << EOF
FROM public.ecr.aws/lambda/nodejs:24
CMD [ "echo", "test-devcontainer" ]
EOF

if DOCKER_BUILDKIT=0 docker build --platform linux/amd64 -t lambda-test-devcontainer -f Dockerfile.test . &> /dev/null; then
    echo "✅ Construction d'image Docker réussie"
    docker rmi lambda-test-devcontainer &> /dev/null || true
else
    echo "❌ Échec de la construction d'image Docker"
    echo "📋 Vérifiez les logs Docker pour plus de détails"
    exit 1
fi

# Nettoyer le fichier de test
rm -f Dockerfile.test

# Test d'accès à ECR public
echo "🔧 Test d'accès à ECR public..."
if timeout 30 docker pull public.ecr.aws/lambda/nodejs:24 &> /dev/null; then
    echo "✅ Accès à ECR public réussi"
else
    echo "⚠️  Impossible d'accéder à ECR public (peut nécessiter une connexion internet)"
    echo "📋 Cela peut fonctionner lors de l'utilisation réelle"
fi

# Afficher les informations Docker
echo ""
echo "📋 Informations Docker:"
echo "   - Version: $(docker --version)"
echo "   - Daemon: $(docker info --format '{{.ServerVersion}}' 2>/dev/null || echo 'Non disponible')"
echo "   - Utilisateur: $(whoami)"
echo "   - Groupes: $(groups)"

echo ""
echo "✅ Configuration Docker terminée avec succès!"
echo "📋 Vous pouvez maintenant procéder à la Partie 2 du Lab 07"
echo ""
echo "💡 Conseils pour dev container:"
echo "   - Si Docker ne fonctionne pas, redémarrez votre dev container"
echo "   - Assurez-vous que la feature docker-in-docker est dans votre devcontainer.json"
echo "   - En cas de problème de permissions, redémarrez le terminal"