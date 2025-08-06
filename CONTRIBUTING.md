# Contributing to Oncoprint.js

Thank you for your interest in contributing to Oncoprint.js! This document provides guidelines and information about contributing to the project.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, please include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots if applicable
- Environment details (browser, Node.js version, etc.)
- Sample data or minimal reproduction case

### Suggesting Features

Feature requests are welcome! Please provide:

- Clear description of the feature
- Use case and motivation
- Proposed API design (if applicable)
- Alternative approaches considered

### Pull Requests

1. Fork the repository
2. Create a feature branch from `develop`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Update documentation if needed
7. Submit a pull request

#### Pull Request Guidelines

- Use a clear and descriptive title
- Reference relevant issues
- Include a detailed description of changes
- Add tests for new features
- Update documentation
- Follow the coding style

## Development Setup

### Prerequisites

- Node.js ≥ 16.0.0
- npm ≥ 8.0.0

### Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/oncoprint-js.git
cd oncoprint-js

# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Start development mode
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run type checking
npm run typecheck

# Run linting
npm run lint
```

### Building

```bash
# Build library
npm run build

# Clean build
npm run clean && npm run build

# Watch mode for development
npm run dev
```

## Project Structure

```
src/
├── components/         # React components
├── core/              # Core visualization logic
├── parsers/           # Data parsing utilities
├── renderers/         # D3.js rendering engine
├── types/             # TypeScript definitions
└── utils/             # Utility functions
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Provide proper type definitions
- Avoid `any` types
- Use strict mode settings

### Code Style

- Use ESLint configuration
- 2-space indentation
- Semicolons required
- Single quotes for strings
- Trailing commas

### Naming Conventions

- Use camelCase for variables and functions
- Use PascalCase for classes and components
- Use UPPER_SNAKE_CASE for constants
- Use descriptive names

### Documentation

- Use JSDoc for public APIs
- Include examples in documentation
- Update README for new features
- Keep API_REFERENCE.md current

### Testing

- Write tests for new features
- Maintain test coverage above 80%
- Use descriptive test names
- Mock external dependencies

## Git Workflow

### Branches

- `main`: Production-ready code
- `develop`: Development branch
- `feature/feature-name`: Feature branches
- `bugfix/bug-description`: Bug fix branches
- `hotfix/hotfix-description`: Emergency fixes

### Commit Messages

Use conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Build/tooling changes

Examples:
- `feat(core): add metadata track sorting`
- `fix(renderer): resolve scaling issue on mobile`
- `docs(api): update OncoprintVisualizer examples`

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release PR to `main`
4. Tag release after merge
5. GitHub Actions handles npm publish

## Questions?

- Open a discussion on GitHub
- Check existing documentation
- Look at example code
- Ask in pull request comments

Thank you for contributing to Oncoprint.js!