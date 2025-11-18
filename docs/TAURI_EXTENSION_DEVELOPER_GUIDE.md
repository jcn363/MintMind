# Tauri Extension Developer Guide

This guide provides comprehensive information for extension developers migrating their extensions to work with the Tauri-based MintMind application, including API changes, compatibility requirements, and publishing guidelines.

## Overview of API Changes

The migration from Electron to Tauri introduces several changes that affect how extensions interact with the host application. Tauri provides a more secure and performant runtime while maintaining compatibility with most MintMind extension APIs.

### Key Differences

- **IPC Communication**: Tauri uses a more efficient IPC system based on Rust
- **System APIs**: Direct Node.js access replaced with secure Tauri commands
- **Security Model**: Enhanced isolation between web content and system resources
- **Performance**: Faster inter-process communication and reduced overhead

### Compatibility Levels

Extensions can be categorized by their compatibility status:

- **🔄 Fully Compatible**: No changes required, works out of the box
- **⚠️ Minor Updates Needed**: Small API changes or configuration updates
- **🔧 Major Changes Required**: Significant refactoring for Tauri APIs
- **❌ Incompatible**: Requires complete rewrite or alternative approach

## Compatibility Checklist

Use this checklist to assess your extension's compatibility:

### ✅ Basic Compatibility

- [ ] Extension uses standard MintMind APIs (languages, workspace, etc.)
- [ ] No direct Node.js `fs` or `child_process` usage
- [ ] No Electron-specific APIs (`electron.remote`, etc.)
- [ ] No native module dependencies
- [ ] Uses standard extension host protocols

### ⚠️ Intermediate Checks

- [ ] Reviews use of `vscode.workspace.fs` instead of Node.js `fs`
- [ ] Checks for terminal or process execution through official APIs
- [ ] Verifies authentication flows use standard OAuth flows
- [ ] Ensures no direct system API calls

### 🔧 Advanced Requirements

- [ ] Tests extension in Tauri environment (see testing section)
- [ ] Updates manifest for Tauri-specific capabilities
- [ ] Replaces any unsupported APIs with Tauri equivalents
- [ ] Validates performance in Tauri IPC environment

## Migration Steps

### Step 1: Environment Setup

1. Set up a Tauri development environment
2. Install MintMind Tauri version for testing
3. Create a test workspace with your extension

### Step 2: Initial Compatibility Check

1. Install your extension in Tauri MintMind
2. Check console for deprecation warnings
3. Run basic functionality tests
4. Monitor for runtime errors

### Step 3: API Migration

1. Replace Electron-specific code with Tauri equivalents
2. Update IPC communication patterns
3. Modify file system operations
4. Adapt authentication and security flows

### Step 4: Testing and Validation

1. Run full test suite in Tauri environment
2. Test on all supported platforms
3. Validate performance characteristics
4. Check memory usage and startup impact

### Step 5: Publishing Updates

1. Update extension manifest with Tauri compatibility
2. Publish updated version to marketplace
3. Update documentation and release notes
4. Monitor user feedback and issue reports

## Unsupported Features

Some Electron-specific features are not available in Tauri:

### ❌ Native Modules

- **Issue**: Direct native module loading not supported
- **Impact**: Extensions using native `.node` files won't work
- **Alternative**: Use Tauri's plugin system or Web APIs

### ❌ Direct System Access

- **Issue**: No direct access to system APIs
- **Impact**: Extensions requiring low-level system calls blocked
- **Alternative**: Use Tauri's command system with Rust backend

### ❌ Electron Remote

- **Issue**: `electron.remote` module not available
- **Impact**: Extensions using remote require API replacement
- **Alternative**: Use Tauri's secure IPC for inter-process communication

### ❌ Node.js Child Process

- **Issue**: Direct `child_process` usage restricted
- **Impact**: Extensions spawning processes may fail
- **Alternative**: Use MintMind's terminal API or Tauri's process commands

## Workarounds for Unsupported Features

### Native Module Replacement

Instead of native modules, use Tauri's plugin architecture:

```typescript
// Before (Electron)
const nativeModule = require("./native-addon.node");

// After (Tauri)
import { invoke } from "@tauri-apps/api/tauri";
const result = await invoke("native_function", { params });
```

### System API Access

Replace direct system calls with Tauri commands:

```typescript
// Before (Electron)
const { exec } = require('child_process');
exec('system-command', (error, stdout) => {
  // handle result
});

// After (Tauri)
import { invoke } = from '@tauri-apps/api/tauri';
const result = await invoke('execute_system_command', {
  command: 'system-command'
});
```

### File System Operations

Use MintMind's official file system APIs:

```typescript
// Before (Electron)
const fs = require("fs");
fs.readFile("/path/to/file", (err, data) => {
  // handle data
});

// After (Tauri - MintMind API)
const fileContent = await vscode.workspace.fs.readFile(
  vscode.Uri.file("/path/to/file")
);
```

## Testing Extensions in Tauri Environment

### Development Build Setup

1. Clone and build MintMind Tauri from source
2. Use development build for testing extensions
3. Enable extension development host

### Console Debugging

- Open Developer Tools in Tauri (Ctrl+Shift+I)
- Monitor console for extension errors
- Check Network tab for failed API calls
- Use React DevTools for component debugging

### Automated Testing

```typescript
// Example test setup for Tauri environment
describe("Extension Tauri Compatibility", () => {
  test("should initialize without errors", async () => {
    // Test extension activation
    const extension = vscode.extensions.getExtension("your-extension-id");
    await extension.activate();

    // Verify Tauri-specific APIs work
    expect(extension.isActive).toBe(true);
  });

  test("should handle IPC communication", async () => {
    // Test Tauri command invocation
    const result = await vscode.commands.executeCommand("your.tauri.command");
    expect(result).toBeDefined();
  });
});
```

### Performance Testing

Monitor extension impact on Tauri performance:

```bash
# Enable performance monitoring
export TAURI_DEV_TOOLS=1

# Run with performance profiling
cargo build --release --features devtools
```

## Publishing Guidelines

### Manifest Updates

Update `package.json` with Tauri compatibility information:

```json
{
  "name": "your-extension",
  "version": "2.0.0",
  "engines": {
    "vscode": "^1.74.0",
    "tauri": "^1.0.0"
  },
  "capabilities": {
    "tauri": {
      "permissions": ["fs:allow-read", "shell:allow-execute"]
    }
  },
  "keywords": ["tauri", "compatible"],
  "categories": ["Other"]
}
```

### Version Numbering

- Use semantic versioning for Tauri updates
- Indicate Tauri compatibility in version (e.g., 1.5.0-tauri)
- Update changelog with migration notes

### Marketplace Publishing

1. Ensure extension passes marketplace validation
2. Include "Tauri Compatible" in description
3. Add migration notes for users
4. Tag release with appropriate keywords

### User Communication

Inform users about Tauri compatibility:

```markdown
## Tauri Compatibility

This version is fully compatible with MintMind Tauri. Key improvements:

- Faster startup times
- Reduced memory usage
- Enhanced security

For Electron users, please update to the latest version for continued support.
```

## Examples

### Before/After API Usage

#### File System Access

```typescript
// Electron (unsupported)
import * as fs from "fs";
fs.readdirSync("/user/documents");

// Tauri (recommended)
const uri = vscode.Uri.file("/user/documents");
const files = await vscode.workspace.fs.readDirectory(uri);
```

#### System Commands

```typescript
// Electron (unsupported)
import { exec } from "child_process";
exec("git status", (error, stdout) => {
  console.log(stdout);
});

// Tauri (recommended)
const terminal = vscode.window.createTerminal();
terminal.sendText("git status");
terminal.show();
```

#### IPC Communication

```typescript
// Electron (deprecated)
const { ipcRenderer } = require("electron");
ipcRenderer.invoke("custom-command", data);

// Tauri (recommended)
import { invoke } from "@tauri-apps/api/tauri";
const result = await invoke("custom-command", data);
```

### Extension Structure Changes

#### Old Structure (Electron)

```text
extension/
├── package.json
├── extension.js
├── native-addon.node
└── node_modules/
```

#### New Structure (Tauri)

```text
extension/
├── package.json
├── extension.js
├── src-tauri/
│   ├── src/
│   │   └── commands.rs
│   └── Cargo.toml
└── node_modules/
```

## Support Resources

### Documentation

- [Tauri Official Guide](https://tauri.app/v1/guides/)
- [MintMind Extension API](https://code.visualstudio.com/api)
- [MintMind Tauri Migration](https://github.com/microsoft/vscode/docs/tauri-migration)

### Community Support

- [GitHub Discussions](https://github.com/microsoft/vscode/discussions)
- [MintMind Discord](https://discord.gg/vscode)
- [Tauri Discord](https://discord.gg/tauri)

### Issue Reporting

- [Extension Issues](https://github.com/microsoft/vscode/issues)
- [Tauri Issues](https://github.com/tauri-apps/tauri/issues)
- [Marketplace Issues](https://github.com/microsoft/vscode-marketplace/issues)

### Professional Services

- [Extension Migration Consulting](https://marketplace.visualstudio.com/services)
- [Tauri Migration Experts](https://tauri.app/consultants)

## Best Practices

### Performance Optimization

- Minimize IPC calls by batching operations
- Use efficient data serialization
- Cache frequently accessed data
- Avoid synchronous operations

### Security Considerations

- Never expose sensitive data through IPC
- Validate all input parameters
- Use Tauri's permission system appropriately
- Follow principle of least privilege

### User Experience

- Provide clear error messages for Tauri-specific issues
- Offer fallback functionality when possible
- Document any platform-specific limitations
- Test on all supported platforms

### Maintenance

- Monitor extension analytics for Tauri usage
- Keep dependencies updated for security
- Regularly test against new Tauri releases
- Maintain compatibility with both Electron and Tauri during transition

## Migration Timeline

### Phase 1: Preparation (Weeks 1-2)

- Assess extension compatibility
- Set up Tauri development environment
- Plan migration approach

### Phase 2: Development (Weeks 3-6)

- Implement API changes
- Update dependencies
- Create comprehensive tests

### Phase 3: Testing (Weeks 7-8)

- Test on all platforms
- Performance validation
- User acceptance testing

### Phase 4: Deployment (Week 9)

- Publish updated extension
- Update documentation
- Communicate with users

## Success Metrics

Track these metrics to measure migration success:

- **Compatibility Rate**: Percentage of extension features working in Tauri
- **Performance Impact**: Memory usage and startup time changes
- **User Feedback**: Issue reports and user satisfaction scores
- **Marketplace Rating**: Maintain or improve extension rating
- **Download Trends**: Monitor adoption of Tauri-compatible version

## Troubleshooting

### Common Issues

**Extension fails to activate**

- Check manifest for Tauri compatibility declarations
- Verify API usage matches Tauri patterns
- Review console for specific error messages

**Performance degradation**

- Profile IPC communication patterns
- Check for synchronous operations
- Optimize data serialization

**Platform-specific failures**

- Test on all supported platforms during development
- Use platform-specific API fallbacks
- Report platform issues to Tauri team

**Security warnings**

- Review permission declarations
- Ensure secure IPC communication
- Validate input sanitization

By following this guide, extension developers can successfully migrate their extensions to work seamlessly with MintMind Tauri, taking advantage of improved performance and security while maintaining compatibility with the MintMind ecosystem.
