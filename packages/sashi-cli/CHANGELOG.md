# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2024-06-29

### Added

-   Initial release of @sashimo/cli
-   `sashi setup` command for existing projects
-   `sashi init` command for creating new projects
-   `sashi check` command for verifying setup
-   Support for Next.js, Express.js, and Node.js frameworks
-   TypeScript and JavaScript support
-   Automatic framework detection
-   Configuration file generation (sashi.config.ts/js)
-   Environment file setup (.env.local)
-   Package manager detection (npm, yarn, pnpm, bun)

### Features

-   Auto-detects framework (Next.js, Express, Node.js)
-   Auto-detects TypeScript usage
-   Creates framework-specific project structures
-   Generates proper API routes for Next.js
-   Creates complete server implementations for Express and Node.js
-   Comprehensive error checking and validation
-   Helpful status reporting and recommendations

[Unreleased]: https://github.com/your-org/usesashi/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/usesashi/releases/tag/v1.0.0
