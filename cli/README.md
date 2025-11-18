# Code CLI

## File I/O Service

The native Rust File I/O service provides high-performance file operations with resource locking and IPC communication. It offers a secure, efficient alternative to direct file system operations in MintMind.

### Features

- **Comprehensive File Operations**: Read, write, copy, move, delete, and stat operations
- **Resource Locking**: Automatic locking to prevent concurrent access conflicts
- **Atomic Operations**: Support for atomic writes, deletes, and file handles
- **IPC Integration**: JSON-RPC communication over stdin/stdout
- **Cross-Platform Support**: Consistent behavior across Linux, macOS, and Windows
- **Error Handling**: Detailed error reporting with appropriate error codes

### Architecture

The File I/O service consists of several key components:

- **service.rs**: Main `FileIOService` coordinating all file operations
- **operations.rs**: Core file operation implementations
- **locks.rs**: Resource locking and concurrency control
- **platform.rs**: Platform-specific file system logic
- **types.rs**: Data structures for requests and responses
- **fileio.rs**: Binary entry point with Tokio runtime and RPC loop

### Usage

#### Building

Build the File I/O service binary:

```bash
# Debug build
cargo build --bin fileio

# Release build
cargo build --release --bin fileio
```

#### Standalone Binary

The service can be run as a standalone binary:

```bash
# Start IPC server with default logging
./fileio

# Start with custom log level
./fileio --log-level debug
```

#### Integration

The service integrates with MintMind through the `DiskFileSystemProviderClient` in `diskFileSystemProviderClient.ts`, which automatically spawns the native binary and communicates via IPC with fallback to the TypeScript implementation.

### RPC Methods

The service exposes these JSON-RPC methods:

- `onFileIORequest`: Main entry point for file operations with a `FileIORequest` payload

Supported operations:
- `ReadFile`: Read file contents with encoding support
- `WriteFile`: Write content with atomic and encoding options
- `Copy`: Copy files with overwrite control
- `Delete`: Delete files/directories with recursive support
- `Stat`: Get file/directory metadata
- `ReadDir`: List directory contents
- `RealPath`: Resolve symbolic links
- `MkDir`: Create directories
- `Rename`: Move/rename files
- `OpenFile`: Open file handles for streaming
- `CloseFile`: Close file handles
- `ReadFileHandle`: Read from file handles
- `WriteFileHandle`: Write to file handles
- `ReadFileStream`: Stream file contents
- `Clone`: Clone files efficiently

### Configuration

- **Logging**: Configurable via `--log-level` flag (trace, debug, info, warn, error, critical, off)
- **Resource Locks**: Automatic per-file locking with deadlock prevention
- **Atomic Operations**: Temp file creation with `.tmp` postfix for atomic writes
- **Error Mapping**: POSIX-style error codes (ENOENT, EPERM, EEXIST, etc.)

### Testing

Run tests with:

```bash
# All FileIO tests
cargo test --package code-cli fileio

# Specific test categories
cargo test -p cli -- fileio::tests::unit_tests
cargo test -p cli -- fileio::tests::concurrency_tests
cargo test -p cli -- fileio::tests::ipc_tests
```

Tests include:
- Unit tests for individual operations
- Concurrency tests for locking behavior
- IPC integration tests for communication
- Error handling and edge case coverage

## Watcher Service

The native Rust file watcher service provides high-performance file system monitoring for MintMind. It replaces the previous TypeScript implementation with a more efficient native binary.

### Features

- **Recursive and Non-Recursive Watching**: Support for both deep directory watching and shallow single-directory monitoring
- **Event Coalescing**: Intelligent merging of multiple file system events to reduce noise
- **Event Throttling**: Configurable buffering and timing to prevent event floods
- **IPC Integration**: Seamless communication with MintMind via JSON-RPC over stdin/stdout
- **Subscription Reuse**: Efficient watcher reuse for non-recursive watchers
- **Failure Recovery**: Automatic suspension and resumption of failed watchers

### Architecture

The watcher service consists of several key components:

- **service.rs**: Main `UniversalWatcher` service coordinating all watchers
- **recursive.rs**: High-performance recursive file watching using the `notify` crate
- **non_recursive.rs**: Non-recursive watching with subscription multiplexing
- **coalescer.rs**: Event deduplication and merging logic
- **throttler.rs**: Event buffering and rate limiting
- **suspend.rs**: Failure handling and recovery mechanisms
- **types.rs**: Data structures matching TypeScript interfaces

### Usage

#### Standalone Binary

The watcher can be run as a standalone binary:

```bash
# Start IPC server
./watcher serve

# Watch a directory recursively
./watcher watch --path /some/path --recursive

# Watch a directory non-recursively
./watcher watch --path /some/path

# Stop watching
./watcher unwatch --id watcher-id
```

#### Integration

The watcher integrates with MintMind through the `UniversalWatcherClient` in `watcherClient.ts`, which automatically spawns the native binary and communicates via IPC.

### RPC Methods

The service exposes these JSON-RPC methods:

- `watch(request: WatchRequest)`: Start watching a directory
- `unwatch(id: string)`: Stop watching
- `getPendingChanges(id: string)`: Get buffered changes
- `getStats()`: Get service statistics

### Event Coalescing Rules

Following TypeScript implementation rules:
- CREATE followed by DELETE = no change
- DELETE followed by CREATE = CHANGE
- Any change after DELETE = CHANGE
- Multiple CREATE/CHANGE = most recent CHANGE

### Configuration

- **Recursive watchers**: 500 events buffered, 200ms throttle interval
- **Non-recursive watchers**: 100 events buffered, 200ms throttle interval
- **Failure suspension**: 30 seconds after 5 consecutive failures
- **Failure reset**: Reset counter after 5 minutes of success

### Testing

Run tests with:

```bash
cargo test --package code-cli watcher
```

Tests include:
- Unit tests for coalescing logic
- Integration tests for full service lifecycle
- Event processing and throttling verification