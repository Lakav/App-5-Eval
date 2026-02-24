import {
  createBucket,
  uploadFile,
  downloadFile,
  listObjects,
} from '../src/s3-operations';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';

// Mock AWS SDK pour les tests unitaires
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  CreateBucketCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn(),
}));

describe('S3 Operations', () => {
  const testFilePath = './test-upload.txt';
  const downloadPath = './test-download.txt';
  const testContent = 'Contenu de test pour S3';

  beforeAll(() => {
    // Créer un fichier de test
    writeFileSync(testFilePath, testContent);
  });

  afterAll(() => {
    // Nettoyer les fichiers de test
    try {
      if (existsSync(testFilePath)) unlinkSync(testFilePath);
      if (existsSync(downloadPath)) unlinkSync(downloadPath);
    } catch (error) {
      console.warn('Erreur lors du nettoyage des fichiers:', error);
    }
  });

  test('should have createBucket function', () => {
    expect(typeof createBucket).toBe('function');
  });

  test('should have uploadFile function', () => {
    expect(typeof uploadFile).toBe('function');
  });

  test('should have downloadFile function', () => {
    expect(typeof downloadFile).toBe('function');
  });

  test('should have listObjects function', () => {
    expect(typeof listObjects).toBe('function');
  });

  test('should create test file successfully', () => {
    expect(existsSync(testFilePath)).toBe(true);
    const content = readFileSync(testFilePath, 'utf-8');
    expect(content).toBe(testContent);
  });
});
