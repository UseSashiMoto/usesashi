import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('sashi integration test', () => {
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

    test('should create a working Express project with sashi setup', () => {
        const projectName = 'test-express-app';
        
        process.chdir(testDir);
        execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName} --framework express`);

        const projectDir = path.join(testDir, projectName);
        expect(fs.existsSync(projectDir)).toBe(true);

        // Check all required files exist
        expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'sashi.config.ts'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, '.env.local'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'src/index.ts'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'tsconfig.json'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'README.md'))).toBe(true);

        // Verify package.json content
        const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
        expect(packageJson.name).toBe(projectName);
        expect(packageJson.dependencies['@sashimo/lib']).toBe('latest');
        expect(packageJson.dependencies['express']).toBeDefined();
        expect(packageJson.devDependencies['typescript']).toBeDefined();
        expect(packageJson.devDependencies['@types/express']).toBeDefined();

        // Verify server file contains proper Express setup
        const serverContent = fs.readFileSync(path.join(projectDir, 'src/index.ts'), 'utf-8');
        expect(serverContent).toContain('import express from \'express\'');
        expect(serverContent).toContain('createMiddleware');
        expect(serverContent).toContain('app.use(\'/sashi\', sashiMiddleware)');
        expect(serverContent).toContain('app.listen(port');

        // Verify config file content
        const configContent = fs.readFileSync(path.join(projectDir, 'sashi.config.ts'), 'utf-8');
        expect(configContent).toContain('openAIKey');
        expect(configContent).toContain('apiSecretKey');
        expect(configContent).toContain('debug');

        // Verify environment file content
        const envContent = fs.readFileSync(path.join(projectDir, '.env.local'), 'utf-8');
        expect(envContent).toContain('OPENAI_API_KEY=your-openai-api-key-here');

        // Verify TypeScript config
        const tsConfig = JSON.parse(fs.readFileSync(path.join(projectDir, 'tsconfig.json'), 'utf-8'));
        expect(tsConfig.compilerOptions.target).toBe('ES2020');
        expect(tsConfig.compilerOptions.outDir).toBe('./dist');
    });

    test('should create a working Node.js project with sashi setup', () => {
        const projectName = 'test-node-app';
        
        process.chdir(testDir);
        execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName} --framework nodejs`);

        const projectDir = path.join(testDir, projectName);
        
        // Verify server file contains proper Node.js setup
        const serverContent = fs.readFileSync(path.join(projectDir, 'src/index.ts'), 'utf-8');
        expect(serverContent).toContain('import http from \'http\'');
        expect(serverContent).toContain('createMiddleware');
        expect(serverContent).toContain('req.url?.startsWith(\'/sashi\')');
        expect(serverContent).toContain('server.listen(port');

        // Verify package.json doesn't include Express
        const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
        expect(packageJson.dependencies['express']).toBeUndefined();
        expect(packageJson.dependencies['@sashimo/lib']).toBe('latest');
    });

    test('should setup sashi in existing project correctly', () => {
        // Create a basic project structure
        global.testUtils.createMockPackageJson(testDir, {
            name: 'existing-project',
            version: '1.0.0',
            dependencies: {
                express: '^4.18.0'
            },
            devDependencies: {
                typescript: '^5.0.0'
            }
        });

        process.chdir(testDir);
        const output = execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js setup', { 
            encoding: 'utf-8'
        });

        expect(output).toContain('Framework detected: express');
        expect(output).toContain('TypeScript: Yes');
        expect(output).toContain('✅ Sashi setup completed successfully!');

        // Check files were created
        expect(fs.existsSync(path.join(testDir, 'sashi.config.ts'))).toBe(true);
        expect(fs.existsSync(path.join(testDir, '.env.local'))).toBe(true);

        // Verify configuration content
        const configContent = fs.readFileSync(path.join(testDir, 'sashi.config.ts'), 'utf-8');
        expect(configContent).toContain('openAIKey');
        expect(configContent).toContain('debug');
    });
});