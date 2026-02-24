import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

import { writeFileSync, readFileSync } from 'fs';

// Configuration du client S3
const s3Client = new S3Client({
  region: 'eu-west-1', // Région par défaut
});

/**
 * Fonction principale pour démontrer les opérations S3
 */
async function main() {
  // Nom unique pour le bucket SDK
  const bucketName = `s3-lab-sdk-${Date.now()}`;
  const fileName = 'test-sdk.txt';
  const localFilePath = './test-sdk.txt';
  const downloadedFilePath = './test-sdk-downloaded.txt';

  try {
    console.log('🚀 Début des opérations S3 avec le SDK TypeScript');
    console.log(`📦 Nom du bucket: ${bucketName}`);

    // 1. Créer un bucket S3
    console.log('\n1️⃣ Création du bucket S3...');
    await createBucket(bucketName);
    console.log('✅ Bucket créé avec succès');

    // 2. Créer un fichier local
    console.log('\n2️⃣ Création du fichier local...');
    const fileContent = `Bonjour depuis le SDK TypeScript!
Ce fichier a été créé le ${new Date().toISOString()}
Opération: Upload via SDK AWS v3
Bucket: ${bucketName}`;

    writeFileSync(localFilePath, fileContent);
    console.log(`✅ Fichier créé: ${localFilePath}`);

    // 3. Uploader le fichier vers S3
    console.log('\n3️⃣ Upload du fichier vers S3...');
    await uploadFile(bucketName, fileName, localFilePath);
    console.log('✅ Fichier uploadé avec succès');

    // 4. Lister les objets dans le bucket
    console.log('\n4️⃣ Liste des objets dans le bucket...');
    await listObjects(bucketName);

    // 5. Télécharger le fichier depuis S3
    console.log('\n5️⃣ Téléchargement du fichier depuis S3...');
    await downloadFile(bucketName, fileName, downloadedFilePath);
    console.log('✅ Fichier téléchargé avec succès');

    // 6. Vérifier le contenu du fichier téléchargé
    console.log('\n6️⃣ Vérification du contenu téléchargé...');
    const downloadedContent = readFileSync(downloadedFilePath, 'utf-8');
    console.log('📄 Contenu du fichier téléchargé:');
    console.log(downloadedContent);

    console.log('\n🎉 Toutes les opérations S3 ont été réalisées avec succès!');
    console.log(`\n⚠️  N'oubliez pas de nettoyer le bucket: ${bucketName}`);
  } catch (error) {
    console.error('❌ Erreur lors des opérations S3:', error);
    process.exit(1);
  }
}

/**
 * Créer un bucket S3
 */
async function createBucket(bucketName: string): Promise<void> {
  const command = new CreateBucketCommand({
    Bucket: bucketName,
    CreateBucketConfiguration: {
      LocationConstraint: 'eu-west-1',
    },
  });

  await s3Client.send(command);
}

/**
 * Uploader un fichier vers S3
 */
async function uploadFile(
  bucketName: string,
  key: string,
  filePath: string
): Promise<void> {
  const fileContent = readFileSync(filePath);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: 'text/plain',
  });

  await s3Client.send(command);
}

/**
 * Lister les objets dans un bucket
 */
async function listObjects(bucketName: string): Promise<void> {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
  });

  const response = await s3Client.send(command);

  if (response.Contents && response.Contents.length > 0) {
    console.log('📋 Objets trouvés:');
    response.Contents.forEach(obj => {
      console.log(
        `  - ${obj.Key} (${obj.Size} bytes, modifié: ${obj.LastModified})`
      );
    });
  } else {
    console.log('📋 Aucun objet trouvé dans le bucket');
  }
}

/**
 * Télécharger un fichier depuis S3
 */
async function downloadFile(
  bucketName: string,
  key: string,
  downloadPath: string
): Promise<void> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (response.Body) {
    const chunks: Uint8Array[] = [];
    const reader = response.Body.transformToWebStream().getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const fileContent = Buffer.concat(chunks);
    writeFileSync(downloadPath, fileContent);
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

export { createBucket, uploadFile, downloadFile, listObjects };
