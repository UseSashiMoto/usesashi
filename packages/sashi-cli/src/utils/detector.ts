import fs from 'fs-extra';
import path from 'path';

export interface ProjectInfo {
    framework: 'nextjs' | 'nodejs' | 'express' | 'unknown';
    hasTypeScript: boolean;
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
    packageJsonPath: string;
    packageJson: any;
    rootDir: string;
}

export async function detectProject(cwd: string = process.cwd()): Promise<ProjectInfo> {
    const packageJsonPath = path.join(cwd, 'package.json');

    if (!await fs.pathExists(packageJsonPath)) {
        throw new Error('No package.json found. Please run this command in a Node.js project directory.');
    }

    const packageJson = await fs.readJson(packageJsonPath);

    // Detect framework
    let framework: ProjectInfo['framework'] = 'unknown';

    if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
        framework = 'nextjs';
    } else if (packageJson.dependencies?.express || packageJson.devDependencies?.express) {
        framework = 'express';
    } else if (packageJson.name || packageJson.main || packageJson.scripts?.start) {
        framework = 'nodejs';
    }

    // Detect TypeScript
    const hasTypeScript = !!(
        packageJson.dependencies?.typescript ||
        packageJson.devDependencies?.typescript ||
        await fs.pathExists(path.join(cwd, 'tsconfig.json'))
    );

    // Detect package manager
    let packageManager: ProjectInfo['packageManager'] = 'npm';

    if (await fs.pathExists(path.join(cwd, 'yarn.lock'))) {
        packageManager = 'yarn';
    } else if (await fs.pathExists(path.join(cwd, 'pnpm-lock.yaml'))) {
        packageManager = 'pnpm';
    } else if (await fs.pathExists(path.join(cwd, 'bun.lockb'))) {
        packageManager = 'bun';
    }

    return {
        framework,
        hasTypeScript,
        packageManager,
        packageJsonPath,
        packageJson,
        rootDir: cwd
    };
}

export function getInstallCommand(packageManager: string, packages: string[]): string {
    switch (packageManager) {
        case 'yarn':
            return `yarn add ${packages.join(' ')}`;
        case 'pnpm':
            return `pnpm add ${packages.join(' ')}`;
        case 'bun':
            return `bun add ${packages.join(' ')}`;
        default:
            return `npm install ${packages.join(' ')}`;
    }
}

export function getDevInstallCommand(packageManager: string, packages: string[]): string {
    switch (packageManager) {
        case 'yarn':
            return `yarn add -D ${packages.join(' ')}`;
        case 'pnpm':
            return `pnpm add -D ${packages.join(' ')}`;
        case 'bun':
            return `bun add -d ${packages.join(' ')}`;
        default:
            return `npm install -D ${packages.join(' ')}`;
    }
} 