# PTY Migration Guide: From node-pty to portable-pty

## Overview

This document describes the migration from Electron's node-pty backend to Tauri's portable-pty backend for terminal functionality in MintMind. This migration eliminates the Node.js dependency, reduces bundle size by ~50MB, improves security, and enables cross-platform terminal operations without Node.js runtime requirements.

## Architecture Overview

### Before Migration (Electron + node-pty)
```
TerminalInstance → PtyService → TerminalProcess (node-pty)
                                      ↓
                               Node.js child_process
```

### After Migration (Tauri + portable-pty)
```
TerminalInstance → PtyService → TauriTerminalProcess (portable-pty)
                                      ↓
                               Tauri IPC → Rust PTY backend
```

### Dual-Mode Operation
The system supports both backends simultaneously:
- **Electron mode**: Uses node-pty via `TerminalProcess`
- **Tauri mode**: Uses portable-pty via `TauriTerminalProcess`
- Runtime detection via `globalThis.__TAURI__`

## API Mapping

| node-pty | portable-pty | Tauri Command | Description |
|----------|--------------|---------------|-------------|
| `spawn()` | `pty_spawn` | `invoke('pty_spawn')` | Create PTY process |
| `write()` | `pty_write` | `invoke('pty_write')` | Send data to PTY |
| `resize()` | `pty_resize` | `invoke('pty_resize')` | Resize terminal |
| `kill()` | `pty_kill` | `invoke('pty_kill')` | Send signal to process |
| - | `pty_read` | `invoke('pty_read')` | Read PTY output |
| - | `pty_shutdown` | `invoke('pty_shutdown')` | Graceful shutdown |
| - | `pty_get_cwd` | `invoke('pty_get_cwd')` | Get current working directory |
| - | `pty_get_title` | `invoke('pty_get_title')` | Get terminal title |
| - | `pty_get_shell_type` | `invoke('pty_get_shell_type')` | Get shell type |

## Implementation Details

### Rust Backend (`src-tauri/src/pty.rs`)

The Rust backend manages PTY sessions using a HashMap registry:

```rust
lazy_static! {
    static ref SESSION_REGISTRY: Mutex<HashMap<String, PtySession>> = Mutex::new(HashMap::new());
}

struct PtySession {
    pty: Box<dyn Pty>,
    child_pid: u32,
    shell_type: Option<String>,
    // ... additional state
}
```

**Key Features:**
- Platform-specific PTY implementations (Unix/Windows)
- Flow control with 100k/5k watermarks
- CWD detection via `/proc/<pid>/cwd` (Linux) or Windows API
- Shell type detection via process title
- Base64-encoded data streaming

### Tauri Commands (`src-tauri/src/pty_commands.rs`)

Tauri exposes PTY operations through typed commands:

```rust
#[tauri::command]
async fn pty_spawn(
    pty_id: String,
    shell_launch_config: ShellLaunchConfig,
) -> Result<SpawnResult, String> {
    // Implementation
}
```

### TypeScript Adapter (`src/vs/platform/terminal/node/terminalProcess.tauri.ts`)

The `TauriTerminalProcess` class implements `ITerminalChildProcess`:

```typescript
export class TauriTerminalProcess extends Disposable implements ITerminalChildProcess {
    private _ptyId: string;
    private _eventListeners: UnlistenFn[] = [];

    constructor(/* ... */) {
        super();
        this._ptyId = crypto.randomUUID();
        this._setupEventListeners();
    }

    async start(): Promise<ITerminalLaunchError | ITerminalLaunchResult | undefined> {
        // Spawn via Tauri IPC
        const result = await invoke('pty_spawn', { ptyId: this._ptyId, /* ... */ });
        return result;
    }
}
```

**Event Handling:**
- Uses Tauri's `listen()` for real-time events (`pty:data`, `pty:exit`, etc.)
- Bridges events to MintMind's `Event` system
- Flow control implemented via acknowledge mechanism

### Runtime Backend Selection (`src/vs/platform/terminal/node/ptyService.ts`)

Dynamic backend selection based on environment:

```typescript
function isTauriMode(): boolean {
    return typeof (globalThis as any).__TAURI__ !== 'undefined';
}

async function loadTauriTerminalProcess() {
    const module = await import('./terminalProcess.tauri');
    return module.TauriTerminalProcess;
}
```

The `createProcess` method selects the appropriate backend:

```typescript
if (isTauriMode()) {
    const TauriProcess = await loadTauriTerminalProcess();
    process = this._instantiationService.createInstance(TauriProcess, /* ... */);
} else {
    process = new TerminalProcess(/* ... */);
}
```

## Platform Behaviors

### Windows (ConPTY)
- Uses WinPTY as fallback when ConPTY unavailable
- Throttled resize operations to prevent hangs
- CWD detection via Windows API calls

### macOS
- Uses `lsof -p <pid>` for CWD detection
- Native PTY implementation with NFC normalization

### Linux
- Reads `/proc/<pid>/cwd` symlinks for CWD
- Standard Unix PTY behavior

## Shell Integration

Shell integration works by injecting scripts that emit special sequences:

1. **Injection**: Scripts copied to temp directory and executed
2. **Injection Config**: Environment variables set (`MINTMIND_INJECTION`, `MINTMIND_NONCE`)
3. **Supported Shells**: bash, zsh, fish, PowerShell
4. **Sequence Detection**: Parser recognizes MintMind injection markers

## Flow Control

Prevents terminal flooding with configurable watermarks:

- **High Watermark**: 100,000 unacknowledged chars → pause PTY
- **Low Watermark**: 5,000 unacknowledged chars → resume PTY
- **Ack Size**: 5,000 chars per acknowledgment batch

## Migration Checklist

### Phase 1: Backend Implementation ✅
- [x] Implement `pty.rs` with session management
- [x] Create `pty_commands.rs` with Tauri commands
- [x] Add PTY permissions to `main-capability.json`

### Phase 2: TypeScript Adapter ✅
- [x] Implement `TauriTerminalProcess` class
- [x] Bridge events between Tauri and MintMind
- [x] Implement flow control and property management

### Phase 3: Runtime Selection ✅
- [x] Add runtime detection (`isTauriMode()`)
- [x] Implement dynamic imports
- [x] Update `PtyService` for dual-mode operation
- [x] Update `TerminalInstance` logging

### Phase 4: Testing
- [ ] Unit tests for `TauriTerminalProcess`
- [ ] Integration tests for IPC communication
- [ ] E2E tests for terminal functionality
- [ ] Cross-platform validation (Windows/macOS/Linux)

### Phase 5: Documentation
- [x] Create this migration guide
- [ ] Update API documentation
- [ ] Add troubleshooting section

## Testing Strategy

### Unit Tests
```typescript
describe('TauriTerminalProcess', () => {
    it('should spawn process successfully', async () => {
        // Test basic spawning
    });

    it('should handle flow control', async () => {
        // Test watermark behavior
    });
});
```

### Integration Tests
- Verify IPC communication between frontend and Rust backend
- Test event propagation (data, exit, resize)
- Validate property updates (CWD, title, shell type)

### End-to-End Tests
- Full terminal session lifecycle
- Multi-terminal scenarios
- Performance under load (flow control)
- Shell integration activation

## Troubleshooting

### Common Issues

**Permission Denied Errors**
```
Error: pty_spawn failed: Access denied
```
- Check PTY permissions in `main-capability.json`
- Verify shell execution paths are allowed
- Ensure proper file system permissions

**Process Spawn Failures**
```
Failed to spawn terminal process
```
- Validate executable path exists
- Check working directory permissions
- Review shell launch configuration

**Data Flow Issues**
```
Terminal not receiving output
```
- Verify event listeners are properly registered
- Check flow control watermark settings
- Validate PTY session IDs match

**Flow Control Problems**
```
Terminal appears frozen
```
- Check unacknowledged character count
- Verify acknowledgment events are firing
- Review watermark configuration

### Debugging Commands

Enable trace logging:
```typescript
this._logService.setLevel(LogLevel.Trace);
```

Monitor PTY sessions:
```rust
// In Rust backend
println!("Active sessions: {:?}", SESSION_REGISTRY.lock().unwrap().keys());
```

### Platform-Specific Issues

**Windows ConPTY Issues**
- Ensure Windows build >= 18309 for ConPTY support
- Check for anti-virus interference
- Validate WinPTY fallback configuration

**macOS Permission Issues**
- Grant accessibility permissions for terminal apps
- Check System Integrity Protection settings
- Verify `lsof` command availability

**Linux CWD Detection**
- Ensure `/proc` filesystem is mounted
- Check process permissions for reading symlinks
- Validate PID validity

## Performance

### Bundle Size Reduction
- **Before**: ~50MB (node-pty + Node.js runtime)
- **After**: ~2MB (portable-pty Rust crate)
- **Savings**: ~48MB reduction

### Startup Improvements
- Faster PTY creation (no Node.js spawn overhead)
- Reduced memory footprint
- Better cross-platform consistency

### Throughput
- Base64 encoding adds ~33% overhead
- Flow control prevents congestion
- Event batching optimizes IPC calls

## Security

### Permission Model
Tauri v2 requires explicit permissions for all operations. The following PTY-specific permissions have been implemented in `src-tauri/capabilities/main-capability.json`:

```json
// Command permissions
{
  "identifier": "pty:allow-spawn",
  "allow": [
    {
      "cmd": "pty_spawn"
    }
  ]
},
{
  "identifier": "pty:allow-write",
  "allow": [
    {
      "cmd": "pty_write"
    }
  ]
},
{
  "identifier": "pty:allow-read",
  "allow": [
    {
      "cmd": "pty_read"
    }
  ]
},
{
  "identifier": "pty:allow-resize",
  "allow": [
    {
      "cmd": "pty_resize"
    }
  ]
},
{
  "identifier": "pty:allow-kill",
  "allow": [
    {
      "cmd": "pty_kill"
    },
    {
      "cmd": "pty_shutdown"
    }
  ]
},
{
  "identifier": "pty:allow-query",
  "allow": [
    {
      "cmd": [
        "pty_get_cwd",
        "pty_get_title",
        "pty_get_shell_type",
        "pty_get_pid",
        "pty_list_sessions"
      ]
    }
  ]
},
{
  "identifier": "pty:allow-flow-control",
  "allow": [
    {
      "cmd": [
        "pty_acknowledge_data",
        "pty_clear_unacknowledged"
      ]
    }
  ]
},
{
  "identifier": "pty:allow-stream",
  "allow": [
    {
      "cmd": "pty_start_data_stream"
    }
  ]
},

// Event permissions
{
  "identifier": "pty:allow-events",
  "allow": [
    {
      "event": [
        "pty:data",
        "pty:ready",
        "pty:exit",
        "pty:error",
        "pty:title-changed",
        "pty:cwd-changed"
      ]
    }
  ]
},

// Scoped shell permissions
{
  "identifier": "shell:allow-execute-pty",
  "allow": [
    {
      "$HOME/**": true
    },
    {
      "$APPDATA/**": true
    },
    {
      "/usr/bin/**": true
    },
    {
      "/bin/**": true
    }
  ]
}
```

### Input Validation
- All IPC inputs validated in Rust backend
- Path traversal prevention
- Command injection protection

### Scoped Execution
Shell commands restricted to allowed paths:
- `$HOME/**` - User home directory
- `$APPDATA/**` - Application data
- `/usr/bin/**` - System binaries
- `/bin/**` - Essential binaries

## Limitations

### Current Restrictions
1. **Buffer Clearing**: Not supported by portable-pty
2. **Unicode Version**: Fixed at v11 (no runtime switching)
3. **Command IDs**: Not tracked (renderer-only feature)

### Future Enhancements (Phase 8+)
- Windows CWD detection improvements
- Enhanced buffer management
- Advanced Unicode support

## References

- [Tauri v2 Documentation](https://v2.tauri.app/)
- [portable-pty Crate](https://crates.io/crates/portable-pty)
- [MintMind Terminal Architecture](https://github.com/microsoft/vscode/wiki/Terminal)
- [TAURI_MIGRATION_ROADMAP.md](../TAURI_MIGRATION_ROADMAP.md)
