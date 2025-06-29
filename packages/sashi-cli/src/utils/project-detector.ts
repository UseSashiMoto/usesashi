import * as fs from 'fs';
import * as path from 'path';

export interface ProjectInfo {
    framework: 'nextjs' | 'nodejs' | 'express' | 'unknown';
    hasTypeScript: boolean;
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
    packageJsonPath: string;
    packageJson: any;
    rootDir: string;
}

export function detectProject(cwd: string = process.cwd()): ProjectInfo {
    const packageJsonPath = path.join(cwd, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('No package.json found. Please run this command in a Node.js project directory.');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

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
        fs.existsSync(path.join(cwd, 'tsconfig.json'))
    );

    // Detect package manager
    let packageManager: ProjectInfo['packageManager'] = 'npm';

    if (fs.existsSync(path.join(cwd, 'yarn.lock'))) {
        packageManager = 'yarn';
    } else if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
        packageManager = 'pnpm';
    } else if (fs.existsSync(path.join(cwd, 'bun.lockb'))) {
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