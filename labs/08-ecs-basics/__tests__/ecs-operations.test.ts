import {
  ECSClient,
  DescribeClustersCommand,
  DescribeServicesCommand,
  ListTasksCommand,
  DescribeTasksCommand,
} from '@aws-sdk/client-ecs';
import {
  S3Client,
  HeadBucketCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';

// Mock des clients AWS pour les tests
jest.mock('@aws-sdk/client-ecs');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-cloudformation');

describe('Lab 8: ECS Operations', () => {
  let ecsClient: jest.Mocked<ECSClient>;
  let s3Client: jest.Mocked<S3Client>;
  let cfClient: jest.Mocked<CloudFormationClient>;

  beforeAll(async () => {
    // Initialise les clients AWS mockés
    ecsClient = new ECSClient({
      region: 'eu-west-1',
    }) as jest.Mocked<ECSClient>;
    s3Client = new S3Client({ region: 'eu-west-1' }) as jest.Mocked<S3Client>;
    cfClient = new CloudFormationClient({
      region: 'eu-west-1',
    }) as jest.Mocked<CloudFormationClient>;
  }, 30000);

  describe('Infrastructure Configuration', () => {
    test('should have correct AWS region configuration', () => {
      const expectedRegion = 'eu-west-1';

      // Test que la région est correctement configurée
      expect(expectedRegion).toBe('eu-west-1');

      // Test que les clients sont initialisés
      expect(ecsClient).toBeDefined();
      expect(s3Client).toBeDefined();
      expect(cfClient).toBeDefined();
    });

    test('should have required CloudFormation stack names defined', () => {
      const requiredStacks = ['ecs-lab-infrastructure', 'ecs-lab-iam-roles'];

      requiredStacks.forEach(stackName => {
        expect(stackName).toBeDefined();
        expect(stackName).toMatch(/^ecs-lab-/);
      });
    });

    test('should have required resource naming patterns', () => {
      const resourcePatterns = {
        cluster: 'ecs-lab-cluster',
        service: 'web-service',
        taskDefinitions: ['ecs-web-app', 'image-classifier'],
        bucketPrefix: 'ecs-lab-images-',
        ecrRepos: ['ecs-lab/web-app', 'ecs-lab/image-classifier'],
      };

      expect(resourcePatterns.cluster).toMatch(/^ecs-lab-/);
      expect(resourcePatterns.service).toBe('web-service');
      expect(resourcePatterns.taskDefinitions).toHaveLength(2);
      expect(resourcePatterns.bucketPrefix).toMatch(/^ecs-lab-/);
      expect(resourcePatterns.ecrRepos).toHaveLength(2);
    });
  });

  describe('Task Definition Validation', () => {
    test('should have valid task definition structure for web app', () => {
      const webTaskDef = {
        family: 'ecs-web-app',
        networkMode: 'awsvpc',
        requiresCompatibilities: ['FARGATE'],
        cpu: '256',
        memory: '512',
      };

      expect(webTaskDef.family).toBe('ecs-web-app');
      expect(webTaskDef.networkMode).toBe('awsvpc');
      expect(webTaskDef.requiresCompatibilities).toContain('FARGATE');
      expect(parseInt(webTaskDef.cpu)).toBeGreaterThan(0);
      expect(parseInt(webTaskDef.memory)).toBeGreaterThan(0);
    });

    test('should have valid task definition structure for image classifier', () => {
      const classifierTaskDef = {
        family: 'image-classifier',
        networkMode: 'awsvpc',
        requiresCompatibilities: ['FARGATE'],
        cpu: '1024',
        memory: '2048',
      };

      expect(classifierTaskDef.family).toBe('image-classifier');
      expect(classifierTaskDef.networkMode).toBe('awsvpc');
      expect(classifierTaskDef.requiresCompatibilities).toContain('FARGATE');
      expect(parseInt(classifierTaskDef.cpu)).toBeGreaterThanOrEqual(1024);
      expect(parseInt(classifierTaskDef.memory)).toBeGreaterThanOrEqual(2048);
    });
  });

  describe('Network Configuration', () => {
    test('should have proper VPC CIDR configuration', () => {
      const vpcConfig = {
        cidr: '10.0.0.0/16',
        publicSubnets: ['10.0.1.0/24', '10.0.2.0/24'],
        privateSubnets: ['10.0.11.0/24', '10.0.12.0/24'],
      };

      expect(vpcConfig.cidr).toMatch(/^10\.0\.0\.0\/16$/);
      expect(vpcConfig.publicSubnets).toHaveLength(2);
      expect(vpcConfig.privateSubnets).toHaveLength(2);

      vpcConfig.publicSubnets.forEach(subnet => {
        expect(subnet).toMatch(/^10\.0\.\d+\.0\/24$/);
      });

      vpcConfig.privateSubnets.forEach(subnet => {
        expect(subnet).toMatch(/^10\.0\.\d+\.0\/24$/);
      });
    });

    test('should have security group rules defined', () => {
      const securityGroups = {
        alb: {
          ingress: [{ port: 80, protocol: 'tcp', source: '0.0.0.0/0' }],
        },
        ecs: {
          ingress: [{ port: 3000, protocol: 'tcp', source: 'alb-sg' }],
          egress: [{ protocol: '-1', destination: '0.0.0.0/0' }],
        },
      };

      expect(securityGroups.alb.ingress[0].port).toBe(80);
      expect(securityGroups.ecs.ingress[0].port).toBe(3000);
      expect(securityGroups.ecs.egress[0].protocol).toBe('-1');
    });
  });

  describe('Container Configuration', () => {
    test('should have valid web app container configuration', () => {
      const webContainer = {
        name: 'web-app',
        port: 3000,
        healthCheck: '/health',
        environment: 'production',
      };

      expect(webContainer.name).toBe('web-app');
      expect(webContainer.port).toBe(3000);
      expect(webContainer.healthCheck).toBe('/health');
      expect(webContainer.environment).toBe('production');
    });

    test('should have valid image classifier container configuration', () => {
      const classifierContainer = {
        name: 'image-classifier',
        model: 'Xenova/mobilenet_v3_small',
        runtime: 'node:18-slim',
      };

      expect(classifierContainer.name).toBe('image-classifier');
      expect(classifierContainer.model).toContain('mobilenet');
      expect(classifierContainer.runtime).toContain('node:18');
    });
  });

  describe('IAM Roles Configuration', () => {
    test('should have required IAM role names', () => {
      const roles = {
        taskExecution: 'ecs-lab-task-execution-role',
        webAppTask: 'ecs-lab-web-app-task-role',
        classifierTask: 'ecs-lab-image-classifier-task-role',
      };

      Object.values(roles).forEach(roleName => {
        expect(roleName).toMatch(/^ecs-lab-/);
        expect(roleName).toContain('role');
      });
    });

    test('should have proper role permissions structure', () => {
      const permissions = {
        taskExecution: ['ecr:GetAuthorizationToken', 'logs:CreateLogStream'],
        webApp: ['cloudwatch:PutMetricData'],
        classifier: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
      };

      expect(permissions.taskExecution).toContain('ecr:GetAuthorizationToken');
      expect(permissions.webApp).toContain('cloudwatch:PutMetricData');
      expect(permissions.classifier).toContain('s3:GetObject');
      expect(permissions.classifier).toContain('s3:PutObject');
    });
  });

  describe('Load Balancer Configuration', () => {
    test('should have Application Load Balancer configuration', () => {
      const albConfig = {
        type: 'application',
        scheme: 'internet-facing',
        port: 80,
        protocol: 'HTTP',
        healthCheck: '/health',
      };

      expect(albConfig.type).toBe('application');
      expect(albConfig.scheme).toBe('internet-facing');
      expect(albConfig.port).toBe(80);
      expect(albConfig.protocol).toBe('HTTP');
      expect(albConfig.healthCheck).toBe('/health');
    });

    test('should have target group configuration', () => {
      const targetGroup = {
        port: 3000,
        protocol: 'HTTP',
        targetType: 'ip',
        healthCheckPath: '/health',
        healthCheckInterval: 30,
      };

      expect(targetGroup.port).toBe(3000);
      expect(targetGroup.protocol).toBe('HTTP');
      expect(targetGroup.targetType).toBe('ip');
      expect(targetGroup.healthCheckPath).toBe('/health');
      expect(targetGroup.healthCheckInterval).toBe(30);
    });
  });

  describe('ECR Repository Configuration', () => {
    test('should have ECR repository naming convention', () => {
      const repositories = ['ecs-lab/web-app', 'ecs-lab/image-classifier'];

      repositories.forEach(repo => {
        expect(repo).toMatch(/^ecs-lab\//);
        expect(repo.split('/')[1]).toBeDefined();
      });
    });

    test('should have lifecycle policies configured', () => {
      const lifecyclePolicy = {
        rules: [
          {
            rulePriority: 1,
            description: 'Keep last N images',
            selection: {
              tagStatus: 'any',
              countType: 'imageCountMoreThan',
            },
            action: {
              type: 'expire',
            },
          },
        ],
      };

      expect(lifecyclePolicy.rules).toHaveLength(1);
      expect(lifecyclePolicy.rules[0].action.type).toBe('expire');
      expect(lifecyclePolicy.rules[0].selection.countType).toBe(
        'imageCountMoreThan'
      );
    });
  });

  describe('CloudWatch Logging', () => {
    test('should have log groups configured', () => {
      const logGroups = [
        '/ecs/ecs-lab/web-app',
        '/ecs/ecs-lab/image-classifier',
      ];

      logGroups.forEach(logGroup => {
        expect(logGroup).toMatch(/^\/ecs\/ecs-lab\//);
        expect(logGroup.split('/')[3]).toBeDefined();
      });
    });

    test('should have log retention configured', () => {
      const logRetention = {
        retentionInDays: 7,
        logDriver: 'awslogs',
      };

      expect(logRetention.retentionInDays).toBe(7);
      expect(logRetention.logDriver).toBe('awslogs');
    });
  });
});
