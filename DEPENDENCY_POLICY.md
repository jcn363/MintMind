# Dependency Management Policy

This document outlines the dependency management strategy for the Visual Studio Code project, including policies for updating, pinning, and security considerations.

## Table of Contents
- [Philosophy](#philosophy)
- [Update Strategy](#update-strategy)
- [Pinned Dependencies](#pinned-dependencies)
- [Security Considerations](#security-considerations)
- [Testing Requirements](#testing-requirements)
- [Process for Updates](#process-for-updates)

## Philosophy

The VS Code project balances stability, security, and feature velocity by:
- Keeping dependencies up-to-date when safe
- Pinning versions only when necessary for compatibility or security
- Prioritizing security fixes over new features
- Maintaining backward compatibility

## Update Strategy

### Automatic Updates (Safe)
- **Patch versions** (`1.2.3` → `1.2.4`): Automatic via `npm update`
- **Security patches**: Immediate updates regardless of version
- **Bug fixes**: Automatic when no breaking changes

### Manual Review Required
- **Minor versions** (`1.2.x` → `1.3.x`): Manual testing required
- **Major versions** (`1.x.x` → `2.x.x`): Extensive testing and team review
- **Breaking changes**: Always require manual approval

### Never Auto-Update
- Build tools (gulp, webpack, etc.)
- Type definitions that affect compilation
- Dependencies with known compatibility issues

## Pinned Dependencies

These dependencies are intentionally pinned to specific versions due to technical requirements:

### @types/cookie@1.0.0 (Latest: 0.6.0)
- **Reason**: This is actually a newer version than the published "latest" (0.6.0)
- **Background**: VS Code uses a development/pre-release version with more complete TypeScript definitions
- **Risk of updating**: Loss of TypeScript intellisense and type safety
- **Last reviewed**: 2025-11-11
- **Next review**: When newer version becomes available

### @types/http-proxy-agent@4.0.1 (Latest: 4.0.0)
- **Reason**: Similar to @types/cookie, this version includes more comprehensive type definitions
- **Background**: Development version with enhanced TypeScript support
- **Risk of updating**: Potential TypeScript compilation errors or missing type information
- **Last reviewed**: 2025-11-11
- **Next review**: When newer version becomes available

### gulp-sourcemaps@2.6.5 (Latest: 3.0.0)
- **Reason**: Version 3.0.0 introduces security vulnerabilities in transitive dependencies
- **Background**: The major update to 3.0.0 bundles vulnerable versions of PostCSS and other dependencies
- **Security issue**: npm audit automatically reverts 3.0.0 due to known vulnerabilities
- **Risk of updating**: Introduction of moderate security vulnerabilities
- **Last reviewed**: 2025-11-11 (tested and confirmed vulnerabilities)
- **Next review**: When 3.1.0+ becomes available and vulnerabilities are fixed

### @types/windows-foreground-love@0.3.1
- **Reason**: Currently at latest available version
- **Status**: Keep updated automatically when new versions become available
- **Last checked**: 2025-11-11

## Security Considerations

### Vulnerability Response
- **Critical/High**: Immediate update or mitigation within 24 hours
- **Moderate**: Update within 1 week or accept risk with documentation
- **Low**: Update when convenient or accept risk

### Security Scanning
- Daily automated scans via `npm audit`
- Weekly manual review of security advisories
- Integration with GitHub Security tab

### Risk Acceptance
Some vulnerabilities may be accepted if:
- They affect only development dependencies
- No viable fix is available
- Risk is theoretical and not exploitable in VS Code's use case
- Performance impact of fix outweighs security benefit

## Testing Requirements

### For Dependency Updates
- **Unit tests**: Must pass 100%
- **Integration tests**: Must pass for affected components
- **Build process**: Must complete successfully
- **TypeScript compilation**: No new errors
- **Performance regression**: <5% degradation acceptable

### For Major Updates
- **Manual testing**: Core editing features
- **Extension compatibility**: Popular extensions still work
- **Platform testing**: Windows, macOS, Linux
- **Performance benchmarking**: No significant regressions

## Process for Updates

### Minor Updates
1. Run `npm audit` and `npm outdated`
2. Update safe dependencies with `npm update`
3. Run full test suite
4. Commit if tests pass

### Major Updates
1. Create feature branch
2. Update dependency
3. Run comprehensive tests
4. Manual testing of core features
5. Code review
6. Merge after approval

### Pinned Dependency Reviews
1. Quarterly review of all pinned dependencies
2. Check for newer versions and security fixes
3. Test updates in isolation
4. Update documentation if policy changes

## Maintenance

### Regular Tasks
- **Weekly**: `npm audit` and address critical issues
- **Monthly**: `npm outdated` and update safe dependencies
- **Quarterly**: Review pinned dependencies
- **Annually**: Major dependency ecosystem updates

### Documentation Updates
This document must be updated when:
- New dependencies are pinned
- Update policies change
- Security incidents occur
- Major version updates are completed

## Contact

For questions about dependency management:
- **Security issues**: Report via [Security Policy](SECURITY.md)
- **Technical questions**: Create issue with `dependency-management` label
- **Policy changes**: Propose via pull request to this document

---

*Last updated: 2025-11-11*
*Maintained by: Development Team*