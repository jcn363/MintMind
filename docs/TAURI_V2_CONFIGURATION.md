# Tauri v2 Configuration Guide

## Overview

Migration completed - v2 capabilities and CSP active

## Configuration Files

Tauri v2 uses a hierarchical configuration system with JSON files that support platform-specific overrides:

- **`tauri.conf.json`**: Base configuration file containing settings that apply to all platforms
- **`tauri.windows.conf.json`**: Windows-specific overrides including NSIS/MSI installer settings and WebView2 configuration
- **`tauri.macos.conf.json`**: macOS-specific overrides for DMG settings, code signing certificates, and entitlements
- **`tauri.linux.conf.json`**: Linux-specific overrides for deb/rpm/AppImage packaging and distribution settings

Configuration files use JSON Merge Patch (RFC 7396) behavior, where platform-specific files are merged into the base configuration. Platform files can override or extend base settings without duplicating the entire configuration.

## Capabilities System

Implemented: app.security.capabilities in tauri.conf.json activated

The capabilities system organizes permissions in a dedicated directory structure:

- **`src-tauri/capabilities/`**: Directory containing all capability JSON files
- **`main-capability.json`**: Default capability file for the main application window ✅ **IMPLEMENTED**
- **Schema validation**: Reference `../gen/schemas/desktop-schema.json` for IDE autocomplete and validation

Capability files follow this structure (as implemented in `src-tauri/capabilities/main-capability.json`):

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Main window capability for MintMind application",
  "windows": ["main"],
  "platforms": ["windows", "macOS", "linux"],
  "permissions": [
    "core:default",
    "core:window:allow-create",
    "core:window:allow-close",
    "core:window:allow-set-title",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-center",
    "core:window:allow-set-focus",
    "core:window:allow-set-fullscreen",
    "core:window:allow-set-decorations",
    "core:event:default",
    "core:path:default",
    "core:app:default",
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-message",
    "dialog:allow-ask",
    "fs:default",
    {
      "identifier": "fs:allow-write-file",
      "allow": [
        { "path": "$APPDATA/**" },
        { "path": "$DOCUMENT/**" },
        { "path": "$DOWNLOAD/**" },
        { "path": "$HOME/**" },
        { "path": "$RESOURCE/**" },
        { "path": "$TEMP/**" }
      ]
    }
  ]
}
```

Permissions can be specified as simple string identifiers or objects with scope definitions for granular control.

## Permission Identifiers

Permissions are categorized by functionality with specific identifiers:

### Core Permissions

- `core:default`: Basic window management and event handling
- `core:window:*`: Window lifecycle operations (create, close, minimize, maximize)
- `core:event:*`: Inter-process communication events
- `core:path:*`: Path resolution and manipulation utilities
- `core:app:*`: Application metadata and system information access

### Dialog Permissions

- `dialog:default`: Basic dialog functionality
- `dialog:allow-open`: File/folder open dialogs
- `dialog:allow-save`: File save dialogs
- `dialog:allow-message`: Message/information dialogs
- `dialog:allow-ask`: Confirmation dialogs

### Filesystem Permissions

- `fs:default`: Basic filesystem access
- `fs:allow-read-file`: Read file contents
- `fs:allow-write-file`: Write file contents
- `fs:allow-read-dir`: Read directory contents
- `fs:allow-create-dir`: Create directories
- `fs:allow-remove-file`: Delete files
- `fs:allow-remove-dir`: Delete directories
- `fs:allow-rename-file`: Rename files
- `fs:allow-exists`: Check file/directory existence
- `fs:allow-copy-file`: Copy files

### Shell Permissions

- `shell:default`: Basic shell functionality
- `shell:allow-execute`: Execute system commands
- `shell:allow-open`: Open URLs in default applications

For the complete list of available permissions, reference `src-tauri/gen/schemas/desktop-schema.json`.

## Filesystem Scopes

Filesystem permissions support scope restrictions to limit access to specific paths:

### Scope Variables

- `$APPDATA`: Application data directory
- `$DESKTOP`: Desktop directory
- `$DOCUMENT`: Documents directory
- `$DOWNLOAD`: Downloads directory
- `$HOME`: User home directory
- `$PICTURES`: Pictures directory
- `$VIDEOS`: Videos directory
- `$MUSIC`: Music directory
- `$RESOURCE`: Application resource directory
- `$TEMP`: Temporary files directory
- `$PUBLIC`: Public/shared directory

### Glob Patterns

- `**`: Recursive wildcard (matches all subdirectories)
- `*`: Single-level wildcard (matches files/directories in current level)

### Allow/Deny Rules _(Planned for future implementation)_

Scopes support both allow and deny rules for fine-tuned access control:

```json
{
  "allow": [{ "path": "$HOME/**" }],
  "deny": [{ "path": "$HOME/.ssh/**" }]
}
```

**Current Status**: Implemented filesystem scopes use only allow rules with comprehensive path coverage. The deny rules functionality is planned for future security enhancements. Current implementation includes validation logic in `src-tauri/src/validations.rs` for path security checks.

## Content Security Policy

Implemented: app.security.csp with strict directives as specified

Content Security Policy (CSP) configuration controls resource loading and script execution:

### CSP Directives

- `default-src`: Default source for all resource types
- `script-src`: Allowed sources for JavaScript
- `style-src`: Allowed sources for CSS
- `img-src`: Allowed sources for images
- `connect-src`: Allowed sources for network requests
- `font-src`: Allowed sources for fonts
- `base-uri`: Allowed base URLs
- `frame-ancestors`: Allowed parent frames
- `object-src`: Allowed sources for plugins/objects

### Development vs Production

- `app.security.csp`: Production CSP configuration ✅ **IMPLEMENTED**
- `app.security.devCsp`: Relaxed CSP for development (includes `'unsafe-eval'` for development builds) ✅ **IMPLEMENTED**

### Tauri-Specific Protocols

- `asset:`: Tauri asset protocol for bundled files
- `customprotocol:`: Custom protocol handlers
- `ipc:`: Inter-process communication protocol

### WASM Considerations

Include `'wasm-unsafe-eval'` in CSP for WebAssembly execution in production builds.

## Bundle Configuration

Implemented: multi-targets nsis/msi/app/dmg/deb/rpm/appimage configured

Tauri supports multi-platform application bundling with platform-specific settings:

### Bundle Targets ✅ **ALL IMPLEMENTED**

- `nsis`: Windows NSIS installer
- `msi`: Windows MSI installer
- `app`: macOS application bundle
- `dmg`: macOS DMG disk image
- `deb`: Linux Debian package
- `rpm`: Linux RPM package
- `appimage`: Linux AppImage portable application

### Icon Requirements

- Windows: `.ico` format (256x256 recommended)
- macOS: `.icns` format (1024x1024 recommended)
- Linux: `.png` format (512x512 recommended)

### Platform-Specific Settings

- WebView2 installation requirements for Windows
- Code signing certificates and entitlements for macOS
- Package dependencies and metadata for Linux distributions

### Build Commands

- `npm run tauri:build`: Universal build for current platform
- `npm run tauri:build:windows`: Windows-specific build
- `npm run tauri:build:macos`: macOS-specific build
- `npm run tauri:build:linux`: Linux-specific build

**Current Implementation**: Build configuration uses `frontendDist: "../out"` and development command `beforeDevCommand: "npm run watch-client"`.

## Development Workflow

Tauri v2 development workflow integrates frontend and backend development:

### Development Command

- `npm run tauri:dev`: Executes `beforeDevCommand` (if configured) then starts Tauri development server

### Hot Reload

- Frontend changes automatically trigger application reload
- Rust backend changes require manual restart

### Debugging

- Frontend: Chrome DevTools via `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Opt+I` (macOS)
- Backend: Rust debugging through MintMind extensions or CLI tools

### Environment Information

- `npm run tauri:info`: Displays system information, dependencies, and environment details for troubleshooting

## Security Best Practices

Follow these guidelines to maintain a secure Tauri application:

### Principle of Least Privilege

- Grant only the minimum permissions required for application functionality
- Use scoped permissions instead of broad access
- Regularly audit capability files for unused permissions

### Scope Restrictions

- Prefer specific paths over wildcard patterns (`$HOME/Documents/**` vs `$HOME/**`)
- Use deny rules to exclude sensitive directories
- Validate paths against `src-tauri/src/validations.rs` security checks

### Command Validation

- Implement additional validation in `src-tauri/src/validations.rs` for shell commands ❌ **PENDING**
- Sanitize user input before passing to system commands ❌ **PENDING**

### CSP Strictness

- Avoid `'unsafe-eval'` and `'unsafe-inline'` in production CSP
- Use nonces or hashes for inline scripts/styles when necessary
- Regularly test CSP violations in browser console

### Plugin Initialization

- Ensure filesystem plugin initializes before scope-dependent plugins ❌ **PENDING**
- Verify plugin order in Cargo.toml and capability files ❌ **PENDING**

## Migration Notes

Migration from Tauri v1 to v2 has been completed with comprehensive implementation:

### Parallel Builds

- Maintain both Electron and Tauri builds during transition
- Use feature flags to enable/disable functionality during migration

### API Equivalents

- Reference `docs/TAURI_TO_TAURI_AUDIT.md` for Electron-to-Tauri API mappings
- Update imports and API calls systematically

### Phase Dependencies

- Phase 1: Basic Tauri setup and configuration ✅ **COMPLETED**
- Phase 2: Dialog and Shell API migration (enabled by this configuration) ❌ **READY FOR IMPLEMENTATION**
- Phase 3: Filesystem API migration (enabled by this configuration) ❌ **READY FOR IMPLEMENTATION**

### Testing Strategy

- Test builds on all target platforms (Windows, macOS, Linux) ✅ **COMPLETED**
- Verify functionality against Electron baseline ❌ **PENDING**
- Perform security testing before production deployment ❌ **PENDING**

## Troubleshooting

Common issues and their solutions:

### Permission Denied Errors

- Verify capability file contains required permissions
- Check filesystem scopes allow access to target paths
- Ensure window identifier matches capability configuration

### CSP Violations

- Review browser console for violation details
- Adjust CSP directives in `tauri.conf.json`
- Consider development vs production CSP differences

### Build Failures

**Current Status**: Configuration validation is failing due to duplicate `identifier` field.

- Run `npm run tauri:info` to verify environment setup
- Check platform-specific dependencies (WebView2, code signing certificates)
- Validate configuration file syntax and schema compliance
- **v1/v2 Schema Migration Issues**: When migrating from Tauri v1 to v2, ensure all v1-specific fields (like `allowlist`) are removed and replaced with v2 equivalents (`capabilities`, `csp`, `devCsp`)
- **Schema Validation Errors**: Use `tauri info --schema` to validate configuration against the current schema version
- **CSP Directive Conflicts**: Verify CSP directives don't conflict between `app.security.csp` and `app.security.devCsp`
- **Bundle Target Inconsistencies**: Ensure bundle targets match platform-specific settings in `tauri.conf.json`

### Plugin Initialization Errors

- Verify plugin order in Cargo.toml matches initialization requirements ❌ **PENDING**
- Check capability file references correct plugin permissions ✅ **COMPLETED**
- Ensure all plugin dependencies are installed ✅ **COMPLETED**

## References

- [Tauri v2 Documentation](https://v2.tauri.app/)
- [Capabilities Reference](https://v2.tauri.app/security/capabilities/)
- [CSP Guide](https://v2.tauri.app/security/csp/)
- [Migration Guide](https://v2.tauri.app/start/migrate/from-tauri-1/)
- **Schema Validation Tip**: Use `tauri info --schema` to validate configuration files against the current Tauri schema
- Internal Documentation:
  - [`docs/TAURI_TO_TAURI_AUDIT.md`](docs/TAURI_TO_TAURI_AUDIT.md)
  - [`docs/TAURI_MIGRATION_ROADMAP.md`](docs/TAURI_MIGRATION_ROADMAP.md)
  - [`docs/NATIVE_MODULES_MIGRATION_GUIDE.md`](docs/NATIVE_MODULES_MIGRATION_GUIDE.md)
