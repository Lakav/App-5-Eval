#!/bin/bash

# API Gateway Lab Cleanup Script
# This script helps students clean up AWS resources created during the lab

set -e

echo "🧹 API Gateway Lab - Cleanup Script"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install AWS CLI first.${NC}"
    exit 1
fi

# Check if AWS profile is set
if [ -z "$AWS_PROFILE" ]; then
    echo -e "${YELLOW}⚠️  AWS_PROFILE not set. Using default profile.${NC}"
    echo "   Recommended: export AWS_PROFILE=aws-labs"
    echo ""
fi

# Function to prompt for confirmation
confirm() {
    read -p "$1 (y/N): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# Function to empty an S3 bucket
empty_s3_bucket() {
    local bucket_name="$1"
    echo "   Emptying bucket: $bucket_name"
    
    # Delete all object versions and delete markers
    aws s3api list-object-versions --bucket "$bucket_name" --query 'Versions[].{Key:Key,VersionId:VersionId}' --output text 2>/dev/null | while read -r key version_id; do
        if [ -n "$key" ] && [ -n "$version_id" ]; then
            aws s3api delete-object --bucket "$bucket_name" --key "$key" --version-id "$version_id" >/dev/null 2>&1 || true
        fi
    done
    
    # Delete all delete markers
    aws s3api list-object-versions --bucket "$bucket_name" --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' --output text 2>/dev/null | while read -r key version_id; do
        if [ -n "$key" ] && [ -n "$version_id" ]; then
            aws s3api delete-object --bucket "$bucket_name" --key "$key" --version-id "$version_id" >/dev/null 2>&1 || true
        fi
    done
    
    # Delete all current objects (for non-versioned buckets)
    aws s3 rm "s3://$bucket_name" --recursive >/dev/null 2>&1 || true
    
    echo "   ✅ Bucket emptied: $bucket_name"
}

# Function to find and delete S3 buckets
cleanup_s3_buckets() {
    echo "🪣 Looking for S3 buckets..."
    
    # Find buckets that match common lab patterns
    local bucket_patterns=("api-gateway-lab" "student-lab" "s3-content")
    local found_buckets=()
    
    for pattern in "${bucket_patterns[@]}"; do
        buckets=$(aws s3 ls | grep "$pattern" | awk '{print $3}' 2>/dev/null || echo "")
        if [ -n "$buckets" ]; then
            while IFS= read -r bucket; do
                if [ -n "$bucket" ]; then
                    found_buckets+=("$bucket")
                fi
            done <<< "$buckets"
        fi
    done
    
    # Also check for buckets with lab-related tags
    all_buckets=$(aws s3api list-buckets --query 'Buckets[].Name' --output text 2>/dev/null || echo "")
    for bucket in $all_buckets; do
        tags=$(aws s3api get-bucket-tagging --bucket "$bucket" --query 'TagSet[?Key==`project`].Value' --output text 2>/dev/null || echo "")
        if [[ "$tags" == *"api-gateway"* ]] || [[ "$tags" == *"lab"* ]]; then
            found_buckets+=("$bucket")
        fi
    done
    
    # Remove duplicates
    local unique_buckets=($(printf "%s\n" "${found_buckets[@]}" | sort -u))
    
    if [ ${#unique_buckets[@]} -eq 0 ]; then
        echo "   No lab-related S3 buckets found."
        return
    fi
    
    echo "   Found S3 buckets to delete:"
    for bucket in "${unique_buckets[@]}"; do
        echo "   - $bucket"
    done
    echo ""
    
    if confirm "Empty and delete these S3 buckets?"; then
        for bucket in "${unique_buckets[@]}"; do
            echo "   Processing bucket: $bucket"
            empty_s3_bucket "$bucket"
            echo "   Deleting bucket: $bucket"
            aws s3api delete-bucket --bucket "$bucket" 2>/dev/null || echo "   ⚠️  Failed to delete bucket $bucket (may have remaining objects or dependencies)"
        done
        echo -e "${GREEN}✅ S3 buckets cleanup completed.${NC}"
    else
        echo "   Skipped S3 buckets cleanup."
    fi
}

# Function to list and delete API Gateway APIs
cleanup_api_gateway() {
    echo ""
    echo "🔍 Looking for API Gateway APIs..."
    
    # Get list of APIs with common lab naming patterns
    local api_patterns=("s3-content-api" "api-gateway-lab" "student-api")
    local found_apis=()
    
    for pattern in "${api_patterns[@]}"; do
        apis=$(aws apigateway get-rest-apis --query "items[?contains(name, '$pattern')].[id,name]" --output text 2>/dev/null || echo "")
        if [ -n "$apis" ]; then
            while IFS=$'\t' read -r api_id api_name; do
                if [ -n "$api_id" ] && [ -n "$api_name" ]; then
                    found_apis+=("$api_id:$api_name")
                fi
            done <<< "$apis"
        fi
    done
    
    # Also find APIs with lab-related tags
    all_apis=$(aws apigateway get-rest-apis --query 'items[].[id,name]' --output text 2>/dev/null || echo "")
    while IFS=$'\t' read -r api_id api_name; do
        if [ -n "$api_id" ]; then
            tags=$(aws apigateway get-tags --resource-arn "arn:aws:apigateway:$(aws configure get region)::/restapis/$api_id" --query 'tags.project' --output text 2>/dev/null || echo "")
            if [[ "$tags" == *"api-gateway"* ]] || [[ "$tags" == *"lab"* ]]; then
                found_apis+=("$api_id:$api_name")
            fi
        fi
    done <<< "$all_apis"
    
    # Remove duplicates
    local unique_apis=($(printf "%s\n" "${found_apis[@]}" | sort -u))
    
    if [ ${#unique_apis[@]} -eq 0 ]; then
        echo "   No lab-related API Gateway APIs found."
        return
    fi
    
    echo "   Found API Gateway APIs to delete:"
    for api_entry in "${unique_apis[@]}"; do
        IFS=':' read -r api_id api_name <<< "$api_entry"
        echo "   - $api_name ($api_id)"
    done
    echo ""
    
    if confirm "Delete these API Gateway APIs?"; then
        for api_entry in "${unique_apis[@]}"; do
            IFS=':' read -r api_id api_name <<< "$api_entry"
            if [ -n "$api_id" ]; then
                echo "   Deleting API: $api_name ($api_id)"
                aws apigateway delete-rest-api --rest-api-id "$api_id" 2>/dev/null || echo "   ⚠️  Failed to delete API $api_id"
            fi
        done
        echo -e "${GREEN}✅ API Gateway cleanup completed.${NC}"
    else
        echo "   Skipped API Gateway cleanup."
    fi
}

# Function to list and delete API Keys
cleanup_api_keys() {
    echo ""
    echo "🔑 Looking for API Keys..."
    
    # Get list of API keys with common lab naming patterns
    local key_patterns=("s3-api-key" "api-gateway-lab" "student-key" "lab-key")
    local found_keys=()
    
    for pattern in "${key_patterns[@]}"; do
        keys=$(aws apigateway get-api-keys --query "items[?contains(name, '$pattern')].[id,name]" --output text 2>/dev/null || echo "")
        if [ -n "$keys" ]; then
            while IFS=$'\t' read -r key_id key_name; do
                if [ -n "$key_id" ] && [ -n "$key_name" ]; then
                    found_keys+=("$key_id:$key_name")
                fi
            done <<< "$keys"
        fi
    done
    
    # Remove duplicates
    local unique_keys=($(printf "%s\n" "${found_keys[@]}" | sort -u))
    
    if [ ${#unique_keys[@]} -eq 0 ]; then
        echo "   No lab-related API keys found."
        return
    fi
    
    echo "   Found API Keys to delete:"
    for key_entry in "${unique_keys[@]}"; do
        IFS=':' read -r key_id key_name <<< "$key_entry"
        echo "   - $key_name ($key_id)"
    done
    echo ""
    
    if confirm "Delete these API Keys?"; then
        for key_entry in "${unique_keys[@]}"; do
            IFS=':' read -r key_id key_name <<< "$key_entry"
            if [ -n "$key_id" ]; then
                echo "   Deleting API Key: $key_name ($key_id)"
                aws apigateway delete-api-key --api-key "$key_id" 2>/dev/null || echo "   ⚠️  Failed to delete API key $key_id"
            fi
        done
        echo -e "${GREEN}✅ API Keys cleanup completed.${NC}"
    else
        echo "   Skipped API Keys cleanup."
    fi
}

# Function to list and delete Usage Plans
cleanup_usage_plans() {
    echo ""
    echo "📊 Looking for Usage Plans..."
    
    # Get list of usage plans with common lab naming patterns
    local plan_patterns=("s3-api-plan" "api-gateway-lab" "student-plan" "lab-plan")
    local found_plans=()
    
    for pattern in "${plan_patterns[@]}"; do
        plans=$(aws apigateway get-usage-plans --query "items[?contains(name, '$pattern')].[id,name]" --output text 2>/dev/null || echo "")
        if [ -n "$plans" ]; then
            while IFS=$'\t' read -r plan_id plan_name; do
                if [ -n "$plan_id" ] && [ -n "$plan_name" ]; then
                    found_plans+=("$plan_id:$plan_name")
                fi
            done <<< "$plans"
        fi
    done
    
    # Remove duplicates
    local unique_plans=($(printf "%s\n" "${found_plans[@]}" | sort -u))
    
    if [ ${#unique_plans[@]} -eq 0 ]; then
        echo "   No lab-related usage plans found."
        return
    fi
    
    echo "   Found Usage Plans to delete:"
    for plan_entry in "${unique_plans[@]}"; do
        IFS=':' read -r plan_id plan_name <<< "$plan_entry"
        echo "   - $plan_name ($plan_id)"
    done
    echo ""
    
    if confirm "Delete these Usage Plans?"; then
        for plan_entry in "${unique_plans[@]}"; do
            IFS=':' read -r plan_id plan_name <<< "$plan_entry"
            if [ -n "$plan_id" ]; then
                echo "   Deleting Usage Plan: $plan_name ($plan_id)"
                aws apigateway delete-usage-plan --usage-plan-id "$plan_id" 2>/dev/null || echo "   ⚠️  Failed to delete usage plan $plan_id"
            fi
        done
        echo -e "${GREEN}✅ Usage Plans cleanup completed.${NC}"
    else
        echo "   Skipped Usage Plans cleanup."
    fi
}

# Function to list and delete IAM roles
cleanup_iam_roles() {
    echo ""
    echo "🔐 Looking for IAM Roles..."
    
    # Common IAM role patterns for this lab
    local role_patterns=("APIGatewayS3ReadRole" "APIGatewayS3ServiceRole" "api-gateway-lab" "s3-api-role")
    local found_roles=()
    
    for pattern in "${role_patterns[@]}"; do
        # Check if role exists
        if aws iam get-role --role-name "$pattern" >/dev/null 2>&1; then
            found_roles+=("$pattern")
        fi
    done
    
    # Also search for roles with lab-related tags or names
    all_roles=$(aws iam list-roles --query 'Roles[].RoleName' --output text 2>/dev/null || echo "")
    for role in $all_roles; do
        if [[ "$role" == *"lab"* ]] || [[ "$role" == *"Lab"* ]] || [[ "$role" == *"student"* ]]; then
            # Check if it's related to API Gateway or S3
            role_policy=$(aws iam list-attached-role-policies --role-name "$role" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
            if [[ "$role_policy" == *"s3"* ]] || [[ "$role_policy" == *"S3"* ]] || [[ "$role_policy" == *"apigateway"* ]]; then
                found_roles+=("$role")
            fi
        fi
    done
    
    # Remove duplicates
    local unique_roles=($(printf "%s\n" "${found_roles[@]}" | sort -u))
    
    if [ ${#unique_roles[@]} -eq 0 ]; then
        echo "   No lab-related IAM roles found."
        return
    fi
    
    echo "   Found IAM Roles to delete:"
    for role in "${unique_roles[@]}"; do
        echo "   - $role"
    done
    echo ""
    
    if confirm "Delete these IAM roles?"; then
        for role in "${unique_roles[@]}"; do
            echo "   Processing IAM role: $role"
            
            # Detach managed policies
            attached_policies=$(aws iam list-attached-role-policies --role-name "$role" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
            if [ -n "$attached_policies" ]; then
                for policy_arn in $attached_policies; do
                    echo "     Detaching policy: $policy_arn"
                    aws iam detach-role-policy --role-name "$role" --policy-arn "$policy_arn" 2>/dev/null || echo "     ⚠️  Failed to detach policy"
                done
            fi
            
            # Delete inline policies
            inline_policies=$(aws iam list-role-policies --role-name "$role" --query 'PolicyNames' --output text 2>/dev/null || echo "")
            if [ -n "$inline_policies" ]; then
                for policy_name in $inline_policies; do
                    echo "     Deleting inline policy: $policy_name"
                    aws iam delete-role-policy --role-name "$role" --policy-name "$policy_name" 2>/dev/null || echo "     ⚠️  Failed to delete inline policy"
                done
            fi
            
            echo "     Deleting IAM role: $role"
            aws iam delete-role --role-name "$role" 2>/dev/null || echo "     ⚠️  Failed to delete IAM role $role"
        done
        echo -e "${GREEN}✅ IAM roles cleanup completed.${NC}"
    else
        echo "   Skipped IAM roles cleanup."
    fi
}

# Main cleanup process
echo "This script will help you clean up AWS resources created during the API Gateway lab."
echo ""
echo -e "${YELLOW}⚠️  Warning: This will delete AWS resources and empty S3 buckets. Make sure you want to proceed.${NC}"
echo ""

if ! confirm "Do you want to continue with the cleanup?"; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "Starting cleanup process..."

# Run cleanup functions in order (dependencies first)
cleanup_usage_plans
cleanup_api_keys
cleanup_api_gateway
cleanup_iam_roles
cleanup_s3_buckets

echo ""
echo "🎉 Cleanup process completed!"
echo ""
echo -e "${YELLOW}📝 Don't forget to:${NC}"
echo "   1. Check the AWS Console to verify all resources are deleted"
echo "   2. Review your AWS bill to ensure no unexpected charges"
echo "   3. If any resources failed to delete, check for dependencies and try manual deletion"
echo ""
echo -e "${BLUE}💡 Pro tip: Use AWS Config or AWS Resource Groups to track resources by tags in future labs!${NC}"
echo ""
echo "Thank you for completing the API Gateway lab! 🚀"