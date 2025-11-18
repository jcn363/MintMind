# Keyboard Layout Migration Guide

## Overview

This guide documents the migration from `native-keymap` Node.js module to Rust-based keyboard layout detection in Tauri. This is Phase 8 of the Tauri migration roadmap, replacing the ~10MB bundle size native-keymap dependency with platform-specific Rust implementations.

## Architecture Overview

### Before (Electron + native-keymap)

```text
TypeScript Service → native-keymap Node.js module → OS APIs
```

### After (Tauri + Rust keyboard module)

```text
TypeScript Service → Tauri IPC → Rust Backend → OS APIs
```

The migration enables dual-mode operation: Electron mode uses the existing `native-keymap` module, while Tauri mode uses new Rust commands and events.

## API Mapping

| native-keymap Function        | Tauri Command/Event                           | Description                       |
| ----------------------------- | --------------------------------------------- | --------------------------------- |
| `getKeyMap()`                 | `invoke('get_keyboard_layout_data')`          | Returns keyboard mapping object   |
| `getCurrentKeyboardLayout()`  | `invoke('get_keyboard_layout_data')`          | Returns layout info object        |
| `onDidChangeKeyboardLayout()` | `listen('keyboard:layout-changed', callback)` | Event listener for layout changes |

## Implementation Details

### Rust Backend (`keyboard.rs`)

The Rust module provides platform-specific keyboard layout detection using conditional compilation:

- **Windows**: Uses `winreg` crate to read keyboard layout from registry keys (`HKEY_CURRENT_USER\Keyboard Layout\Preload`)
- **macOS**: Uses `core-foundation` and `core-graphics` for IOKit keyboard layout APIs
- **Linux**: Uses `x11`/`wayland-client` crates to detect and query X11/Wayland keyboard layouts

Key components:

- `KeyboardLayoutData` struct with `keyboard_layout_info` and `keyboard_mapping` fields
- Platform-specific layout info structs (`WindowsKeyboardLayoutInfo`, `MacKeyboardLayoutInfo`, `LinuxKeyboardLayoutInfo`)
- Global cache (`KEYBOARD_LAYOUT_CACHE`) with lazy initialization
- Event emission system for layout changes

### Tauri Commands (`keyboard_commands.rs`)

Three commands wrap the Rust keyboard detection:

1. `get_keyboard_layout_data` - Returns current layout data from cache or queries OS
2. `start_keyboard_layout_listener` - Registers app handle for change notifications
3. `stop_keyboard_layout_listener` - Removes app handle from listeners

### TypeScript Adapter

The `KeyboardLayoutMainService` class now detects runtime mode and routes to appropriate implementation:

```typescript
private async _doInitialize(): Promise<void> {
  if (isTauriMode()) {
    await this._doInitializeTauri();
  } else {
    await this._doInitializeElectron();
  }
}
```

## Platform Behaviors

### Windows

- Registry keys: `HKEY_CURRENT_USER\Keyboard Layout\Preload`
- Virtual key mapping using Windows API (`MapVirtualKeyEx`)
- Layout change detection via polling (2-second intervals) - planned: `SetWindowsHookEx` (WH_KEYBOARD_LL)

### macOS

- IOKit APIs: `TISCopyCurrentKeyboardInputSource()`, `UCKeyTranslate()`
- Dead key handling with `kUCKeyActionDown` state checking
- Layout change via polling (2-second intervals) - planned: `NSDistributedNotificationCenter`

### Linux

- X11: `setxkbmap -query` output parsing
- Wayland: XKB state querying from `$XDG_CONFIG_HOME/xkb` (planned)
- Polling-based change detection (2-second intervals)

## Data Structures

### TypeScript Interfaces

```typescript
interface IKeyboardLayoutData {
  keyboardLayoutInfo: IKeyboardLayoutInfo;
  keyboardMapping: { [scanCode: string]: any };
}

interface IKeyboardLayoutInfo {
  id: string;
  lang: string;
  localizedName?: string;
  displayName?: string;
  text?: string;
  // ... platform-specific fields
}
```

### Rust Structs

```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct KeyboardLayoutData {
    pub keyboard_layout_info: KeyboardLayoutInfo,
    pub keyboard_mapping: HashMap<String, serde_json::Value>,
}
```

## Migration Checklist

- [x] Phase 1: Backend Implementation
- [x] Phase 2: TypeScript Adapter
- [x] Phase 3: Runtime Selection
- [x] Phase 4: Testing (unit, integration, E2E)
- [x] Phase 5: Documentation

## Testing Strategy

### Unit Tests

- Rust functions for each platform's keyboard detection
- Command validation and error handling
- Cache behavior and layout parsing

### Integration Tests

- IPC communication between TypeScript and Rust
- Event emission and listener registration
- Dual-mode service initialization

### E2E Tests

- Layout switching scenarios
- Change detection accuracy
- Fallback behavior on detection failure

## Troubleshooting

### Permission Errors

- **Windows**: Ensure registry access permissions
- **macOS**: Grant accessibility permissions for keyboard monitoring
- **Linux**: Verify X11/Wayland display server access

### Detection Failures

- Check OS API availability
- Verify platform-specific dependencies
- Enable debug logging for detection attempts

### Event Listener Issues

- Confirm Tauri event permissions in capabilities
- Check listener registration/unregistration
- Monitor event payload serialization

## Performance

### Bundle Size Reduction

- Eliminates ~10MB `native-keymap` native module
- Reduces Node.js runtime overhead
- Platform-specific compilation minimizes binary size

### Startup Improvements

- Lazy initialization after window open
- Cached layout data prevents repeated OS queries
- Background thread for change detection

## Security

### Permission Model

- `keyboard:allow-query`: Command execution permissions
- `keyboard:allow-events`: Event listening permissions
- Scoped to main window only

### Input Validation

- Layout data structure validation
- Scan code format checking
- Platform-specific field validation

### Data Isolation

- Read-only OS API access
- No filesystem or network operations
- Sandboxed platform API calls

## Limitations

### Current Restrictions

- All platforms use polling-based change detection (2s intervals) instead of OS hooks
- Basic keyboard mapping with hardcoded key sets (KeyA, KeyB, Digit1, Digit2)
- Limited dead key support on Windows (dead keys always set to false)
- macOS layout names may vary by system language
- Wayland client integration not implemented
- Full OS hook integration deferred (SetWindowsHookEx, NSDistributedNotificationCenter)

### Future Enhancements

- Native Wayland keyboard event listeners
- Improved dead key handling across platforms (using `windows` crate APIs)
- Full OS hook integration (SetWindowsHookEx, NSDistributedNotificationCenter)
- Complete keyboard mapping coverage beyond basic keys
- Layout prediction and caching optimizations

## References

- [Tauri v2 Documentation](https://tauri.app/v2/)
- [Windows Keyboard Layout API](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getkeyboardlayout)
- [macOS Text Input Sources](https://developer.apple.com/documentation/coreservices/text_input_sources)
- [Linux XKB Configuration](https://xkbcommon.org/)
- [MintMind Keyboard Layout Architecture](../src/vs/platform/keyboardLayout/)
- [Tauri Migration Roadmap](../docs/TAURI_MIGRATION_ROADMAP.md)
