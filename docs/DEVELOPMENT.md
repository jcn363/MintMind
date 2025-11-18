# Development Guide

This guide will help you set up the development environment for MintMind and get started with development.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setting Up the Development Environment](#setting-up-the-development-environment)
- [Project Structure](#project-structure)
- [Running the Application](#running-the-application)
- [Debugging](#debugging)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

- [Bun](https://bun.sh/) (v1.0.0 or later)
- [Rust](https://www.rust-lang.org/) (for Tauri)
- [Node.js](https://nodejs.org/) (v18 or later)
- [Git](https://git-scm.com/)
- [MintMind](https://code.visualstudio.com/) (recommended)

## Setting Up the Development Environment

1. **Clone the repository**

   ```bash
   git clone https://github.com/jcn363/mintmind.git
   cd mintmind
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Set up Git hooks (optional but recommended)**

   ```bash
   bun run prepare
   ```

4. **Verify the installation**

   ```bash
   bun run check
   ```

## Project Structure

```text
MintMind/
├── src/                # Source code
│   ├── main/           # Main process code
│   ├── renderer/       # UI components
│   └── shared/         # Shared utilities
├── extensions/         # Built-in extensions
├── scripts/            # Build and utility scripts
├── test/               # Test files
├── build/              # Build output
└── docs/               # Documentation
```

## Running the Application

### Development Mode

```bash
# Start the development server
bun run dev
```

This will start the application in development mode with hot-reload enabled.

### Production Build

```bash
# Build the application
bun run build

# Package for the current platform
bun run package
```

## Debugging

### MintMind Debug Configurations

The repository includes MintMind debug configurations in `.vscode/launch.json`:

- **Debug Main Process**: Debug the main Electron process
- **Debug Renderer Process**: Debug the renderer process
- **Debug Tests**: Run and debug tests

### Browser DevTools

In development mode, you can open the browser's developer tools:

- **Main Process**: Use the application menu (View > Toggle Developer Tools)
- **Renderer Process**: Right-click and select "Inspect Element"

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run unit tests
bun test:unit

# Run integration tests
bun test:integration

# Run tests with coverage
bun test:coverage
```

### Writing Tests

- Unit tests should be placed in the `test/unit` directory
- Integration tests should be placed in the `test/integration` directory
- Test files should be named `*.test.ts` or `*.spec.ts`

## Code Style

We use the following tools to maintain code quality:

- **ESLint** for JavaScript/TypeScript linting
- **Prettier** for code formatting
- **TypeScript** for type checking

### Formatting Code

```bash
# Format all code
bun run format

# Check formatting (CI)
bun run format:check
```

### Linting

```bash
# Run linter
bun run lint

# Fix linting issues
bun run lint:fix
```

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools

## Pull Request Process

1. Fork the repository and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Troubleshooting

### Common Issues

#### Missing Dependencies

```bash
# If you get dependency errors, try:
bun install
```

#### Build Failures

```bash
# Clean the build directory and node_modules
bun run clean
bun install
```

#### TypeScript Errors

```bash
# Check for TypeScript errors
bun run typecheck
```

### Getting Help

If you encounter any issues, please:

1. Check the [issues](https://github.com/jcn363/mintmind/issues) to see if it's a known problem
2. Search the [discussions](https://github.com/jcn363/mintmind/discussions)
3. Open a new issue if you can't find a solution
