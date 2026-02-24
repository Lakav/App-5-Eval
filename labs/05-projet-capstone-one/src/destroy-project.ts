import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { DynamoDBClient, DeleteTableCommand } from '@aws-sdk/client-dynamodb';
import { APIGatewayClient, DeleteRestApiCommand } from '@aws-sdk/client-api-gateway';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const AWS_REGION = 'eu-west-1';
const RESOURCE_STATE_FILE = join(process.cwd(), '.capstone-resources.json');

const s3Client = new S3Client({ region: AWS_REGION });
const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION });
const apiGatewayClient = new APIGatewayClient({ region: AWS_REGION });

type ResourceState = {
  bucketName: string;
  tableName: string;
  apiId?: string;
  apiUrl?: string;
};

async function main() {
  try {
    console.log('🚀 Starting Project Deletion...');

    const resources = loadResourceState();
    console.log(`📌 Bucket: ${resources.bucketName}`);
    console.log(`📌 Table: ${resources.tableName}`);
    console.log(`📌 API ID: ${resources.apiId || 'none'}`);

    await deleteDynamoDBTable(resources.tableName);
    console.log(`✅ DynamoDB table "${resources.tableName}" deleted.`);

    await deleteBucketAndObjects(resources.bucketName);
    console.log(`✅ S3 bucket "${resources.bucketName}" and all objects deleted.`);

    if (resources.apiId) {
      await deleteApiGateway(resources.apiId);
      console.log(`✅ API Gateway "${resources.apiId}" deleted.`);
    } else {
      console.log('ℹ️  No API Gateway ID found, skipping API deletion.');
    }

    clearApiFromState(resources);
    console.log('Project deleted...');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

function loadResourceState(): ResourceState {
  const state = readResourceState();
  const envBucket = process.env['CAPSTONE_BUCKET_NAME'];
  const envTable = process.env['CAPSTONE_TABLE_NAME'];
  const envApiId = process.env['CAPSTONE_API_ID'];

  const bucketName = envBucket || state.bucketName;
  const tableName = envTable || state.tableName;

  if (!bucketName || !tableName) {
    throw new Error(
      `Missing resource names. Use ${RESOURCE_STATE_FILE} or set CAPSTONE_BUCKET_NAME and CAPSTONE_TABLE_NAME.`
    );
  }

  const resolvedState: ResourceState = {
    bucketName,
    tableName,
  };
  const resolvedApiId = envApiId || state.apiId;
  if (resolvedApiId) {
    resolvedState.apiId = resolvedApiId;
  }
  if (state.apiUrl) {
    resolvedState.apiUrl = state.apiUrl;
  }
  return resolvedState;
}

function readResourceState(): Partial<ResourceState> {
  if (!existsSync(RESOURCE_STATE_FILE)) {
    return {};
  }

  return JSON.parse(readFileSync(RESOURCE_STATE_FILE, 'utf-8')) as Partial<ResourceState>;
}

function clearApiFromState(resources: ResourceState): void {
  const nextState: ResourceState = {
    bucketName: resources.bucketName,
    tableName: resources.tableName,
  };

  writeFileSync(RESOURCE_STATE_FILE, JSON.stringify(nextState, null, 2));
}

async function deleteBucketAndObjects(bucketName: string): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch (error: unknown) {
    const typedError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (typedError.name === 'NotFound' || typedError.$metadata?.httpStatusCode === 404) {
      console.log(`ℹ️  Bucket "${bucketName}" does not exist, nothing to delete.`);
      return;
    }
    throw error;
  }

  const listResponse = await s3Client.send(new ListObjectsV2Command({ Bucket: bucketName }));

  if (listResponse.Contents && listResponse.Contents.length > 0) {
    console.log(`🗑️  Deleting ${listResponse.Contents.length} object(s) from bucket...`);

    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: listResponse.Contents.map((obj) => ({ Key: obj.Key || '' })),
        },
      })
    );
    console.log('✅ All objects deleted.');
  } else {
    console.log('ℹ️  Bucket is empty.');
  }

  await s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
  console.log(`✅ Bucket "${bucketName}" deleted.`);
}

async function deleteDynamoDBTable(tableName: string): Promise<void> {
  try {
    await dynamoDBClient.send(new DeleteTableCommand({ TableName: tableName }));
  } catch (error: unknown) {
    const typedError = error as { name?: string };
    if (typedError.name === 'ResourceNotFoundException') {
      console.log(`ℹ️  Table "${tableName}" does not exist, nothing to delete.`);
      return;
    }

    console.error('❌ Error deleting DynamoDB table:', error);
    throw error;
  }
}

async function deleteApiGateway(apiId: string): Promise<void> {
  try {
    await apiGatewayClient.send(new DeleteRestApiCommand({ restApiId: apiId }));
  } catch (error: unknown) {
    const typedError = error as { name?: string };
    if (typedError.name === 'NotFoundException') {
      console.log(`ℹ️  API Gateway "${apiId}" does not exist, nothing to delete.`);
      return;
    }

    console.error('❌ Error deleting API Gateway:', error);
    throw error;
  }
}

main();

export {};
