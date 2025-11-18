# Native Modules Migration Guide

## Overview

This guide outlines the process for migrating four key native modules from the current Electron-based implementation to Tauri. The modules covered are `node-pty`, `native-keymap`, `@vscode/windows-registry`, and `@vscode/windows-process-tree`. The migration involves replacing Node.js-based native bindings with Rust equivalents, leveraging Tauri's plugin system and native APIs.

## Current Electron Implementation

### Native Module Categories
- **Terminal Emulation**: node-pty for pseudo-terminal functionality
- **Keyboard Mapping**: native-keymap for platform-specific keyboard layout detection
- **Windows Registry Access**: @vscode/windows-registry for Windows registry operations
- **Process Management**: @vscode/windows-process-tree for Windows process tree enumeration

### Key Dependencies
- node-pty for terminal emulation in the integrated terminal
- native-keymap for keyboard layout and key mapping functionality
- @vscode/windows-registry for accessing Windows registry keys (Windows-specific)
- @vscode/windows-process-tree for enumerating Windows process hierarchies (Windows-specific)

## Tauri Migration Strategy

### Architecture Changes
- Replace Node.js runtime with Rust backend
- Use Tauri's command system for IPC
- Leverage Rust crates for native functionality
- Implement plugins for reusable components

### Migration Phases

#### Phase 1: Assessment
```rust
// Example: Identify native dependencies
// Check Cargo.toml for current Rust dependencies
// Audit Node.js native modules in package.json
```

#### Phase 2: Core Migration
- Implement basic Tauri application structure
- Migrate file system operations to Rust std::fs
- Replace IPC with Tauri's invoke system

#### Phase 3: Advanced Features
- Port node-pty functionality using portable-pty or similar crate
- Implement keyboard mapping with keymap crate
- Replace Windows registry access with winreg crate
- Implement Windows process tree enumeration with sysinfo or winapi

## Module-Specific Migrations

### node-pty

#### Current Usage Locations
- `src/vs/platform/terminal/node/terminalProcess.ts`: Core terminal process management, spawning processes, handling data events, resizing terminals, and managing process lifecycle
- `src/vs/workbench/contrib/terminal/browser/terminalInstance.ts`: Terminal instance management with HACK for initial text to pass conptyInheritCursor flag
- `test/integration/terminal-operations.integration.test.ts`: Mocked in tests for terminal operations
- `extensions/vscode-api-tests/src/singlefolder-tests/chat.test.ts`: Access verification for Copilot CLI in chat extension

#### Summary of Usage
The module is used extensively for creating and managing pseudo-terminals in MintMind's integrated terminal. It handles process spawning, data I/O, terminal resizing, and process lifecycle management with specific handling for Windows ConPTY and macOS/Linux differences.

#### Recommended Rust Crate(s)
- `portable-pty` (cross-platform pseudo-terminal support)
- `conpty` (Windows-specific ConPTY support)

#### Proposed Rust Module Path
`src-tauri/src/pty.rs` (single file) or `src-tauri/src/pty/` (module directory with sub-modules for different platforms)

#### Tauri Commands/Events to Expose
- `spawn_pty`: Create and spawn a new pseudo-terminal process
- `write_pty`: Send data to the terminal
- `resize_pty`: Resize the terminal dimensions
- `kill_pty`: Terminate the terminal process
- `pty_data_event`: Event for incoming terminal data
- `pty_exit_event`: Event for process termination

#### Platform-Specific Considerations
- **Windows**: Use ConPTY for modern Windows 10+ terminal emulation, handle legacy console fallback, manage UTF-8 encoding for international characters
- **macOS**: Use forkpty system call, handle UTF-8 encoding and locale settings
- **Linux**: Use forkpty with appropriate terminal allocation, handle different distribution-specific terminal configurations

### native-keymap

#### Current Usage Locations
- `src/vs/platform/keyboardLayout/electron-main/keyboardLayoutMainService.ts`: Keyboard layout detection and management service
- `src/vs/base/common/keyCodes.ts`: References to Chromium keyboard codes for mapping

#### Summary of Usage
Used to detect and manage keyboard layouts across different platforms, providing consistent key code mapping for MintMind's keyboard handling.

#### Recommended Rust Crate(s)
- `keymap` (cross-platform keyboard mapping)

#### Proposed Rust Module Path
`src-tauri/src/keymap.rs` (single file) or `src-tauri/src/keymap/` (module directory)

#### Tauri Commands/Events to Expose
- `get_current_keyboard_layout`: Get current keyboard layout information
- `get_key_mapping`: Map key codes to platform-specific representations
- `keyboard_layout_changed`: Event when keyboard layout changes

#### Platform-Specific Considerations
- **Windows**: Map Windows virtual key codes to Chromium key codes, handle different keyboard layouts (QWERTY, Dvorak, international)
- **macOS**: Use Carbon framework for keyboard layout detection, handle dead keys and composed characters
- **Linux**: Use XKB for keyboard mapping, handle X11 vs Wayland differences, support various keyboard layouts and dead keys

### @vscode/windows-registry

#### Current Usage Locations
- `src/vs/base/node/id.ts`: Reading Windows machine ID from registry
- `src/vs/platform/native/electron-main/nativeHostMainService.ts`: Registry operations for Windows-specific functionality

#### Summary of Usage
Provides access to Windows registry for reading system information and configuration data, particularly for unique machine identification.

#### Recommended Rust Crate(s)
- `winreg` (Windows registry access)

#### Proposed Rust Module Path
`src-tauri/src/windows_registry.rs` (single file) or `src-tauri/src/windows/registry/` (module directory)

#### Tauri Commands/Events to Expose
- `get_string_reg_key`: Read string values from registry keys
- `get_dword_reg_key`: Read DWORD values from registry keys
- `get_binary_reg_key`: Read binary data from registry keys
- `enum_reg_keys`: Enumerate subkeys under a registry key

#### Platform-Specific Considerations
- **Windows**: Handle different registry hives (HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER, HKEY_CLASSES_ROOT), manage permissions for accessing protected keys, handle 32-bit vs 64-bit registry redirection
- **Non-Windows**: No functionality needed, gracefully disable or return appropriate errors

### @vscode/windows-process-tree

#### Current Usage Locations
- `src/vs/platform/terminal/node/windowsShellHelper.ts`: Windows shell helper using process tree for shell detection
- `src/vs/workbench/contrib/debug/node/terminals.ts`: Process tree enumeration for debug terminal operations
- `src/vs/base/node/ps.ts`: Process tree utility functions

#### Summary of Usage
Used to enumerate process trees on Windows, particularly for terminal and debugging functionality to understand process hierarchies and relationships.

#### Recommended Rust Crate(s)
- `sysinfo` (cross-platform system information including process trees)

#### Proposed Rust Module Path
`src-tauri/src/windows_process_tree.rs` (single file) or `src-tauri/src/windows/process_tree/` (module directory)

#### Tauri Commands/Events to Expose
- `get_process_tree`: Get process tree starting from a root PID
- `get_process_list`: Get flat list of all processes
- `get_process_info`: Get detailed information about a specific process

#### Platform-Specific Considerations
- **Windows**: Use Windows API for efficient process enumeration, handle Windows job objects and process groups, manage process permissions
- **macOS**: Use sysctl for process information, handle process groups and sessions
- **Linux**: Read /proc filesystem for process information, handle cgroups and namespaces, manage different process schedulers

## Implementation Examples

### Terminal Migration
```rust
// Tauri command for spawning PTY
#[tauri::command]
fn spawn_pty(cmd: String, args: Vec<String>, cwd: Option<String>) -> Result<PtyHandle, String> {
    // Implementation using portable-pty
    Ok(pty_handle)
}
```

### Keyboard Layout Migration
```javascript
// Frontend: Replace native-keymap
invoke('get_current_keyboard_layout')
    .then(layout => console.log(layout))
    .catch(err => console.error(err));
```

## Best Practices

### Code Organization
- Separate Rust logic into dedicated modules
- Use Tauri's state management for shared data
- Implement proper error handling with Result types

### Testing Strategy
- Unit tests for Rust functions
- Integration tests for IPC commands
- Cross-platform testing for native features

### Security Considerations
- Follow Rust's ownership principles
- Implement proper permission checks
- Sanitize inputs from frontend

## Common Pitfalls

### Memory Management
- Avoid common Rust pitfalls like dangling pointers
- Use proper lifetime annotations for borrowed data
- Implement Drop traits for cleanup

### Platform Differences
- Handle OS-specific path separators
- Account for different file permissions
- Test on all target platforms

### Performance Optimization
- Minimize data copying across FFI boundaries
- Use efficient data structures
- Profile memory usage regularly

## Resources

- [Tauri Documentation](https://tauri.app/)
- [Rust Book](https://doc.rust-lang.org/book/)
- [Tauri Plugin Development](https://tauri.app/v1/guides/plugins/)

## Conclusion

Migrating these native modules from Electron to Tauri requires careful planning and Rust expertise, but offers significant benefits in performance, security, and maintainability. Follow this guide's phased approach and leverage Tauri's ecosystem for successful migration.
