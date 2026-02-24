// Jest setup file for AWS Labs Repository
// This file runs before each test suite

// Set test environment variables
process.env.NODE_ENV = 'test';

// Mock AWS SDK calls by default to prevent accidental resource creation during tests
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-iot');
jest.mock('@aws-sdk/client-api-gateway');
jest.mock('@aws-sdk/client-ec2');
jest.mock('@aws-sdk/client-iam');

// Global test timeout
jest.setTimeout(30000);
