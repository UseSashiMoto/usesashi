import chalk from 'chalk';
import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import { detectProject } from '../utils/detector';

interface CheckOptions {
    verbose?: boolean;
}

export async function checkCommand(options: CheckOptions) {
    console.log(chalk.blue.bold('🔍 Checking Sashi setup...\n'));

    try {
        // Detect current project
        const spinner = ora('Detecting project configuration...').start();
        const projectInfo = await detectProject();
        spinner.succeed('Project detected');

        const issues = [];
        const warnings = [];
        const successes = [];

        // Check 1: Sashi packages installation
        console.log(chalk.blue('📦 Checking package installation...'));

        const sashiPackages = {
            '@sashimo/lib': projectInfo.packageJson.dependencies?.['@sashimo/lib'] || projectInfo.packageJson.devDependencies?.['@sashimo/lib'],
            '@sashimo/ui': projectInfo.packageJson.dependencies?.['@sashimo/ui'] || projectInfo.packageJson.devDependencies?.['@sashimo/ui']
        };

        if (sashiPackages['@sashimo/lib']) {
            successes.push(`✅ @sashimo/lib v${sashiPackages['@sashimo/lib'].replace(/^[\^~]/, '')} installed`);
        } else {
            issues.push('❌ @sashimo/lib not found - run "sashi setup" to install');
        }

        if (projectInfo.framework === 'nextjs') {
            if (sashiPackages['@sashimo/ui']) {
                successes.push(`✅ @sashimo/ui v${sashiPackages['@sashimo/ui'].replace(/^[\^~]/, '')} installed`);
            } else {
                warnings.push('⚠️  @sashimo/ui not found - recommended for Next.js projects');
            }
        }

        // Check 2: Configuration files
        console.log(chalk.blue('\n⚙️  Checking configuration...'));

        const configFiles = {
            sashiConfig: await fs.pathExists(path.join(projectInfo.rootDir, 'sashi.config.js')) ||
                await fs.pathExists(path.join(projectInfo.rootDir, 'sashi.config.ts')),
            envFile: await fs.pathExists(path.join(projectInfo.rootDir, '.env.local')) ||
                await fs.pathExists(path.join(projectInfo.rootDir, '.env'))
        };

        if (configFiles.sashiConfig) {
            successes.push('✅ Sashi configuration file found');

            // Check config content
            if (options.verbose) {
                await checkConfigContent(projectInfo.rootDir, successes, warnings, issues);
            }
        } else {
            issues.push('❌ Sashi configuration file not found - run "sashi setup" to create');
        }

        if (configFiles.envFile) {
            successes.push('✅ Environment file found');

            // Check for API key
            await checkEnvironmentVariables(projectInfo.rootDir, successes, warnings, issues);
        } else {
            warnings.push('⚠️  Environment file not found - you may need to configure API keys');
        }

        // Check 3: Framework-specific setup
        console.log(chalk.blue('\n🚀 Checking framework integration...'));

        switch (projectInfo.framework) {
            case 'nextjs':
                await checkNextJSSetup(projectInfo.rootDir, successes, warnings, issues);
                break;
            case 'express':
                await checkExpressSetup(projectInfo.rootDir, successes, warnings, issues);
                break;
            case 'nodejs':
                await checkNodeJSSetup(projectInfo.rootDir, successes, warnings, issues);
                break;
            default:
                warnings.push('⚠️  Unknown framework - manual integration may be required');
        }

        // Check 4: Dependencies and compatibility
        console.log(chalk.blue('\n🔧 Checking dependencies...'));

        if (projectInfo.hasTypeScript) {
            successes.push('✅ TypeScript detected');
        } else {
            warnings.push('⚠️  JavaScript project - TypeScript recommended for better development experience');
        }

        // Check Node.js version
        const nodeVersion = process.version;
        if (nodeVersion) {
            const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0] || '0');
            if (majorVersion >= 16) {
                successes.push(`✅ Node.js ${nodeVersion} (compatible)`);
            } else {
                issues.push(`❌ Node.js ${nodeVersion} is too old - Node.js 16+ required`);
            }
        }

        // Summary
        console.log(chalk.blue('\n📋 Summary:'));

        if (successes.length > 0) {
            console.log(chalk.green('\n✅ Successes:'));
            successes.forEach(success => console.log(`  ${success}`));
        }

        if (warnings.length > 0) {
            console.log(chalk.yellow('\n⚠️  Warnings:'));
            warnings.forEach(warning => console.log(`  ${warning}`));
        }

        if (issues.length > 0) {
            console.log(chalk.red('\n❌ Issues:'));
            issues.forEach(issue => console.log(`  ${issue}`));

            console.log(chalk.yellow('\n🔧 Recommended actions:'));
            if (issues.some(i => i.includes('@sashimo/lib'))) {
                console.log('  - Run "sashi setup" to install and configure Sashi');
            }
            if (issues.some(i => i.includes('configuration'))) {
                console.log('  - Run "sashi setup" to create configuration files');
            }
            if (issues.some(i => i.includes('Node.js'))) {
                console.log('  - Update Node.js to version 16 or higher');
            }
        }

        // Overall status
        if (issues.length === 0) {
            console.log(chalk.green.bold('\n🎉 Sashi setup looks good!'));

            if (projectInfo.framework === 'nextjs') {
                console.log(chalk.blue('\n🌐 Access your admin panel at: http://localhost:3000/sashi'));
            } else {
                console.log(chalk.blue('\n🌐 Admin panel available at your configured Sashi path (default: /sashi)'));
            }
        } else {
            console.log(chalk.red.bold(`\n⚠️  Found ${issues.length} issue(s) that need attention`));
        }

        if (options.verbose) {
            console.log(chalk.gray('\n📊 Project Information:'));
            console.log(chalk.gray(`  Framework: ${projectInfo.framework}`));
            console.log(chalk.gray(`  TypeScript: ${projectInfo.hasTypeScript ? 'Yes' : 'No'}`));
            console.log(chalk.gray(`  Package Manager: ${projectInfo.packageManager}`));
            console.log(chalk.gray(`  Root Directory: ${projectInfo.rootDir}`));
        }

    } catch (error) {
        console.error(chalk.red('❌ Check failed:'), (error as Error).message);
        process.exit(1);
    }
}

async function checkConfigContent(rootDir: string, successes: string[], warnings: string[], issues: string[]) {
    // This would check the actual config file content
    // For now, just indicate that config exists
}

async function checkEnvironmentVariables(rootDir: string, successes: string[], warnings: string[], issues: string[]) {
    try {
        const envFiles = ['.env.local', '.env'];
        let envContent = '';

        for (const file of envFiles) {
            const filePath = path.join(rootDir, file);
            if (await fs.pathExists(filePath)) {
                envContent = await fs.readFile(filePath, 'utf-8');
                break;
            }
        }

        if (envContent.includes('OPENAI_API_KEY')) {
            successes.push('✅ OpenAI API key configured');
        } else {
            warnings.push('⚠️  OPENAI_API_KEY not found in environment file');
        }

        if (envContent.includes('SASHI_HUB_URL')) {
            successes.push('✅ Sashi Hub URL configured');
        }
    } catch (error) {
        warnings.push('⚠️  Could not read environment file');
    }
}

async function checkNextJSSetup(rootDir: string, successes: string[], warnings: string[], issues: string[]) {
    // Check for API route
    const apiRoutes = [
        path.join(rootDir, 'pages', 'api', 'sashi', '[[...slug]].js'),
        path.join(rootDir, 'pages', 'api', 'sashi', '[[...slug]].ts'),
        path.join(rootDir, 'app', 'api', 'sashi', '[[...slug]]', 'route.js'),
        path.join(rootDir, 'app', 'api', 'sashi', '[[...slug]]', 'route.ts')
    ];

    const hasApiRoute = await Promise.all(apiRoutes.map(route => fs.pathExists(route)));
    if (hasApiRoute.some(exists => exists)) {
        successes.push('✅ Sashi API route configured');
    } else {
        issues.push('❌ Sashi API route not found - create pages/api/sashi/[[...slug]].js');
    }

    // Check for UI page
    const uiPages = [
        path.join(rootDir, 'pages', 'sashi', 'index.js'),
        path.join(rootDir, 'pages', 'sashi', 'index.tsx'),
        path.join(rootDir, 'app', 'sashi', 'page.js'),
        path.join(rootDir, 'app', 'sashi', 'page.tsx')
    ];

    const hasUIPage = await Promise.all(uiPages.map(page => fs.pathExists(page)));
    if (hasUIPage.some(exists => exists)) {
        successes.push('✅ Sashi UI page configured');
    } else {
        warnings.push('⚠️  Sashi UI page not found - create pages/sashi/index.tsx for admin interface');
    }

    // Check for Tailwind CSS
    const hasTailwind = await fs.pathExists(path.join(rootDir, 'tailwind.config.js')) ||
        await fs.pathExists(path.join(rootDir, 'tailwind.config.ts'));

    if (hasTailwind) {
        successes.push('✅ Tailwind CSS configured');
    } else {
        warnings.push('⚠️  Tailwind CSS not found - required for Sashi UI components');
    }
}

async function checkExpressSetup(rootDir: string, successes: string[], warnings: string[], issues: string[]) {
    // Check for example integration file
    const exampleFiles = [
        path.join(rootDir, 'sashi-example.js'),
        path.join(rootDir, 'sashi-example.ts')
    ];

    const hasExample = await Promise.all(exampleFiles.map(file => fs.pathExists(file)));
    if (hasExample.some(exists => exists)) {
        successes.push('✅ Sashi example integration found');
    } else {
        warnings.push('⚠️  No Sashi integration example found - check documentation for setup');
    }
}

async function checkNodeJSSetup(rootDir: string, successes: string[], warnings: string[], issues: string[]) {
    // Similar to Express setup
    await checkExpressSetup(rootDir, successes, warnings, issues);
} 