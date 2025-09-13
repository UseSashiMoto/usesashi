#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { addCommand } from './commands/add';
import { checkCommand } from './commands/check';
import { initCommand } from './commands/init';
import { setupCommand } from './commands/setup';
import { updateCommand } from './commands/update';

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
    .option('-y, --yes', 'Skip prompts and use defaults', false)
    .option('--openai-api-key <key>', 'OpenAI API key')
    .option('--hub-url <url>', 'Sashi Hub URL (defaults to https://hub.usesashi.com)')
    .action(setupCommand);

// Init command - for new projects
program
    .command('init [project-name]')
    .description('Create a new project with Sashi pre-configured')
    .option('-f, --framework <framework>', 'Target framework (nextjs, nodejs, express)', 'nextjs')
    .option('-t, --typescript', 'Use TypeScript', true)
    .option('-y, --yes', 'Skip prompts and use defaults', false)
    .option('--openai-api-key <key>', 'OpenAI API key')
    .option('--hub-url <url>', 'Sashi Hub URL (defaults to https://hub.usesashi.com)')
    .action(initCommand);

// Add command - add Sashi middleware
program
    .command('add')
    .description('Add Sashi middleware to your project')
    .option('-y, --yes', 'Skip prompts and use defaults', false)
    .action(addCommand);

// Update command - update Sashi packages
program
    .command('update')
    .description('Update Sashi packages to latest version')
    .option('-y, --yes', 'Skip prompts and update all', false)
    .action(updateCommand);

// Check command - verify setup
program
    .command('check')
    .description('Check Sashi setup and configuration')
    .option('-v, --verbose', 'Show detailed information', false)
    .action(checkCommand);

// Global error handler
program.configureHelp({
    sortSubcommands: true,
});

program.on('command:*', () => {
    console.error(chalk.red(`Invalid command: ${program.args.join(' ')}`));
    console.log('See --help for a list of available commands.');
    process.exit(1);
});

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}

program.parse(process.argv); 