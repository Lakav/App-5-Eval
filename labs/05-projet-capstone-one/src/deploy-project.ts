import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  AttributeValue,
  CreateTableCommand,
  PutItemCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import {
  APIGatewayClient,
  CreateDeploymentCommand,
  CreateResourceCommand,
  CreateRestApiCommand,
  GetResourcesCommand,
  GetRestApiCommand,
  PutIntegrationCommand,
  PutIntegrationResponseCommand,
  PutMethodCommand,
  PutMethodResponseCommand,
} from '@aws-sdk/client-api-gateway';
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';

const AWS_REGION = 'eu-west-1';
const API_STAGE_NAME = 'dev';
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

type ApiGatewayDetails = {
  apiId: string;
  apiUrl: string;
};

type DynamoDbRawItem = Record<string, AttributeValue>;

async function deploy() {
  try {
    console.log('🚀 Starting Project Deployment...');

    const resources = loadOrCreateResourceState();
    console.log(`📌 Bucket: ${resources.bucketName}`);
    console.log(`📌 Table: ${resources.tableName}`);

    await createBucket(resources.bucketName);
    console.log(`✅ S3 Bucket "${resources.bucketName}" ready.`);

    await uploadAssets(resources.bucketName, './assets');
    console.log(`✅ Assets uploaded to "${resources.bucketName}".`);

    await createDynamoDBTable(resources.tableName);
    console.log(`✅ DynamoDB table "${resources.tableName}" ready.`);

    await insertItemsFromJson(resources.tableName, './data/ships.json');
    console.log(`✅ DynamoDB data inserted into "${resources.tableName}".`);

    const apiGateway = await createOrReuseApiGateway(resources);
    const updatedState: ResourceState = {
      ...resources,
      apiId: apiGateway.apiId,
      apiUrl: apiGateway.apiUrl,
    };
    saveResourceState(updatedState);

    console.log(`✅ API Gateway ready: ${apiGateway.apiUrl}`);
    console.log('Project deployed...');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

function loadOrCreateResourceState(): ResourceState {
  const existing = readResourceState();
  const envBucket = process.env['CAPSTONE_BUCKET_NAME'];
  const envTable = process.env['CAPSTONE_TABLE_NAME'];

  const bucketName = envBucket || existing.bucketName || `my-capstone-project-bucket-${buildSuffix()}`.slice(0, 63);
  const tableName = envTable || existing.tableName || `my-capstone-project-table-${buildSuffix()}`;

  const state: ResourceState = {
    bucketName,
    tableName,
  };
  if (existing.apiId) {
    state.apiId = existing.apiId;
  }
  if (existing.apiUrl) {
    state.apiUrl = existing.apiUrl;
  }

  saveResourceState(state);
  return state;
}

function readResourceState(): Partial<ResourceState> {
  if (!existsSync(RESOURCE_STATE_FILE)) {
    return {};
  }

  return JSON.parse(readFileSync(RESOURCE_STATE_FILE, 'utf-8')) as Partial<ResourceState>;
}

function saveResourceState(state: ResourceState): void {
  writeFileSync(RESOURCE_STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`📝 Resource state saved to ${RESOURCE_STATE_FILE}`);
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

async function createBucket(bucketName: string): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`ℹ️  Bucket "${bucketName}" already exists, skipping creation.`);
  } catch (error: unknown) {
    const typedError = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
    if (typedError.name === 'NotFound' || typedError.$metadata?.httpStatusCode === 404) {
      const command = new CreateBucketCommand({
        Bucket: bucketName,
        CreateBucketConfiguration: { LocationConstraint: AWS_REGION },
      });

      const maxAttempts = 5;
      let attempt = 0;
      while (attempt < maxAttempts) {
        try {
          await s3Client.send(command);
          return;
        } catch (createError: unknown) {
          const typedCreateError = createError as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
          const isOperationAborted =
            typedCreateError.Code === 'OperationAborted' ||
            typedCreateError.name === 'OperationAborted' ||
            typedCreateError.$metadata?.httpStatusCode === 409;

          if (!isOperationAborted || attempt === maxAttempts - 1) {
            throw createError;
          }

          const waitMs = Math.pow(2, attempt) * 1000;
          console.log(
            `⏳ S3 busy for "${bucketName}" (attempt ${attempt + 1}/${maxAttempts}), retrying in ${waitMs / 1000}s...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          attempt++;
        }
      }
    } else {
      throw error;
    }
  }
}

async function askUserConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(['y', 'yes', 'o', 'oui'].includes(answer.toLowerCase()));
    });
  });
}

async function uploadJpg(bucketName: string, key: string, filePath: string): Promise<void> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    console.log(`⚠️  Object "${key}" already exists in bucket "${bucketName}".`);

    const shouldOverwrite = await askUserConfirmation('Do you want to overwrite it? (y/n): ');
    if (!shouldOverwrite) {
      console.log(`⏭️  Skipping "${key}".`);
      return;
    }

    console.log(`🔄 Overwriting "${key}"...`);
  } catch (error: unknown) {
    const typedError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (typedError.name !== 'NotFound' && typedError.$metadata?.httpStatusCode !== 404) {
      throw error;
    }
  }

  const fileContent = readFileSync(filePath);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: 'image/jpeg',
    })
  );
}

async function uploadAssets(bucketName: string, folderPath: string): Promise<void> {
  const filePaths = readdirSync(folderPath).map((file) => join(folderPath, file));
  console.log(`📂 Found ${filePaths.length} file(s) to upload`);

  for (const filePath of filePaths) {
    const fileName = filePath.split('/').pop() || filePath;
    await uploadJpg(bucketName, fileName, filePath);
    console.log(`✅ Uploaded: ${fileName}`);
  }
}

async function createDynamoDBTable(tableName: string): Promise<void> {
  try {
    try {
      await dynamoDBClient.send(new DescribeTableCommand({ TableName: tableName }));
      console.log(`ℹ️  Table "${tableName}" already exists, skipping creation.`);
      return;
    } catch (error: unknown) {
      const typedError = error as { name?: string };
      if (typedError.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    await dynamoDBClient.send(
      new CreateTableCommand({
        TableName: tableName,
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST',
      })
    );

    console.log(`⏳ Waiting for table "${tableName}" to be active...`);
    await waitUntilTableExists({ client: dynamoDBClient, maxWaitTime: 60 }, { TableName: tableName });
    console.log(`✅ Table "${tableName}" is now active.`);
  } catch (error) {
    console.error('❌ Error creating DynamoDB table:', error);
    throw error;
  }
}

async function insertItemsFromJson(tableName: string, jsonFilePath: string): Promise<void> {
  try {
    const fileContent = readFileSync(jsonFilePath, 'utf-8');
    const items = JSON.parse(fileContent) as DynamoDbRawItem[];

    console.log(`📝 Inserting ${items.length} item(s) into DynamoDB...`);

    for (const item of items) {
      await dynamoDBClient.send(
        new PutItemCommand({
          TableName: tableName,
          Item: item,
        })
      );
      const typedItem = item as {
        id?: { S?: string };
        nom?: { S?: string };
      };
      console.log(`✅ Inserted: ${typedItem.nom?.S || 'unknown'} (${typedItem.id?.S || 'unknown'})`);
    }
  } catch (error) {
    console.error('❌ Error inserting items:', error);
    throw error;
  }
}

async function createOrReuseApiGateway(resources: ResourceState): Promise<ApiGatewayDetails> {
  if (resources.apiId) {
    try {
      await apiGatewayClient.send(new GetRestApiCommand({ restApiId: resources.apiId }));
      return {
        apiId: resources.apiId,
        apiUrl: buildApiUrl(resources.apiId),
      };
    } catch (error: unknown) {
      const typedError = error as { name?: string };
      if (typedError.name !== 'NotFoundException') {
        throw error;
      }
      console.log('ℹ️  Stored API Gateway not found, recreating it...');
    }
  }

  const accountId = resolveAwsAccountId();
  const dynamoRoleArn = `arn:aws:iam::${accountId}:role/APIGatewayDynamoDBServiceRole`;
  const s3RoleArn = `arn:aws:iam::${accountId}:role/APIGatewayS3ServiceRole`;

  const createApiResponse = await apiGatewayClient.send(
    new CreateRestApiCommand({
      name: `ships-api-${buildSuffix()}`,
      description: 'Capstone API - ships profiles and photos',
      endpointConfiguration: { types: ['REGIONAL'] },
      binaryMediaTypes: ['image/jpeg', 'image/jpg', 'image/png'],
    })
  );

  if (!createApiResponse.id) {
    throw new Error('Unable to create API Gateway: missing API id in response.');
  }

  const apiId = createApiResponse.id;
  const rootResourceId = await getRootResourceId(apiId);

  const shipsResourceId = await createResource(apiId, rootResourceId, 'ships');
  const profileResourceId = await createResource(apiId, shipsResourceId, 'profile');
  const profileKeyResourceId = await createResource(apiId, profileResourceId, '{key}');
  const photoResourceId = await createResource(apiId, shipsResourceId, 'photo');
  const photoKeyResourceId = await createResource(apiId, photoResourceId, '{key}');

  await configureGetShips(apiId, shipsResourceId, resources.tableName, dynamoRoleArn);
  await configureOptionsMethod(apiId, shipsResourceId, 'GET,OPTIONS');

  await configureGetShipProfile(apiId, profileKeyResourceId, resources.tableName, dynamoRoleArn);
  await configureOptionsMethod(apiId, profileKeyResourceId, 'GET,OPTIONS');

  await configureGetShipPhoto(apiId, photoKeyResourceId, resources.bucketName, s3RoleArn);
  await configureOptionsMethod(apiId, photoKeyResourceId, 'GET,OPTIONS');

  await apiGatewayClient.send(
    new CreateDeploymentCommand({
      restApiId: apiId,
      stageName: API_STAGE_NAME,
      description: 'Initial capstone deployment',
    })
  );

  return {
    apiId,
    apiUrl: buildApiUrl(apiId),
  };
}

function resolveAwsAccountId(): string {
  const envAccountId = process.env['AWS_ACCOUNT_ID'];
  if (envAccountId) {
    return envAccountId;
  }

  const output = execSync('aws sts get-caller-identity --query Account --output text', {
    encoding: 'utf-8',
  }).trim();

  if (!output) {
    throw new Error('Unable to resolve AWS account id (empty output from aws sts).');
  }

  return output;
}

function buildApiUrl(apiId: string): string {
  return `https://${apiId}.execute-api.${AWS_REGION}.amazonaws.com/${API_STAGE_NAME}`;
}

async function getRootResourceId(apiId: string): Promise<string> {
  const resources = await apiGatewayClient.send(new GetResourcesCommand({ restApiId: apiId, limit: 500 }));
  const root = resources.items?.find((item) => item.path === '/');

  if (!root?.id) {
    throw new Error(`Root resource not found for API ${apiId}.`);
  }

  return root.id;
}

async function createResource(apiId: string, parentId: string, pathPart: string): Promise<string> {
  const response = await apiGatewayClient.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId,
      pathPart,
    })
  );

  if (!response.id) {
    throw new Error(`Failed to create resource '${pathPart}' on API ${apiId}.`);
  }

  return response.id;
}

async function configureGetShips(
  apiId: string,
  resourceId: string,
  tableName: string,
  roleArn: string
): Promise<void> {
  await apiGatewayClient.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'GET',
      authorizationType: 'NONE',
    })
  );

  await apiGatewayClient.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'GET',
      type: 'AWS',
      integrationHttpMethod: 'POST',
      uri: `arn:aws:apigateway:${AWS_REGION}:dynamodb:action/Scan`,
      credentials: roleArn,
      passthroughBehavior: 'WHEN_NO_MATCH',
      requestTemplates: {
        'application/json': `{"TableName":"${tableName}"}`,
      },
    })
  );

  await apiGatewayClient.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
      },
    })
  );

  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,x-api-key'",
        'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
      },
      responseTemplates: {
        'application/json': `#set($items = $input.path('$.Items'))
{
  "ships": [
#foreach($item in $items)
    {
      "id": "$item.id.S",
      "nom": "$item.nom.S",
      "type": "$item.type.S",
      "pavillon": "$item.pavillon.S",
      "taille": "$item.taille.N",
      "nombre_marins": "$item.nombre_marins.N",
      "s3_image_key": "$item.s3_image_key.S"
    }#if($foreach.hasNext),#end
#end
  ]
}`,
      },
    })
  );
}

async function configureGetShipProfile(
  apiId: string,
  resourceId: string,
  tableName: string,
  roleArn: string
): Promise<void> {
  await apiGatewayClient.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'GET',
      authorizationType: 'NONE',
      requestParameters: {
        'method.request.path.key': true,
      },
    })
  );

  await apiGatewayClient.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'GET',
      type: 'AWS',
      integrationHttpMethod: 'POST',
      uri: `arn:aws:apigateway:${AWS_REGION}:dynamodb:action/GetItem`,
      credentials: roleArn,
      passthroughBehavior: 'WHEN_NO_MATCH',
      requestTemplates: {
        'application/json': `{
  "TableName": "${tableName}",
  "Key": {
    "id": {
      "S": "$input.params('key')"
    }
  }
}`,
      },
    })
  );

  await apiGatewayClient.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
      },
    })
  );

  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,x-api-key'",
        'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
      },
      responseTemplates: {
        'application/json': `#set($item = $input.path('$.Item'))
{
  "id": "$item.id.S",
  "nom": "$item.nom.S",
  "type": "$item.type.S",
  "pavillon": "$item.pavillon.S",
  "taille": "$item.taille.N",
  "nombre_marins": "$item.nombre_marins.N",
  "s3_image_key": "$item.s3_image_key.S"
}`,
      },
    })
  );
}

async function configureGetShipPhoto(
  apiId: string,
  resourceId: string,
  bucketName: string,
  roleArn: string
): Promise<void> {
  await apiGatewayClient.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'GET',
      authorizationType: 'NONE',
      requestParameters: {
        'method.request.path.key': true,
      },
    })
  );

  await apiGatewayClient.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'GET',
      type: 'AWS',
      integrationHttpMethod: 'GET',
      uri: `arn:aws:apigateway:${AWS_REGION}:s3:path/{bucket}/{object}`,
      credentials: roleArn,
      passthroughBehavior: 'WHEN_NO_MATCH',
      requestParameters: {
        'integration.request.path.bucket': `'${bucketName}'`,
        'integration.request.path.object': 'method.request.path.key',
      },
    })
  );

  await apiGatewayClient.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Content-Type': true,
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
      },
    })
  );

  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Content-Type': 'integration.response.header.Content-Type',
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,x-api-key'",
        'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
      },
    })
  );
}

async function configureOptionsMethod(apiId: string, resourceId: string, allowedMethods: string): Promise<void> {
  await apiGatewayClient.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'OPTIONS',
      authorizationType: 'NONE',
    })
  );

  await apiGatewayClient.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'OPTIONS',
      type: 'MOCK',
      passthroughBehavior: 'WHEN_NO_MATCH',
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    })
  );

  await apiGatewayClient.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'OPTIONS',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    })
  );

  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'OPTIONS',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,x-api-key'",
        'method.response.header.Access-Control-Allow-Methods': `'${allowedMethods}'`,
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
    })
  );
}

deploy();
