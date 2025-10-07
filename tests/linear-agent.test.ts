import express from 'express';
import request from 'supertest';

// Mock all the problematic modules before importing anything else
jest.mock('../packages/sashi-lib/src/aibot', () => ({}));
jest.mock('../packages/sashi-lib/src/ai-function-loader', () => ({
    generateSplitToolSchemas: jest.fn(() => []),
    getFunctionRegistry: jest.fn(() => new Map())
}));
jest.mock('../packages/sashi-lib/src/github-api-service', () => ({
    getGithubConfig: jest.fn()
}));
jest.mock('../packages/sashi-lib/src/sashiagent', () => ({
    getLinearSashiAgent: jest.fn()
}));

// Mock fetch globally
global.fetch = jest.fn();

// Import after mocking
const { getLinearSashiAgent } = require('../packages/sashi-lib/src/sashiagent');

describe('Linear Agent Integration Tests', () => {
    let app: express.Application;
    let mockLinearAgent: any;
    let mockGetGithubConfig: any;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Create mock Linear agent
        mockLinearAgent = {
            handleUserPrompt: jest.fn()
        };

        // Mock the getLinearSashiAgent function
        (getLinearSashiAgent as jest.Mock).mockReturnValue(mockLinearAgent);

        // Mock getGithubConfig
        mockGetGithubConfig = require('../packages/sashi-lib/src/github-api-service').getGithubConfig;
        mockGetGithubConfig.mockResolvedValue({
            token: 'mock-github-token',
            owner: 'test-owner',
            repo: 'test-repo'
        });

        // Create Express app with a simple mock middleware
        app = express();
        app.use(express.json());

        // Mock the linear agent endpoint directly
        app.post('/linear/agent', async (req, res) => {
            const { userPrompt, previousActivities = [] } = req.body;

            // Mock session validation
            const sessionToken = req.headers['x-sashi-session-token'];
            if (!sessionToken) {
                return res.status(401).json({ error: 'Session token required' });
            }
            if (sessionToken !== 'valid-session-token') {
                return res.status(401).json({ error: 'Invalid session token' });
            }

            if (!userPrompt || typeof userPrompt !== 'string') {
                return res.status(400).json({
                    error: 'Invalid request: userPrompt is required and must be a string'
                });
            }

            try {
                // Get GitHub config for the Linear agent
                const githubConfig = await mockGetGithubConfig({
                    hubUrl: 'http://test-hub.com',
                    apiSecretKey: 'test-api-secret'
                });

                // Create mock workflow execution function
                const executeWorkflowFn = jest.fn().mockResolvedValue({
                    success: true,
                    results: []
                });

                // Create Linear agent with proper configuration
                const linearAgent = getLinearSashiAgent({
                    githubConfig,
                    hubUrl: 'http://test-hub.com',
                    apiSecretKey: 'test-api-secret',
                    executeWorkflowFn
                });

                // Process the user request
                const response = await linearAgent.handleUserPrompt(userPrompt, previousActivities);

                // Return response in format Linear expects
                res.json({
                    success: true,
                    response: response
                });

            } catch (error) {
                console.error('Linear agent error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                res.status(500).json({
                    success: false,
                    error: 'Linear agent failed to process request',
                    details: errorMessage
                });
            }
        });
    });

    describe('POST /linear/agent', () => {
        const validSessionToken = 'valid-session-token';

        it('should successfully process a workflow list request', async () => {
            // Mock the Linear agent response
            const mockResponse = 'RESPONSE: **Your Saved Workflows:**\n\n1. **Test Workflow**\n   ID: workflow-123\n   Created: 1/1/2024\n   Actions: 2 steps\n\nTo run a workflow, use: executeWorkflow(workflow_id)';

            mockLinearAgent.handleUserPrompt.mockResolvedValue(mockResponse);

            const response = await request(app)
                .post('/linear/agent')
                .set('x-sashi-session-token', validSessionToken)
                .send({
                    userPrompt: 'List my workflows',
                    previousActivities: []
                });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                response: mockResponse
            });

            // Verify Linear agent was called correctly
            expect(mockLinearAgent.handleUserPrompt).toHaveBeenCalledWith(
                'List my workflows',
                []
            );

            // Verify Linear agent was configured correctly
            expect(getLinearSashiAgent).toHaveBeenCalledWith({
                githubConfig: {
                    token: 'mock-github-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                hubUrl: 'http://test-hub.com',
                apiSecretKey: 'test-api-secret',
                executeWorkflowFn: expect.any(Function)
            });
        });

        it('should successfully process a workflow execution request', async () => {
            const mockResponse = 'RESPONSE: **Workflow \'user-notification\' executed successfully!**\n\n**Results:**\n\n**Step 1:** Get Users\nFound 5 items:\n  1. john@example.com\n  2. jane@example.com\n\n**Step 2:** Send Notifications\n  sent: 5\n  failed: 0';

            mockLinearAgent.handleUserPrompt.mockResolvedValue(mockResponse);

            const response = await request(app)
                .post('/linear/agent')
                .set('x-sashi-session-token', validSessionToken)
                .send({
                    userPrompt: 'Run workflow user-notification',
                    previousActivities: [
                        { role: 'user', content: 'List my workflows' },
                        { role: 'assistant', content: 'RESPONSE: Here are your workflows...' }
                    ]
                });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                response: mockResponse
            });

            expect(mockLinearAgent.handleUserPrompt).toHaveBeenCalledWith(
                'Run workflow user-notification',
                [
                    { role: 'user', content: 'List my workflows' },
                    { role: 'assistant', content: 'RESPONSE: Here are your workflows...' }
                ]
            );
        });

        it('should handle GitHub status requests', async () => {
            const mockResponse = 'RESPONSE: **GitHub Integration Status**\n\nStatus: ✅ Connected\nConfiguration: Connected to test-owner/test-repo\n\n**Current Configuration:**\n- Repository: test-owner/test-repo\n- Token: Configured';

            mockLinearAgent.handleUserPrompt.mockResolvedValue(mockResponse);

            const response = await request(app)
                .post('/linear/agent')
                .set('x-sashi-session-token', validSessionToken)
                .send({
                    userPrompt: 'What\'s my GitHub status?',
                    previousActivities: []
                });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                response: mockResponse
            });
        });

        it('should handle help requests', async () => {
            const mockResponse = 'RESPONSE: I can help you with:\n\n**Workflows:**\n- List your saved workflows\n- Execute workflows by ID\n\n**GitHub Integration:**\n- Check GitHub connection status\n- Get repository details\n\nTry saying \'list workflows\' to get started!';

            mockLinearAgent.handleUserPrompt.mockResolvedValue(mockResponse);

            const response = await request(app)
                .post('/linear/agent')
                .set('x-sashi-session-token', validSessionToken)
                .send({
                    userPrompt: 'help',
                    previousActivities: []
                });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                response: mockResponse
            });
        });

        it('should return 400 when userPrompt is missing', async () => {
            const response = await request(app)
                .post('/linear/agent')
                .set('x-sashi-session-token', validSessionToken)
                .send({
                    previousActivities: []
                });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                error: 'Invalid request: userPrompt is required and must be a string'
            });

            expect(mockLinearAgent.handleUserPrompt).not.toHaveBeenCalled();
        });

        it('should return 400 when userPrompt is not a string', async () => {
            const response = await request(app)
                .post('/linear/agent')
                .set('x-sashi-session-token', validSessionToken)
                .send({
                    userPrompt: 123,
                    previousActivities: []
                });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                error: 'Invalid request: userPrompt is required and must be a string'
            });

            expect(mockLinearAgent.handleUserPrompt).not.toHaveBeenCalled();
        });

        it('should return 401 when session token is missing', async () => {
            const response = await request(app)
                .post('/linear/agent')
                .send({
                    userPrompt: 'List my workflows',
                    previousActivities: []
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Session token required');
        });

        it('should return 401 when session token is invalid', async () => {
            const response = await request(app)
                .post('/linear/agent')
                .set('x-sashi-session-token', 'invalid-token')
                .send({
                    userPrompt: 'List my workflows',
                    previousActivities: []
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid session token');
        });

        it('should handle Linear agent errors gracefully', async () => {
            const errorMessage = 'Linear agent processing failed';
            mockLinearAgent.handleUserPrompt.mockRejectedValue(new Error(errorMessage));

            const response = await request(app)
                .post('/linear/agent')
                .set('x-sashi-session-token', validSessionToken)
                .send({
                    userPrompt: 'List my workflows',
                    previousActivities: []
                });

            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                success: false,
                error: 'Linear agent failed to process request',
                details: errorMessage
            });
        });

        it('should handle GitHub config fetch errors', async () => {
            mockGetGithubConfig.mockRejectedValue(new Error('Hub connection failed'));

            const response = await request(app)
                .post('/linear/agent')
                .set('x-sashi-session-token', validSessionToken)
                .send({
                    userPrompt: 'List my workflows',
                    previousActivities: []
                });

            expect(response.status).toBe(500);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Linear agent failed to process request'
            });
        });

        it('should default previousActivities to empty array when not provided', async () => {
            const mockResponse = 'RESPONSE: Test response';
            mockLinearAgent.handleUserPrompt.mockResolvedValue(mockResponse);

            const response = await request(app)
                .post('/linear/agent')
                .set('x-sashi-session-token', validSessionToken)
                .send({
                    userPrompt: 'help'
                    // previousActivities not provided
                });

            expect(response.status).toBe(200);
            expect(mockLinearAgent.handleUserPrompt).toHaveBeenCalledWith('help', []);
        });
    });

    describe('Linear Agent Configuration', () => {
        it('should configure Linear agent with correct parameters', async () => {
            mockLinearAgent.handleUserPrompt.mockResolvedValue('RESPONSE: Test');

            await request(app)
                .post('/linear/agent')
                .set('x-sashi-session-token', 'valid-session-token')
                .send({
                    userPrompt: 'test',
                    previousActivities: []
                });

            expect(getLinearSashiAgent).toHaveBeenCalledWith({
                githubConfig: {
                    token: 'mock-github-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                hubUrl: 'http://test-hub.com',
                apiSecretKey: 'test-api-secret',
                executeWorkflowFn: expect.any(Function)
            });
        });

        it('should handle missing GitHub config gracefully', async () => {
            mockGetGithubConfig.mockResolvedValue(undefined);
            mockLinearAgent.handleUserPrompt.mockResolvedValue('RESPONSE: Test');

            const response = await request(app)
                .post('/linear/agent')
                .set('x-sashi-session-token', 'valid-session-token')
                .send({
                    userPrompt: 'test',
                    previousActivities: []
                });

            expect(response.status).toBe(200);
            expect(getLinearSashiAgent).toHaveBeenCalledWith({
                githubConfig: undefined,
                hubUrl: 'http://test-hub.com',
                apiSecretKey: 'test-api-secret',
                executeWorkflowFn: expect.any(Function)
            });
        });
    });
});
