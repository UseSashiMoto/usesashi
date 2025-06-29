import chalk from 'chalk';
import { execa } from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import ora from 'ora';
import path from 'path';
import { getInstallCommand } from '../utils/detector';
import { createConfigFiles } from '../utils/templates';

interface InitOptions {
    framework?: string;
    typescript?: boolean;
    yes?: boolean;
    apiKey?: string;
    hubUrl?: string;
}

export async function initCommand(projectName: string, options: InitOptions) {
    console.log(chalk.blue.bold('🚀 Creating new project with Sashi...\n'));

    try {
        // Get project name if not provided
        if (!projectName) {
            const { name } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'Project name:',
                    validate: (input) => input.trim() ? true : 'Project name is required'
                }
            ]);
            projectName = name;
        }

        const projectDir = path.join(process.cwd(), projectName);

        // Check if directory already exists
        if (await fs.pathExists(projectDir)) {
            console.error(chalk.red(`❌ Directory ${projectName} already exists`));
            process.exit(1);
        }

        let framework = options.framework || 'nextjs';
        let useTypeScript = options.typescript ?? true;
        let apiKey = options.apiKey;
        let hubUrl = options.hubUrl;
        let packageManager = 'npm';

        if (!options.yes) {
            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'framework',
                    message: 'Select framework:',
                    choices: [
                        { name: 'Next.js', value: 'nextjs' },
                        { name: 'Express.js', value: 'express' },
                        { name: 'Node.js (generic)', value: 'nodejs' }
                    ],
                    default: framework
                },
                {
                    type: 'confirm',
                    name: 'typescript',
                    message: 'Use TypeScript?',
                    default: useTypeScript
                },
                {
                    type: 'list',
                    name: 'packageManager',
                    message: 'Package manager:',
                    choices: [
                        { name: 'npm', value: 'npm' },
                        { name: 'yarn', value: 'yarn' },
                        { name: 'pnpm', value: 'pnpm' },
                        { name: 'bun', value: 'bun' }
                    ],
                    default: 'npm'
                },
                {
                    type: 'input',
                    name: 'apiKey',
                    message: 'OpenAI API Key (required):',
                    validate: (input) => input.trim() ? true : 'API key is required',
                    when: !apiKey
                },
                {
                    type: 'input',
                    name: 'hubUrl',
                    message: 'Sashi Hub URL (optional, press enter to skip):',
                    when: !hubUrl
                }
            ]);

            framework = answers.framework;
            useTypeScript = answers.typescript;
            packageManager = answers.packageManager;
            apiKey = answers.apiKey || apiKey;
            hubUrl = answers.hubUrl || hubUrl;
        }

        if (!apiKey) {
            console.error(chalk.red('❌ OpenAI API key is required'));
            process.exit(1);
        }

        // Create project directory
        const createSpinner = ora('Creating project directory...').start();
        await fs.ensureDir(projectDir);
        createSpinner.succeed('Project directory created');

        // Initialize package.json
        const initSpinner = ora('Initializing project...').start();

        if (framework === 'nextjs') {
            // Create Next.js project
            await execa('npx', [
                'create-next-app@latest',
                projectName,
                useTypeScript ? '--typescript' : '--javascript',
                '--tailwind',
                '--eslint',
                '--app',
                '--src-dir',
                '--import-alias',
                '@/*'
            ], { cwd: process.cwd() });
        } else {
            // Create basic Node.js project
            await fs.writeJson(path.join(projectDir, 'package.json'), {
                name: projectName,
                version: '1.0.0',
                description: `A ${framework} project with Sashi`,
                main: useTypeScript ? 'dist/index.js' : 'index.js',
                scripts: {
                    start: useTypeScript ? 'node dist/index.js' : 'node index.js',
                    dev: useTypeScript ? 'ts-node src/index.ts' : 'node index.js',
                    ...(useTypeScript && {
                        build: 'tsc',
                        'build:watch': 'tsc --watch'
                    })
                },
                keywords: ['sashi', framework],
                author: '',
                license: 'MIT'
            }, { spaces: 2 });

            if (useTypeScript) {
                await fs.writeJson(path.join(projectDir, 'tsconfig.json'), {
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
                }, { spaces: 2 });
            }
        }

        initSpinner.succeed('Project initialized');

        // Install dependencies
        const installSpinner = ora('Installing dependencies...').start();

        const corePackages = ['@sashimo/lib'];
        const uiPackages = framework === 'nextjs' ? ['@sashimo/ui'] : [];
        const frameworkPackages = framework === 'express' ? ['express'] : [];
        const devPackages = [
            ...(useTypeScript ? ['typescript', '@types/node'] : []),
            ...(framework === 'express' && useTypeScript ? ['@types/express'] : []),
            ...(useTypeScript && framework !== 'nextjs' ? ['ts-node'] : [])
        ];

        try {
            // Install production dependencies
            const prodPackages = [...corePackages, ...uiPackages, ...frameworkPackages];
            if (prodPackages.length > 0) {
                await execa('sh', ['-c', getInstallCommand(packageManager, prodPackages)], {
                    cwd: projectDir
                });
            }

            // Install dev dependencies
            if (devPackages.length > 0) {
                const devCommand = packageManager === 'yarn' ? `yarn add -D ${devPackages.join(' ')}` :
                    packageManager === 'pnpm' ? `pnpm add -D ${devPackages.join(' ')}` :
                        packageManager === 'bun' ? `bun add -d ${devPackages.join(' ')}` :
                            `npm install -D ${devPackages.join(' ')}`;

                await execa('sh', ['-c', devCommand], { cwd: projectDir });
            }

            installSpinner.succeed('Dependencies installed');
        } catch (error) {
            installSpinner.fail('Failed to install dependencies');
            throw error;
        }

        // Create Sashi configuration files
        const configSpinner = ora('Creating Sashi configuration...').start();

        try {
            await createConfigFiles({
                framework: framework as any,
                typescript: useTypeScript,
                apiKey,
                hubUrl,
                rootDir: projectDir
            });

            configSpinner.succeed('Sashi configuration created');
        } catch (error) {
            configSpinner.fail('Failed to create Sashi configuration');
            throw error;
        }

        // Success message
        console.log(chalk.green.bold('\n✅ Project created successfully!\n'));

        console.log(chalk.yellow('Next steps:'));
        console.log(`1. cd ${projectName}`);
        console.log('2. Start the development server:');

        if (framework === 'nextjs') {
            console.log(`   ${packageManager} run dev`);
            console.log('3. Visit http://localhost:3000/sashi to access the admin panel');
        } else {
            console.log(`   ${packageManager} run dev`);
            console.log('3. Visit http://localhost:3000/sashi to access the admin panel');
        }

        console.log(chalk.blue('\nFor more information, visit: https://docs.usesashi.com'));

    } catch (error) {
        console.error(chalk.red('❌ Project creation failed:'), (error as Error).message);
        process.exit(1);
    }
} 