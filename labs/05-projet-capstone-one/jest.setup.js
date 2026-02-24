/**
 * Configuration Jest pour les tests AWS
 */

// Configuration des timeouts pour les opérations AWS
jest.setTimeout(30000);

// Configuration des variables d'environnement pour les tests
process.env.AWS_PROFILE = 'aws-labs';
process.env.AWS_REGION = 'eu-west-1';
process.env.NODE_ENV = 'test';

// TODO: Ajoutez des mocks si nécessaire pour les tests unitaires
// Par exemple, pour mocker les services AWS :

// jest.mock('@aws-sdk/client-dynamodb');
// jest.mock('@aws-sdk/client-s3');
// jest.mock('@aws-sdk/client-apigateway');

console.log('Jest configuré pour les tests AWS');
console.log(`Profil AWS: ${process.env.AWS_PROFILE}`);
console.log(`Région AWS: ${process.env.AWS_REGION}`);
