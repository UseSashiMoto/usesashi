import chalk from 'chalk';
import { execa } from 'execa';
import inquirer from 'inquirer';
import ora from 'ora';
import semver from 'semver';
import { detectProject, getInstallCommand } from '../utils/detector';

interface UpdateOptions {
    yes?: boolean;
}

const SASHI_PACKAGES = [
    '@sashimo/lib',
    '@sashimo/ui',
    '@sashimo/cli'
];

export async function updateCommand(options: UpdateOptions) {
    console.log(chalk.blue.bold('🔄 Updating Sashi packages...\n'));

    try {
        // Detect current project
        const spinner = ora('Detecting project configuration...').start();
        const projectInfo = await detectProject();
        spinner.succeed('Project detected');

        // Check which Sashi packages are installed
        const installedPackages = [];
        const packageUpdates = [];

        for (const pkg of SASHI_PACKAGES) {
            const currentVersion = projectInfo.packageJson.dependencies?.[pkg] ||
                projectInfo.packageJson.devDependencies?.[pkg];

            if (currentVersion) {
                installedPackages.push(pkg);

                // Get latest version from npm
                try {
                    const { stdout } = await execa('npm', ['view', pkg, 'version']);
                    const latestVersion = stdout.trim();
                    const cleanCurrentVersion = currentVersion.replace(/^[\^~]/, '');

                    if (semver.gt(latestVersion, cleanCurrentVersion)) {
                        packageUpdates.push({
                            name: pkg,
                            current: cleanCurrentVersion,
                            latest: latestVersion
                        });
                    }
                } catch (error) {
                    console.log(chalk.yellow(`⚠️  Could not check version for ${pkg}`));
                }
            }
        }

        if (installedPackages.length === 0) {
            console.log(chalk.yellow('❌ No Sashi packages found in this project'));
            console.log(chalk.gray('Run "sashi setup" to install Sashi in your project'));
            return;
        }

        console.log(chalk.gray(`Found ${installedPackages.length} Sashi package(s):`));
        installedPackages.forEach(pkg => {
            console.log(chalk.gray(`  - ${pkg}`));
        });

        if (packageUpdates.length === 0) {
            console.log(chalk.green('\n✅ All Sashi packages are up to date!'));
            return;
        }

        console.log(chalk.yellow(`\n📦 ${packageUpdates.length} package(s) can be updated:`));
        packageUpdates.forEach(update => {
            console.log(chalk.yellow(`  ${update.name}: ${update.current} → ${update.latest}`));
        });

        // Confirm updates
        if (!options.yes) {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Update these packages?',
                    default: true
                }
            ]);

            if (!confirm) {
                console.log(chalk.yellow('❌ Update cancelled'));
                return;
            }
        }

        // Perform updates
        const updateSpinner = ora('Updating packages...').start();

        try {
            const packagesToUpdate = packageUpdates.map(update => `${update.name}@latest`);
            await execa('sh', ['-c', getInstallCommand(projectInfo.packageManager, packagesToUpdate)], {
                cwd: projectInfo.rootDir
            });

            updateSpinner.succeed('Packages updated successfully');
        } catch (error) {
            updateSpinner.fail('Failed to update packages');
            throw error;
        }

        // Check for breaking changes or migration notes
        const migrationSpinner = ora('Checking for migration notes...').start();

        try {
            await checkMigrationNotes(packageUpdates);
            migrationSpinner.succeed('Migration check completed');
        } catch (error) {
            migrationSpinner.warn('Could not check migration notes');
        }

        // Success message
        console.log(chalk.green.bold('\n✅ Sashi packages updated successfully!\n'));

        console.log(chalk.yellow('Next steps:'));
        console.log('1. Review any migration notes above');
        console.log('2. Test your application to ensure everything works');
        console.log('3. Update your configuration if needed');

        console.log(chalk.blue('\nChangelog: https://github.com/usesashi/sashi/releases'));

    } catch (error) {
        console.error(chalk.red('❌ Update failed:'), (error as Error).message);
        process.exit(1);
    }
}

async function checkMigrationNotes(updates: any[]) {
    const migrationNotes = [];

    for (const update of updates) {
        // Check for major version changes that might need migration
        const currentMajor = semver.major(update.current);
        const latestMajor = semver.major(update.latest);

        if (latestMajor > currentMajor) {
            migrationNotes.push({
                package: update.name,
                type: 'major',
                message: `Major version update (${currentMajor}.x → ${latestMajor}.x) - check for breaking changes`
            });
        } else if (semver.minor(update.latest) > semver.minor(update.current)) {
            migrationNotes.push({
                package: update.name,
                type: 'minor',
                message: `Minor version update - new features may be available`
            });
        }
    }

    if (migrationNotes.length > 0) {
        console.log(chalk.yellow('\n📋 Migration Notes:'));
        migrationNotes.forEach(note => {
            const icon = note.type === 'major' ? '🚨' : '📝';
            console.log(chalk.yellow(`${icon} ${note.package}: ${note.message}`));
        });

        // Package-specific migration notes
        const hasLibUpdate = updates.some(u => u.name === '@sashimo/lib');
        const hasUIUpdate = updates.some(u => u.name === '@sashimo/ui');

        if (hasLibUpdate) {
            console.log(chalk.blue('\n@sashimo/lib migration tips:'));
            console.log('- Check if your middleware configuration needs updates');
            console.log('- Review function registration if you use custom functions');
            console.log('- Update environment variables if new options are available');
        }

        if (hasUIUpdate) {
            console.log(chalk.blue('\n@sashimo/ui migration tips:'));
            console.log('- Check if your Tailwind configuration needs updates');
            console.log('- Review component props if you use custom styling');
            console.log('- Update theme configuration if new options are available');
        }
    }
} 