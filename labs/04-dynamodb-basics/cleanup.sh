#!/bin/bash

echo "🧹 Cleaning up DynamoDB lab resources..."

# Note: The TypeScript script should handle table deletion automatically
# This script is provided as a backup cleanup method

# Check if AWS CLI is available and profile is set
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please ensure it's installed."
    exit 1
fi

if [ -z "$AWS_PROFILE" ]; then
    echo "⚠️  AWS_PROFILE not set. Using default profile."
fi

# List any remaining DynamoDB tables that might match our lab pattern
echo "📋 Checking for remaining DynamoDB tables..."
aws dynamodb list-tables --query 'TableNames[?contains(@, `coffee-shop`)]' --output table

echo "✅ Cleanup script completed."
echo "💡 If any tables remain, delete them manually via the AWS Console or CLI."