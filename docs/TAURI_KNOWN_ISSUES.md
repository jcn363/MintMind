# Tauri Known Issues

This document tracks known issues in the Tauri-based MintMind application, including critical bugs, platform-specific problems, performance issues, and extension compatibility problems. Issues are categorized by severity and include workarounds and status tracking.

## Issue Categories and Severity Levels

### Severity Definitions
- **🔴 Critical**: Blocks core functionality, crashes, or data loss
- **🟠 High**: Major feature broken, significant user impact
- **🟡 Medium**: Minor feature broken, workaround available
- **🟢 Low**: Cosmetic issues, minor inconvenience
- **🔵 Info**: Planned improvements, feature requests

### Status Definitions
- **Open**: Actively being investigated
- **In Progress**: Fix is being developed
- **Fixed**: Resolved in upcoming release
- **Won't Fix**: Known limitation, no fix planned
- **Duplicate**: Consolidated with another issue

## Critical Issues

### 🔴 Terminal Crashes on Windows 11
- **Issue ID**: #TAURI-001
- **Platforms**: Windows 11 (build 22000+)
- **Description**: Terminal windows crash randomly when using PTY operations
- **Impact**: Complete loss of terminal functionality
- **Workaround**:
  1. Use external terminal (PowerShell/Command Prompt)
  2. Disable integrated terminal in settings: `"terminal.integrated.enable": false`
  3. Downgrade to Windows 10 if possible
- **Root Cause**: WebView2 PTY implementation conflicts with Windows 11 security features
- **Status**: In Progress (Target: v1.1.1)
- **Reported**: 2023-11-15
- **Priority**: P0

### 🔴 File Dialog Freezing on macOS Sonoma
- **Issue ID**: #TAURI-002
- **Platforms**: macOS Sonoma (14.0+)
- **Description**: Native file open/save dialogs freeze the application
- **Impact**: Cannot open or save files through standard dialogs
- **Workaround**:
  1. Use keyboard shortcuts (Cmd+O for open, Cmd+S for save)
  2. Drag and drop files into the workspace
  3. Use "File > Open Recent" for frequently accessed files
- **Root Cause**: macOS Sonoma changed NSOpenPanel API behavior
- **Status**: Fixed (v1.0.3)
- **Reported**: 2023-09-20
- **Priority**: P0

## Platform-Specific Issues

### Windows Issues

#### 🟠 Registry Access Slow on Windows Server
- **Issue ID**: #TAURI-003
- **Platforms**: Windows Server 2019/2022
- **Description**: Registry operations take 5-10x longer than expected
- **Impact**: Slow startup, extension activation delays
- **Workaround**:
  1. Pre-warm registry cache: Run `reg query HKCU` in Command Prompt
  2. Disable registry-based extensions temporarily
  3. Use local settings instead of global preferences
- **Root Cause**: Windows Server registry virtualization overhead
- **Status**: In Progress (Target: v1.2.0)
- **Reported**: 2023-10-05
- **Priority**: P1

#### 🟡 Keyboard Layout Detection Failure
- **Issue ID**: #TAURI-004
- **Platforms**: Windows with non-US keyboard layouts
- **Description**: Special characters and shortcuts don't work with international keyboards
- **Impact**: Cannot use locale-specific keyboard shortcuts
- **Workaround**:
  1. Set keyboard layout to US English in Windows settings
  2. Use on-screen keyboard for special characters
  3. Remap shortcuts in MintMind keybindings
- **Root Cause**: Tauri keyboard event handling doesn't account for keyboard layout mapping
- **Status**: Open
- **Reported**: 2023-08-12
- **Priority**: P2

### macOS Issues

#### 🟠 Slow File Operations on macOS Monterey
- **Issue ID**: #TAURI-005
- **Platforms**: macOS Monterey (12.x)
- **Description**: File read/write operations 2-3x slower than expected
- **Impact**: Lag when opening large files or workspaces
- **Workaround**:
  1. Increase file watcher memory: `"files.watcher.memory": 8192`
  2. Disable file tree preview: `"explorer.openEditors.visible": 0`
  3. Use SSD storage for workspace files
- **Root Cause**: Monterey's file system optimization conflicts with Tauri's VFS layer
- **Status**: In Progress (Target: v1.1.2)
- **Reported**: 2023-09-01
- **Priority**: P1

#### 🟡 Gatekeeper Warnings on First Launch
- **Issue ID**: #TAURI-006
- **Platforms**: macOS Ventura/Sonoma
- **Description**: macOS Gatekeeper shows security warning on first run
- **Impact**: Extra step required for initial setup
- **Workaround**:
  1. Right-click app and select "Open"
  2. Click "Open" in the security dialog
  3. App will remember the choice for future launches
- **Root Cause**: Unsigned Tauri application bundle
- **Status**: Won't Fix (Apple requirement)
- **Reported**: 2023-07-15
- **Priority**: P3

### Linux Issues

#### 🟠 Wayland Keyboard Layout Issues
- **Issue ID**: #TAURI-007
- **Platforms**: Linux with Wayland (Ubuntu 22.04+, Fedora 36+)
- **Description**: Keyboard layout detection fails in Wayland sessions
- **Impact**: Wrong characters typed, shortcuts don't work
- **Workaround**:
  1. Force X11 session: `echo $XDG_SESSION_TYPE` should show "x11"
  2. Set environment variable: `export GDK_BACKEND=x11`
  3. Configure keyboard layout in system settings
- **Root Cause**: Wayland doesn't expose keyboard layout to applications
- **Status**: Open
- **Reported**: 2023-10-20
- **Priority**: P2

#### 🟡 Permission Denied on /opt Installation
- **Issue ID**: #TAURI-008
- **Platforms**: Linux distributions with restricted /opt access
- **Description**: Cannot install to /opt without root privileges
- **Impact**: Must use user directory or run installer as root
- **Workaround**:
  1. Install to user directory: `./installer.sh --user`
  2. Use AppImage version (no installation required)
  3. Run installer with sudo: `sudo ./installer.sh`
- **Root Cause**: Distribution security policies restrict /opt writes
- **Status**: Info (Expected behavior)
- **Reported**: 2023-06-10
- **Priority**: P4

## Performance Issues

### 🟠 Higher IPC Latency on Linux
- **Issue ID**: #TAURI-009
- **Platforms**: Linux (all distributions)
- **Description**: Inter-process communication 20-30% slower than expected
- **Impact**: Slower extension activation, UI responsiveness
- **Workaround**:
  1. Reduce concurrent extensions: Keep < 10 extensions active
  2. Increase IPC buffer size: `"tauri.ipc.bufferSize": 65536`
  3. Use native Linux kernel (avoid WSL/Containers)
- **Root Cause**: Linux IPC implementation overhead in Tauri
- **Status**: In Progress (Target: v1.1.0)
- **Reported**: 2023-08-30
- **Priority**: P1

### 🟡 Memory Leak in Long-Running Sessions
- **Issue ID**: #TAURI-010
- **Platforms**: All platforms
- **Description**: Memory usage grows by 50-100MB per day of continuous use
- **Impact**: Performance degradation over time
- **Workaround**:
  1. Restart application daily
  2. Monitor memory usage with Task Manager/Activity Monitor
  3. Close unused workspace folders
- **Root Cause**: IPC connection pooling not releasing resources properly
- **Status**: In Progress (Target: v1.1.5)
- **Reported**: 2023-09-15
- **Priority**: P2

## Extension Compatibility Issues

### 🟡 GitLens Extension Conflicts
- **Issue ID**: #TAURI-011
- **Platforms**: All platforms
- **Description**: GitLens v13+ shows errors with Tauri file watching
- **Impact**: Git decorations may not update properly
- **Workaround**:
  1. Downgrade to GitLens v12.2.2
  2. Disable real-time git decorations: `"gitlens.currentLine.enabled": false`
  3. Use MintMind's built-in Git features instead
- **Root Cause**: GitLens uses deprecated file watching APIs
- **Status**: Fixed (Extension updated)
- **Reported**: 2023-07-20
- **Priority**: P2

### 🟡 Remote SSH Extension Timeout
- **Issue ID**: #TAURI-012
- **Platforms**: All platforms
- **Description**: SSH connections timeout more frequently
- **Impact**: Remote development sessions disconnect
- **Workaround**:
  1. Increase timeout settings: `"remote.SSH.connectTimeout": 60000`
  2. Use stable SSH connection with keep-alive
  3. Verify network stability before connecting
- **Root Cause**: IPC latency affects SSH tunnel stability
- **Status**: In Progress (Target: v1.1.3)
- **Reported**: 2023-10-01
- **Priority**: P1

### 🟡 Python Extension IntelliSense Delay
- **Issue ID**: #TAURI-013
- **Platforms**: All platforms
- **Description**: Python IntelliSense has 2-3 second delay
- **Impact**: Slower code completion and error detection
- **Workaround**:
  1. Disable advanced analysis: `"python.analysis.diagnosticMode": "off"`
  2. Use Jedi instead of Pylance: `"python.languageServer": "Jedi"`
  3. Pre-analyze workspace: `Python: Analyze Workspace` command
- **Root Cause**: IPC overhead affects language server communication
- **Status**: Open
- **Reported**: 2023-09-05
- **Priority**: P2

## Workarounds Summary

### Immediate Actions (Do These First)
1. **For Windows users**: Check Windows version and consider workarounds for registry/keyboard issues
2. **For macOS users**: Be prepared for Gatekeeper warnings and file dialog issues
3. **For Linux users**: Verify Wayland vs X11 and check permissions
4. **For all users**: Monitor memory usage and restart periodically

### Configuration Workarounds
Add these to your `settings.json`:
```json
{
  "terminal.integrated.enable": true,
  "files.watcher.memory": 8192,
  "tauri.ipc.bufferSize": 65536,
  "remote.SSH.connectTimeout": 60000
}
```

### Extension-Specific Fixes
- GitLens: Use v12.2.2 or disable real-time features
- Remote SSH: Increase timeouts and verify network
- Python: Switch to Jedi or disable advanced analysis

## Issue Status Tracking

### Version Milestones
- **v1.0.3**: Fixed macOS file dialog freezing
- **v1.1.0**: Address IPC latency and terminal crashes
- **v1.1.1**: Complete Windows terminal stability
- **v1.1.2**: macOS file operation performance
- **v1.1.3**: Remote SSH stability improvements
- **v1.1.5**: Memory leak fixes

### Priority Distribution
- **P0 (Critical)**: 2 issues (terminal crash, file dialog freeze)
- **P1 (High)**: 4 issues (registry, file ops, IPC, SSH)
- **P2 (Medium)**: 6 issues (keyboard, memory, extensions)
- **P3 (Low)**: 2 issues (Gatekeeper, permissions)
- **P4 (Info)**: 1 issue (installation paths)

## Reporting New Issues

### Before Reporting
1. Check if issue is already documented here
2. Search GitHub issues for duplicates
3. Test with latest Tauri version
4. Try provided workarounds

### How to Report
1. **GitHub Issues**: Use [vscode-tauri repository](https://github.com/microsoft/vscode/issues)
2. **Include Details**:
   - MintMind version and Tauri version
   - Operating system and version
   - Steps to reproduce
   - Expected vs actual behavior
   - Console logs (F12 Developer Tools)
   - System information (Help > About)

3. **Label Appropriately**:
   - `bug` for unexpected behavior
   - `performance` for speed/memory issues
   - `compatibility` for extension problems
   - `platform-windows/mac/linux` for OS-specific issues

### Response Times
- **Critical/P0**: Response within 24 hours
- **High/P1**: Response within 3 business days
- **Medium/P2**: Response within 1 week
- **Low/P3+**: Response within 2 weeks

## Contributing Fixes

### Development Setup
1. Fork the vscode-tauri repository
2. Set up development environment
3. Create feature branch for fixes
4. Test on affected platforms

### Testing Requirements
- Unit tests for bug fixes
- Integration tests for API changes
- E2E tests for user-facing fixes
- Performance benchmarks for optimization changes

### Code Review Process
- Open pull request with detailed description
- Include before/after benchmarks for performance fixes
- Test on all affected platforms
- Address reviewer feedback promptly

## Future Improvements

### Planned Enhancements
- **IPC Optimization**: Reduce latency by 50% (Q1 2024)
- **Memory Management**: Zero-growth memory usage (Q2 2024)
- **Platform Parity**: Consistent behavior across all platforms (Q3 2024)
- **Extension Compatibility**: 100% compatibility with top 100 extensions (Q4 2024)

### Long-term Vision
- Native performance on all platforms
- Zero known issues in production
- Seamless migration experience
- Industry-leading stability metrics

---

*Last updated: 2023-11-17*
*Issues tracked: 13*
*Critical issues: 2*
*In progress: 6*
*Fixed since launch: 1*