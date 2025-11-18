# Backend Service Integration Framework

This directory contains a Rust framework for implementing backend services that integrate with the MintMind CLI through inter-process communication (IPC). The framework provides utilities for service lifecycle management, logging, path normalization, and RPC communication.

## Overview

The backend service integration framework enables developers to create high-performance services in Rust that can be spawned and managed by TypeScript code running in the MintMind CLI. The framework provides:

- **IPC Communication**: Base64-encoded JSON-RPC over stdin/stdout for secure, structured communication
- **Lifecycle Management**: Service spawning, parent process monitoring, and graceful shutdown
- **Logging Bridge**: Forwarding of Rust log messages to TypeScript via IPC
- **Path Utilities**: Cross-platform path normalization and manipulation functions
- **Service Patterns**: Reference implementations and best practices for common service architectures

### Architecture

The framework consists of several key components:

```
TypeScript (CLI) ↔ IPC Transport ↔ Rust Service
      ↓                    ↓                    ↓
  ServiceSpawner → ParentMonitor → RPC Dispatcher
                                → IPC Logger
                                → Path Normalizer
```

Services run as separate processes and communicate bidirectionally with the parent TypeScript process using line-based message exchange over stdin/stdout. All messages are base64-encoded for compatibility with MintMind's IPC system.

## Quick Start

Follow these steps to create a new backend service:

1. **Create a new Rust file** for your service (e.g., `my_service.rs`):

```rust
use std::env;
use tokio::signal;
use tokio::sync::mpsc;

use crate::services::{ipc::start_node_ipc_server, lifecycle::ParentMonitor, logging::create_ipc_logger};
use crate::util::errors::AnyError;

pub struct MyService;

impl MyService {
    pub fn process_data(&self, input: String) -> Result<String, AnyError> {
        Ok(format!("Processed: {}", input))
    }
}

#[tokio::main]
async fn main() -> Result<(), AnyError> {
    // Get parent PID
    let parent_pid = env::var("MINTMIND_PARENT_PID")
        .unwrap_or_else(|_| "1".to_string())
        .parse::<u32>()
        .unwrap_or(1);

    // Create IPC logging channel
    let (log_tx, _) = mpsc::unbounded_channel();

    // Set up logging
    let logger = create_ipc_logger(log_tx, crate::log::Level::Info);

    // Create RPC builder with service
    let service = MyService;
    let mut rpc_builder = RpcBuilder::new(crate::json_rpc::JsonRpcSerializer {});
    let mut method_builder = rpc_builder.methods(service);

    // Register RPC methods
    method_builder.register_sync("processData", |input: String, service: &MyService| {
        service.process_data(input)
    })?;

    // Build dispatcher
    let dispatcher = method_builder.build(logger);

    // Set up parent monitoring
    let monitor = ParentMonitor::new(parent_pid);

    // Start IPC server
    let ipc_handle = tokio::spawn(async move {
        start_node_ipc_server_with(dispatcher).await
    });

    // Start parent monitoring
    let monitor_handle = tokio::spawn(async move {
        monitor.monitor().await
    });

    // Set up shutdown handling
    let shutdown_signal = async {
        tokio::select! {
            _ = signal::ctrl_c() => {},
            _ = signal::unix::SignalKind::terminate() => {},
        }
    };

    // Run until shutdown
    tokio::select! {
        _ = shutdown_signal => {
            info!(dispatcher.log, "Shutdown signal received");
        }
        result = monitor_handle => {
            match result {
                Ok(Ok(())) => info!(dispatcher.log, "Parent monitoring completed"),
                Ok(Err(e)) => error!(dispatcher.log, "Parent monitoring failed: {:?}", e),
                Err(e) => error!(dispatcher.log, "Monitoring task panicked: {:?}", e),
            }
        }
    }

    // Wait for IPC server to finish
    let _ = ipc_handle.await;

    Ok(())
}
```

2. **Add to module exports** in `mod.rs`:

```rust
pub mod my_service;
```

3. **Spawn from TypeScript**:

```typescript
import { spawn } from 'child_process';
import { ServiceSpawner } from './services';

const spawner = new ServiceSpawner();
const serviceProcess = await spawner.spawn('./my_service', [], {
  env: { MINTMIND_PARENT_PID: process.pid.toString() }
});

// Communicate with service
serviceProcess.send({ id: 1, method: 'processData', params: ['hello'] });
```

## IPC Protocol

Communication between TypeScript and Rust services uses base64-encoded JSON-RPC 2.0 over stdin/stdout.

### Message Format

All messages are JSON-RPC 2.0 objects wrapped in base64 encoding:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "myMethod",
  "params": ["arg1", "arg2"]
}
```

Raw JSON is base64-encoded before transmission:

```
eyJqc29ucnBjIjoiMi4wIiwiaWQiOjEsIm1ldGhvZCI6Im15TWV0aG9kIiwicGFyYW1zIjpbImFyZzEiLCJhcmcyIl19
```

### RPC Conventions

- **Request IDs**: Monotonically increasing integers starting from 1
- **Method Names**: camelCase strings matching registered Rust methods
- **Parameter Types**: Match Rust method signatures exactly
- **Error Handling**: Standard JSON-RPC error objects with custom error codes
- **Streaming**: Support for server-to-client streaming via notification methods

### Transport Details

- **Encoding**: UTF-8 base64-encoded JSON lines
- **Framing**: Line-based (\n delimited)
- **Buffering**: Full line buffering for reliability
- **Timeouts**: Configurable per-operation timeouts
- **Concurrency**: Single-threaded request processing with async I/O

## Logging

The framework provides a logging bridge that forwards Rust log messages to TypeScript via IPC.

### IPC Logging Bridge

Log messages are formatted as `__$console` type messages:

```json
{
  "type": "__$console",
  "severity": "info",
  "arguments": ["[2023-11-10 14:08:35] INFO my_service: Processing data"]
}
```

### Log Level Mapping

Rust log levels map to TypeScript severity levels:

| Rust Level | TypeScript Severity |
|------------|-------------------|
| `Trace`    | `"log"`          |
| `Debug`    | `"log"`          |
| `Info`     | `"info"`         |
| `Warn`     | `"warn"`         |
| `Error`    | `"error"`        |
| `Critical` | `"error"`        |

### Usage

Create an IPC logger and use it in your service:

```rust
let (log_tx, _) = mpsc::unbounded_channel();
let logger = create_ipc_logger(log_tx, Level::Info);

// Use in RPC dispatcher
let dispatcher = method_builder.build(logger);

// Log messages
info!(dispatcher.log, "Service started");
error!(dispatcher.log, "Failed to process: {:?}", error);
```

## Lifecycle Management

The framework provides utilities for service spawning, monitoring, and shutdown.

### Service Spawning

Use `ServiceSpawner` to create new service processes:

```rust
let config = ServiceConfig {
    name: "my_service".to_string(),
    log_level: Level::Info,
    parent_pid: process::id(),
    env_vars: HashMap::new(),
};

let handle = ServiceSpawner::spawn(&config, "my_service", &[]).await?;
```

### Parent Process Monitoring

Services monitor their parent process and exit gracefully when the parent dies:

```rust
let monitor = ParentMonitor::new(parent_pid);
let monitor_handle = tokio::spawn(async move {
    monitor.monitor().await
});
```

### Shutdown Patterns

Implement graceful shutdown with signal handling:

```rust
let shutdown_signal = async {
    tokio::select! {
        _ = signal::ctrl_c() => {},
        _ = signal::unix::SignalKind::terminate() => {},
    }
};
```

## Path Utilities

Cross-platform path normalization and manipulation functions compatible with Node.js path module.

### Core Functions

- **`normalize()`**: Resolves `.` and `..` segments, removes redundant separators
- **`resolve()`**: Converts relative paths to absolute paths
- **`join()`**: Joins path segments with platform-specific separators
- **`relative()`**: Computes relative path from one absolute path to another
- **`is_absolute()`**: Tests if a path is absolute
- **`parse()`**: Breaks path into components (root, dir, base, ext, name)

### Platform Compatibility

The path utilities handle differences between Windows and POSIX systems:

```rust
// Windows
PathNormalizer::normalize("C:\\foo\\bar\\..\\baz"); // "C:\\foo\\baz"

// POSIX
PathNormalizer::normalize("/foo/bar/../baz"); // "/foo/baz"
```

### Usage

```rust
use crate::services::paths::PathNormalizer;

// Normalize paths
let normalized = PathNormalizer::normalize("./foo/../bar");

// Join paths
let joined = PathNormalizer::join(&["/usr", "local", "bin"]);

// Check if absolute
let is_abs = PathNormalizer::is_absolute("/absolute/path");
```

## Examples

The framework includes a complete echo service example that demonstrates all core patterns.

### Echo Service Pattern

```rust
// cli/examples/echo_service.rs
pub struct EchoService;

impl EchoService {
    pub fn echo(&self, message: String) -> Result<String, AnyError> {
        Ok(format!("Echo: {}", message))
    }
}
```

Key patterns demonstrated:

1. **Service Struct**: Clean separation of business logic
2. **RPC Registration**: Synchronous method registration with type safety
3. **IPC Setup**: Standard IPC server initialization
4. **Lifecycle Management**: Parent monitoring and graceful shutdown
5. **Logging Integration**: IPC logging bridge setup
6. **Error Handling**: Proper error propagation through RPC layer

### Key Patterns

- **Stateless Services**: Services without internal state work well for RPC
- **Async Methods**: Use `register_async` for I/O-bound operations
- **Streaming**: Implement streaming responses for large data transfers
- **Resource Cleanup**: Implement `Drop` traits for proper cleanup
- **Configuration**: Accept configuration through environment variables

## Integration with TypeScript

TypeScript code spawns and communicates with Rust services using Node.js child_process.

### Service Spawning

```typescript
import { spawn } from 'child_process';
import { createInterface } from 'readline';

class RustService {
  private process: ChildProcess;
  private rl: ReadlineInterface;

  constructor(binaryPath: string, args: string[] = []) {
    this.process = spawn(binaryPath, args, {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: {
        ...process.env,
        MINTMIND_PARENT_PID: process.pid.toString(),
      },
    });

    this.rl = createInterface({
      input: this.process.stdout,
      output: this.process.stdin,
      terminal: false,
    });
  }

  async call<T = any>(method: string, params: any[] = []): Promise<T> {
    const id = ++this.nextId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      // Send base64-encoded request
      const encoded = Buffer.from(JSON.stringify(request)).toString('base64');
      this.process.stdin.write(encoded + '\n');

      // Wait for response
      const handler = (line: string) => {
        try {
          const decoded = Buffer.from(line, 'base64').toString();
          const response = JSON.parse(decoded);
          if (response.id === id) {
            this.rl.off('line', handler);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch (e) {
          reject(e);
        }
      };

      this.rl.on('line', handler);
    });
  }

  shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.process.on('exit', () => resolve());
      this.process.kill('SIGTERM');
    });
  }
}
```

### Communication Flow

1. TypeScript spawns Rust process with stdin/stdout pipes
2. Sets `MINTMIND_PARENT_PID` environment variable
3. Sends base64-encoded JSON-RPC requests
4. Receives base64-encoded JSON-RPC responses
5. Handles service lifecycle (startup, monitoring, shutdown)

## Best Practices

### Error Handling

- Use `AnyError` for consistent error types across RPC boundaries
- Implement proper error serialization for custom error types
- Handle both synchronous and asynchronous errors appropriately
- Log errors before returning them to clients

### Resource Cleanup

```rust
struct MyService {
    temp_files: Vec<PathBuf>,
}

impl Drop for MyService {
    fn drop(&mut self) {
        for file in &self.temp_files {
            let _ = fs::remove_file(file);
        }
    }
}
```

### Testing

- Unit test service logic separately from IPC layer
- Use mock RPC dispatchers for testing
- Test error conditions and edge cases
- Verify proper cleanup in test teardown

### Performance

- Minimize allocations in hot paths
- Use async methods for I/O operations
- Implement streaming for large data transfers
- Profile and optimize RPC serialization

## Troubleshooting

### Common Issues

**Service fails to start**
- Check binary permissions and path
- Verify environment variables are set correctly
- Ensure parent PID is valid

**IPC communication fails**
- Verify base64 encoding/decoding
- Check JSON-RPC message format
- Ensure stdin/stdout pipes are not closed
- Test with simple echo service first

**Service exits unexpectedly**
- Check parent process monitoring is working
- Verify signal handling is implemented
- Review error logs in TypeScript console
- Test service isolation (run independently)

**High memory usage**
- Implement proper resource cleanup
- Check for memory leaks in async operations
- Monitor for unbounded channel growth
- Profile with memory tracing tools

### Debugging Tips

**Enable verbose logging**
```rust
let logger = create_ipc_logger(log_tx, Level::Debug);
```

**Add debug prints**
```rust
eprintln!("Debug: processing request {:?}", request);
```

**Test IPC manually**
```bash
echo "eyJqc29ucnBjIjoiMi4wIiwiaWQiOjEsIm1ldGhvZCI6ImVjaG8iLCJwYXJhbXMiOlsiSGVsbG8iXX0=" | base64 -d
```

**Monitor process tree**
```bash
ps aux | grep service_name
```

**Check IPC messages**
Use Wireshark or tcpdump to inspect stdin/stdout traffic, or add logging around message serialization/deserialization.
