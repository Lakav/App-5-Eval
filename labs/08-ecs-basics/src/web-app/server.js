const express = require('express');
const AWS = require('aws-sdk');
const os = require('os');
const http = require('http');

const app = express();
const port = process.env.PORT || 3000;

// Configuration AWS
AWS.config.update({ region: process.env.AWS_DEFAULT_REGION || 'eu-west-1' });

// Middleware pour parser JSON
app.use(express.json());

// Variables pour les statistiques
let requestCount = 0;
const startTime = new Date();

// Cache pour les métadonnées ECS
let ecsMetadata = null;
let ecsMetadataError = null;

// Fonction pour récupérer les métadonnées ECS
async function fetchECSMetadata() {
  const metadataUri = process.env.ECS_CONTAINER_METADATA_URI_V4;

  if (!metadataUri) {
    return {
      error: 'Not running in ECS (ECS_CONTAINER_METADATA_URI_V4 not set)',
    };
  }

  return new Promise(resolve => {
    // Récupérer les métadonnées du conteneur
    http
      .get(metadataUri, res => {
        let containerData = '';
        res.on('data', chunk => {
          containerData += chunk;
        });
        res.on('end', () => {
          // Récupérer les métadonnées de la tâche
          http
            .get(`${metadataUri}/task`, taskRes => {
              let taskData = '';
              taskRes.on('data', chunk => {
                taskData += chunk;
              });
              taskRes.on('end', () => {
                try {
                  const container = JSON.parse(containerData);
                  const task = JSON.parse(taskData);
                  resolve({
                    container: {
                      name: container.Name,
                      dockerId: container.DockerId?.substring(0, 12),
                      image: container.Image,
                      imageID: container.ImageID?.substring(0, 12),
                      createdAt: container.CreatedAt,
                      startedAt: container.StartedAt,
                    },
                    task: {
                      taskARN: task.TaskARN,
                      family: task.Family,
                      revision: task.Revision,
                      cluster: task.Cluster,
                      availabilityZone: task.AvailabilityZone,
                      launchType: task.LaunchType,
                      desiredStatus: task.DesiredStatus,
                      knownStatus: task.KnownStatus,
                    },
                  });
                } catch (err) {
                  resolve({
                    error: 'Failed to parse ECS metadata',
                    details: err.message,
                  });
                }
              });
            })
            .on('error', err => {
              resolve({
                error: 'Failed to fetch task metadata',
                details: err.message,
              });
            });
        });
      })
      .on('error', err => {
        resolve({
          error: 'Failed to fetch container metadata',
          details: err.message,
        });
      });
  });
}

// Récupérer les métadonnées au démarrage
(async () => {
  try {
    ecsMetadata = await fetchECSMetadata();
    if (ecsMetadata.error) {
      ecsMetadataError = ecsMetadata.error;
      console.log('ECS Metadata:', ecsMetadataError);
    } else {
      console.log('ECS Metadata loaded successfully');
      console.log('Availability Zone:', ecsMetadata.task?.availabilityZone);
      console.log('Task ARN:', ecsMetadata.task?.taskARN);
    }
  } catch (err) {
    ecsMetadataError = err.message;
    console.error('Error fetching ECS metadata:', err);
  }
})();

// Route de santé pour le load balancer
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Route principale
app.get('/', (req, res) => {
  requestCount++;

  const response = {
    message: "Bienvenue sur l'application ECS Lab!",
    container: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
    },
    ecs: ecsMetadata || { error: ecsMetadataError || 'Metadata not available' },
    stats: {
      requestCount: requestCount,
      uptime: process.uptime(),
      startTime: startTime.toISOString(),
      memoryUsage: process.memoryUsage(),
    },
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  };

  res.json(response);
});

// Route d'informations sur le conteneur
app.get('/info', (req, res) => {
  requestCount++;

  const response = {
    container: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
      freeMemory: Math.round(os.freemem() / 1024 / 1024) + ' MB',
      loadAverage: os.loadavg(),
      uptime: os.uptime(),
    },
    ecs: ecsMetadata || { error: ecsMetadataError || 'Metadata not available' },
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
        AWS_REGION: process.env.AWS_REGION,
        ECS_CONTAINER_METADATA_URI_V4: process.env.ECS_CONTAINER_METADATA_URI_V4
          ? 'Set'
          : 'Not set',
      },
    },
    stats: {
      requestCount: requestCount,
      startTime: startTime.toISOString(),
    },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
});

// Route de test de charge
app.get('/load-test', (req, res) => {
  requestCount++;

  // Simulation d'une charge CPU
  const iterations = parseInt(req.query.iterations) || 1000000;
  const start = Date.now();

  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i);
  }

  const duration = Date.now() - start;

  res.json({
    message: 'Test de charge terminé',
    iterations: iterations,
    duration: duration + ' ms',
    result: Math.round(result),
    container: os.hostname(),
    timestamp: new Date().toISOString(),
  });
});

// Route pour simuler une erreur
app.get('/error', (req, res) => {
  requestCount++;
  console.error("Erreur simulée demandée par l'utilisateur");
  res.status(500).json({
    error: 'Erreur simulée',
    container: os.hostname(),
    timestamp: new Date().toISOString(),
  });
});

// Middleware de gestion d'erreurs
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    container: os.hostname(),
    timestamp: new Date().toISOString(),
  });
});

// Gestion des signaux pour un arrêt propre
process.on('SIGTERM', () => {
  console.log('Signal SIGTERM reçu, arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Signal SIGINT reçu, arrêt du serveur...');
  process.exit(0);
});

// Démarrage du serveur
app.listen(port, '0.0.0.0', () => {
  console.log(`Serveur démarré sur le port ${port}`);
  console.log(`Hostname: ${os.hostname()}`);
  console.log(`Node.js version: ${process.version}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`AWS Region: ${process.env.AWS_DEFAULT_REGION || 'eu-west-1'}`);
});
