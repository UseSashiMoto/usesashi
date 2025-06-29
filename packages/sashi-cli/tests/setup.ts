// Test setup file
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

// Global test utilities
declare global {
    var testUtils: {
        createTempDir: () => string;
        cleanupTempDir: (dir: string) => void;
        createMockPackageJson: (dir: string, content?: any) => void;
    };
}

global.testUtils = {
    createTempDir: (): string => {
        const tempDir = fs.mkdtempSync(path.join(tmpdir(), 'sashi-cli-test-'));
        return tempDir;
    },

    cleanupTempDir: (dir: string): void => {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    },

    createMockPackageJson: (dir: string, content: any = {}): void => {
        const defaultContent = {
            name: 'test-project',
            version: '1.0.0',
            ...content
        };
        fs.writeFileSync(
            path.join(dir, 'package.json'),
            JSON.stringify(defaultContent, null, 2)
        );
    }
};

// Cleanup after all tests
afterAll(() => {
    // Clean up any remaining temp directories
    const tempDirs = fs.readdirSync(tmpdir()).filter(dir => dir.startsWith('sashi-cli-test-'));
    tempDirs.forEach(dir => {
        const fullPath = path.join(tmpdir(), dir);
        if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        }
    });
}); 