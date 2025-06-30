# Sashi CLI

The official command-line interface for installing and managing Sashi AI admin companion in your Next.js and Node.js projects.

## Installation

No installation required! Use npx to run commands directly:

```bash
npx @sashimo/cli setup
npx @sashimo/cli init my-app
npx @sashimo/cli check
```

## Quick Start

### For Existing Projects

```bash
# Setup Sashi in your existing project
npx @sashimo/cli setup

# Or with options
npx @sashimo/cli setup --framework nextjs --typescript --api-key sk-your-openai-key
```

### For New Projects

```bash
# Create a new project with Sashi pre-configured
npx @sashimo/cli init my-admin-app

# Or with options
npx @sashimo/cli init my-admin-app --framework nodejs --typescript
```

### Check Your Setup

```bash
# Verify your Sashi configuration
npx @sashimo/cli check
```

## Commands

### `npx @sashimo/cli setup`

Setup Sashi in an existing Next.js or Node.js project.

```bash
npx @sashimo/cli setup [options]
```

**Options:**

-   `-f, --framework <framework>` - Target framework (nextjs, nodejs, express, auto)
-   `-t, --typescript` - Use TypeScript setup
-   `-y, --yes` - Skip prompts and use defaults
-   `--api-key <key>` - OpenAI API key
-   `--hub-url <url>` - Sashi Hub URL (optional)

**Example:**

```bash
npx @sashimo/cli setup --framework nextjs --typescript --api-key sk-...
```

### `npx @sashimo/cli init [project-name]`

Create a new project with Sashi pre-configured.

```bash
npx @sashimo/cli init [project-name] [options]
```

**Options:**

-   `-f, --framework <framework>` - Target framework (nextjs, nodejs, express)
-   `-t, --typescript` - Use TypeScript (default: true)
-   `-y, --yes` - Skip prompts and use defaults
-   `--api-key <key>` - OpenAI API key
-   `--hub-url <url>` - Sashi Hub URL (optional)

**Example:**

```bash
npx @sashimo/cli init my-app --framework nextjs --api-key sk-...
```

### `npx @sashimo/cli check`

Check your Sashi setup and configuration.

```bash
npx @sashimo/cli check
```

This command will:

-   Check if Sashi packages are installed
-   Verify configuration files exist
-   Provide recommendations for setup issues

**Note:** The `add` and `update` commands are planned for future releases.

## Framework Support

### Next.js

Sashi CLI provides full support for Next.js projects:

-   Automatic detection of Pages Router vs App Router
-   Creates API routes for Sashi middleware
-   Sets up UI pages for admin interface
-   Configures Tailwind CSS integration

**Generated Files:**

-   `pages/api/sashi/[[...slug]].ts` - API route
-   `pages/sashi/index.tsx` - Admin UI page
-   `sashi.config.ts` - Configuration file
-   `.env.local` - Environment variables

### Express.js

For Express.js applications:

-   Creates middleware integration example
-   Provides server setup templates
-   Configures CORS and routing

**Generated Files:**

-   `sashi-example.ts` - Integration example
-   `sashi.config.ts` - Configuration file
-   `.env` - Environment variables

### Node.js (Generic)

For generic Node.js applications:

-   Creates HTTP server integration
-   Provides basic routing setup
-   Configures middleware handling

## Configuration

Sashi CLI generates a `sashi.config.ts` file with all configuration options:

```typescript
import type { SashiConfig } from "@sashimo/lib"

const config: SashiConfig = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: "gpt-4",
    },
    middleware: {
        path: "/sashi",
        cors: {
            origin: process.env.NODE_ENV === "development" ? "*" : false,
        },
    },
    ui: {
        theme: "light",
        branding: {
            title: "Admin Panel",
        },
    },
    functions: {
        loadDefaults: false,
        hiddenFromUI: [],
    },
}

export default config
```

## Environment Variables

The CLI sets up these environment variables:

```bash
# Required
OPENAI_API_KEY=your-openai-api-key

# Optional
SASHI_HUB_URL=https://your-hub-url.com
```

## Package Manager Support

Sashi CLI automatically detects and uses your preferred package manager:

-   **npm** - Default
-   **yarn** - Detected by `yarn.lock`
-   **pnpm** - Detected by `pnpm-lock.yaml`
-   **bun** - Detected by `bun.lockb`

## TypeScript Support

Sashi CLI provides excellent TypeScript support:

-   Automatic TypeScript detection
-   Type-safe configuration files
-   Proper import/export syntax
-   Type definitions for all APIs

## Troubleshooting

### Common Issues

1. **"No package.json found"**

    - Run the command in a Node.js project directory
    - Initialize with `npm init` if needed

2. **"OpenAI API key is required"**

    - Get an API key from [OpenAI Platform](https://platform.openai.com)
    - Pass it via `--api-key` flag or set in environment

3. **"Tailwind CSS not detected"**
    - Install Tailwind CSS: `npx tailwindcss init -p`
    - Required for Sashi UI components

### Getting Help

```bash
# Show help for any command
sashi --help
sashi setup --help
sashi init --help

# Check your setup
sashi check --verbose
```

## Examples

### Quick Setup for Next.js

```bash
# In your Next.js project
sashi setup --framework nextjs --typescript --api-key sk-your-key

# Start development server
npm run dev

# Visit http://localhost:3000/sashi
```

### Create New Express App

```bash
# Create new Express app with Sashi
sashi init my-api --framework express --typescript

cd my-api
npm run dev

# Visit http://localhost:3000/sashi
```

### Add Features to Existing Project

```bash
# Add UI components
sashi add ui

# Add default utility functions
sashi add functions

# Add workflow management
sashi add workflows
```

## Community

-   **GitHub**: [https://github.com/UseSashiMoto/usesashi](https://github.com/UseSashiMoto/usesashi)
-   **Discord**: Join our community at [https://discord.gg/3a9S6XPc6Q](https://discord.gg/3a9S6XPc6Q)

## Contributing

See the main [Sashi repository](https://github.com/UseSashiMoto/usesashi) for contribution guidelines.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
