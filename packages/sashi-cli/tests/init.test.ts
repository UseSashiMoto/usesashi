import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('sashi init command', () => {
    let testDir: string;
    let origCwd: string;

    beforeEach(() => {
        testDir = global.testUtils.createTempDir();
        origCwd = process.cwd();
    });

    afterEach(() => {
        process.chdir(origCwd);
        global.testUtils.cleanupTempDir(testDir);
    });

    test('should create new Node.js project by default', () => {
        const projectName = 'test-project';
        
        process.chdir(testDir);
        execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName}`);

        const projectDir = path.join(testDir, projectName);
        expect(fs.existsSync(projectDir)).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'sashi.config.ts'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, '.env.local'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'src/index.ts'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'tsconfig.json'))).toBe(true);

        const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
        expect(packageJson.name).toBe(projectName);
        expect(packageJson.dependencies['@sashimo/lib']).toBe('latest');
        expect(packageJson.devDependencies['typescript']).toBeDefined();
    });

    test('should create Express project when specified', () => {
        const projectName = 'express-project';
        
        process.chdir(testDir);
        execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName} --framework express`);

        const projectDir = path.join(testDir, projectName);
        const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
        expect(packageJson.dependencies['express']).toBeDefined();
        expect(packageJson.devDependencies['@types/express']).toBeDefined();
    });

    test('should create TypeScript project by default', () => {
        const projectName = 'ts-project';
        
        process.chdir(testDir);
        execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName}`);

        const projectDir = path.join(testDir, projectName);
        expect(fs.existsSync(path.join(projectDir, 'sashi.config.ts'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'src/index.ts'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'tsconfig.json'))).toBe(true);

        const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
        expect(packageJson.devDependencies?.typescript).toBeDefined();
    });

    test('should fail when project name is not provided', () => {
        expect(() => {
            process.chdir(testDir);
            execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init', { 
                encoding: 'utf-8'
            });
        }).toThrow();
    });

    test('should fail when directory already exists', () => {
        const projectName = 'existing-project';
        fs.mkdirSync(path.join(testDir, projectName));

        expect(() => {
            process.chdir(testDir);
            execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName}`, { 
                encoding: 'utf-8'
            });
        }).toThrow();
    });

    test('should create correct server files for Express', () => {
        const projectName = 'express-test';
        
        process.chdir(testDir);
        execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName} --framework express`);

        const projectDir = path.join(testDir, projectName);
        const serverContent = fs.readFileSync(path.join(projectDir, 'src/index.ts'), 'utf-8');
        expect(serverContent).toContain('express');
        expect(serverContent).toContain('createMiddleware');
        expect(serverContent).toContain('/sashi');
    });

    test('should create correct server files for Node.js', () => {
        const projectName = 'node-test';
        
        process.chdir(testDir);
        execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName} --framework nodejs`);

        const projectDir = path.join(testDir, projectName);
        const serverContent = fs.readFileSync(path.join(projectDir, 'src/index.ts'), 'utf-8');
        expect(serverContent).toContain('http');
        expect(serverContent).toContain('createMiddleware');
        expect(serverContent).toContain('/sashi');
    });
});