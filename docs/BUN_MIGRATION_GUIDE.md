# Bun Migration Guide

This guide provides instructions for migrating the project from npm to bun as the package manager, as required by the project's global rules.

## Prerequisites

1. Install bun on your system:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
   Follow the installation instructions for your operating system.

2. Verify installation:
   ```bash
   bun --version
   ```

## Migration Steps

1. **Backup Your Work**
   Ensure all your changes are committed to version control before proceeding.

2. **Run the Migration Script**
   ```bash
   ./scripts/migrate-to-bun.sh
   ```
   This script will:
   - Backup your existing package-lock.json and node_modules
   - Install dependencies using bun
   - Update package.json scripts to use bun
   - Update CI/CD configuration if applicable

3. **Test Your Application**
   Run your application and test all functionality:
   ```bash
   bun run dev
   bun run test
   ```

4. **Update Documentation**
   - Update any documentation that references npm commands
   - Ensure all team members are aware of the change

## Troubleshooting

### Common Issues

1. **Missing Dependencies**
   If you encounter missing dependencies, try:
   ```bash
   bun install
   ```

2. **Build Failures**
   Some packages might require additional configuration for bun. Check the [bun documentation](https://bun.sh/docs) for compatibility information.

3. **Performance Issues**
   If you experience performance issues, try clearing bun's cache:
   ```bash
   bun clean
   ```

## CI/CD Updates

Update your CI/CD pipeline to use bun:

```yaml
# Example GitHub Actions configuration
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install
      - run: bun run test
```

## Rollback

If you need to rollback:

1. Restore the backup files:
   ```bash
   mv package-lock.json.bak.$TIMESTAMP package-lock.json
   rm -rf node_modules
   mv node_modules.bak node_modules
   ```

2. Reinstall with npm:
   ```bash
   # Nota: Esta opción solo se debe usar como último recurso
   npm install
   ```

## Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [Migrating from npm to bun](https://bun.sh/docs/installation/migrate-from-nodejs)
