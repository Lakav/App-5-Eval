#!/usr/bin/env node

/**
 * Script de monitoring pour observer l'auto-scaling en temps réel
 * Affiche l'état des instances, métriques CPU et alarmes CloudWatch
 */

const { EC2Client, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const {
  AutoScalingClient,
  DescribeAutoScalingGroupsCommand,
} = require('@aws-sdk/client-auto-scaling');
const {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  DescribeAlarmsCommand,
} = require('@aws-sdk/client-cloudwatch');

// Configuration AWS
const region = process.env.AWS_REGION || 'eu-west-1';
const profile = 'aws-labs-admin';

const ec2Client = new EC2Client({ region, profile });
const asgClient = new AutoScalingClient({ region, profile });
const cloudWatchClient = new CloudWatchClient({ region, profile });

const ASG_NAME = 'Demo-WebServers-ASG';

/**
 * Récupère les informations de l'Auto Scaling Group
 */
async function getAutoScalingGroupInfo() {
  try {
    const command = new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: [ASG_NAME],
    });

    const response = await asgClient.send(command);
    return response.AutoScalingGroups[0];
  } catch (error) {
    console.error("❌ Erreur lors de la récupération de l'ASG:", error.message);
    return null;
  }
}

/**
 * Récupère les détails des instances EC2
 */
async function getInstanceDetails(instanceIds) {
  if (!instanceIds || instanceIds.length === 0) {
    return [];
  }

  try {
    const command = new DescribeInstancesCommand({
      InstanceIds: instanceIds,
    });

    const response = await ec2Client.send(command);
    const instances = [];

    response.Reservations.forEach(reservation => {
      reservation.Instances.forEach(instance => {
        instances.push({
          instanceId: instance.InstanceId,
          state: instance.State.Name,
          availabilityZone: instance.Placement.AvailabilityZone,
          publicIp: instance.PublicIpAddress,
          launchTime: instance.LaunchTime,
        });
      });
    });

    return instances;
  } catch (error) {
    console.error(
      '❌ Erreur lors de la récupération des détails des instances:',
      error.message
    );
    return [];
  }
}

/**
 * Récupère les métriques CPU moyennes de l'ASG
 */
async function getCPUMetrics() {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 30 * 60 * 1000); // 30 minutes

    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/EC2',
      MetricName: 'CPUUtilization',
      Dimensions: [
        {
          Name: 'AutoScalingGroupName',
          Value: ASG_NAME,
        },
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: 300, // 5 minutes
      Statistics: ['Average'],
    });

    const response = await cloudWatchClient.send(command);
    return response.Datapoints.sort((a, b) => b.Timestamp - a.Timestamp);
  } catch (error) {
    console.error(
      '❌ Erreur lors de la récupération des métriques CPU:',
      error.message
    );
    return [];
  }
}

/**
 * Récupère l'état des alarmes CloudWatch
 */
async function getAlarmStates() {
  try {
    const command = new DescribeAlarmsCommand({
      AlarmNames: ['Demo-High-CPU-Utilization', 'Demo-Low-CPU-Utilization'],
    });

    const response = await cloudWatchClient.send(command);
    return response.MetricAlarms;
  } catch (error) {
    console.error(
      '❌ Erreur lors de la récupération des alarmes:',
      error.message
    );
    return [];
  }
}

/**
 * Formate la durée depuis le lancement
 */
function formatDuration(launchTime) {
  const now = new Date();
  const diff = now - new Date(launchTime);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

/**
 * Affiche le statut de l'auto-scaling
 */
async function displayScalingStatus() {
  console.clear();
  console.log('🔄 Monitoring Auto Scaling - Démonstration Load Balancer');
  console.log('='.repeat(70));
  console.log(`⏰ Dernière mise à jour: ${new Date().toLocaleTimeString()}`);
  console.log('');

  // Informations de l'Auto Scaling Group
  const asgInfo = await getAutoScalingGroupInfo();
  if (!asgInfo) {
    console.log(
      '❌ Auto Scaling Group non trouvé. Vérifiez que la stack est déployée.'
    );
    return;
  }

  console.log('📊 Auto Scaling Group Status:');
  console.log(`   Nom: ${asgInfo.AutoScalingGroupName}`);
  console.log(`   Capacité désirée: ${asgInfo.DesiredCapacity}`);
  console.log(`   Capacité actuelle: ${asgInfo.Instances.length}`);
  console.log(`   Min: ${asgInfo.MinSize} | Max: ${asgInfo.MaxSize}`);
  console.log('');

  // Détails des instances
  const instanceIds = asgInfo.Instances.map(i => i.InstanceId);
  const instanceDetails = await getInstanceDetails(instanceIds);

  console.log('🖥️  Instances EC2:');
  if (instanceDetails.length === 0) {
    console.log('   Aucune instance trouvée');
  } else {
    instanceDetails.forEach((instance, index) => {
      const healthStatus =
        asgInfo.Instances.find(i => i.InstanceId === instance.instanceId)
          ?.HealthStatus || 'Unknown';
      const lifecycleState =
        asgInfo.Instances.find(i => i.InstanceId === instance.instanceId)
          ?.LifecycleState || 'Unknown';
      const duration = formatDuration(instance.launchTime);

      console.log(`   ${index + 1}. ${instance.instanceId}`);
      console.log(
        `      État: ${instance.state} | Santé: ${healthStatus} | Cycle: ${lifecycleState}`
      );
      console.log(
        `      Zone: ${instance.availabilityZone} | IP: ${instance.publicIp || 'N/A'}`
      );
      console.log(`      Lancée il y a: ${duration}`);
      console.log('');
    });
  }

  // Métriques CPU
  const cpuMetrics = await getCPUMetrics();
  console.log('📈 Métriques CPU (dernières 30 minutes):');
  if (cpuMetrics.length === 0) {
    console.log('   Aucune métrique disponible');
  } else {
    const latestMetric = cpuMetrics[0];
    console.log(`   CPU actuel: ${latestMetric.Average.toFixed(1)}%`);
    console.log(
      `   Dernière mesure: ${latestMetric.Timestamp.toLocaleTimeString()}`
    );

    if (cpuMetrics.length > 1) {
      console.log('   Historique récent:');
      cpuMetrics.slice(0, 5).forEach(metric => {
        console.log(
          `     ${metric.Timestamp.toLocaleTimeString()}: ${metric.Average.toFixed(1)}%`
        );
      });
    }
  }
  console.log('');

  // État des alarmes
  const alarms = await getAlarmStates();
  console.log('🚨 Alarmes CloudWatch:');
  if (alarms.length === 0) {
    console.log('   Aucune alarme trouvée');
  } else {
    alarms.forEach(alarm => {
      const stateIcon =
        alarm.StateValue === 'ALARM'
          ? '🔴'
          : alarm.StateValue === 'OK'
            ? '🟢'
            : '🟡';
      console.log(`   ${stateIcon} ${alarm.AlarmName}: ${alarm.StateValue}`);
      if (alarm.StateReason) {
        console.log(`      Raison: ${alarm.StateReason}`);
      }
    });
  }
  console.log('');

  // Instructions
  console.log('💡 Instructions:');
  console.log('   - Appuyez sur Ctrl+C pour arrêter le monitoring');
  console.log(
    '   - Lancez "npm run simulate-load" pour déclencher l\'auto-scaling'
  );
  console.log(
    "   - L'auto-scaling se déclenche quand CPU > 70% pendant 10 minutes"
  );
  console.log(
    '   - Le scale-down se déclenche quand CPU < 25% pendant 10 minutes'
  );
}

/**
 * Fonction principale avec boucle de monitoring
 */
async function main() {
  console.log('🚀 Démarrage du monitoring auto-scaling...');
  console.log('Appuyez sur Ctrl+C pour arrêter');

  // Affichage initial
  await displayScalingStatus();

  // Mise à jour toutes les 30 secondes
  const interval = setInterval(async () => {
    await displayScalingStatus();
  }, 30000);

  // Gestion de l'arrêt propre
  process.on('SIGINT', () => {
    console.log('\\n\\n👋 Arrêt du monitoring...');
    clearInterval(interval);
    process.exit(0);
  });
}

// Exécuter le script
if (require.main === module) {
  main().catch(error => {
    console.error("❌ Erreur lors de l'exécution:", error.message);
    process.exit(1);
  });
}
