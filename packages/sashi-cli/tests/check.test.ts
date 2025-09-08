import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('sashi check command', () => {
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

    test('should report missing package.json', () => {
        process.chdir(testDir);
        const output = execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js check', { 
            encoding: 'utf-8'
        });

        expect(output).toContain('No package.json found');
    });

    test('should check for Sashi lib package', () => {
        global.testUtils.createMockPackageJson(testDir, {
            dependencies: {
                '@sashimo/lib': '^1.0.0'
            }
        });

        process.chdir(testDir);
        const output = execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js check', { 
            encoding: 'utf-8'
        });

        expect(output).toContain('@sashimo/lib: ✅ Installed');
        expect(output).toContain('@sashimo/ui: ⚠️  Not found');
    });

    test('should check for config files', () => {
        global.testUtils.createMockPackageJson(testDir);
        fs.writeFileSync(path.join(testDir, 'sashi.config.js'), 'module.exports = {};');

        process.chdir(testDir);
        const output = execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js check', { 
            encoding: 'utf-8'
        });

        expect(output).toContain('Config file: ✅ Found');
    });

    test('should check for environment files', () => {
        global.testUtils.createMockPackageJson(testDir);
        fs.writeFileSync(path.join(testDir, '.env.local'), 'OPENAI_API_KEY=test');

        process.chdir(testDir);
        const output = execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js check', { 
            encoding: 'utf-8'
        });

        expect(output).toContain('Environment file: ✅ Found');
    });

    test('should provide recommendations when Sashi lib is missing', () => {
        global.testUtils.createMockPackageJson(testDir);

        process.chdir(testDir);
        const output = execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js check', { 
            encoding: 'utf-8'
        });

        expect(output).toContain('🔧 Recommendations:');
        expect(output).toContain('Run "sashi setup"');
    });

    test('should check TypeScript config files', () => {
        global.testUtils.createMockPackageJson(testDir);
        fs.writeFileSync(path.join(testDir, 'sashi.config.ts'), 'export default {};');

        process.chdir(testDir);
        const output = execSync('node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js check', { 
            encoding: 'utf-8'
        });

        expect(output).toContain('Config file: ✅ Found');
    });
});