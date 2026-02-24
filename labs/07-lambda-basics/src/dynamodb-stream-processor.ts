import { DynamoDBStreamEvent, Context } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';

// Client S3 réutilisable
const s3Client = new S3Client({ region: 'eu-west-1' });

// Interface pour l'historique des changements
interface ChangeHistory {
  timestamp: string;
  eventName: string;
  itemId: string;
  oldImage?: any;
  newImage?: any;
}

/**
 * Fonction Lambda qui traite les événements DynamoDB Stream
 * @param event - Événement DynamoDB Stream
 * @param context - Contexte Lambda
 */
export const handler = async (
  event: DynamoDBStreamEvent,
  context: Context
): Promise<void> => {
  console.log('🚀 Lambda conteneur déclenchée par DynamoDB Stream');
  console.log('📋 Événement reçu:', JSON.stringify(event, null, 2));
  console.log(`📋 Nombre d'enregistrements: ${event.Records.length}`);

  try {
    const changes: ChangeHistory[] = [];

    // Traiter chaque enregistrement du stream
    for (const record of event.Records) {
      console.log(`🔄 Traitement de l'enregistrement: ${record.eventID}`);
      console.log(`📝 Type d'événement: ${record.eventName}`);

      // Extraire l'ID de l'item (supposé être dans la clé 'id')
      let itemId = 'unknown';
      if (record.dynamodb?.Keys?.['id']) {
        const keys = unmarshall(record.dynamodb.Keys as Record<string, any>);
        itemId = keys['id'];
      }

      // Créer l'entrée d'historique
      const change: ChangeHistory = {
        timestamp: new Date().toISOString(),
        eventName: record.eventName || 'UNKNOWN',
        itemId: itemId,
      };

      // Traiter l'ancienne image (OLD)
      if (record.dynamodb?.OldImage) {
        change.oldImage = unmarshall(
          record.dynamodb.OldImage as Record<string, any>
        );
        console.log(
          '📤 Ancienne image (OLD):',
          JSON.stringify(change.oldImage, null, 2)
        );
      }

      // Traiter la nouvelle image (NEW)
      if (record.dynamodb?.NewImage) {
        change.newImage = unmarshall(
          record.dynamodb.NewImage as Record<string, any>
        );
        console.log(
          '📥 Nouvelle image (NEW):',
          JSON.stringify(change.newImage, null, 2)
        );
      }

      changes.push(change);

      // Logger les détails du changement
      console.log(`✅ Changement enregistré pour l'item ${itemId}:`);
      if (change.oldImage && change.newImage) {
        console.log('🔄 MODIFICATION détectée');
      } else if (change.newImage && !change.oldImage) {
        console.log('➕ INSERTION détectée');
      } else if (change.oldImage && !change.newImage) {
        console.log('🗑️ SUPPRESSION détectée');
      }
    }

    // Sauvegarder l'historique dans S3
    if (changes.length > 0) {
      await saveHistoryToS3(changes);
    }

    console.log(`✅ Traitement terminé: ${changes.length} changements traités`);
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

/**
 * Sauvegarde l'historique des changements dans S3
 * @param changes - Liste des changements à sauvegarder
 */
async function saveHistoryToS3(changes: ChangeHistory[]): Promise<void> {
  try {
    // Le nom du bucket est passé via une variable d'environnement
    const bucketName = process.env['HISTORY_BUCKET_NAME'];
    if (!bucketName) {
      throw new Error('HISTORY_BUCKET_NAME environment variable not set');
    }

    // Créer un nom de fichier unique avec timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `history/changes-${timestamp}.json`;

    // Préparer le contenu du fichier
    const historyContent = {
      timestamp: new Date().toISOString(),
      totalChanges: changes.length,
      changes: changes,
    };

    console.log(
      `💾 Sauvegarde de l'historique dans S3: s3://${bucketName}/${fileName}`
    );

    // Uploader vers S3
    const putObjectCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: JSON.stringify(historyContent, null, 2),
      ContentType: 'application/json',
      Metadata: {
        'generated-by': 'dynamodb-stream-processor',
        'change-count': changes.length.toString(),
      },
    });

    await s3Client.send(putObjectCommand);

    console.log('✅ Historique sauvegardé avec succès dans S3');
    console.log(`📁 Fichier créé: ${fileName}`);
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde S3:', error);
    throw error;
  }
}
