import chalk from 'chalk';
import { execa } from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import ora from 'ora';
import path from 'path';
import { detectProject, getDevInstallCommand, getInstallCommand } from '../utils/detector';
import { handleHubRegistration, validateHubUrl } from '../utils/hub';
import { createConfigFiles } from '../utils/templates';

interface SetupOptions {
    framework?: string;
    typescript?: boolean;
    yes?: boolean;
    openAIAPIKey?: string;
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

        // Validate hub URL if provided
        if (options.hubUrl && !validateHubUrl(options.hubUrl)) {
            console.error(chalk.red('❌ Invalid hub URL format'));
            process.exit(1);
        }

        // Confirm or override detected settings
        let finalFramework = options.framework === 'auto' ? projectInfo.framework : options.framework;
        let useTypeScript = options.typescript ?? projectInfo.hasTypeScript;
        let openAIAPIKey = options.openAIAPIKey;
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
                    validate: (input: string) => input.trim() ? true : 'API key is required',
                    when: !openAIAPIKey
                },
                {
                    type: 'input',
                    name: 'hubUrl',
                    message: 'Sashi Hub URL (optional, press enter to skip):',
                    validate: (input: string) => {
                        if (!input) return true; // Optional field
                        return validateHubUrl(input) ? true : 'Please enter a valid URL';
                    },
                    when: !hubUrl
                }
            ]);

            finalFramework = answers.framework;
            useTypeScript = answers.typescript;
            openAIAPIKey = answers.openAIAPIKey || openAIAPIKey;
            hubUrl = answers.hubUrl || hubUrl;
        }

        // Use provided OpenAI API key or placeholder
        const finalOpenAIAPIKey = openAIAPIKey || 'your-openai-api-key-here';

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
                apiKey: finalOpenAIAPIKey,
                hubUrl,
                hubApiKey: undefined, // Will be set after hub registration
                rootDir: projectInfo.rootDir
            });

            configSpinner.succeed('Configuration files created');
        } catch (error) {
            configSpinner.fail('Failed to create configuration files');
            throw error;
        }

        // Optional hub registration after main setup is complete
        let hubApiKey: string | undefined;
        if (!options.yes) {
            try {
                hubApiKey = await handleHubRegistration({
                    hubUrl,
                    skipPrompt: false
                }) || undefined;

                if (hubApiKey) {
                    // Update the .env.local file with the hub API key
                    const envPath = path.join(projectInfo.rootDir, '.env.local');
                    let envContent = await fs.readFile(envPath, 'utf-8');
                    envContent = envContent.replace(
                        'HUB_API_SECRET_KEY=your-hub-secret-key-here',
                        `HUB_API_SECRET_KEY=${hubApiKey}`
                    );
                    await fs.writeFile(envPath, envContent);
                }
            } catch (error) {
                // Hub registration failed, but setup is still successful
                console.log(chalk.yellow('⚠️ Hub registration failed, but your project setup is complete!'));
            }
        }

        // Success message
        console.log(chalk.green.bold('\n✅ Sashi setup completed successfully!\n'));

        console.log(chalk.yellow('Next steps:'));
        if (!openAIAPIKey) {
            console.log('1. Add your OpenAI API key to .env.local');
            console.log('   Get your key from: https://platform.openai.com/api-keys');
        } else {
            console.log('1. Your OpenAI API key has been added to .env.local');
        }

        if (hubApiKey) {
            console.log('2. ✅ Hub registration successful - enhanced features enabled!');
            console.log('3. Start your development server');
        } else {
            console.log('2. Start your development server');
            if (!options.yes) {
                console.log('3. Hub registration was skipped - you can run setup again to enable enhanced features');
            }
        }

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