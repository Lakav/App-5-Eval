# AWS Labs Repository Setup

## Quick Start

**Before you begin any AWS labs, you must complete the setup process.**

👉 **Go to [Lab 00: AWS Environment Setup](labs/00-setup/README.md)** to configure your environment.

## What You'll Set Up

The setup lab will guide you through:

- ✅ Installing AWS CLI v2
- ✅ Configuring AWS SSO authentication
- ✅ Setting up environment variables
- ✅ Installing Node.js and dependencies
- ✅ Validating your configuration

## Quick Validation

After completing the setup lab, use these commands to verify everything is working:

```bash
# Full setup validation
npm run validate-setup

# Quick SSO check (use before each lab session)
npm run validate-sso
```

## Important Notes

- **Always set `AWS_PROFILE=aws-labs`** before running AWS commands
- **Run `npm run validate-sso`** before starting each lab session
- **Use `aws sso login`** if your session expires

---

**Start here:** [Lab 00: AWS Environment Setup](labs/00-setup/README.md)
