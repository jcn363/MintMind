# Contributing to MintMind

Thank you for your interest in contributing to MintMind! We're excited to have you on board. This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Making Changes](#making-changes)
- [Code Review Process](#code-review-process)
- [Reporting Issues](#reporting-issues)
- [Feature Requests](#feature-requests)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [email protected].

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
   ```bash
   git clone https://github.com/your-username/mintmind.git
   cd mintmind
   ```
3. **Set up the development environment**
   ```bash
   bun install
   ```
4. **Create a branch** for your changes
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Branch Naming

Use the following prefixes for branch names:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test-related changes
- `chore/` - Build process or tooling changes

Example: `feature/add-dark-mode`

### Making Changes

1. **Write tests** for your changes
2. **Run the tests** to ensure they pass
   ```bash
   bun test
   ```
3. **Lint your code**
   ```bash
   bun run lint
   ```
4. **Format your code**
   ```bash
   bun run format
   ```
5. **Commit your changes** following the [commit message guidelines](#commit-message-guidelines)

### Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Commit Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools

#### Examples

```
feat(editor): add dark mode support

Adds a new dark mode theme to the editor with customizable color schemes.

Closes #123
```

```
fix(terminal): handle special characters in command input

Fixes an issue where special characters in terminal input were not being escaped properly.

Fixes #456
```

## Code Review Process

1. **Push your changes** to your fork
   ```bash
   git push origin your-branch-name
   ```
2. **Create a Pull Request** (PR) from your fork to the main repository
3. **Address any review comments** and update your PR as needed
4. **Squash your commits** into a single commit before merging
5. **Wait for CI** to pass before merging

### PR Checklist

Before submitting a PR, make sure:

- [ ] All tests pass
- [ ] Code is properly formatted
- [ ] Lint checks pass
- [ ] Documentation is updated
- [ ] Changes are well-tested
- [ ] Commit messages follow the guidelines

## Reporting Issues

When reporting issues, please include:

1. A clear title and description
2. Steps to reproduce the issue
3. Expected vs. actual behavior
4. Screenshots or screen recordings (if applicable)
5. Browser/OS version
6. Any error messages

## Feature Requests

We welcome feature requests! Please:

1. Check if a similar feature has already been requested
2. Describe the feature in detail
3. Explain why this feature would be valuable
4. Include any relevant examples or use cases

## Documentation

Good documentation is crucial for the success of MintMind. When making changes:

1. Update relevant documentation
2. Add examples for new features
3. Keep the documentation up-to-date
4. Follow the [Documentation Style Guide](docs/DOCUMENTATION_STYLE_GUIDE.md)

## Setting Up a Development Environment

### Prerequisites

- [Bun](https://bun.sh/) (v1.0.0 or later)
- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/) (for Tauri)
- [Git](https://git-scm.com/)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/mintmind.git
   cd mintmind
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Start the development server**
   ```bash
   bun run dev
   ```

## Testing

Run the test suite:

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test path/to/test.file.ts
```

## Community

- **Discord**: Join our [Discord server](https://discord.gg/mintmind)
- **Twitter**: Follow us [@mintmind_ide](https://twitter.com/mintmind_ide)
- **Blog**: Read our [blog](https://mintmind.dev/blog) for updates and tutorials

## License

By contributing to MintMind, you agree that your contributions will be licensed under the [MIT License](LICENSE).
