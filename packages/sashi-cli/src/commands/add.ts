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

const FEATURES: Record<string, {
    name: string;
    description: string;
    packages: string[];
}> = {
    middleware: {
        name: 'Middleware',
        description: 'Core Sashi middleware for handling AI requests',
        packages: ['@sashimo/lib']
    },
    ui: {
        name: 'UI Components',
        description: 'React UI components for admin interface',
        packages: ['@sashimo/ui']
    },
    functions: {
        name: 'Default Functions',
        description: 'Pre-built utility functions for common tasks',
        packages: []
    },
    workflows: {
        name: 'Workflows',
        description: 'Workflow management and automation features',
        packages: []
    }
};

export async function addCommand(feature: string, options: AddOptions) {
    console.log(chalk.blue.bold(`🔧 Adding ${feature} to your project...\n`));

    try {
        // Detect current project
        const spinner = ora('Detecting project configuration...').start();
        const projectInfo = await detectProject();
        spinner.succeed('Project detected');

        // Validate feature
        if (!FEATURES[feature]) {
            console.error(chalk.red(`❌ Unknown feature: ${feature}`));
            console.log(chalk.gray('Available features:'));
            Object.entries(FEATURES).forEach(([key, info]) => {
                console.log(chalk.gray(`  ${key} - ${info.description}`));
            });
            process.exit(1);
        }

        const featureInfo = FEATURES[feature];
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
                await execa('sh', ['-c', getInstallCommand(projectInfo.packageManager, featureInfo.packages)], {
                    cwd: projectInfo.rootDir
                });
                installSpinner.succeed('Packages installed');
            } catch (error) {
                installSpinner.fail('Failed to install packages');
                throw error;
            }
        }

        // Feature-specific setup
        const setupSpinner = ora(`Setting up ${featureInfo.name}...`).start();

        try {
            switch (feature) {
                case 'middleware':
                    await setupMiddleware(projectInfo);
                    break;
                case 'ui':
                    await setupUI(projectInfo);
                    break;
                case 'functions':
                    await setupFunctions(projectInfo);
                    break;
                case 'workflows':
                    await setupWorkflows(projectInfo);
                    break;
            }

            setupSpinner.succeed(`${featureInfo.name} setup completed`);
        } catch (error) {
            setupSpinner.fail(`Failed to setup ${featureInfo.name}`);
            throw error;
        }

        // Success message
        console.log(chalk.green.bold(`\n✅ ${featureInfo.name} added successfully!\n`));

        // Feature-specific instructions
        switch (feature) {
            case 'middleware':
                console.log(chalk.yellow('Next steps:'));
                console.log('1. Configure your OpenAI API key in environment variables');
                console.log('2. Import and use the middleware in your application');
                break;
            case 'ui':
                console.log(chalk.yellow('Next steps:'));
                console.log('1. Import SashiUI component in your pages');
                console.log('2. Add Tailwind CSS if not already configured');
                break;
            case 'functions':
                console.log(chalk.yellow('Usage:'));
                console.log('1. Import and register default functions in your middleware');
                console.log('2. Use loadDefaultFunctions() to enable utility functions');
                break;
            case 'workflows':
                console.log(chalk.yellow('Usage:'));
                console.log('1. Create workflow definitions in your project');
                console.log('2. Use the workflow management UI to create and run workflows');
                break;
        }

    } catch (error) {
        console.error(chalk.red(`❌ Failed to add ${feature}:`), (error as Error).message);
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

async function setupUI(projectInfo: any) {
    if (projectInfo.framework !== 'nextjs') {
        console.log(chalk.yellow('⚠️  UI components are primarily designed for Next.js projects.'));
    }

    // Check for Tailwind CSS
    const hasTailwind = projectInfo.packageJson.dependencies?.tailwindcss ||
        projectInfo.packageJson.devDependencies?.tailwindcss ||
        await fs.pathExists(path.join(projectInfo.rootDir, 'tailwind.config.js'));

    if (!hasTailwind) {
        console.log(chalk.yellow('⚠️  Tailwind CSS not detected. Sashi UI requires Tailwind CSS.'));
        console.log(chalk.gray('   Install it with: npx tailwindcss init -p'));
    }
}

async function setupFunctions(projectInfo: any) {
    // Create example functions file
    const exampleDir = path.join(projectInfo.rootDir, 'sashi');
    await fs.ensureDir(exampleDir);

    const exampleContent = projectInfo.hasTypeScript ? `
import { AIFunction, registerFunction, loadDefaultFunctions } from '@sashimo/lib';

// Load default utility functions
loadDefaultFunctions(['math', 'text', 'data']); // Load specific categories
// Or load all: loadDefaultFunctions();

// Example custom function
const customFunction = new AIFunction('custom_example', 'Example custom function')
  .args({
    name: 'input',
    description: 'Input text',
    type: 'string',
    required: true
  })
  .returns({
    name: 'output',
    description: 'Processed output',
    type: 'string'
  })
  .implement(async (input: string) => {
    return \`Processed: \${input}\`;
  });

registerFunction(customFunction);

export { customFunction };
` : `
const { AIFunction, registerFunction, loadDefaultFunctions } = require('@sashimo/lib');

// Load default utility functions
loadDefaultFunctions(['math', 'text', 'data']); // Load specific categories
// Or load all: loadDefaultFunctions();

// Example custom function
const customFunction = new AIFunction('custom_example', 'Example custom function')
  .args({
    name: 'input',
    description: 'Input text',
    type: 'string',
    required: true
  })
  .returns({
    name: 'output',
    description: 'Processed output',
    type: 'string'
  })
  .implement(async (input) => {
    return \`Processed: \${input}\`;
  });

registerFunction(customFunction);

module.exports = { customFunction };
`;

    await fs.writeFile(
        path.join(exampleDir, `functions.${projectInfo.hasTypeScript ? 'ts' : 'js'}`),
        exampleContent
    );
}

async function setupWorkflows(projectInfo: any) {
    // Create example workflow directory
    const workflowDir = path.join(projectInfo.rootDir, 'sashi', 'workflows');
    await fs.ensureDir(workflowDir);

    const exampleWorkflow = {
        name: 'example-workflow',
        description: 'Example workflow for demonstration',
        steps: [
            {
                id: 'step1',
                name: 'Input Processing',
                function: 'process_input',
                inputs: {
                    data: '{{ workflow.input }}'
                }
            },
            {
                id: 'step2',
                name: 'Data Transformation',
                function: 'transform_data',
                inputs: {
                    data: '{{ step1.output }}'
                }
            }
        ],
        outputs: {
            result: '{{ step2.output }}'
        }
    };

    await fs.writeJson(
        path.join(workflowDir, 'example.json'),
        exampleWorkflow,
        { spaces: 2 }
    );
} 