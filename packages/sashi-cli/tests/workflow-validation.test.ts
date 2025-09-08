import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import fetch from 'node-fetch';

describe('Workflow Execution Validation', () => {
    let testDir: string;
    let origCwd: string;
    let serverProcess: any;
    let projectDir: string;

    beforeAll(async () => {
        testDir = global.testUtils.createTempDir();
        origCwd = process.cwd();
        
        // Create Express project
        const projectName = 'workflow-test-server';
        
        process.chdir(testDir);
        execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName} --framework express`);

        projectDir = path.join(testDir, projectName);
        
        // Install dependencies
        execSync('npm install', { cwd: projectDir });

        // Add test API keys
        const envPath = path.join(projectDir, '.env.local');
        fs.writeFileSync(envPath, `OPENAI_API_KEY=sk-test-dummy-key\nHUB_API_SECRET_KEY=test-secret\n`);

        // Start server
        serverProcess = spawn('npm', ['run', 'dev'], { 
            cwd: projectDir,
            stdio: ['ignore', 'pipe', 'pipe'] 
        });

        let serverOutput = '';
        serverProcess.stdout.on('data', (data: Buffer) => {
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
                    setTimeout(resolve, 2000);
                }
            }, 500);
        });
    }, 60000);

    afterAll(() => {
        process.chdir(origCwd);
        global.testUtils.cleanupTempDir(testDir);
        if (serverProcess) {
            serverProcess.kill();
        }
    });

    describe('Workflow Execution Tests', () => {
        test('should accept valid single-action workflow', async () => {
            const workflowPayload = {
                workflow: {
                    type: 'workflow',
                    actions: [{
                        id: 'test-single-action',
                        description: 'Single test action',
                        tool: 'test-tool',
                        parameters: { message: 'single action test' }
                    }]
                },
                debug: true
            };

            const response = await fetch('http://localhost:3000/sashi/workflow/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sashi-session-token': 'test-session'
                },
                body: JSON.stringify(workflowPayload)
            });

            expect(response.status).toBe(200);
            
            const result = await response.json();
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('results');
            expect(result).toHaveProperty('errors');
            expect(Array.isArray(result.results)).toBe(true);
            expect(Array.isArray(result.errors)).toBe(true);
        });

        test('should accept valid multi-action workflow', async () => {
            const workflowPayload = {
                workflow: {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'step-1',
                            description: 'First action',
                            tool: 'tool-1',
                            parameters: { input: 'first' }
                        },
                        {
                            id: 'step-2', 
                            description: 'Second action',
                            tool: 'tool-2',
                            parameters: { input: 'second' }
                        },
                        {
                            id: 'step-3',
                            description: 'Third action',
                            tool: 'tool-3',
                            parameters: { input: 'third' }
                        }
                    ]
                },
                debug: true
            };

            const response = await fetch('http://localhost:3000/sashi/workflow/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sashi-session-token': 'test-session'
                },
                body: JSON.stringify(workflowPayload)
            });

            expect(response.status).toBe(200);
            
            const result = await response.json();
            expect(result.success).toBeDefined();
            expect(result.errors.length).toBe(3); // All actions should fail due to missing tools
            expect(result.errors[0].actionId).toBe('step-1');
            expect(result.errors[1].actionId).toBe('step-2');
            expect(result.errors[2].actionId).toBe('step-3');
        });

        test('should reject workflow with missing type', async () => {
            const invalidPayload = {
                workflow: {
                    actions: [{
                        id: 'test',
                        description: 'Test',
                        tool: 'tool',
                        parameters: {}
                    }]
                }
            };

            const response = await fetch('http://localhost:3000/sashi/workflow/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sashi-session-token': 'test-session'
                },
                body: JSON.stringify(invalidPayload)
            });

            expect(response.status).toBe(200);
            const result = await response.json();
            expect(result).toHaveProperty('error');
        });

        test('should reject workflow with missing actions', async () => {
            const invalidPayload = {
                workflow: {
                    type: 'workflow'
                }
            };

            const response = await fetch('http://localhost:3000/sashi/workflow/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', 
                    'x-sashi-session-token': 'test-session'
                },
                body: JSON.stringify(invalidPayload)
            });

            expect(response.status).toBe(200);
            const result = await response.json();
            expect(result).toHaveProperty('error');
        });

        test('should handle workflow with complex parameters', async () => {
            const complexWorkflow = {
                workflow: {
                    type: 'workflow',
                    actions: [{
                        id: 'complex-action',
                        description: 'Action with complex parameters',
                        tool: 'complex-tool',
                        parameters: {
                            stringParam: 'test string',
                            numberParam: 42,
                            boolParam: true,
                            arrayParam: [1, 2, 3],
                            objectParam: {
                                nested: 'value',
                                count: 10
                            }
                        }
                    }]
                },
                debug: true
            };

            const response = await fetch('http://localhost:3000/sashi/workflow/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sashi-session-token': 'test-session'
                },
                body: JSON.stringify(complexWorkflow)
            });

            expect(response.status).toBe(200);
            const result = await response.json();
            expect(result).toHaveProperty('success');
        });

        test('should require session token', async () => {
            const workflowPayload = {
                workflow: {
                    type: 'workflow',
                    actions: [{
                        id: 'auth-test',
                        description: 'Test auth',
                        tool: 'test-tool',
                        parameters: {}
                    }]
                }
            };

            const response = await fetch('http://localhost:3000/sashi/workflow/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                    // No session token
                },
                body: JSON.stringify(workflowPayload)
            });

            expect([401, 403, 500]).toContain(response.status); // Should reject without auth
        });
    });
});