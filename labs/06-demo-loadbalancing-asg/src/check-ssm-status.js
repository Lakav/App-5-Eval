#!/usr/bin/env node

/**
 * Script pour vérifier le statut SSM des instances
 * Utile pour diagnostiquer les problèmes de connexion SSM
 */

const { execSync } = require('child_process');

const AWS_PROFILE = 'aws-labs';
const ASG_NAME = 'Demo-WebServers-ASG';

/**
 * Exécute une commande AWS CLI et retourne le résultat
 */
function runAwsCommand(command) {
  try {
    const result = execSync(`${command} --profile ${AWS_PROFILE}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (error) {
    console.error(`❌ Erreur lors de l'exécution de la commande: ${command}`);
    console.error(`   ${error.message}`);
    return null;
  }
}

/**
 * Récupère les instances de l'Auto Scaling Group
 */
function getAutoScalingInstances() {
  console.log("🔍 Recherche des instances de l'Auto Scaling Group...");

  const command = `aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names ${ASG_NAME} --query 'AutoScalingGroups[0].Instances[?LifecycleState==\`InService\`].{InstanceId:InstanceId,AvailabilityZone:AvailabilityZone,HealthStatus:HealthStatus}' --output json`;

  const result = runAwsCommand(command);
  if (!result) {
    return [];
  }

  try {
    return JSON.parse(result);
  } catch (error) {
    console.error('❌ Erreur lors du parsing des instances:', error.message);
    return [];
  }
}

/**
 * Vérifie le statut SSM des instances
 */
function checkSSMStatus(instanceIds) {
  if (!instanceIds || instanceIds.length === 0) {
    console.log('❌ Aucune instance à vérifier');
    return [];
  }

  console.log('🔍 Vérification du statut SSM des instances...');

  const command = `aws ssm describe-instance-information --filters "Key=InstanceIds,Values=${instanceIds.join(',')}" --query 'InstanceInformationList[].{InstanceId:InstanceId,PingStatus:PingStatus,LastPingDateTime:LastPingDateTime,AgentVersion:AgentVersion,PlatformType:PlatformType}' --output json`;

  const result = runAwsCommand(command);
  if (!result) {
    return [];
  }

  try {
    return JSON.parse(result);
  } catch (error) {
    console.error('❌ Erreur lors du parsing du statut SSM:', error.message);
    return [];
  }
}

/**
 * Fonction principale
 */
function main() {
  console.log('🔍 Vérification du statut SSM des instances');
  console.log('='.repeat(50));

  // Vérifier que AWS CLI est configuré
  const identity = runAwsCommand('aws sts get-caller-identity');
  if (!identity) {
    console.log("❌ AWS CLI n'est pas configuré correctement");
    console.log('Vérifiez votre profil AWS et votre session SSO');
    process.exit(1);
  }

  console.log('✅ AWS CLI configuré correctement');
  console.log('');

  // Récupérer les instances de l'ASG
  const instances = getAutoScalingInstances();

  if (instances.length === 0) {
    console.log("⚠️  Aucune instance trouvée dans l'Auto Scaling Group");
    console.log(
      "Vérifiez que la stack CloudFormation est déployée et que les instances sont en cours d'exécution"
    );
    return;
  }

  console.log(`📊 ${instances.length} instance(s) trouvée(s) dans l'ASG:`);
  instances.forEach((instance, index) => {
    console.log(
      `   ${index + 1}. ${instance.InstanceId} - ${instance.AvailabilityZone} (Santé: ${instance.HealthStatus})`
    );
  });
  console.log('');

  // Vérifier le statut SSM
  const instanceIds = instances.map(i => i.InstanceId);
  const ssmStatus = checkSSMStatus(instanceIds);

  console.log('🔧 Statut SSM des instances:');
  if (ssmStatus.length === 0) {
    console.log("❌ Aucune instance n'est enregistrée dans SSM");
    console.log('');
    console.log('💡 Solutions possibles:');
    console.log(
      "   1. Attendre quelques minutes que les instances s'enregistrent"
    );
    console.log(
      '   2. Vérifier que le rôle IAM inclut AmazonSSMManagedInstanceCore'
    );
    console.log("   3. Vérifier que l'agent SSM est installé et démarré");
    console.log('   4. Redéployer la stack avec les corrections SSM');
    console.log('');
    console.log('🔄 Commandes pour redéployer:');
    console.log('   npm run cleanup');
    console.log('   npm run deploy');
  } else {
    ssmStatus.forEach((status, index) => {
      const pingIcon = status.PingStatus === 'Online' ? '🟢' : '🔴';
      const lastPing = status.LastPingDateTime
        ? new Date(status.LastPingDateTime).toLocaleString()
        : 'Jamais';

      console.log(`   ${index + 1}. ${status.InstanceId}`);
      console.log(`      ${pingIcon} Statut: ${status.PingStatus}`);
      console.log(`      📅 Dernier ping: ${lastPing}`);
      console.log(`      🔧 Version agent: ${status.AgentVersion || 'N/A'}`);
      console.log(`      💻 Plateforme: ${status.PlatformType || 'N/A'}`);
      console.log('');
    });

    const onlineInstances = ssmStatus.filter(s => s.PingStatus === 'Online');

    if (onlineInstances.length === instances.length) {
      console.log('✅ Toutes les instances sont prêtes pour SSM!');
      console.log('🚀 Vous pouvez maintenant lancer: npm run simulate-load');
    } else {
      console.log(
        `⚠️  ${onlineInstances.length}/${instances.length} instance(s) prête(s) pour SSM`
      );
      console.log(
        '⏳ Attendez quelques minutes et relancez cette vérification'
      );
    }
  }

  console.log('');
  console.log('🔍 Pour plus de détails, consultez:');
  console.log('   - Console AWS > Systems Manager > Fleet Manager');
  console.log('   - Console AWS > EC2 > Instances (onglet "Systems Manager")');
}

// Exécuter le script
if (require.main === module) {
  main();
}
