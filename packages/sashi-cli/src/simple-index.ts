#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
    .name('sashi')
    .description('CLI for installing and managing Sashi AI admin companion')
    .version('1.0.0');

// Setup command - for existing projects
program
    .command('setup')
    .description('Setup Sashi in an existing Next.js or Node.js project')
    .option('-f, --framework <framework>', 'Target framework (nextjs, nodejs, express)', 'auto')
    .option('-t, --typescript', 'Use TypeScript setup', false)
    .option('--api-key <key>', 'OpenAI API key')
    .action(async (options) => {
        console.log('🚀 Setting up Sashi in your project...\n');

        try {
            // Check if package.json exists
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            if (!fs.existsSync(packageJsonPath)) {
                console.error('❌ No package.json found. Please run this command in a Node.js project directory.');
                process.exit(1);
            }

            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

            // Detect framework
            let framework = options.framework;
            if (framework === 'auto') {
                if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
                    framework = 'nextjs';
                } else if (packageJson.dependencies?.express || packageJson.devDependencies?.express) {
                    framework = 'express';
                } else {
                    framework = 'nodejs';
                }
            }

            // Detect TypeScript
            const hasTypeScript = !!(
                packageJson.dependencies?.typescript ||
                packageJson.devDependencies?.typescript ||
                fs.existsSync(path.join(process.cwd(), 'tsconfig.json'))
            );

            console.log(`Framework detected: ${framework}`);
            console.log(`TypeScript: ${hasTypeScript ? 'Yes' : 'No'}`);
            console.log(`API Key provided: ${options.apiKey ? 'Yes' : 'No'}\n`);

            // Create basic configuration files
            await createBasicConfig(framework, hasTypeScript, options.apiKey);

            console.log('✅ Sashi setup completed successfully!\n');
            console.log('Next steps:');
            console.log('1. Install Sashi packages: npm install @sashimo/lib');
            if (framework === 'nextjs') {
                console.log('2. Install UI package: npm install @sashimo/ui');
                console.log('3. Visit /sashi in your browser to access the admin panel');
            }
            console.log('4. Add your OpenAI API key to .env.local');

        } catch (error) {
            console.error('❌ Setup failed:', (error as Error).message);
            process.exit(1);
        }
    });

// Init command - for new projects
program
    .command('init [project-name]')
    .description('Create a new project with Sashi pre-configured')
    .option('-f, --framework <framework>', 'Target framework (nextjs, nodejs, express)', 'nextjs')
    .option('-t, --typescript', 'Use TypeScript', true)
    .action(async (projectName, options) => {
        console.log('🚀 Creating new project with Sashi...\n');

        if (!projectName) {
            console.error('❌ Project name is required');
            console.log('Usage: sashi init <project-name>');
            process.exit(1);
        }

        const projectDir = path.join(process.cwd(), projectName);

        if (fs.existsSync(projectDir)) {
            console.error(`❌ Directory ${projectName} already exists`);
            process.exit(1);
        }

        try {
            // Create project directory
            fs.mkdirSync(projectDir, { recursive: true });
            console.log(`✅ Created directory: ${projectName}`);

            // Create basic package.json
            const baseDependencies = {
                '@sashimo/lib': 'latest'
            };

            const frameworkDependencies = options.framework === 'nextjs' ? {
                'next': '^15.0.0',
                'react': '^18.0.0',
                'react-dom': '^18.0.0',
                '@sashimo/ui': 'latest'
            } : options.framework === 'express' ? {
                'express': '^4.18.0'
            } : {};

            const baseDevDependencies = options.typescript ? {
                'typescript': '^5.0.0',
                '@types/node': '^20.0.0',
                'ts-node': '^10.0.0'
            } : {};

            const frameworkDevDependencies = options.framework === 'nextjs' && options.typescript ? {
                '@types/react': '^18.0.0',
                '@types/react-dom': '^18.0.0'
            } : options.framework === 'express' && options.typescript ? {
                '@types/express': '^4.18.0'
            } : {};

            const scripts = options.framework === 'nextjs' ? {
                dev: 'next dev',
                build: 'next build',
                start: 'next start',
                lint: 'next lint'
            } : {
                start: options.typescript ? 'node dist/index.js' : 'node index.js',
                dev: options.typescript ? 'ts-node src/index.ts' : 'node index.js',
                ...(options.typescript && { build: 'tsc' })
            };

            const packageJson = {
                name: projectName,
                version: '1.0.0',
                description: `A ${options.framework} project with Sashi`,
                main: options.typescript ? 'dist/index.js' : 'index.js',
                scripts,
                dependencies: {
                    ...baseDependencies,
                    ...frameworkDependencies
                },
                devDependencies: {
                    ...baseDevDependencies,
                    ...frameworkDevDependencies
                }
            };

            fs.writeFileSync(
                path.join(projectDir, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            // Create basic files based on framework
            await createProjectFiles(projectDir, options.framework, options.typescript);

            console.log('✅ Project created successfully!\n');
            console.log('Next steps:');
            console.log(`1. cd ${projectName}`);
            console.log('2. npm install');
            console.log('3. Add your OpenAI API key to .env.local');
            console.log('4. npm run dev');

        } catch (error) {
            console.error('❌ Project creation failed:', (error as Error).message);
            process.exit(1);
        }
    });

// Check command
program
    .command('check')
    .description('Check Sashi setup and configuration')
    .action(() => {
        console.log('🔍 Checking Sashi setup...\n');

        const packageJsonPath = path.join(process.cwd(), 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            console.log('❌ No package.json found');
            return;
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        // Check for Sashi packages
        const hasSashiLib = packageJson.dependencies?.['@sashimo/lib'] || packageJson.devDependencies?.['@sashimo/lib'];
        const hasSashiUI = packageJson.dependencies?.['@sashimo/ui'] || packageJson.devDependencies?.['@sashimo/ui'];

        console.log('📦 Package Status:');
        console.log(`@sashimo/lib: ${hasSashiLib ? '✅ Installed' : '❌ Not found'}`);
        console.log(`@sashimo/ui: ${hasSashiUI ? '✅ Installed' : '⚠️  Not found'}`);

        // Check for config files
        const hasConfig = fs.existsSync(path.join(process.cwd(), 'sashi.config.js')) ||
            fs.existsSync(path.join(process.cwd(), 'sashi.config.ts'));
        const hasEnv = fs.existsSync(path.join(process.cwd(), '.env.local')) ||
            fs.existsSync(path.join(process.cwd(), '.env'));

        console.log('\n⚙️  Configuration:');
        console.log(`Config file: ${hasConfig ? '✅ Found' : '❌ Missing'}`);
        console.log(`Environment file: ${hasEnv ? '✅ Found' : '❌ Missing'}`);

        if (!hasSashiLib) {
            console.log('\n🔧 Recommendations:');
            console.log('- Run "sashi setup" to install and configure Sashi');
        }
    });

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}

program.parse(process.argv);

// Helper functions
async function createBasicConfig(framework: string, typescript: boolean, apiKey?: string) {
    const configExt = typescript ? 'ts' : 'js';

    // Create sashi.config file
    const configContent = typescript ? `
import type { SashiConfig } from '@sashimo/lib';

const config: SashiConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4',
  },
  middleware: {
    path: '/sashi',
  },
  ${framework === 'nextjs' ? `ui: {
    theme: 'light',
    branding: {
      title: 'Admin Panel',
    },
  },` : ''}
};

export default config;
` : `
const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
  },
  middleware: {
    path: '/sashi',
  },
  ${framework === 'nextjs' ? `ui: {
    theme: 'light',
    branding: {
      title: 'Admin Panel',
    },
  },` : ''}
};

module.exports = config;
`;

    fs.writeFileSync(`sashi.config.${configExt}`, configContent);

    // Create .env.local file
    const envContent = `# Sashi Configuration
OPENAI_API_KEY=${apiKey || 'your-openai-api-key-here'}

# Add other environment variables as needed
`;

    fs.writeFileSync('.env.local', envContent);
}

async function createProjectFiles(projectDir: string, framework: string, typescript: boolean) {
    const ext = typescript ? 'ts' : 'js';
    const configExt = typescript ? 'ts' : 'js';

    // Create Sashi configuration files in the project directory
    const configContent = typescript ? `
import type { SashiConfig } from '@sashimo/lib';

const config: SashiConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4',
  },
  middleware: {
    path: '/sashi',
  },
  ${framework === 'nextjs' ? `ui: {
    theme: 'light',
    branding: {
      title: 'Admin Panel',
    },
  },` : ''}
};

export default config;
` : `
const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
  },
  middleware: {
    path: '/sashi',
  },
  ${framework === 'nextjs' ? `ui: {
    theme: 'light',
    branding: {
      title: 'Admin Panel',
    },
  },` : ''}
};

module.exports = config;
`;

    // Create .env.local file
    const envContent = `# Sashi Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Add other environment variables as needed
`;

    // Write config files
    fs.writeFileSync(path.join(projectDir, `sashi.config.${configExt}`), configContent);
    fs.writeFileSync(path.join(projectDir, '.env.local'), envContent);

    if (framework === 'nextjs') {
        // Create basic Next.js structure
        fs.writeFileSync(
            path.join(projectDir, 'README.md'),
            `# ${path.basename(projectDir)}\n\nA Next.js project with Sashi AI admin companion.\n\n## Getting Started\n\n1. Install dependencies: \`npm install\`\n2. Add your OpenAI API key to \`.env.local\`\n3. Start the development server: \`npm run dev\`\n4. Visit http://localhost:3000/sashi to access the admin panel\n`
        );

        // Create a basic Next.js page structure
        const appDir = path.join(projectDir, 'src', 'app');
        fs.mkdirSync(appDir, { recursive: true });

        // Create basic layout
        const layoutContent = typescript ? `
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sashi Admin App',
  description: 'AI-powered admin interface',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
` : `
export const metadata = {
  title: 'Sashi Admin App',
  description: 'AI-powered admin interface',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`;

        const pageContent = `
export default function Home() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Welcome to your Sashi-powered app!</h1>
      <p>Visit <a href="/sashi">/sashi</a> to access the admin panel.</p>
    </div>
  )
}
`;

        fs.writeFileSync(path.join(appDir, `layout.${typescript ? 'tsx' : 'jsx'}`), layoutContent);
        fs.writeFileSync(path.join(appDir, `page.${typescript ? 'tsx' : 'jsx'}`), pageContent);

        // Create API route for Sashi
        const apiDir = path.join(appDir, 'api', 'sashi', '[[...slug]]');
        fs.mkdirSync(apiDir, { recursive: true });

        const apiContent = typescript ? `
import { createSashiMiddleware } from '@sashimo/lib';
import config from '../../../../../sashi.config';

const sashiMiddleware = createSashiMiddleware(config);

export async function GET(request: Request) {
  return sashiMiddleware(request);
}

export async function POST(request: Request) {
  return sashiMiddleware(request);
}
` : `
import { createSashiMiddleware } from '@sashimo/lib';
import config from '../../../../../sashi.config';

const sashiMiddleware = createSashiMiddleware(config);

export async function GET(request) {
  return sashiMiddleware(request);
}

export async function POST(request) {
  return sashiMiddleware(request);
}
`;

        fs.writeFileSync(path.join(apiDir, `route.${typescript ? 'ts' : 'js'}`), apiContent);

    } else if (framework === 'express') {
        // Create Express-specific structure
        const indexContent = typescript ? `
import express from 'express';
import { createSashiMiddleware } from '@sashimo/lib';
import config from '../sashi.config';

const app = express();
const port = process.env.PORT || 3000;

// Create Sashi middleware
const sashiMiddleware = createSashiMiddleware(config);

// Mount Sashi middleware
app.use('/sashi', sashiMiddleware);

// Basic route
app.get('/', (req, res) => {
  res.send(\`
    <h1>Express + Sashi Server</h1>
    <p>Visit <a href="/sashi">/sashi</a> to access the admin panel.</p>
  \`);
});

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
  console.log(\`Admin panel available at http://localhost:\${port}/sashi\`);
});
` : `
const express = require('express');
const { createSashiMiddleware } = require('@sashimo/lib');
const config = require('../sashi.config');

const app = express();
const port = process.env.PORT || 3000;

// Create Sashi middleware
const sashiMiddleware = createSashiMiddleware(config);

// Mount Sashi middleware
app.use('/sashi', sashiMiddleware);

// Basic route
app.get('/', (req, res) => {
  res.send(\`
    <h1>Express + Sashi Server</h1>
    <p>Visit <a href="/sashi">/sashi</a> to access the admin panel.</p>
  \`);
});

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
  console.log(\`Admin panel available at http://localhost:\${port}/sashi\`);
});
`;

        const srcDir = typescript ? path.join(projectDir, 'src') : projectDir;
        if (typescript) {
            fs.mkdirSync(srcDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(srcDir, `index.${ext}`),
            indexContent
        );

        // Create README for Express
        fs.writeFileSync(
            path.join(projectDir, 'README.md'),
            `# ${path.basename(projectDir)}\n\nAn Express.js project with Sashi AI admin companion.\n\n## Getting Started\n\n1. Install dependencies: \`npm install\`\n2. Add your OpenAI API key to \`.env.local\`\n3. Start the development server: \`npm run dev\`\n4. Visit http://localhost:3000/sashi to access the admin panel\n`
        );

    } else {
        // Create basic Node.js structure
        const indexContent = typescript ? `
import http from 'http';
import { createSashiMiddleware } from '@sashimo/lib';
import config from '../sashi.config';

const port = process.env.PORT || 3000;

// Create Sashi middleware
const sashiMiddleware = createSashiMiddleware(config);

const server = http.createServer((req, res) => {
  if (req.url?.startsWith('/sashi')) {
    // Handle Sashi routes
    sashiMiddleware(req, res);
  } else {
    // Basic home route
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`
      <h1>Node.js + Sashi Server</h1>
      <p>Visit <a href="/sashi">/sashi</a> to access the admin panel.</p>
    \`);
  }
});

server.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
  console.log(\`Admin panel available at http://localhost:\${port}/sashi\`);
});
` : `
const http = require('http');
const { createSashiMiddleware } = require('@sashimo/lib');
const config = require('../sashi.config');

const port = process.env.PORT || 3000;

// Create Sashi middleware
const sashiMiddleware = createSashiMiddleware(config);

const server = http.createServer((req, res) => {
  if (req.url?.startsWith('/sashi')) {
    // Handle Sashi routes
    sashiMiddleware(req, res);
  } else {
    // Basic home route
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`
      <h1>Node.js + Sashi Server</h1>
      <p>Visit <a href="/sashi">/sashi</a> to access the admin panel.</p>
    \`);
  }
});

server.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
  console.log(\`Admin panel available at http://localhost:\${port}/sashi\`);
});
`;

        const srcDir = typescript ? path.join(projectDir, 'src') : projectDir;
        if (typescript) {
            fs.mkdirSync(srcDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(srcDir, `index.${ext}`),
            indexContent
        );

        // Create README for Node.js
        fs.writeFileSync(
            path.join(projectDir, 'README.md'),
            `# ${path.basename(projectDir)}\n\nA Node.js project with Sashi AI admin companion.\n\n## Getting Started\n\n1. Install dependencies: \`npm install\`\n2. Add your OpenAI API key to \`.env.local\`\n3. Start the development server: \`npm run dev\`\n4. Visit http://localhost:3000/sashi to access the admin panel\n`
        );
    }

    if (typescript) {
        // Create tsconfig.json
        const tsConfig = {
            compilerOptions: {
                target: 'ES2020',
                module: 'commonjs',
                outDir: './dist',
                rootDir: './src',
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                resolveJsonModule: true
            },
            include: ['src/**/*'],
            exclude: ['node_modules', 'dist']
        };

        fs.writeFileSync(
            path.join(projectDir, 'tsconfig.json'),
            JSON.stringify(tsConfig, null, 2)
        );
    }
} 