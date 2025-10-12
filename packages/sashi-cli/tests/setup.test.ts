import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('sashi setup command', () => {
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

    test('should detect Express framework', () => {
        global.testUtils.createMockPackageJson(testDir, {
            dependencies: {
                express: '^4.18.0'
            }
        });

        process.chdir(testDir);
        const output = execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js setup', { 
            encoding: 'utf-8'
        });

        expect(output).toContain('Framework detected: express');
        expect(fs.existsSync(path.join(testDir, 'sashi.config.js'))).toBe(true);
        expect(fs.existsSync(path.join(testDir, '.env.local'))).toBe(true);
    });

    test('should detect Node.js as default framework', () => {
        global.testUtils.createMockPackageJson(testDir);

        process.chdir(testDir);
        const output = execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js setup', { 
            encoding: 'utf-8'
        });

        expect(output).toContain('Framework detected: nodejs');
        expect(fs.existsSync(path.join(testDir, 'sashi.config.js'))).toBe(true);
        expect(fs.existsSync(path.join(testDir, '.env.local'))).toBe(true);
    });

    test('should detect TypeScript correctly', () => {
        global.testUtils.createMockPackageJson(testDir, {
            devDependencies: {
                typescript: '^5.0.0'
            }
        });

        process.chdir(testDir);
        const output = execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js setup', { 
            encoding: 'utf-8'
        });

        expect(output).toContain('TypeScript: Yes');
        expect(fs.existsSync(path.join(testDir, 'sashi.config.ts'))).toBe(true);
    });

    test('should create correct configuration files', () => {
        global.testUtils.createMockPackageJson(testDir);

        process.chdir(testDir);
        execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js setup');

        const configContent = fs.readFileSync(path.join(testDir, 'sashi.config.js'), 'utf-8');
        expect(configContent).toContain('openAIKey');
        expect(configContent).toContain('apiSecretKey');
        expect(configContent).toContain('debug');

        const envContent = fs.readFileSync(path.join(testDir, '.env.local'), 'utf-8');
        expect(envContent).toContain('OPENAI_API_KEY');
    });

    test('should accept API key option', () => {
        global.testUtils.createMockPackageJson(testDir);

        process.chdir(testDir);
        execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js setup --api-key test-key');

        const envContent = fs.readFileSync(path.join(testDir, '.env.local'), 'utf-8');
        expect(envContent).toContain('OPENAI_API_KEY=test-key');
    });

    test('should fail when no package.json exists', () => {
        expect(() => {
            process.chdir(testDir);
            execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js setup', { 
                encoding: 'utf-8'
            });
        }).toThrow();
    });
});