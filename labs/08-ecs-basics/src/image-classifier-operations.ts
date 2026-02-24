import {
  ECSClient,
  // TODO: Décommentez les imports suivants quand vous implémentez les méthodes correspondantes
  // RegisterTaskDefinitionCommand,
  // RunTaskCommand,
  // DescribeTasksCommand,
} from '@aws-sdk/client-ecs';
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';

/**
 * Classe pour les opérations de classification d'images avec ECS
 *
 * À IMPLÉMENTER: Les étudiants doivent compléter les méthodes marquées avec TODO
 */
export class ImageClassifierOperations {
  // TODO: Cette propriété sera utilisée dans vos implémentations
  // @ts-ignore - Will be used by students in their implementation
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
   * Cette méthode est déjà implémentée pour vous
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
   * TODO: Créer et enregistrer la task definition pour le classificateur d'images
   *
   * Utilisez la documentation AWS SDK v3 pour TypeScript :
   * https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ecs/command/RegisterTaskDefinitionCommand/
   *
   * La task definition doit inclure :
   * - family: 'image-classifier'
   * - networkMode: 'awsvpc'
   * - requiresCompatibilities: ['FARGATE']
   * - cpu: '1024'
   * - memory: '2048'
   * - executionRoleArn: le rôle d'exécution ECS
   * - taskRoleArn: le rôle de tâche pour le classificateur
   * - containerDefinitions avec :
   *   - name: 'image-classifier'
   *   - image: l'URI ECR fournie
   *   - command: ['node', 'classifier.js'] (sera overridé lors de l'exécution)
   *   - logConfiguration pour CloudWatch
   *   - environment variables pour NODE_ENV
   *
   * @param ecrUri URI de l'image ECR
   * @param taskRoleArn ARN du rôle de tâche
   * @param executionRoleArn ARN du rôle d'exécution
   * @returns ARN de la task definition créée
   */
  async registerImageClassifierTaskDefinition(
    ecrUri: string,
    taskRoleArn: string,
    executionRoleArn: string
  ): Promise<string> {
    console.log('📝 Enregistrement de la task definition...');

    // TODO: Implémentez cette méthode
    // Créez l'objet taskDefinition avec toutes les propriétés requises
    // Utilisez RegisterTaskDefinitionCommand pour l'enregistrer
    // Retournez l'ARN de la task definition créée

    throw new Error('Méthode à implémenter');
  }

  /**
   * TODO: Exécuter la tâche de classification d'images
   *
   * Utilisez la documentation AWS SDK v3 pour TypeScript :
   * https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ecs/command/RunTaskCommand/
   *
   * La tâche doit être configurée avec :
   * - cluster: le nom du cluster ECS
   * - taskDefinition: l'ARN de la task definition
   * - launchType: 'FARGATE'
   * - networkConfiguration avec les subnets et security groups
   *   IMPORTANT: assignPublicIp doit être 'ENABLED' pour accéder à Internet
   * - overrides pour passer l'URL de l'image en argument de commande :
   *   - containerOverrides avec command: ['node', 'classifier.js', imageUrl]
   *   (équivalent à: docker run image-classifier node classifier.js $IMAGE_URL)
   *
   * @param clusterName Nom du cluster ECS
   * @param taskDefinitionArn ARN de la task definition
   * @param subnetIds IDs des subnets
   * @param securityGroupId ID du security group
   * @param imageUrl URL HTTPS de l'image à classifier
   * @returns ARN de la tâche lancée
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

    // TODO: Implémentez cette méthode
    // Créez la commande RunTaskCommand avec tous les paramètres
    // Configurez les overrides pour passer la variable d'environnement IMAGE_URL
    // IMPORTANT: Assurez-vous que assignPublicIp est 'ENABLED'
    // Retournez l'ARN de la tâche créée

    throw new Error('Méthode à implémenter');
  }

  /**
   * TODO: Surveiller l'exécution d'une tâche
   *
   * Utilisez la documentation AWS SDK v3 pour TypeScript :
   * https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ecs/command/DescribeTasksCommand/
   *
   * Cette méthode doit :
   * - Vérifier périodiquement le statut de la tâche
   * - Afficher les mises à jour de statut
   * - Se terminer quand la tâche est STOPPED
   * - Vérifier le code de sortie pour déterminer le succès/échec
   *
   * @param clusterName Nom du cluster ECS
   * @param taskArn ARN de la tâche à surveiller
   */
  async monitorTask(_clusterName: string, _taskArn: string): Promise<void> {
    console.log('👀 Surveillance de la tâche...');

    // TODO: Implémentez cette méthode
    // Utilisez une boucle pour vérifier périodiquement le statut
    // Utilisez DescribeTasksCommand pour obtenir les détails de la tâche
    // Attendez entre les vérifications avec setTimeout
    // Affichez les changements de statut

    throw new Error('Méthode à implémenter');
  }
}

/**
 * Fonction principale pour exécuter le lab de classification d'images
 * Cette fonction est déjà implémentée et utilise vos méthodes
 */
export async function runImageClassificationLab(): Promise<void> {
  const classifier = new ImageClassifierOperations();

  try {
    console.log("🚀 Début du lab de classification d'images...");

    // 1. Récupérer les informations CloudFormation
    const outputs = await classifier.getStackOutputs();

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

    // Convertit la chaîne de subnets en tableau
    const subnetArray = subnetIds.split(',');

    const taskArn = await classifier.runImageClassificationTask(
      'ecs-lab-cluster',
      taskDefArn,
      subnetArray,
      ecsSecurityGroup,
      imageUrl
    );

    // 5. Surveiller l'exécution (À IMPLÉMENTER)
    await classifier.monitorTask('ecs-lab-cluster', taskArn);

    console.log("🎉 Lab de classification d'images terminé avec succès!");
    console.log(
      '\n💡 Consultez les logs CloudWatch pour voir les résultats de classification:'
    );
    console.log('   aws logs tail /ecs/ecs-lab/image-classifier --follow');
  } catch (error) {
    console.error('❌ Erreur dans le lab:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  runImageClassificationLab();
}
