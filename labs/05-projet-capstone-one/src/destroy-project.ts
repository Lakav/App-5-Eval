import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

import { 
  DynamoDBClient,
  DeleteTableCommand
} from "@aws-sdk/client-dynamodb";
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Configuration du client S3
const s3Client = new S3Client({
  region: 'eu-west-1',
});

// Configuration du client DynamoDB
const dynamoDBClient = new DynamoDBClient({
  region: 'eu-west-1',
});

const RESOURCE_STATE_FILE = join(process.cwd(), '.capstone-resources.json');

type ResourceNames = {
  bucketName: string;
  tableName: string;
};

// Main function to execute destructive operation
async function main() {
  try {
    console.log('🚀 Starting Project Deletion...');

    const resources = loadResourceNames();
    console.log(`📌 Bucket: ${resources.bucketName}`);
    console.log(`📌 Table: ${resources.tableName}`);

    // Delete DynamoDB resources (à implémenter plus tard)
    const dynamoDBTableName = resources.tableName;
    await deleteDynamoDBTable(dynamoDBTableName);
    console.log(`✅ DynamoDB Table "${dynamoDBTableName}" deleted.`);

    // Delete S3 bucket and all objects
    const bucketName = resources.bucketName;
    await deleteBucketAndObjects(bucketName);
    console.log(`✅ S3 Bucket "${bucketName}" and all objects deleted.`);

    // Delete API Gateway resources (à implémenter plus tard)

    console.log('Project deleted...');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

function loadResourceNames(): ResourceNames {
  const envBucket = process.env['CAPSTONE_BUCKET_NAME'];
  const envTable = process.env['CAPSTONE_TABLE_NAME'];

  if (envBucket && envTable) {
    return {
      bucketName: envBucket,
      tableName: envTable,
    };
  }

  if (!existsSync(RESOURCE_STATE_FILE)) {
    throw new Error(`Missing ${RESOURCE_STATE_FILE}. Set CAPSTONE_BUCKET_NAME and CAPSTONE_TABLE_NAME to destroy manually.`);
  }

  const parsed = JSON.parse(readFileSync(RESOURCE_STATE_FILE, 'utf-8')) as Partial<ResourceNames>;
  if (!parsed.bucketName || !parsed.tableName) {
    throw new Error(`Invalid ${RESOURCE_STATE_FILE}. Set CAPSTONE_BUCKET_NAME and CAPSTONE_TABLE_NAME to destroy manually.`);
  }

  return {
    bucketName: parsed.bucketName,
    tableName: parsed.tableName,
  };
}

/**
 * Supprimer tous les objets d'un bucket S3 puis le bucket lui-même
 */
async function deleteBucketAndObjects(bucketName: string): Promise<void> {
  try {
    // Vérifier si le bucket existe
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`ℹ️  Bucket "${bucketName}" does not exist, nothing to delete.`);
      return;
    }
    throw error;
  }

  // Lister tous les objets du bucket
  const listCommand = new ListObjectsV2Command({ Bucket: bucketName });
  const listResponse = await s3Client.send(listCommand);

  if (listResponse.Contents && listResponse.Contents.length > 0) {
    console.log(`🗑️  Deleting ${listResponse.Contents.length} object(s) from bucket...`);

    // Préparer la liste des objets à supprimer
    const objectsToDelete = listResponse.Contents.map((obj) => ({
      Key: obj.Key!,
    }));

    // Supprimer tous les objets
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: objectsToDelete,
      },
    });

    await s3Client.send(deleteCommand);
    console.log(`✅ All objects deleted.`);
  } else {
    console.log(`ℹ️  Bucket is empty.`);
  }

  // Supprimer le bucket
  const deleteBucketCommand = new DeleteBucketCommand({ Bucket: bucketName });
  await s3Client.send(deleteBucketCommand);
  console.log(`✅ Bucket "${bucketName}" deleted.`);
}

/**
 * Supprimer une table DynamoDB
 */
async function deleteDynamoDBTable(tableName: string): Promise<void> {
  try {
    const command = new DeleteTableCommand({ TableName: tableName });
    await dynamoDBClient.send(command);
  } catch (error) {
    console.error('❌ Error deleting DynamoDB table:', error);
  }
}

// Execute the main function
main();

// Export to make this a module and avoid global scope conflicts
export {};
