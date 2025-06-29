---
"@sashimo/cli": major
---

# Initial release of @sashimo/cli

A new command-line tool to quickly and easily install the Sashi package in Next.js or Node.js projects.

## Features

-   **`sashi setup`** - Setup Sashi in existing projects with automatic framework detection
-   **`sashi init [project-name]`** - Create new projects with Sashi pre-configured
-   **`sashi check`** - Verify setup and configuration

## Key capabilities

-   Auto-detects framework (Next.js, Express, Node.js)
-   Auto-detects TypeScript usage
-   Supports multiple package managers (npm, yarn, pnpm, bun)
-   Creates configuration files and environment setup
-   Generates framework-specific project structures

## Installation

No installation required! Use npx to run commands directly:

```bash
npx @sashimo/cli setup
npx @sashimo/cli init my-app
npx @sashimo/cli check
```

## Usage

```bash
# Setup Sashi in existing project
npx @sashimo/cli setup

# Create new Next.js project with Sashi
npx @sashimo/cli init my-app --framework nextjs --typescript

# Verify your setup
npx @sashimo/cli check
```
