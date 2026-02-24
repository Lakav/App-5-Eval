import { handler } from '../src/s3-processor';
import { EventBridgeEvent, Context } from 'aws-lambda';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');

describe('S3 Processor Lambda', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 's3-file-processor',
    functionVersion: '$LATEST',
    invokedFunctionArn:
      'arn:aws:lambda:eu-west-1:123456789012:function:s3-file-processor',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/s3-file-processor',
    logStreamName: '2024/01/12/[$LATEST]test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  const mockEvent: EventBridgeEvent<'Object Created', any> = {
    version: '0',
    id: 'test-event-id',
    'detail-type': 'Object Created',
    source: 'aws.s3',
    account: '123456789012',
    time: '2024-01-12T10:00:00Z',
    region: 'eu-west-1',
    resources: [],
    detail: {
      bucket: {
        name: 'test-bucket',
      },
      object: {
        key: 'data.json',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should process valid JSON file successfully', async () => {
    // Mock S3 response
    const mockS3Response = {
      Body: {
        transformToString: jest.fn().mockResolvedValue('{"test": "data"}'),
      },
      ContentLength: 16,
      LastModified: new Date(),
      ContentType: 'application/json',
    };

    const { S3Client } = require('@aws-sdk/client-s3');
    const mockSend = jest.fn().mockResolvedValue(mockS3Response);
    S3Client.prototype.send = mockSend;

    await expect(handler(mockEvent, mockContext)).resolves.not.toThrow();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should ignore non-JSON files', async () => {
    const eventWithTxtFile = {
      ...mockEvent,
      detail: {
        ...mockEvent.detail,
        object: {
          key: 'document.txt',
        },
      },
    };

    await expect(handler(eventWithTxtFile, mockContext)).resolves.not.toThrow();

    // S3 should not be called for non-JSON files
    const { S3Client } = require('@aws-sdk/client-s3');
    expect(S3Client.prototype.send).not.toHaveBeenCalled();
  });

  it('should handle S3 errors gracefully', async () => {
    const { S3Client } = require('@aws-sdk/client-s3');
    const mockSend = jest.fn().mockRejectedValue(new Error('S3 access denied'));
    S3Client.prototype.send = mockSend;

    await expect(handler(mockEvent, mockContext)).rejects.toThrow(
      'S3 access denied'
    );
  });

  it('should handle invalid JSON gracefully', async () => {
    const mockS3Response = {
      Body: {
        transformToString: jest.fn().mockResolvedValue('invalid json content'),
      },
      ContentLength: 20,
      LastModified: new Date(),
      ContentType: 'application/json',
    };

    const { S3Client } = require('@aws-sdk/client-s3');
    const mockSend = jest.fn().mockResolvedValue(mockS3Response);
    S3Client.prototype.send = mockSend;

    // Should not throw, but should log the error
    await expect(handler(mockEvent, mockContext)).resolves.not.toThrow();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
