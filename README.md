# AWS Labs Repository

An educational repository designed for Master 2 students to learn AWS services through hands-on, independent laboratory exercises.

## 🎯 Overview

This repository contains a collection of AWS service labs, each designed to be completely independent and beginner-friendly. Students can work on any lab without needing to complete others first.

## 📁 Repository Structure

```
aws-labs-repository/
├── labs/                   # Individual AWS service labs
├── shared/                 # Shared utilities and templates
├── docs/                   # Educational documentation
└── README.md              # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- AWS CLI v2
- AWS SSO configured (see [SETUP.md](SETUP.md))

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## 🧪 Available Labs

_Labs will be added as they are developed_

## 📚 Documentation

- [Setup Guide](SETUP.md) - AWS SSO configuration and prerequisites
- [AWS Basics](docs/aws-basics.md) - Fundamental AWS concepts
- [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions

## 🛠️ Development

### Code Quality

This repository maintains high code quality standards:

```bash
# Lint code
npm run lint

# Format code
npm run format

# Run tests
npm test
```

### Adding New Labs

Each lab should follow the established structure and patterns. See the shared templates for guidance.

## 🔒 Security

- Never commit AWS credentials
- Use AWS SSO for authentication
- Follow the security guidelines in each lab

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

This is an educational repository. Please follow the established patterns and maintain beginner-friendly code.
