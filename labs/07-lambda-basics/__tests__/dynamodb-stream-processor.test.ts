import { handler } from '../src/dynamodb-stream-processor';
import { DynamoDBStreamEvent, Context } from 'aws-lambda';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');

describe('DynamoDB Stream Processor Lambda', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'dynamodb-stream-processor',
    functionVersion: '$LATEST',
    invokedFunctionArn:
      'arn:aws:lambda:eu-west-1:123456789012:function:dynamodb-stream-processor',
    memoryLimitInMB: '512',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/dynamodb-stream-processor',
    logStreamName: '2024/01/12/[$LATEST]test-stream',
    getRemainingTimeInMillis: () => 60000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  const mockInsertEvent: DynamoDBStreamEvent = {
    Records: [
      {
        eventID: 'test-event-1',
        eventName: 'INSERT',
        eventVersion: '1.1',
        eventSource: 'aws:dynamodb',
        awsRegion: 'eu-west-1',
        dynamodb: {
          ApproximateCreationDateTime: 1642000000,
          Keys: {
            id: { S: 'test-item-1' },
          },
          NewImage: {
            id: { S: 'test-item-1' },
            name: { S: 'Test Item' },
            status: { S: 'active' },
          },
          SequenceNumber: '123456789',
          SizeBytes: 100,
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
      },
    ],
  };

  const mockModifyEvent: DynamoDBStreamEvent = {
    Records: [
      {
        eventID: 'test-event-2',
        eventName: 'MODIFY',
        eventVersion: '1.1',
        eventSource: 'aws:dynamodb',
        awsRegion: 'eu-west-1',
        dynamodb: {
          ApproximateCreationDateTime: 1642000000,
          Keys: {
            id: { S: 'test-item-1' },
          },
          OldImage: {
            id: { S: 'test-item-1' },
            name: { S: 'Test Item' },
            status: { S: 'active' },
          },
          NewImage: {
            id: { S: 'test-item-1' },
            name: { S: 'Test Item' },
            status: { S: 'updated' },
          },
          SequenceNumber: '123456790',
          SizeBytes: 120,
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Set environment variable for S3 bucket
    process.env.HISTORY_BUCKET_NAME = 'test-history-bucket';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.HISTORY_BUCKET_NAME;
  });

  it('should process INSERT event successfully', async () => {
    // Mock S3 response
    const { S3Client } = require('@aws-sdk/client-s3');
    const mockSend = jest.fn().mockResolvedValue({});
    S3Client.prototype.send = mockSend;

    await expect(handler(mockInsertEvent, mockContext)).resolves.not.toThrow();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should process MODIFY event with OLD and NEW images', async () => {
    const { S3Client } = require('@aws-sdk/client-s3');
    const mockSend = jest.fn().mockResolvedValue({});
    S3Client.prototype.send = mockSend;

    await expect(handler(mockModifyEvent, mockContext)).resolves.not.toThrow();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple records in one event', async () => {
    const multiRecordEvent: DynamoDBStreamEvent = {
      Records: [mockInsertEvent.Records[0], mockModifyEvent.Records[0]],
    };

    const { S3Client } = require('@aws-sdk/client-s3');
    const mockSend = jest.fn().mockResolvedValue({});
    S3Client.prototype.send = mockSend;

    await expect(handler(multiRecordEvent, mockContext)).resolves.not.toThrow();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should throw error when HISTORY_BUCKET_NAME is not set', async () => {
    delete process.env.HISTORY_BUCKET_NAME;

    await expect(handler(mockInsertEvent, mockContext)).rejects.toThrow(
      'HISTORY_BUCKET_NAME environment variable not set'
    );
  });

  it('should handle S3 upload errors', async () => {
    const { S3Client } = require('@aws-sdk/client-s3');
    const mockSend = jest.fn().mockRejectedValue(new Error('S3 upload failed'));
    S3Client.prototype.send = mockSend;

    await expect(handler(mockInsertEvent, mockContext)).rejects.toThrow(
      'S3 upload failed'
    );
  });

  it('should handle records without Keys gracefully', async () => {
    const eventWithoutKeys: DynamoDBStreamEvent = {
      Records: [
        {
          ...mockInsertEvent.Records[0],
          dynamodb: {
            ...mockInsertEvent.Records[0].dynamodb!,
            Keys: undefined,
          },
        },
      ],
    };

    const { S3Client } = require('@aws-sdk/client-s3');
    const mockSend = jest.fn().mockResolvedValue({});
    S3Client.prototype.send = mockSend;

    await expect(handler(eventWithoutKeys, mockContext)).resolves.not.toThrow();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
