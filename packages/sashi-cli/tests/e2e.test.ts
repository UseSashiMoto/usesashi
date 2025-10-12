import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import fetch from 'node-fetch';

describe('End-to-End Sashi CLI Tests', () => {
    let testDir: string;
    let origCwd: string;
    let serverProcess: any;

    beforeAll(() => {
        testDir = global.testUtils.createTempDir();
        origCwd = process.cwd();
    });

    afterAll(() => {
        process.chdir(origCwd);
        global.testUtils.cleanupTempDir(testDir);
        if (serverProcess) {
            serverProcess.kill();
        }
    });

    describe('Express Server E2E Test', () => {
        let projectDir: string;

        beforeAll(async () => {
            const projectName = 'e2e-express-test';
            
            process.chdir(testDir);
            execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName} --framework express`);

            projectDir = path.join(testDir, projectName);
            expect(fs.existsSync(projectDir)).toBe(true);

            // Install dependencies
            execSync('npm install', { cwd: projectDir });

            // Add test API keys
            const envPath = path.join(projectDir, '.env.local');
            fs.writeFileSync(envPath, `# Test Configuration
OPENAI_API_KEY=sk-test-dummy-key-for-e2e-testing
HUB_API_SECRET_KEY=test-secret-key

# Add other environment variables as needed
`);
        }, 60000); // 60 second timeout for npm install

        test('should start server successfully', async () => {
            // Start server in background
            serverProcess = spawn('npm', ['run', 'dev'], { 
                cwd: projectDir,
                stdio: ['ignore', 'pipe', 'pipe'] 
            });

            let serverOutput = '';
            serverProcess.stdout.on('data', (data: Buffer) => {
                serverOutput += data.toString();
            });

            serverProcess.stderr.on('data', (data: Buffer) => {
                serverOutput += data.toString();
            });

            // Wait for server to start
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Server failed to start. Output: ${serverOutput}`));
                }, 30000);

                const checkServer = setInterval(async () => {
                    if (serverOutput.includes('Server running at')) {
                        clearInterval(checkServer);
                        clearTimeout(timeout);
                        // Wait a bit more for full initialization
                        setTimeout(resolve, 2000);
                    }
                }, 500);
            });

            expect(serverOutput).toContain('Server running at');
        }, 35000);

        test('should serve admin panel', async () => {
            const response = await fetch('http://localhost:3000/sashi/bot');
            expect(response.status).toBe(200);
            
            const html = await response.text();
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('Sashi App');
            expect(html).toContain('__INITIAL_STATE__');
        });

        test('should handle API ping endpoint', async () => {
            const response = await fetch('http://localhost:3000/sashi/ping');
            expect(response.status).toBe(200);
        });

        test('should handle workflow execution', async () => {
            const workflowPayload = {
                workflow: {
                    type: 'workflow',
                    actions: [{
                        id: 'test-action',
                        description: 'Test action for E2E',
                        tool: 'test-function',
                        parameters: { message: 'E2E test' }
                    }]
                },
                debug: true
            };

            const response = await fetch('http://localhost:3000/sashi/workflow/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sashi-session-token': 'test-session-token'
                },
                body: JSON.stringify(workflowPayload)
            });

            expect(response.status).toBe(200);
            
            const result = await response.json();
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('results');
            expect(result).toHaveProperty('errors');
        });

        test('should handle chat endpoint', async () => {
            const chatPayload = {
                type: '/chat/message',
                inquiry: 'Hello, this is an E2E test',
                previous: []
            };

            const response = await fetch('http://localhost:3000/sashi/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sashi-session-token': 'test-session-token'
                },
                body: JSON.stringify(chatPayload)
            });

            // The request should reach the endpoint even if it fails due to dummy API key
            expect([200, 400, 401, 500]).toContain(response.status);
        });

        afterAll(() => {
            if (serverProcess) {
                serverProcess.kill();
                serverProcess = null;
            }
        });
    });

    describe('Node.js Server E2E Test', () => {
        test('should create working Node.js project', () => {
            const projectName = 'e2e-nodejs-test';
            
            process.chdir(testDir);
            execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName} --framework nodejs`);

            const projectDir = path.join(testDir, projectName);
            expect(fs.existsSync(projectDir)).toBe(true);

            // Verify project structure
            expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
            expect(fs.existsSync(path.join(projectDir, 'sashi.config.ts'))).toBe(true);
            expect(fs.existsSync(path.join(projectDir, '.env.local'))).toBe(true);
            expect(fs.existsSync(path.join(projectDir, 'src/index.ts'))).toBe(true);
            expect(fs.existsSync(path.join(projectDir, 'tsconfig.json'))).toBe(true);

            // Install dependencies
            execSync('npm install', { cwd: projectDir });

            // Verify TypeScript compilation
            execSync('npx tsc --noEmit', { cwd: projectDir });

            // Verify server file contains correct Node.js setup
            const serverContent = fs.readFileSync(path.join(projectDir, 'src/index.ts'), 'utf-8');
            expect(serverContent).toContain('import http from \'http\'');
            expect(serverContent).toContain('createMiddleware');
            expect(serverContent).toContain('/sashi');
        }, 60000);
    });
});