import { EventBridgeEvent, Context } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// Interface pour l'événement S3 via EventBridge
interface S3EventDetail {
  bucket: {
    name: string;
  };
  object: {
    key: string;
  };
}

// Client S3 réutilisable
const s3Client = new S3Client({ region: 'eu-west-1' });

/**
 * Fonction Lambda qui traite les fichiers S3 déclenchée par EventBridge
 * @param event - Événement EventBridge contenant les détails S3
 * @param context - Contexte Lambda
 */
export const handler = async (
  event: EventBridgeEvent<'Object Created', S3EventDetail>,
  context: Context
): Promise<void> => {
  console.log('🚀 Lambda déclenchée par EventBridge');
  console.log('📋 Événement reçu:', JSON.stringify(event, null, 2));

  try {
    // Extraire les informations du bucket et de l'objet
    const bucketName = event.detail.bucket.name;
    const objectKey = event.detail.object.key;

    console.log(`📁 Bucket: ${bucketName}`);
    console.log(`📄 Fichier: ${objectKey}`);

    // Vérifier si c'est le fichier data.json que nous attendons
    if (!objectKey.endsWith('data.json')) {
      console.log("⚠️ Ce n'est pas un fichier data.json, ignorer");
      return;
    }

    // Lire le contenu du fichier S3
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    console.log('📥 Lecture du fichier S3...');
    const response = await s3Client.send(getObjectCommand);

    if (!response.Body) {
      throw new Error('Le fichier S3 est vide ou inaccessible');
    }

    // Convertir le stream en string
    const fileContent = await response.Body.transformToString();
    console.log('📝 Contenu du fichier lu avec succès');

    // Parser le JSON et logger le contenu
    try {
      const jsonData = JSON.parse(fileContent);
      console.log('✅ Contenu JSON parsé:');
      console.log('📊 Données:', JSON.stringify(jsonData, null, 2));

      // Logger des informations supplémentaires sur le fichier
      console.log(`📏 Taille du fichier: ${response.ContentLength} bytes`);
      console.log(`🕒 Dernière modification: ${response.LastModified}`);
      console.log(`📋 Type de contenu: ${response.ContentType}`);

      // Si c'est un tableau, logger le nombre d'éléments
      if (Array.isArray(jsonData)) {
        console.log(`📈 Nombre d'éléments dans le tableau: ${jsonData.length}`);
      }
    } catch (parseError) {
      console.error('❌ Erreur lors du parsing JSON:', parseError);
      console.log('📄 Contenu brut du fichier:', fileContent);
    }

    console.log('✅ Traitement terminé avec succès');
  } catch (error) {
    console.error('❌ Erreur lors du traitement:', error);

    // Logger des détails supplémentaires pour le débogage
    console.error("🔍 Détails de l'erreur:", {
      message: error instanceof Error ? error.message : 'Erreur inconnue',
      stack: error instanceof Error ? error.stack : undefined,
      requestId: context.awsRequestId,
      functionName: context.functionName,
      remainingTime: context.getRemainingTimeInMillis(),
    });

    // Re-lancer l'erreur pour que Lambda la marque comme échec
    throw error;
  }
};
