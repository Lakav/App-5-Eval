import {
  ECSClient,
  RegisterTaskDefinitionCommand,
  RunTaskCommand,
  DescribeTasksCommand,
  StopTaskCommand,
} from '@aws-sdk/client-ecs';
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';

/**
 * Solution complète pour la partie 2 du lab ECS
 * Classification d'images avec Xenova/mobilevit-small
 */
export class ImageClassifierOperations {
  private ecsClient: ECSClient;
  private cfClient: CloudFormationClient;
  private region: string;

  constructor(region: string = 'eu-west-1') {
    this.region = region;
    this.ecsClient = new ECSClient({ region: this.region });
    this.cfClient = new CloudFormationClient({ region: this.region });
  }

  /**
   * Récupère les informations depuis CloudFormation
   */
  async getStackOutputs(): Promise<Record<string, string>> {
    console.log('📋 Récupération des informations CloudFormation...');

    try {
      // Récupère les outputs de la stack infrastructure
      const infraResponse = await this.cfClient.send(
        new DescribeStacksCommand({
          StackName: 'ecs-lab-infrastructure',
        })
      );

      const infraStack = infraResponse.Stacks?.[0];
      if (!infraStack?.Outputs) {
        throw new Error('Infrastructure stack outputs not found');
      }

      // Récupère les outputs de la stack IAM
      const iamResponse = await this.cfClient.send(
        new DescribeStacksCommand({
          StackName: 'ecs-lab-iam-roles',
        })
      );

      const iamStack = iamResponse.Stacks?.[0];
      if (!iamStack?.Outputs) {
        throw new Error('IAM stack outputs not found');
      }

      // Combine les outputs des deux stacks
      const outputs: Record<string, string> = {};

      infraStack.Outputs.forEach(output => {
        if (output.OutputKey && output.OutputValue) {
          outputs[output.OutputKey] = output.OutputValue;
        }
      });

      iamStack.Outputs.forEach(output => {
        if (output.OutputKey && output.OutputValue) {
          outputs[output.OutputKey] = output.OutputValue;
        }
      });

      console.log('✅ Informations CloudFormation récupérées');
      return outputs;
    } catch (error) {
      console.error(
        '❌ Erreur lors de la récupération des outputs CloudFormation:',
        error
      );
      throw error;
    }
  }

  /**
   * Crée et enregistre la task definition pour le classificateur d'images
   */
  async registerImageClassifierTaskDefinition(
    ecrUri: string,
    taskRoleArn: string,
    executionRoleArn: string
  ): Promise<string> {
    console.log('📝 Enregistrement de la task definition...');

    try {
      const command = new RegisterTaskDefinitionCommand({
        family: 'image-classifier',
        networkMode: 'awsvpc',
        requiresCompatibilities: ['FARGATE'],
        cpu: '1024',
        memory: '2048',
        executionRoleArn: executionRoleArn,
        taskRoleArn: taskRoleArn,
        containerDefinitions: [
          {
            name: 'image-classifier',
            image: ecrUri,
            essential: true,
            command: ['node', 'classifier.js'],
            logConfiguration: {
              logDriver: 'awslogs',
              options: {
                'awslogs-group': '/ecs/ecs-lab/image-classifier',
                'awslogs-region': this.region,
                'awslogs-stream-prefix': 'ecs',
              },
            },
            environment: [
              {
                name: 'NODE_ENV',
                value: 'production',
              },
            ],
          },
        ],
        tags: [
          {
            key: 'git-repository',
            value:
              'https://github.com/soraskills/develop-for-the-cloud-labs.git',
          },
          {
            key: 'project',
            value: 'ecs-lab',
          },
          {
            key: 'environment',
            value: 'development',
          },
          {
            key: 'managed-by',
            value: 'aws-sdk',
          },
        ],
      });

      const response = await this.ecsClient.send(command);

      const taskDefArn = response.taskDefinition?.taskDefinitionArn;
      console.log(`✅ Task definition enregistrée: ${taskDefArn}`);

      return taskDefArn || '';
    } catch (error) {
      console.error(
        "❌ Erreur lors de l'enregistrement de la task definition:",
        error
      );
      throw error;
    }
  }

  /**
   * Exécute la tâche de classification d'images
   */
  async runImageClassificationTask(
    clusterName: string,
    taskDefinitionArn: string,
    subnetIds: string[],
    securityGroupId: string,
    imageUrl: string
  ): Promise<string> {
    console.log('🚀 Lancement de la tâche de classification...');
    console.log(`📸 Image à classifier: ${imageUrl}`);

    try {
      const command = new RunTaskCommand({
        cluster: clusterName,
        taskDefinition: taskDefinitionArn,
        launchType: 'FARGATE',
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: subnetIds,
            securityGroups: [securityGroupId],
            assignPublicIp: 'ENABLED', // Nécessaire pour accéder à Internet (Hugging Face)
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: 'image-classifier',
              command: ['node', 'classifier.js', imageUrl], // Passe l'URL en argument
            },
          ],
        },
        tags: [
          {
            key: 'git-repository',
            value:
              'https://github.com/soraskills/develop-for-the-cloud-labs.git',
          },
          {
            key: 'project',
            value: 'ecs-lab',
          },
          {
            key: 'environment',
            value: 'development',
          },
          {
            key: 'managed-by',
            value: 'aws-sdk',
          },
        ],
      });

      const response = await this.ecsClient.send(command);

      if (response.tasks && response.tasks.length > 0) {
        const task = response.tasks[0];
        if (!task) {
          throw new Error('Task object is undefined');
        }
        const taskArn = task.taskArn;
        console.log(`✅ Tâche lancée: ${taskArn}`);
        return taskArn || '';
      } else {
        throw new Error('Aucune tâche créée');
      }
    } catch (error) {
      console.error('❌ Erreur lors du lancement de la tâche:', error);
      throw error;
    }
  }

  /**
   * Surveille l'exécution d'une tâche
   */
  async monitorTask(clusterName: string, taskArn: string): Promise<void> {
    console.log('👀 Surveillance de la tâche...');

    const maxAttempts = 30; // 15 minutes maximum
    let attempts = 0;
    let lastStatus = '';

    while (attempts < maxAttempts) {
      try {
        const response = await this.ecsClient.send(
          new DescribeTasksCommand({
            cluster: clusterName,
            tasks: [taskArn],
          })
        );

        if (response.tasks && response.tasks.length > 0) {
          const task = response.tasks[0];
          if (!task) {
            throw new Error('Task object is undefined');
          }
          const status = task.lastStatus;

          // Affiche seulement si le statut a changé
          if (status !== lastStatus) {
            console.log(`📊 Status de la tâche: ${status}`);
            lastStatus = status || '';
          }

          if (status === 'STOPPED') {
            const exitCode = task.containers?.[0]?.exitCode;
            const stopReason = task.stoppedReason;

            if (exitCode === 0) {
              console.log('✅ Tâche terminée avec succès!');
              console.log(
                '\n💡 Consultez les logs CloudWatch pour voir les résultats:'
              );
              console.log(
                '   aws logs tail /ecs/ecs-lab/image-classifier --follow --profile aws-labs'
              );
              return;
            } else {
              console.log(`❌ Tâche échouée avec le code: ${exitCode}`);
              if (stopReason) {
                console.log(`   Raison: ${stopReason}`);
              }
              throw new Error(`Task failed with exit code ${exitCode}`);
            }
          }

          if (status === 'RUNNING') {
            console.log(
              "🔄 Tâche en cours d'exécution... (vérification dans 30s)"
            );
          }
        }

        // Attendre 30 secondes avant la prochaine vérification
        await new Promise(resolve => setTimeout(resolve, 30000));
        attempts++;
      } catch (error) {
        if (error instanceof Error && error.message.includes('Task failed')) {
          throw error;
        }
        console.error('❌ Erreur lors de la surveillance:', error);
        break;
      }
    }

    if (attempts >= maxAttempts) {
      console.log('⏰ Timeout de surveillance atteint');
      throw new Error('Task monitoring timeout');
    }
  }

  /**
   * Nettoie les ressources temporaires
   */
  async cleanup(clusterName: string, taskArn: string): Promise<void> {
    console.log('🧹 Nettoyage des ressources...');

    try {
      // Vérifier si la tâche est encore en cours
      const response = await this.ecsClient.send(
        new DescribeTasksCommand({
          cluster: clusterName,
          tasks: [taskArn],
        })
      );

      if (response.tasks && response.tasks.length > 0) {
        const task = response.tasks[0];
        if (task && task.lastStatus !== 'STOPPED') {
          await this.ecsClient.send(
            new StopTaskCommand({
              cluster: clusterName,
              task: taskArn,
              reason: 'Nettoyage du lab',
            })
          );
          console.log('✅ Tâche arrêtée');
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage:', error);
    }
  }
}

/**
 * Fonction principale pour exécuter la solution complète
 */
export async function runImageClassificationLab(): Promise<void> {
  const classifier = new ImageClassifierOperations();

  try {
    console.log("🚀 Début du lab de classification d'images...");

    // 1. Récupérer les informations CloudFormation
    const outputs = await classifier.getStackOutputs();

    console.log('\n📋 Outputs CloudFormation disponibles:');
    console.log(JSON.stringify(outputs, null, 2));

    // 2. URL de l'image à classifier (depuis Hugging Face)
    const imageUrl =
      'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg';

    console.log(`\n📸 Image à classifier: ${imageUrl}`);

    // 3. Enregistrer la task definition
    const classifierECRRepo = outputs['ClassifierECRRepository'];
    const imageClassifierTaskRole = outputs['ImageClassifierTaskRoleArn'];
    const ecsTaskExecutionRole = outputs['ECSTaskExecutionRoleArn'];

    if (!classifierECRRepo) {
      throw new Error(
        'ClassifierECRRepository output not found in CloudFormation stack'
      );
    }
    if (!imageClassifierTaskRole) {
      throw new Error(
        'ImageClassifierTaskRoleArn output not found in CloudFormation stack'
      );
    }
    if (!ecsTaskExecutionRole) {
      throw new Error(
        'ECSTaskExecutionRoleArn output not found in CloudFormation stack'
      );
    }

    const taskDefArn = await classifier.registerImageClassifierTaskDefinition(
      classifierECRRepo + ':latest',
      imageClassifierTaskRole,
      ecsTaskExecutionRole
    );

    // 4. Lancer la tâche
    const subnetIds = outputs['SubnetIds'];
    const ecsSecurityGroup = outputs['ECSSecurityGroup'];

    if (!subnetIds) {
      throw new Error('SubnetIds output not found in CloudFormation stack');
    }
    if (!ecsSecurityGroup) {
      throw new Error(
        'ECSSecurityGroup output not found in CloudFormation stack'
      );
    }

    const subnetArray = subnetIds.split(',');

    const taskArn = await classifier.runImageClassificationTask(
      'ecs-lab-cluster',
      taskDefArn,
      subnetArray,
      ecsSecurityGroup,
      imageUrl
    );

    // 5. Surveiller l'exécution
    await classifier.monitorTask('ecs-lab-cluster', taskArn);

    console.log("🎉 Lab de classification d'images terminé avec succès!");
  } catch (error) {
    console.error('❌ Erreur dans le lab:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  runImageClassificationLab();
}
