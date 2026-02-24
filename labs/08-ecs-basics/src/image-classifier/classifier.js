import { pipeline, env } from '@xenova/transformers';

// Configuration pour utiliser les modèles distants
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = false;
env.cacheDir = '/tmp/.cache/huggingface';

class ImageClassifier {
  constructor() {
    this.classifier = null;
    this.modelName = 'Xenova/convnext-tiny-224';
  }

  async initialize() {
    console.log("Initialisation du classificateur d'images...");
    console.log(`Chargement du modèle: ${this.modelName}`);
    console.log(`Cache directory: ${env.cacheDir}`);

    try {
      // Charge le modèle de classification d'images
      this.classifier = await pipeline('image-classification', this.modelName);
      console.log('Modèle chargé avec succès!');
    } catch (error) {
      console.error('Erreur lors du chargement du modèle:', error);
      console.error(
        'Vérifiez que le conteneur a accès à Internet pour télécharger le modèle depuis Hugging Face'
      );
      throw error;
    }
  }

  async classifyImageFromUrl(imageUrl) {
    console.log(`Classification de l'image depuis: ${imageUrl}`);

    try {
      // Effectue la classification directement avec l'URL
      const results = await this.classifier(imageUrl);

      console.log('Classification terminée');
      console.log(`Nombre de prédictions: ${results.length}`);

      // Retourne les 5 meilleures prédictions
      const predictions = results.slice(0, 5).map(result => ({
        label: result.label,
        confidence: Math.round(result.score * 10000) / 100, // Pourcentage avec 2 décimales
        score: result.score,
      }));

      console.log('=== Résultats de classification ===');
      predictions.forEach((pred, index) => {
        console.log(`${index + 1}. ${pred.label}: ${pred.confidence}%`);
      });

      return predictions;
    } catch (error) {
      console.error('Erreur lors de la classification:', error);
      throw error;
    }
  }
}

// Fonction principale
async function main() {
  const classifier = new ImageClassifier();

  try {
    // Initialise le classificateur
    await classifier.initialize();

    // Récupère l'URL de l'image depuis les variables d'environnement ou arguments
    const imageUrl = process.env.IMAGE_URL || process.argv[2];

    if (!imageUrl) {
      throw new Error(
        "URL de l'image manquante. Utilisez la variable d'environnement IMAGE_URL ou passez l'URL en argument."
      );
    }

    // Valide que c'est une URL HTTPS
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      throw new Error(
        `URL invalide: ${imageUrl}. L'URL doit commencer par http:// ou https://`
      );
    }

    console.log(`URL de l'image: ${imageUrl}`);

    // Classifie l'image
    const predictions = await classifier.classifyImageFromUrl(imageUrl);

    // Prépare le résultat final
    const result = {
      timestamp: new Date().toISOString(),
      input: {
        url: imageUrl,
      },
      model: {
        name: classifier.modelName,
        version: '1.0.0',
      },
      predictions: predictions,
      processing: {
        success: true,
      },
    };

    console.log('\n=== Résultat final ===');
    console.log(JSON.stringify(result, null, 2));

    console.log('\nTraitement terminé avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('\n=== Erreur fatale ===');
    console.error(error.message);
    process.exit(1);
  }
}

// Gestion des signaux pour un arrêt propre
process.on('SIGTERM', () => {
  console.log('Signal SIGTERM reçu, arrêt du processus...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Signal SIGINT reçu, arrêt du processus...');
  process.exit(0);
});

// Démarre le processus principal
main();

export { ImageClassifier };
