#!/usr/bin/env node

/**
 * Script de simulation de charge simplifié pour déclencher l'auto-scaling
 * Cette version utilise AWS CLI au lieu des SDK pour plus de simplicité
 */

const { execSync } = require('child_process');

const AWS_PROFILE = 'aws-labs-admin';
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

  const command = `aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names ${ASG_NAME} --query 'AutoScalingGroups[0].Instances[?LifecycleState==\`InService\`].{InstanceId:InstanceId,AvailabilityZone:AvailabilityZone}' --output json`;

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
 * Lance la simulation de charge sur une instance via AWS CLI
 */
function simulateLoadOnInstance(instanceId, availabilityZone) {
  console.log(
    `🔥 Lancement de la simulation de charge sur ${instanceId} (${availabilityZone})...`
  );

  // Commande pour lancer stress via SSM
  const stressCommand = `
echo "🔥 Démarrage de la simulation de charge CPU..."
echo "Cette simulation va consommer 80% du CPU pendant 10 minutes"
echo "Instance: $(curl -s http://169.254.169.254/latest/meta-data/instance-id)"
echo "AZ: $(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone)"

# Installer stress si pas déjà installé
if ! command -v stress &> /dev/null; then
    echo "Installation d'EPEL et stress..."
    sudo amazon-linux-extras install epel -y
    sudo yum install -y stress
fi

# Lancer stress en arrière-plan pour 10 minutes (600 secondes)
echo "Lancement de stress --cpu 1 --timeout 600s"
nohup stress --cpu 1 --timeout 600s > /tmp/stress.log 2>&1 &
STRESS_PID=$!
echo "Simulation de charge démarrée (PID: $STRESS_PID)"
echo "La simulation s'arrêtera automatiquement dans 10 minutes"
echo "Logs disponibles dans /tmp/stress.log"
    `.trim();

  // Encoder la commande en base64 pour éviter les problèmes d'échappement
  const encodedCommand = Buffer.from(stressCommand).toString('base64');

  const ssmCommand = `aws ssm send-command --instance-ids ${instanceId} --document-name "AWS-RunShellScript" --parameters 'commands=["echo \\"${encodedCommand}\\" | base64 -d | bash"]' --comment "Simulation de charge CPU pour démonstration auto-scaling" --output json`;

  const result = runAwsCommand(ssmCommand);
  if (result) {
    try {
      const commandResult = JSON.parse(result);
      console.log(
        `✅ Commande envoyée à ${instanceId}, Command ID: ${commandResult.Command.CommandId}`
      );
      return commandResult.Command.CommandId;
    } catch (error) {
      console.error(
        `❌ Erreur lors du parsing de la réponse SSM pour ${instanceId}:`,
        error.message
      );
    }
  }

  return null;
}

/**
 * Version alternative utilisant une approche plus simple
 */
function simulateLoadAlternative() {
  console.log(
    '🔥 Méthode alternative : Simulation de charge via script bash...'
  );

  // Créer un script bash temporaire
  const bashScript = `#!/bin/bash
# Script de simulation de charge pour toutes les instances de l'ASG

echo "🚀 Démarrage de la simulation de charge pour la démonstration auto-scaling"
echo "============================================================================"

# Récupérer les instances de l'ASG
INSTANCES=$(aws autoscaling describe-auto-scaling-groups \\
    --auto-scaling-group-names ${ASG_NAME} \\
    --query 'AutoScalingGroups[0].Instances[?LifecycleState==\`InService\`].InstanceId' \\
    --output text \\
    --profile ${AWS_PROFILE})

if [ -z "$INSTANCES" ]; then
    echo "❌ Aucune instance trouvée dans l'Auto Scaling Group"
    exit 1
fi

echo "📊 Instances trouvées: $INSTANCES"
echo ""

# Pour chaque instance, lancer la simulation de charge
for INSTANCE_ID in $INSTANCES; do
    echo "🔥 Lancement de la simulation sur $INSTANCE_ID..."
    
    aws ssm send-command \\
        --instance-ids $INSTANCE_ID \\
        --document-name "AWS-RunShellScript" \\
        --parameters 'commands=["echo \\"Démarrage simulation de charge CPU\\"; if ! command -v stress &> /dev/null; then sudo amazon-linux-extras install epel -y; sudo yum install -y stress; fi; nohup stress --cpu 1 --timeout 600s > /tmp/stress.log 2>&1 & echo \\"Simulation démarrée (PID: $!)\\"; echo \\"Logs dans /tmp/stress.log\\""]' \\
        --comment "Simulation de charge CPU - Demo Auto Scaling" \\
        --profile ${AWS_PROFILE} \\
        --output table
    
    echo "✅ Commande envoyée à $INSTANCE_ID"
    echo ""
done

echo "🎉 Simulation de charge lancée sur toutes les instances!"
echo ""
echo "📈 Que va-t-il se passer maintenant:"
echo "   1. Les instances vont consommer ~80% de CPU pendant 10 minutes"
echo "   2. CloudWatch va détecter la haute utilisation CPU (seuil: 70%)"
echo "   3. L'alarme va déclencher l'auto-scaling après ~5-10 minutes"
echo "   4. De nouvelles instances seront créées automatiquement"
echo "   5. Le Load Balancer intégrera les nouvelles instances"
echo ""
echo "🔍 Pour surveiller l'auto-scaling:"
echo "   - Console AWS > EC2 > Auto Scaling Groups"
echo "   - Console AWS > CloudWatch > Alarms"
echo "   - Console AWS > EC2 > Load Balancers"
echo ""
echo "⏱️  La simulation s'arrêtera automatiquement dans 10 minutes"
`;

  // Écrire le script dans un fichier temporaire
  require('fs').writeFileSync('/tmp/simulate-load.sh', bashScript);
  require('fs').chmodSync('/tmp/simulate-load.sh', '755');

  // Exécuter le script
  try {
    execSync('bash /tmp/simulate-load.sh', { stdio: 'inherit' });
  } catch (error) {
    console.error("❌ Erreur lors de l'exécution du script:", error.message);
  }
}

/**
 * Fonction principale
 */
function main() {
  console.log(
    '🚀 Démarrage de la simulation de charge pour la démonstration auto-scaling'
  );
  console.log('='.repeat(70));

  // Vérifier que AWS CLI est configuré
  const identity = runAwsCommand('aws sts get-caller-identity');
  if (!identity) {
    console.log("❌ AWS CLI n'est pas configuré correctement");
    console.log('Vérifiez votre profil AWS et votre session SSO');
    process.exit(1);
  }

  console.log('✅ AWS CLI configuré correctement');
  console.log('');

  // Récupérer les instances
  const instances = getAutoScalingInstances();

  if (instances.length === 0) {
    console.log("⚠️  Aucune instance trouvée dans l'Auto Scaling Group");
    console.log(
      "Vérifiez que la stack CloudFormation est déployée et que les instances sont en cours d'exécution"
    );
    console.log('');
    console.log('💡 Utilisation de la méthode alternative...');
    simulateLoadAlternative();
    return;
  }

  console.log(`📊 ${instances.length} instance(s) trouvée(s):`);
  instances.forEach((instance, index) => {
    console.log(
      `   ${index + 1}. ${instance.InstanceId} - ${instance.AvailabilityZone}`
    );
  });

  console.log(
    '\\n🔥 Lancement de la simulation de charge sur toutes les instances...'
  );

  // Lancer la simulation sur toutes les instances
  let successCount = 0;
  instances.forEach(instance => {
    const commandId = simulateLoadOnInstance(
      instance.InstanceId,
      instance.AvailabilityZone
    );
    if (commandId) {
      successCount++;
    }
  });

  if (successCount === 0) {
    console.log("\\n⚠️  Aucune commande n'a pu être envoyée via SSM");
    console.log('💡 Utilisation de la méthode alternative...');
    simulateLoadAlternative();
    return;
  }

  console.log(
    `\\n✅ Simulation de charge lancée sur ${successCount}/${instances.length} instance(s)!`
  );
  console.log('\\n📈 Que va-t-il se passer maintenant:');
  console.log(
    '   1. Les instances vont consommer ~80% de CPU pendant 10 minutes'
  );
  console.log(
    '   2. CloudWatch va détecter la haute utilisation CPU (seuil: 70%)'
  );
  console.log(
    "   3. L'alarme va déclencher l'auto-scaling après ~5-10 minutes"
  );
  console.log('   4. De nouvelles instances seront créées automatiquement');
  console.log('   5. Le Load Balancer intégrera les nouvelles instances');

  console.log("\\n🔍 Pour surveiller l'auto-scaling:");
  console.log('   - Console AWS > EC2 > Auto Scaling Groups');
  console.log('   - Console AWS > CloudWatch > Alarms');
  console.log('   - Console AWS > EC2 > Load Balancers');

  console.log(
    "\\n⏱️  La simulation s'arrêtera automatiquement dans 10 minutes"
  );
  console.log(
    '   Les instances reviendront alors à une utilisation CPU normale'
  );
}

// Exécuter le script
if (require.main === module) {
  main();
}
