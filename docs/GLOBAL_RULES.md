# Global Rules

These rules establish the foundational principles for developing and maintaining the Rust AI IDE project, ensuring consistency, quality, and efficiency across all components.

## 1. Development Practices

Development practices form the core of our workflow, guiding how tasks are approached, implemented, and validated to maintain high standards and avoid common pitfalls.

- Do not ensure backward compatibility; prioritize modern advancements and innovative features over legacy support in all implementations.
- Decompose tasks into granular, sequential steps to avert timeouts, ensure comprehensive implementation, and allow for progressive verification through incremental builds and tests.
- Execute one task at a time exclusively, without initiating or running any additional tasks concurrently, to ensure focused and uninterrupted processing.
- Implement changes incrementally—one focused modification at a time—validating each via targeted tests (e.g., running specific unit tests or integration suites) to ensure precision and ease debugging in isolated contexts.
- Tackle errors in bite-sized, manageable increments, committing changes frequently to source control for version tracking, clarity in git history, and the ability to rollback problematic changes without disrupting the entire codebase.
- Thoroughly review and correct all errors in the provided content, including but not limited to grammatical, spelling, punctuation, factual, logical, structural, and any other inaccuracies or issues that require fixing to ensure clarity, accuracy, and overall effectiveness.
- Uphold the **DRY** (Don't Repeat Yourself) principle rigorously by extracting reusable utility functions, procedural macros, or generic traits to eradicate redundancy, streamline maintenance, and foster code reusability across projects.
- Maintain a single source of truth for all configurations and data.
- Architect each software crate or package with a singular, sharply defined responsibility, ensuring it targets one core functionality (e.g., a logging crate handling only log aggregation and formatting), aligns with the single responsibility principle, encourages modularity, and provides explicit documentation on its scope, dependencies (e.g., specifying exact versions in `Cargo.toml`), and rationale for design decisions to enable easy integration, testing, and reuse in broader ecosystems.
- Automate repetitive workflows extensively with scripts for building (e.g., `cargo build --release`), testing (e.g., `cargo test -- --nocapture`), linting (e.g., `cargo clippy -- -W clippy::all`), formatting (e.g., `cargo fmt`), and deployment (e.g., CI/CD pipelines via GitHub Actions), reducing human error, accelerating development cycles, and freeing time for creative problem-solving.
- Mandate `bun` as the sole package manager for all JavaScript/TypeScript dependencies, eschewing alternatives like `npm`, `yarn`, `pnpm`, or `vite` to enforce consistency, leverage its speed for monorepos, and integrate seamlessly with build tools for optimal performance.
- Execute modifications in this prioritized sequence:
  1. **Resolve Dependency Issues**: Scrutinize and rectify all dependency configurations, addressing version conflicts (e.g., using `cargo update` or specifying exact versions), peer dependencies, and transitive dependencies to guarantee stability, compatibility, and security across environments.
  2. **Fix Import Resolution Errors**: Validate all module imports for accuracy, confirming path aliases (e.g., in `tsconfig.json` or `Cargo.toml`), relative paths, and module resolution settings (e.g., via `rustc` or TypeScript compiler options) to eliminate import failures across the entire codebase.
  3. **Address Type System Mismatches**: Amend struct field discrepancies, enum variant inconsistencies, and type errors comprehensively. Harmonize return types in asynchronous operations (e.g., ensuring `Future<Output = Result<T, E>>` consistency), managing futures with combinators like `and_then` or `map_err`. Resolve conflicts involving custom types such as `NetworkRestrictions` or `DataPolicies` by updating definitions, adding trait implementations, or refactoring for type coherence.
  4. **Enhance Code Quality**: Eradicate unused imports, variables, redundant code, and dead functions using automated tools like `cargo clippy` (with strict warnings) and `rustfmt` for Rust, ESLint (configured for TypeScript rules) for web code, and `prettier` for formatting. Standardize error handling uniformly, favoring `Result<T, E>` and `Option<T>` in Rust for explicit error propagation, and consistent async error patterns (e.g., `.await` with `?` operator) in web components. Verify that all test dependencies are confined to `dev-dependencies` in `Cargo.toml`, isolated from production, and free from security vulnerabilities or unnecessary bloat.
  5. **Validate Compilation and Testing**: Confirm all tests compile flawlessly by executing `cargo check --tests` and resolving any warnings or errors. Perform a full test suite run with `cargo test` to affirm overall functionality, followed by targeted integration tests (e.g., in the `tests/` directory) to validate end-to-end behaviors, ensuring no regressions and complete coverage.

## 2. Code and Test Separation

Maintaining a clear separation between test and production code is essential for performance, security, and maintainability.

- Enforce absolute segregation between test files and production code to prevent any cross-contamination, eliminate performance overhead in production builds, and maintain a clean, efficient codebase.
- Confine all tests to dedicated test modules or directories, ensuring clear demarcation from source code to avoid any overlap or confusion in project structure.
- Utilize `#[cfg(test)]` attributes to annotate test modules, guaranteeing they are compiled exclusively during testing phases and exert zero influence on production binaries, including memory or runtime footprints.
- Isolate test-only dependencies entirely, verifying through build configurations that they are never included in production bundles, referenced in release builds, or accessible via conditional compilation flags.
- Restrict integration tests to a dedicated `tests/` directory at the project root for centralized management, easy discovery, and to support complex, end-to-end scenarios without cluttering source directories.
- Place unit tests in the same directory as the code they test to enhance discoverability, maintain logical proximity, and facilitate quick navigation during development and debugging.

## 3. Code Organization

Effective code organization promotes modularity, readability, and scalability.

- Modularize code aggressively into smaller, focused modules, each encapsulating a single, well-defined responsibility, adhering to Rust's idiomatic patterns such as traits for abstraction, and promoting long-term maintainability through clear interfaces.
- Prioritize composition over inheritance to boost flexibility, minimize tight coupling, and enable seamless extension, modification, and recombination of components without inheritance hierarchies.
- Integrate dependency injection patterns judiciously, leveraging Rust's ownership system or frameworks like `actix` or `warp` for web services, to decouple components, enhance testability via mocking libraries like `mockall`, and simplify dependency management in complex systems.
- Structure modules into a coherent hierarchy, grouping related functionality logically (e.g., by domain or feature), avoiding circular dependencies through careful design, and documenting module purposes to improve readability, scalability, and onboarding for new developers.

## 4. Optimization for Performance and User Experience

Performance optimization ensures the application is responsive and efficient, directly impacting user satisfaction.

- Emphasize techniques to curtail initial load times and amplify responsiveness, centering on perceived performance metrics (e.g., First Contentful Paint, Time to Interactive) for superior user satisfaction and retention.
- **Implement Code Splitting**: Employ dynamic imports (`import()`) strategically for heavyweight libraries such as Monaco Editor (for code editing), Material UI (for components), and data visualization tools (e.g., D3.js or Chart.js) to fragment bundles, reducing initial JavaScript payload and enabling faster app startup.
- **Apply Lazy Loading**: Harness `React.lazy` for route-based and component-based splitting, deferring non-critical content loads (e.g., admin panels or heavy forms) and incorporating prefetching for essential paths using `React Router`'s `<Link>` component with `prefetch` props.
- **Enable Tree Shaking**: Utilize selective imports (e.g., `import { Button } from '@mui/material/Button'`) and named exports from bulky libraries like Material UI or Lodash to excise unused code during bundling, minimizing final bundle sizes via build tools like Rollup or Webpack.
- **Conduct Bundle Analysis**: Embed tools such as `webpack-bundle-analyzer` or `bun`'s native analysis features into build scripts to routinely dissect bundle compositions, pinpoint oversized modules, and uncover optimization avenues like removing duplicate dependencies.
- **Optimize Assets**: Compress and refine images (e.g., via `imagemin` or Sharp), fonts (e.g., subsetting with `fontmin`), and static resources using modern formats like WebP for images and WOFF2 for fonts, integrating with CDNs for caching and lazy loading attributes.
- **Deploy Preloading Strategies**: Apply intelligent preloading for vital resources, including critical CSS (with `<link rel="preload" as="style">`), fonts, and route data, leveraging service workers (e.g., via Workbox) for background fetching and caching to slash perceived load times and enhance offline capabilities.

## 5. Code Scanning and Security

Security and code quality scanning are critical for identifying and mitigating risks early in the development process.

- Mandate Snyk Code scanning for all newly generated first-party code to detect vulnerabilities, code quality issues, and potential exploits in real-time during development.
- Require Snyk SCA (Software Composition Analysis) scanning for any new dependencies or updates, identifying risks in third-party libraries, license conflicts, and supply chain vulnerabilities before integration.
- Upon discovering security issues from newly introduced or modified code or dependencies, remediate them promptly using Snyk's contextual insights, such as updating to secure versions, patching code flaws, or replacing risky dependencies while maintaining functionality.
- Re-scan the codebase post-remediation to validate that issues are fully resolved and no new vulnerabilities have emerged, ensuring a clean security baseline.
- Iterate this scanning and fixing process persistently until zero issues remain, integrating scans into CI/CD pipelines (e.g., via GitHub Actions or GitLab CI) for automated enforcement and continuous monitoring.
