import chalk from 'chalk';
import { execa } from 'execa';
import inquirer from 'inquirer';
import ora from 'ora';
import { detectProject, getDevInstallCommand, getInstallCommand } from '../utils/detector';
import { createConfigFiles } from '../utils/templates';

interface SetupOptions {
    framework?: string;
    typescript?: boolean;
    yes?: boolean;
    apiKey?: string;
    hubUrl?: string;
}

export async function setupCommand(options: SetupOptions) {
    console.log(chalk.blue.bold('🚀 Setting up Sashi in your project...\n'));

    try {
        // Detect current project
        const spinner = ora('Detecting project configuration...').start();
        const projectInfo = await detectProject();
        spinner.succeed('Project detected');

        console.log(chalk.gray(`Framework: ${projectInfo.framework}`));
        console.log(chalk.gray(`TypeScript: ${projectInfo.hasTypeScript ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`Package Manager: ${projectInfo.packageManager}\n`));

        // Confirm or override detected settings
        let finalFramework = options.framework === 'auto' ? projectInfo.framework : options.framework;
        let useTypeScript = options.typescript ?? projectInfo.hasTypeScript;
        let apiKey = options.apiKey;
        let hubUrl = options.hubUrl;

        if (!options.yes) {
            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'framework',
                    message: 'Select target framework:',
                    choices: [
                        { name: 'Next.js', value: 'nextjs' },
                        { name: 'Express.js', value: 'express' },
                        { name: 'Node.js (generic)', value: 'nodejs' }
                    ],
                    default: finalFramework === 'unknown' ? 'nextjs' : finalFramework
                },
                {
                    type: 'confirm',
                    name: 'typescript',
                    message: 'Use TypeScript?',
                    default: useTypeScript
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

            finalFramework = answers.framework;
            useTypeScript = answers.typescript;
            apiKey = answers.apiKey || apiKey;
            hubUrl = answers.hubUrl || hubUrl;
        }

        if (!apiKey) {
            console.error(chalk.red('❌ OpenAI API key is required'));
            process.exit(1);
        }

        // Install packages
        const installSpinner = ora('Installing Sashi packages...').start();

        const corePackages = ['@sashimo/lib'];
        const uiPackages = finalFramework === 'nextjs' ? ['@sashimo/ui'] : [];
        const devPackages = useTypeScript ? ['@types/node'] : [];

        try {
            if (corePackages.length > 0) {
                await execa('sh', ['-c', getInstallCommand(projectInfo.packageManager, corePackages)], {
                    cwd: projectInfo.rootDir
                });
            }

            if (uiPackages.length > 0) {
                await execa('sh', ['-c', getInstallCommand(projectInfo.packageManager, uiPackages)], {
                    cwd: projectInfo.rootDir
                });
            }

            if (devPackages.length > 0) {
                await execa('sh', ['-c', getDevInstallCommand(projectInfo.packageManager, devPackages)], {
                    cwd: projectInfo.rootDir
                });
            }

            installSpinner.succeed('Packages installed');
        } catch (error) {
            installSpinner.fail('Failed to install packages');
            throw error;
        }

        // Create configuration files
        const configSpinner = ora('Creating configuration files...').start();

        try {
            await createConfigFiles({
                framework: finalFramework as any,
                typescript: useTypeScript,
                apiKey,
                hubUrl,
                rootDir: projectInfo.rootDir
            });

            configSpinner.succeed('Configuration files created');
        } catch (error) {
            configSpinner.fail('Failed to create configuration files');
            throw error;
        }

        // Success message
        console.log(chalk.green.bold('\n✅ Sashi setup completed successfully!\n'));

        console.log(chalk.yellow('Next steps:'));
        console.log('1. Add your OpenAI API key to your environment variables');
        console.log('2. Start your development server');

        if (finalFramework === 'nextjs') {
            console.log('3. Visit /sashi in your browser to access the admin panel');
        } else {
            console.log('3. Import and use Sashi middleware in your application');
        }

        console.log(chalk.blue('\nFor more information, visit: https://docs.usesashi.com'));

    } catch (error) {
        console.error(chalk.red('❌ Setup failed:'), (error as Error).message);
        process.exit(1);
    }
} 