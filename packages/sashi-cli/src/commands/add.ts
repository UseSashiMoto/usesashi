import chalk from 'chalk';
import { execa } from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import ora from 'ora';
import path from 'path';
import { detectProject, getInstallCommand } from '../utils/detector';

interface AddOptions {
    yes?: boolean;
}

const FEATURES = {
    middleware: {
        name: 'Middleware',
        description: 'Core Sashi middleware for handling AI requests',
        packages: ['@sashimo/lib']
    }
} as const;

export async function addCommand(options: AddOptions) {
    console.log(chalk.blue.bold('🔧 Adding Sashi middleware to your project...\n'));

    try {
        // Detect current project
        const spinner = ora('Detecting project configuration...').start();
        const projectInfo = await detectProject();
        spinner.succeed('Project detected');

        const featureInfo = FEATURES.middleware;
        console.log(chalk.gray(`Adding: ${featureInfo.name}`));
        console.log(chalk.gray(`Description: ${featureInfo.description}\n`));

        // Confirm installation
        if (!options.yes) {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Add ${featureInfo.name} to your project?`,
                    default: true
                }
            ]);

            if (!confirm) {
                console.log(chalk.yellow('❌ Installation cancelled'));
                return;
            }
        }

        // Install packages if needed
        if (featureInfo.packages.length > 0) {
            const installSpinner = ora('Installing packages...').start();

            try {
                await execa('sh', ['-c', getInstallCommand(projectInfo.packageManager, [...featureInfo.packages])], {
                    cwd: projectInfo.rootDir
                });
                installSpinner.succeed('Packages installed');
            } catch (error) {
                installSpinner.fail('Failed to install packages');
                throw error;
            }
        }

        // Setup middleware
        const setupSpinner = ora(`Setting up ${featureInfo.name}...`).start();

        try {
            await setupMiddleware(projectInfo);
            setupSpinner.succeed(`${featureInfo.name} setup completed`);
        } catch (error) {
            setupSpinner.fail(`Failed to setup ${featureInfo.name}`);
            throw error;
        }

        // Success message
        console.log(chalk.green.bold(`\n✅ ${featureInfo.name} added successfully!\n`));

        // Next steps
        console.log(chalk.yellow('Next steps:'));
        console.log('1. Configure your OpenAI API key in environment variables');
        console.log('2. Import and use the middleware in your application');

    } catch (error) {
        console.error(chalk.red('❌ Failed to add middleware:'), (error as Error).message);
        process.exit(1);
    }
}

async function setupMiddleware(projectInfo: any) {
    // Check if sashi.config already exists
    const configExists = await fs.pathExists(path.join(projectInfo.rootDir, 'sashi.config.js')) ||
        await fs.pathExists(path.join(projectInfo.rootDir, 'sashi.config.ts'));

    if (!configExists) {
        console.log(chalk.yellow('⚠️  No sashi.config found. Run "sashi setup" for full configuration.'));
    }
}

