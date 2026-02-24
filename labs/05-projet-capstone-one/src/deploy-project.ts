import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

import { 
  DynamoDBClient,
  CreateTableCommand,
  PutItemCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';
import { existsSync, writeFileSync } from 'fs';

// Région par défaut pour tous les clients AWS
const AWS_REGION = 'eu-west-1';

// Configuration du client S3
const s3Client = new S3Client({
  region: AWS_REGION,
});

const dynamoDBClient = new DynamoDBClient({
  region: AWS_REGION,
});

const RESOURCE_STATE_FILE = join(process.cwd(), '.capstone-resources.json');

type ResourceNames = {
  bucketName: string;
  tableName: string;
};

// Main function to execute all operations
async function deploy() {
  try {
    console.log('🚀 Starting Project Deployment...');

    const resources = loadOrCreateResourceNames();
    console.log(`📌 Bucket: ${resources.bucketName}`);
    console.log(`📌 Table: ${resources.tableName}`);

    // Create S3 and Insert Objects
    const bucketName = resources.bucketName;
    const objectsFolder = './assets';
    const dataFolder = './data';
    
    await createBucket(bucketName);
    console.log(`✅ S3 Bucket "${bucketName}" created.`);

    await uploadAssets(bucketName, objectsFolder);
    console.log(`✅ Assets from "${objectsFolder}" uploaded to bucket "${bucketName}".`);

    // Create DynamoDB and Insert Items
    const dynamoDBTableName = resources.tableName;
    await createDynamoDBTable(dynamoDBTableName);
    console.log(`✅ DynamoDB Table "${dynamoDBTableName}" created.`);

    await insertItemsFromJson(dynamoDBTableName, join(dataFolder, 'ships.json'));
    console.log(`✅ Items from "${join(dataFolder, 'ships.json')}" inserted into DynamoDB Table "${dynamoDBTableName}".`);

    // Create API Gateway and Configure S3 / DynamoDB Integration

    console.log('Project deployed...');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

function loadOrCreateResourceNames(): ResourceNames {
  const envBucket = process.env['CAPSTONE_BUCKET_NAME'];
  const envTable = process.env['CAPSTONE_TABLE_NAME'];

  if (envBucket && envTable) {
    return {
      bucketName: envBucket,
      tableName: envTable,
    };
  }

  if (existsSync(RESOURCE_STATE_FILE)) {
    const parsed = JSON.parse(readFileSync(RESOURCE_STATE_FILE, 'utf-8')) as Partial<ResourceNames>;
    if (parsed.bucketName && parsed.tableName) {
      return {
        bucketName: parsed.bucketName,
        tableName: parsed.tableName,
      };
    }
  }

  const suffix = buildSuffix();
  const generated: ResourceNames = {
    bucketName: `my-capstone-project-bucket-${suffix}`.slice(0, 63),
    tableName: `my-capstone-project-table-${suffix}`,
  };

  writeFileSync(RESOURCE_STATE_FILE, JSON.stringify(generated, null, 2));
  console.log(`📝 Saved resource names to ${RESOURCE_STATE_FILE}`);

  return generated;
}

function buildSuffix(): string {
  const customSuffix = process.env['CAPSTONE_SUFFIX'];
  const rawSuffix = customSuffix || `${process.env['USER'] || 'student'}-${Date.now().toString(36)}`;
  return rawSuffix
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);
}

/**
 * Créer un bucket S3
 */
async function createBucket(bucketName: string): Promise<void> {
  try {
    // Vérifier si le bucket existe déjà
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`ℹ️  Bucket "${bucketName}" already exists, skipping creation.`);
  } catch (error: any) {
    // Si le bucket n'existe pas (erreur 404), on le crée
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      const command = new CreateBucketCommand({
        Bucket: bucketName,
        CreateBucketConfiguration: {
          LocationConstraint: 'eu-west-1',
        },
      });

      const maxAttempts = 5;
      let attempt = 0;

      while (attempt < maxAttempts) {
        try {
          await s3Client.send(command);
          return;
        } catch (createError: any) {
          const isOperationAborted = createError?.Code === 'OperationAborted' || createError?.name === 'OperationAborted' || createError?.$metadata?.httpStatusCode === 409;

          if (!isOperationAborted || attempt === maxAttempts - 1) {
            throw createError;
          }

          const waitMs = Math.pow(2, attempt) * 1000;
          console.log(`⏳ S3 is busy for bucket "${bucketName}" (attempt ${attempt + 1}/${maxAttempts}). Retrying in ${waitMs / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          attempt++;
        }
      }
    } else {
      // Autre erreur (permissions, etc.)
      throw error;
    }
  }
}

/**
 * Demander confirmation à l'utilisateur via la console
 */
async function askUserConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'o' || answer.toLowerCase() === 'oui');
    });
  });
}

/**
 * Uploader un jpg vers S3
 */
async function uploadJpg(
  bucketName: string,
  key: string,
  filePath: string
): Promise<void> {
  try {
    // Vérifier si l'objet existe déjà
    await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    
    // L'objet existe, demander confirmation
    console.log(`⚠️  Object "${key}" already exists in bucket "${bucketName}".`);
    const shouldOverwrite = await askUserConfirmation('Do you want to overwrite it? (y/n): ');
    
    if (!shouldOverwrite) {
      console.log(`⏭️  Skipping "${key}".`);
      return;
    }
    
    console.log(`🔄 Overwriting "${key}"...`);
  } catch (error: any) {
    // Si l'objet n'existe pas (erreur 404), on continue normalement
    if (error.name !== 'NotFound' && error.$metadata?.httpStatusCode !== 404) {
      // Autre erreur (permissions, etc.)
      throw error;
    }
  }

  // Uploader le fichier
  const fileContent = readFileSync(filePath);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: 'image/jpeg',
  });

  await s3Client.send(command);
}

/**
 * Uploader tout le dossier assets vers S3
 */
async function uploadAssets(bucketName: string, folderPath: string): Promise<void> {
  // Première boucle : Construire le tableau de paths
  const filePaths: string[] = [];
  const files = readdirSync(folderPath);
  
  for (const file of files) {
    const fullPath = join(folderPath, file);
    filePaths.push(fullPath);
  }
  
  console.log(`📂 Found ${filePaths.length} file(s) to upload`);
  
  // Deuxième boucle : Uploader chaque fichier
  for (const filePath of filePaths) {
    const fileName = filePath.split('/').pop() || filePath;
    await uploadJpg(bucketName, fileName, filePath);
    console.log(`✅ Uploaded: ${fileName}`);
  }
}

/**
 * Créer une table DynamoDB
 */
async function createDynamoDBTable(tableName: string): Promise<void> {
  try {
    // Vérifier si la table existe déjà
    try {
      await dynamoDBClient.send(new DescribeTableCommand({ TableName: tableName }));
      console.log(`ℹ️  Table "${tableName}" already exists, skipping creation.`);
      return;
    } catch (error: any) {
      // Si la table n'existe pas, on continue pour la créer
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    // Créer la table
    const command = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }, // Partition key
      ],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST', // Mode à la demande (pas de capacité fixe)
    });

    await dynamoDBClient.send(command);
    console.log(`⏳ Waiting for table "${tableName}" to be active...`);

    // Attendre que la table soit active
    await waitUntilTableExists(
      { client: dynamoDBClient, maxWaitTime: 60 },
      { TableName: tableName }
    );

    console.log(`✅ Table "${tableName}" is now active.`);
  } catch (error) {
    console.error('❌ Error creating DynamoDB table:', error);
    throw error; // Propager l'erreur pour arrêter le déploiement
  }
}

/**
 * Insérer des items dans DynamoDB à partir d'un fichier JSON
 */
async function insertItemsFromJson(tableName: string, jsonFilePath: string): Promise<void> {
  try {
      // Lire le fichier JSON
      const fileContent = readFileSync(jsonFilePath, 'utf-8');
      const items = JSON.parse(fileContent);

      console.log(`📝 Inserting ${items.length} item(s) into DynamoDB...`);

      // Insérer chaque item dans DynamoDB
      for (const item of items) {
          const command = new PutItemCommand({
              TableName: tableName,
              Item: item, // Le JSON est déjà au format DynamoDB
          });
          await dynamoDBClient.send(command);
          console.log(`✅ Inserted: ${item.nom.S} (${item.id.S})`);
      }
  } catch (error) {
      console.error('❌ Error inserting items:', error);
      throw error;
  }
}

// Execute the main function
deploy();
