#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
    .name('sashi')
    .description('CLI for installing and managing Sashi AI admin companion')
    .version('1.0.0');

program
    .command('setup')
    .description('Setup Sashi in an existing Next.js or Node.js project')
    .action(() => {
        console.log('🚀 Setting up Sashi...');
        console.log('This is a basic working CLI!');
    });

program
    .command('init [project-name]')
    .description('Create a new project with Sashi pre-configured')
    .action((projectName) => {
        console.log(`🚀 Creating new project: ${projectName || 'my-sashi-app'}`);
        console.log('This would create a new project with Sashi!');
    });

program.parse(process.argv); 