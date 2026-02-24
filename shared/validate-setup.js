#!/usr/bin/env node

/**
 * AWS Labs Setup Validation Script
 *
 * This script validates that the AWS SSO setup is working correctly
 * and all prerequisites are met for running the labs.
 */

const { execSync } = require('child_process');
const fs = require('fs');

// ANSI color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

// Helper function to print colored output
function print(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper function to run shell commands safely
function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
    return { success: true, output: result };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      output: error.stdout || error.stderr || '',
    };
  }
}

// Validation functions
async function validateAwsCli() {
  print('\n1. Checking AWS CLI installation...', 'blue');

  const result = runCommand('aws --version', { silent: true });

  if (result.success) {
    const version = result.output.trim();
    print(`✅ AWS CLI is installed: ${version}`, 'green');

    // Check if it's version 2
    if (version.includes('aws-cli/2.')) {
      print('✅ AWS CLI v2 detected (recommended)', 'green');
    } else {
      print(
        '⚠️  AWS CLI v1 detected. Consider upgrading to v2 for SSO support',
        'yellow'
      );
    }
    return true;
  } else {
    print('❌ AWS CLI is not installed or not in PATH', 'red');
    print('Please install AWS CLI v2 following the SETUP.md guide', 'yellow');
    return false;
  }
}

async function validateSsoProfile() {
  print('\n2. Checking AWS SSO profile configuration...', 'blue');

  const profileFlag = process.env.AWS_PROFILE ? '' : '--profile aws-labs';
  const result = runCommand(`aws configure list ${profileFlag}`, {
    silent: true,
  });

  if (result.success) {
    const profileName = process.env.AWS_PROFILE || 'aws-labs';
    print(`✅ AWS profile "${profileName}" is configured`, 'green');

    // Show profile details
    const profileInfo = result.output;
    if (profileInfo.includes('sso_')) {
      print('✅ SSO configuration detected in profile', 'green');
    } else {
      print('⚠️  Profile exists but may not be configured for SSO', 'yellow');
    }
    return true;
  } else {
    print('❌ AWS profile "aws-labs" is not configured', 'red');
    print('Run: aws configure sso', 'yellow');
    return false;
  }
}

async function validateSsoSession() {
  print('\n3. Checking AWS SSO session status...', 'blue');

  const profileFlag = process.env.AWS_PROFILE ? '' : '--profile aws-labs';
  const result = runCommand(`aws sts get-caller-identity ${profileFlag}`, {
    silent: true,
  });

  if (result.success) {
    print('✅ SSO session is active', 'green');

    try {
      const identity = JSON.parse(result.output);
      print(`   Account: ${identity.Account}`, 'blue');
      print(`   User: ${identity.Arn.split('/').pop()}`, 'blue');
      print(`   Role: ${identity.Arn.split('/')[1]}`, 'blue');
    } catch (e) {
      print('   (Could not parse identity details)', 'yellow');
    }
    return true;
  } else {
    print('❌ SSO session is not active or expired', 'red');
    const loginCmd = process.env.AWS_PROFILE
      ? 'aws sso login'
      : 'aws sso login --profile aws-labs';
    print(`Run: ${loginCmd}`, 'yellow');
    return false;
  }
}

async function validateNodeJs() {
  print('\n4. Checking Node.js installation...', 'blue');

  const nodeResult = runCommand('node --version', { silent: true });
  const npmResult = runCommand('npm --version', { silent: true });

  if (nodeResult.success && npmResult.success) {
    const nodeVersion = nodeResult.output.trim();
    const npmVersion = npmResult.output.trim();

    print(`✅ Node.js is installed: ${nodeVersion}`, 'green');
    print(`✅ npm is installed: ${npmVersion}`, 'green');

    // Check Node.js version (should be 18+)
    const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
    if (majorVersion >= 18) {
      print('✅ Node.js version is compatible (18+)', 'green');
    } else {
      print('⚠️  Node.js version is older than recommended (18+)', 'yellow');
    }
    return true;
  } else {
    print('❌ Node.js or npm is not installed', 'red');
    print('Please install Node.js v18+ from https://nodejs.org/', 'yellow');
    return false;
  }
}

async function validateDependencies() {
  print('\n5. Checking project dependencies...', 'blue');

  // Check if we're in the right directory
  if (!fs.existsSync('package.json')) {
    print(
      '⚠️  Not in repository directory or package.json not found',
      'yellow'
    );
    return false;
  }

  // Check if node_modules exists
  if (!fs.existsSync('node_modules')) {
    print('⚠️  Dependencies not installed', 'yellow');
    print('Run: npm install', 'yellow');
    return false;
  }

  // Try to run npm list to check dependency health
  const result = runCommand('npm list --depth=0', { silent: true });

  if (result.success) {
    print('✅ npm dependencies are installed and healthy', 'green');
    return true;
  } else {
    print('⚠️  Some dependencies may have issues', 'yellow');
    print('Consider running: npm install', 'yellow');
    return false;
  }
}

async function validateAwsServices() {
  print('\n6. Testing AWS service access...', 'blue');

  // Test S3 access (should work even if no buckets exist)
  const profileFlag = process.env.AWS_PROFILE ? '' : '--profile aws-labs';
  const s3Result = runCommand(`aws s3 ls ${profileFlag}`, { silent: true });

  if (s3Result.success) {
    print('✅ S3 service access confirmed', 'green');
  } else {
    print('⚠️  S3 service access failed - check permissions', 'yellow');
  }

  // Test STS (should always work if authenticated)
  const stsResult = runCommand(`aws sts get-caller-identity ${profileFlag}`, {
    silent: true,
  });

  if (stsResult.success) {
    print('✅ STS service access confirmed', 'green');
    return true;
  } else {
    print('❌ STS service access failed - authentication issue', 'red');
    return false;
  }
}

async function checkEnvironmentVariables() {
  print('\n7. Checking environment configuration...', 'blue');

  const awsProfile = process.env.AWS_PROFILE;
  const awsRegion = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION;

  if (awsProfile) {
    print(`✅ AWS_PROFILE is set: ${awsProfile}`, 'green');
    if (awsProfile === 'aws-labs') {
      print('✅ AWS_PROFILE matches recommended profile name', 'green');
    } else {
      print('⚠️  AWS_PROFILE is set but not to "aws-labs"', 'yellow');
      print('   Consider setting: export AWS_PROFILE=aws-labs', 'yellow');
    }
  } else {
    print('❌ AWS_PROFILE environment variable is not set', 'red');
    print('   This is REQUIRED for seamless AWS access', 'red');
    print('   Set it with: export AWS_PROFILE=aws-labs', 'yellow');
    print(
      '   Add to your shell config (~/.bashrc, ~/.zshrc) to make permanent',
      'yellow'
    );
    return false;
  }

  if (awsRegion) {
    print(`ℹ️  AWS region is set: ${awsRegion}`, 'blue');
  } else {
    print(
      'ℹ️  AWS region not set in environment (will use profile default)',
      'blue'
    );
  }

  return awsProfile === 'aws-labs';
}

// Main validation function
async function runValidation() {
  print('='.repeat(50), 'bold');
  print('AWS Labs Repository Setup Validation', 'bold');
  print('='.repeat(50), 'bold');

  const checks = [
    validateAwsCli,
    validateSsoProfile,
    validateSsoSession,
    validateNodeJs,
    validateDependencies,
    validateAwsServices,
    checkEnvironmentVariables,
  ];

  let passedChecks = 0;
  const totalChecks = checks.length;

  for (const check of checks) {
    try {
      const result = await check();
      if (result) {
        passedChecks++;
      }
    } catch (error) {
      print(`❌ Check failed with error: ${error.message}`, 'red');
    }
  }

  print('\n' + '='.repeat(50), 'bold');
  print('Validation Summary', 'bold');
  print('='.repeat(50), 'bold');

  const percentage = Math.round((passedChecks / totalChecks) * 100);

  if (passedChecks === totalChecks) {
    print(`🎉 All checks passed! (${passedChecks}/${totalChecks})`, 'green');
    print('You are ready to start working with the AWS labs!', 'green');
  } else if (passedChecks >= totalChecks * 0.8) {
    print(
      `⚠️  Most checks passed (${passedChecks}/${totalChecks} - ${percentage}%)`,
      'yellow'
    );
    print(
      'You can likely proceed, but consider addressing the warnings above.',
      'yellow'
    );
  } else {
    print(
      `❌ Several checks failed (${passedChecks}/${totalChecks} - ${percentage}%)`,
      'red'
    );
    print(
      'Please address the issues above before proceeding with the labs.',
      'red'
    );
  }

  print('\nFor detailed setup instructions, see SETUP.md', 'blue');
  print('For help, contact your instructor or teaching assistant.', 'blue');

  return passedChecks === totalChecks;
}

// Quick SSO status check function
async function checkSsoStatus() {
  print('Checking AWS SSO session status...', 'blue');

  const profileFlag = process.env.AWS_PROFILE ? '' : '--profile aws-labs';
  const result = runCommand(`aws sts get-caller-identity ${profileFlag}`, {
    silent: true,
  });

  if (result.success) {
    print('✅ SSO session is active', 'green');
    try {
      const identity = JSON.parse(result.output);
      print(`Logged in as: ${identity.Arn.split('/').pop()}`, 'blue');
      print(`Account: ${identity.Account}`, 'blue');
    } catch (e) {
      // Ignore parsing errors
    }
    return true;
  } else {
    print('❌ SSO session is expired or not configured', 'red');
    const loginCmd = process.env.AWS_PROFILE
      ? 'aws sso login'
      : 'aws sso login --profile aws-labs';
    print(`Run: ${loginCmd}`, 'yellow');
    return false;
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    print('AWS Labs Setup Validation Script', 'bold');
    print('\nUsage:');
    print('  node validate-setup.js          Run full validation');
    print('  node validate-setup.js --sso    Check SSO status only');
    print('  node validate-setup.js --help   Show this help');
    return;
  }

  if (args.includes('--sso')) {
    await checkSsoStatus();
    return;
  }

  // Run full validation by default
  const success = await runValidation();
  process.exit(success ? 0 : 1);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    print(`Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = {
  runValidation,
  checkSsoStatus,
  validateAwsCli,
  validateSsoProfile,
  validateSsoSession,
  validateNodeJs,
  validateDependencies,
  validateAwsServices,
};
