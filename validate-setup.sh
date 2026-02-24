#!/bin/bash

# AWS Labs Setup Validation Script (Shell Wrapper)
# This script provides a convenient way to run the validation

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed or not in PATH"
    echo "Please install Node.js v18+ from https://nodejs.org/"
    exit 1
fi

# Run the validation script
node shared/validate-setup.js "$@"