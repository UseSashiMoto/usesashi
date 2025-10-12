#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const program = new Command();

program
    .name('sashi')
    .description('CLI for installing and managing Sashi AI admin companion')
    .version('1.0.0');

// Setup command - for existing projects
program
    .command('setup')
    .description('Setup Sashi in an existing Next.js or Node.js project')
    .option('-f, --framework <framework>', 'Target framework (nodejs, express)', 'auto')
    .option('-t, --typescript', 'Use TypeScript setup', false)
    .option('--api-key <key>', 'OpenAI API key')
    .option('--hub-url <url>', 'Sashi Hub URL', 'https://hub.usesashi.com')
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
                if (packageJson.dependencies?.express || packageJson.devDependencies?.express) {
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

            // Optional hub registration
            const hubRegistration = await promptHubRegistration(options.hubUrl);

            // Create basic configuration files
            await createBasicConfig(framework, hasTypeScript, options.apiKey, hubRegistration, options.hubUrl);

            console.log('✅ Sashi setup completed successfully!\n');
            console.log('Next steps:');
            console.log('1. Install Sashi packages: npm install @sashimo/lib');
            console.log('2. Add your OpenAI API key to .env.local');
            if (hubRegistration?.apiKey) {
                console.log('3. Your Hub API key has been added to .env.local');
                console.log('4. Start your server and visit /sashi to access the admin panel');
            } else {
                console.log('3. Start your server and visit /sashi to access the admin panel');
                console.log('4. Optionally run setup again to register with Sashi Hub for additional features');
            }

        } catch (error) {
            console.error('❌ Setup failed:', (error as Error).message);
            process.exit(1);
        }
    });

// Init command - for new projects
program
    .command('init [project-name]')
    .description('Create a new project with Sashi pre-configured')
    .option('-f, --framework <framework>', 'Target framework (nodejs, express)', 'nodejs')
    .option('-t, --typescript', 'Use TypeScript', true)
    .option('--hub-url <url>', 'Sashi Hub URL', 'https://hub.usesashi.com')
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

            const frameworkDependencies = options.framework === 'express' ? {
                'express': '^4.18.0'
            } : {};

            const baseDevDependencies = options.typescript ? {
                'typescript': '^5.0.0',
                '@types/node': '^20.0.0',
                'ts-node': '^10.0.0'
            } : {};

            const frameworkDevDependencies = options.framework === 'express' && options.typescript ? {
                '@types/express': '^4.17.21'
            } : {};

            const scripts = {
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

            // Optional hub registration  
            const hubRegistration = await promptHubRegistration(options.hubUrl);

            // Create basic files based on framework
            await createProjectFiles(projectDir, options.framework, options.typescript, hubRegistration, options.hubUrl);

            console.log('✅ Project created successfully!\n');
            console.log('Next steps:');
            console.log(`1. cd ${projectName}`);
            console.log('2. npm install');
            if (hubRegistration?.apiKey) {
                console.log('3. Your Hub API key has been added to .env.local');
                console.log('4. Add your OpenAI API key to .env.local');
                console.log('5. npm run dev');
            } else {
                console.log('3. Add your OpenAI API key to .env.local');
                console.log('4. npm run dev');
                console.log('5. Optionally run "sashi setup" to register with Sashi Hub for additional features');
            }

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
async function createBasicConfig(framework: string, typescript: boolean, apiKey?: string, hubRegistration?: HubRegistration, hubUrl?: string) {
    const configExt = typescript ? 'ts' : 'js';

    // Create sashi.config file
    const defaultHubUrl = hubUrl || 'https://hub.usesashi.com';
    const configContent = typescript ? `
const config = {
  openAIKey: process.env.OPENAI_API_KEY!,
  hubUrl: process.env.HUB_URL || '${defaultHubUrl}',
  apiSecretKey: process.env.HUB_API_SECRET_KEY,
  debug: true,
};

export default config;
` : `
const config = {
  openAIKey: process.env.OPENAI_API_KEY,
  hubUrl: process.env.HUB_URL || '${defaultHubUrl}',
  apiSecretKey: process.env.HUB_API_SECRET_KEY,
  debug: true,
};

module.exports = config;
`;

    fs.writeFileSync(`sashi.config.${configExt}`, configContent);

    // Create .env.local file
    const envContent = `# Sashi Configuration
OPENAI_API_KEY=${apiKey || 'your-openai-api-key-here'}
HUB_API_SECRET_KEY=${hubRegistration?.apiKey || 'your-hub-secret-key-here'}
HUB_URL=${hubUrl || 'https://hub.usesashi.com'}

# Add other environment variables as needed
`;

    fs.writeFileSync('.env.local', envContent);
}

async function createProjectFiles(projectDir: string, framework: string, typescript: boolean, hubRegistration?: HubRegistration, hubUrl?: string) {
    const ext = typescript ? 'ts' : 'js';
    const configExt = typescript ? 'ts' : 'js';

    // Create Sashi configuration files in the project directory
    const defaultHubUrl = hubUrl || 'https://hub.usesashi.com';
    const configContent = typescript ? `
const config = {
  openAIKey: process.env.OPENAI_API_KEY!,
  hubUrl: process.env.HUB_URL || '${defaultHubUrl}',
  apiSecretKey: process.env.HUB_API_SECRET_KEY,
  debug: true,
};

export default config;
` : `
const config = {
  openAIKey: process.env.OPENAI_API_KEY,
  hubUrl: process.env.HUB_URL || '${defaultHubUrl}',
  apiSecretKey: process.env.HUB_API_SECRET_KEY,
  debug: true,
};

module.exports = config;
`;

    // Create .env.local file
    const envContent = `# Sashi Configuration
OPENAI_API_KEY=your-openai-api-key-here
HUB_API_SECRET_KEY=${hubRegistration?.apiKey || 'your-hub-secret-key-here'}
HUB_URL=${hubUrl || 'https://hub.usesashi.com'}

# Add other environment variables as needed
`;

    // Write config files
    fs.writeFileSync(path.join(projectDir, `sashi.config.${configExt}`), configContent);
    fs.writeFileSync(path.join(projectDir, '.env.local'), envContent);

    if (framework === 'express') {
        // Create Express-specific structure
        const indexContent = typescript ? `
import express from 'express';
import { createMiddleware } from '@sashimo/lib';
import config from '../sashi.config';

const app = express();
const port = process.env.PORT || 3000;

// Create Sashi middleware
const sashiMiddleware = createMiddleware(config);

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
const { createMiddleware } = require('@sashimo/lib');
const config = require('../sashi.config');

const app = express();
const port = process.env.PORT || 3000;

// Create Sashi middleware
const sashiMiddleware = createMiddleware(config);

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
import { createMiddleware } from '@sashimo/lib';
import config from '../sashi.config';

const port = process.env.PORT || 3000;

// Create Sashi middleware
const sashiMiddleware = createMiddleware(config);

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
const { createMiddleware } = require('@sashimo/lib');
const config = require('../sashi.config');

const port = process.env.PORT || 3000;

// Create Sashi middleware
const sashiMiddleware = createMiddleware(config);

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

// Types for hub registration
interface HubRegistration {
    apiKey?: string;
    user?: {
        id: string;
        email: string;
        name?: string;
    };
    serverConnection?: {
        id: string;
        name: string;
        url: string;
        apiToken: string;
    };
    githubConfig?: {
        id: string;
        owner: string;
        repo: string;
        repoName: string;
        defaultBranch: string;
    };
}

interface GitHubConfig {
    token: string;
    owner: string;
    repo: string;
    repoName?: string;
    defaultBranch?: string;
}

// Hub registration prompt function
async function promptHubRegistration(hubUrl: string): Promise<HubRegistration | null> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const prompt = (question: string): Promise<string> => {
        return new Promise((resolve) => {
            rl.question(question, resolve);
        });
    };

    const promptPassword = (question: string): Promise<string> => {
        return new Promise((resolve) => {
            process.stdout.write(question);
            process.stdin.setRawMode(true);
            let password = '';
            process.stdin.on('data', function listener(char) {
                const charStr = char.toString();
                switch (charStr) {
                    case '\n':
                    case '\r':
                    case '\u0004':
                        process.stdin.setRawMode(false);
                        process.stdin.removeListener('data', listener);
                        process.stdout.write('\n');
                        resolve(password);
                        break;
                    case '\u0003':
                        process.exit(1);
                        break;
                    default:
                        process.stdout.write('*');
                        password += charStr;
                        break;
                }
            });
        });
    };

    try {
        console.log('\n🌟 Join Sashi Hub for enhanced features and team collaboration!');
        console.log('Benefits:');
        console.log('• Team collaboration and shared workflows');
        console.log('• GitHub integration for code context');
        console.log('• Enhanced AI capabilities');
        console.log('• Project analytics and insights\n');

        const joinHub = await prompt('Would you like to join Sashi Hub? (y/N): ');

        if (joinHub.toLowerCase() !== 'y' && joinHub.toLowerCase() !== 'yes') {
            rl.close();
            console.log('⏭️  Skipping hub registration. You can run setup again later to join.');
            return null;
        }

        console.log('\n📝 Creating your Sashi Hub account...');

        const email = await prompt('📧 Email: ');
        const password = await promptPassword('🔒 Password: ');
        const name = await prompt('👤 Name (optional): ');

        let serverUrl = '';
        let connectionName = '';
        const setupServer = await prompt('\n🌐 Connect your local server? (y/N): ');
        if (setupServer.toLowerCase() === 'y' || setupServer.toLowerCase() === 'yes') {
            serverUrl = await prompt('Server URL (e.g., http://localhost:3000): ');
            connectionName = await prompt('Connection name (e.g., "Local Development"): ');
        }

        let githubConfig: GitHubConfig | undefined;
        const setupGitHub = await prompt('\n🐙 Setup GitHub integration? (y/N): ');
        if (setupGitHub.toLowerCase() === 'y' || setupGitHub.toLowerCase() === 'yes') {
            console.log('\n📋 GitHub Personal Access Token required.');
            console.log('Create one at: https://github.com/settings/tokens');
            console.log('Required scopes: repo, read:org');

            const token = await prompt('GitHub Token: ');
            const owner = await prompt('GitHub Username/Organization: ');
            const repo = await prompt('Repository name: ');
            const repoName = await prompt('Display name (optional): ');
            const defaultBranch = await prompt('Default branch (default: main): ');

            if (token && owner && repo) {
                githubConfig = {
                    token,
                    owner,
                    repo,
                    repoName: repoName || repo,
                    defaultBranch: defaultBranch || 'main'
                };
            }
        }

        rl.close();

        // Register with hub
        console.log('\n🚀 Creating account...');
        const registration = await registerWithHub(hubUrl, {
            email,
            password,
            name: name || undefined,
            serverUrl: serverUrl || undefined,
            connectionName: connectionName || undefined,
            github: githubConfig
        });

        if (registration.success) {
            console.log('✅ Account created successfully!');
            console.log(`🔑 API Key generated and will be added to your configuration`);
            if (registration.serverConnection) {
                console.log(`🌐 Server connection "${registration.serverConnection.name}" created`);
            }
            if (registration.githubConfig) {
                console.log(`🐙 GitHub integration with ${registration.githubConfig.owner}/${registration.githubConfig.repo} configured`);
            }

            return {
                apiKey: registration.apiKey,
                user: registration.user,
                serverConnection: registration.serverConnection,
                githubConfig: registration.githubConfig
            };
        } else {
            console.log('❌ Registration failed. Continuing without hub registration.');
            return null;
        }

    } catch (error) {
        rl.close();
        console.log('❌ Registration error:', (error as Error).message);
        console.log('Continuing without hub registration.');
        return null;
    }
}

// Register with Sashi Hub API
async function registerWithHub(hubUrl: string, userData: {
    email: string;
    password: string;
    name?: string;
    serverUrl?: string;
    connectionName?: string;
    github?: GitHubConfig;
}): Promise<any> {
    try {
        // Use node's built-in fetch (Node 18+) or require a polyfill
        const response = await fetch(`${hubUrl}/api/sashi/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        return {
            success: true,
            apiKey: result.apiKey,
            user: result.user,
            serverConnection: result.serverConnection,
            githubConfig: result.githubConfig
        };
    } catch (error) {
        return {
            success: false,
            error: (error as Error).message
        };
    }
} 