import express from 'express';
import request from 'supertest';
import { createMiddleware } from '../packages/sashi-lib/src/middleware';

// Mock fetch for hub communication
global.fetch = jest.fn();

// Mock the external dependencies
jest.mock('@sashimo/lib', () => ({
    createMiddleware: jest.requireActual('../packages/sashi-lib/src/middleware').createMiddleware,
}));

describe('Middleware Conditional Subscription Limits', () => {
    let app: express.Express;
    let mockFetch: jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch = fetch as jest.MockedFunction<typeof fetch>;

        app = express();
        app.use(express.json());
    });

    describe('Workflow Endpoints with Hub URL configured', () => {
        beforeEach(() => {
            // Configure middleware with hub URL (should enforce subscription limits)
            const middleware = createMiddleware({
                openAIKey: 'test-openai-key',
                hubUrl: 'https://hub.usesashi.com',
                apiSecretKey: 'test-secret-key',
                getSession: async () => 'test-session',
            });

            app.use('/sashi', middleware);
        });

        describe('POST /workflows - with hub configured', () => {
            it('should forward to hub and enforce subscription limits', async () => {
                const mockWorkflow = {
                    id: 'workflow-1',
                    name: 'Test Workflow',
                    actions: [],
                };

                // Mock successful hub response
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    status: 201,
                    json: async () => mockWorkflow,
                } as Response);

                const response = await request(app)
                    .post('/sashi/workflows')
                    .set('x-sashi-session-token', 'test-session')
                    .send(mockWorkflow);

                expect(response.status).toBe(201);
                expect(mockFetch).toHaveBeenCalledWith(
                    'https://hub.usesashi.com/workflows',
                    expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            'Content-Type': 'application/json',
                            'x-api-token': 'test-secret-key',
                            'x-sashi-session-token': 'test-session',
                        }),
                        body: JSON.stringify(mockWorkflow),
                    })
                );
            });

            it('should handle workflow limit reached from hub', async () => {
                const mockWorkflow = {
                    id: 'workflow-1',
                    name: 'Test Workflow',
                    actions: [],
                };

                // Mock hub returning workflow limit error
                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 403,
                    json: async () => ({
                        error: 'WORKFLOW_LIMIT_REACHED',
                        message: 'Free plan allows up to 3 saved workflows. Upgrade to pro for unlimited workflows.',
                        limit: 3,
                        current: 3,
                        requiresUpgrade: true,
                    }),
                } as Response);

                const response = await request(app)
                    .post('/sashi/workflows')
                    .set('x-sashi-session-token', 'test-session')
                    .send(mockWorkflow);

                expect(response.status).toBe(403);
                expect(response.body).toEqual({
                    error: 'WORKFLOW_LIMIT_REACHED',
                    message: 'Free plan allows up to 3 saved workflows. Upgrade to pro for unlimited workflows.',
                    limit: 3,
                    current: 3,
                    requiresUpgrade: true,
                });
            });

            it('should handle hub connection errors gracefully', async () => {
                const mockWorkflow = {
                    id: 'workflow-1',
                    name: 'Test Workflow',
                    actions: [],
                };

                // Mock fetch failure (network error)
                mockFetch.mockRejectedValueOnce(new Error('Network error'));

                const response = await request(app)
                    .post('/sashi/workflows')
                    .set('x-sashi-session-token', 'test-session')
                    .send(mockWorkflow);

                expect(response.status).toBe(500);
                expect(response.body).toEqual({
                    error: 'Hub connection failed',
                    details: 'Unable to connect to hub server. Please check your network connection.',
                    code: 'HUB_CONNECTION_ERROR',
                    hubUrl: 'https://hub.usesashi.com',
                });
            });
        });

        describe('POST /workflow/execute - with hub configured', () => {
            it('should check execution limits before executing workflow', async () => {
                const mockWorkflow = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'action-1',
                            tool: 'test-tool',
                            parameters: {},
                        },
                    ],
                };

                // Mock execution limit check - success
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({ allowed: true }),
                } as Response);

                const response = await request(app)
                    .post('/sashi/workflow/execute')
                    .set('x-sashi-session-token', 'test-session')
                    .send({ workflow: mockWorkflow });

                // Should call execution limit check first
                expect(mockFetch).toHaveBeenCalledWith(
                    'https://hub.usesashi.com/check-execution-limit',
                    expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            'Content-Type': 'application/json',
                            'x-api-token': 'test-secret-key',
                            'x-sashi-session-token': 'test-session',
                        }),
                    })
                );
            });

            it('should block execution when monthly limit reached', async () => {
                const mockWorkflow = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'action-1',
                            tool: 'test-tool',
                            parameters: {},
                        },
                    ],
                };

                // Mock execution limit check - limit reached
                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 403,
                    json: async () => ({
                        error: 'EXECUTION_LIMIT_REACHED',
                        message: 'Free plan allows up to 10 executions per month. Upgrade to pro for unlimited executions.',
                        limit: 10,
                        current: 10,
                        requiresUpgrade: true,
                    }),
                } as Response);

                const response = await request(app)
                    .post('/sashi/workflow/execute')
                    .set('x-sashi-session-token', 'test-session')
                    .send({ workflow: mockWorkflow });

                expect(response.status).toBe(403);
                expect(response.body).toEqual({
                    error: 'EXECUTION_LIMIT_REACHED',
                    message: 'Free plan allows up to 10 executions per month. Upgrade to pro for unlimited executions.',
                    limit: 10,
                    current: 10,
                    requiresUpgrade: true,
                });
            });

            it('should continue execution if limit check fails for technical reasons', async () => {
                const mockWorkflow = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'action-1',
                            tool: 'test-tool',
                            parameters: {},
                        },
                    ],
                };

                // Mock execution limit check - network error (should not block execution)
                mockFetch.mockRejectedValueOnce(new Error('Hub connection timeout'));

                const response = await request(app)
                    .post('/sashi/workflow/execute')
                    .set('x-sashi-session-token', 'test-session')
                    .send({ workflow: mockWorkflow });

                // Should continue with workflow execution despite limit check failure
                // The exact status depends on your workflow execution implementation
                // but it should NOT be 403 (limit reached)
                expect(response.status).not.toBe(403);
            });
        });

        describe('GitHub Integration Endpoints - with hub configured', () => {
            it('should forward GitHub config requests to hub', async () => {
                // Mock successful hub response for GitHub config
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        owner: 'test-owner',
                        repo: 'test-repo',
                        defaultBranch: 'main',
                    }),
                } as Response);

                const response = await request(app)
                    .get('/sashi/github/config')
                    .set('x-sashi-session-token', 'test-session');

                expect(response.status).toBe(200);
                expect(mockFetch).toHaveBeenCalledWith(
                    'https://hub.usesashi.com/github/config',
                    expect.objectContaining({
                        method: 'GET',
                        headers: expect.objectContaining({
                            'Content-Type': 'application/json',
                            'x-api-token': 'test-secret-key',
                            'x-sashi-session-token': 'test-session',
                        }),
                    })
                );
            });

            it('should handle GitHub Pro requirement from hub', async () => {
                // Mock hub returning GitHub Pro requirement error
                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 403,
                    json: async () => ({
                        error: 'GITHUB_INTEGRATION_REQUIRES_PRO',
                        message: 'GitHub integration is only available for Pro users. Upgrade to pro to connect your repositories.',
                        requiresUpgrade: true,
                    }),
                } as Response);

                const response = await request(app)
                    .get('/sashi/github/config')
                    .set('x-sashi-session-token', 'test-session');

                expect(response.status).toBe(403);
                expect(response.body).toEqual({
                    error: 'GITHUB_INTEGRATION_REQUIRES_PRO',
                    message: 'GitHub integration is only available for Pro users. Upgrade to pro to connect your repositories.',
                    requiresUpgrade: true,
                });
            });
        });
    });

    describe('Workflow Endpoints WITHOUT hub URL configured (self-hosted)', () => {
        beforeEach(() => {
            // Configure middleware WITHOUT hub URL (should NOT enforce subscription limits)
            const middleware = createMiddleware({
                openAIKey: 'test-openai-key',
                // No hubUrl provided - self-hosted scenario
                getSession: async () => 'test-session',
            });

            app.use('/sashi', middleware);
        });

        describe('POST /workflows - without hub configured', () => {
            it('should return error for workflow saving without hub', async () => {
                const mockWorkflow = {
                    id: 'workflow-1',
                    name: 'Test Workflow',
                    actions: [],
                };

                const response = await request(app)
                    .post('/sashi/workflows')
                    .set('x-sashi-session-token', 'test-session')
                    .send(mockWorkflow);

                expect(response.status).toBe(500);
                expect(response.body).toEqual({
                    error: 'Hub not configured',
                    message: 'Workflow saving requires hub configuration or local implementation',
                    code: 'NO_HUB_CONFIG',
                });

                // Should not make any fetch calls
                expect(mockFetch).not.toHaveBeenCalled();
            });
        });

        describe('POST /workflow/execute - without hub configured', () => {
            it('should execute workflows without subscription checks', async () => {
                const mockWorkflow = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'action-1',
                            tool: 'test-tool',
                            parameters: {},
                        },
                    ],
                };

                const response = await request(app)
                    .post('/sashi/workflow/execute')
                    .set('x-sashi-session-token', 'test-session')
                    .send({ workflow: mockWorkflow });

                // Should not check execution limits when no hub is configured
                expect(mockFetch).not.toHaveBeenCalledWith(
                    expect.stringContaining('/check-execution-limit'),
                    expect.any(Object)
                );

                // The exact response depends on your workflow execution implementation
                // but it should proceed without subscription checks
            });
        });

        describe('GitHub Integration Endpoints - without hub configured', () => {
            it('should return error for GitHub config without hub', async () => {
                const response = await request(app)
                    .get('/sashi/github/config')
                    .set('x-sashi-session-token', 'test-session');

                expect(response.status).toBe(500);
                expect(response.body).toEqual({
                    error: 'Hub not configured',
                    message: 'GitHub configuration requires hub setup',
                    code: 'NO_HUB_CONFIG',
                });

                expect(mockFetch).not.toHaveBeenCalled();
            });
        });
    });

    describe('Error Scenarios', () => {
        beforeEach(() => {
            const middleware = createMiddleware({
                openAIKey: 'test-openai-key',
                hubUrl: 'https://hub.usesashi.com',
                apiSecretKey: 'test-secret-key',
                getSession: async () => 'test-session',
            });

            app.use('/sashi', middleware);
        });

        it('should handle missing API secret key', async () => {
            // Create middleware without API secret key
            const middlewareNoSecret = createMiddleware({
                openAIKey: 'test-openai-key',
                hubUrl: 'https://hub.usesashi.com',
                // No apiSecretKey provided
                getSession: async () => 'test-session',
            });

            const appNoSecret = express();
            appNoSecret.use(express.json());
            appNoSecret.use('/sashi', middlewareNoSecret);

            const response = await request(appNoSecret)
                .post('/sashi/workflows')
                .set('x-sashi-session-token', 'test-session')
                .send({ id: 'test' });

            expect(response.status).toBe(500);
            expect(response.body.code).toBe('HUB_CONFIG_MISSING');
        });

        it('should handle invalid hub URL', async () => {
            // Mock fetch to simulate invalid URL error
            mockFetch.mockRejectedValueOnce(new Error('Invalid URL'));

            const response = await request(app)
                .post('/sashi/workflows')
                .set('x-sashi-session-token', 'test-session')
                .send({ id: 'test' });

            expect(response.status).toBe(500);
            expect(response.body.code).toBe('HUB_INVALID_URL');
        });

        it('should handle hub timeout errors', async () => {
            // Mock fetch to simulate timeout
            mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

            const response = await request(app)
                .post('/sashi/workflows')
                .set('x-sashi-session-token', 'test-session')
                .send({ id: 'test' });

            expect(response.status).toBe(500);
            expect(response.body.code).toBe('HUB_CONNECTION_ERROR');
        });

        it('should handle authentication errors from hub', async () => {
            // Mock hub returning 401 Unauthorized
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                json: async () => ({ error: 'Invalid API token' }),
            } as Response);

            const response = await request(app)
                .post('/sashi/workflows')
                .set('x-sashi-session-token', 'test-session')
                .send({ id: 'test' });

            expect(response.status).toBe(401);
        });

        it('should handle session retrieval errors', async () => {
            // Create middleware with failing getSession
            const middlewareFailingSession = createMiddleware({
                openAIKey: 'test-openai-key',
                hubUrl: 'https://hub.usesashi.com',
                apiSecretKey: 'test-secret-key',
                getSession: async () => {
                    throw new Error('Session retrieval failed');
                },
            });

            const appFailingSession = express();
            appFailingSession.use(express.json());
            appFailingSession.use('/sashi', middlewareFailingSession);

            const response = await request(appFailingSession)
                .post('/sashi/workflows')
                .set('x-sashi-session-token', 'test-session')
                .send({ id: 'test' });

            expect(response.status).toBe(401);
            expect(response.body.code).toBe('SESSION_ERROR');
        });
    });

    describe('Hub Connection Check', () => {
        it('should report connected when hub is reachable', async () => {
            const middleware = createMiddleware({
                openAIKey: 'test-openai-key',
                hubUrl: 'https://hub.usesashi.com',
                apiSecretKey: 'test-secret-key',
                getSession: async () => 'test-session',
            });

            app.use('/sashi', middleware);

            // Mock successful ping to hub
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
            } as Response);

            const response = await request(app)
                .get('/sashi/check_hub_connection');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ connected: true });
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.usesashi.com/ping',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'x-api-token': 'test-secret-key',
                    }),
                })
            );
        });

        it('should report disconnected when hub is unreachable', async () => {
            const middleware = createMiddleware({
                openAIKey: 'test-openai-key',
                hubUrl: 'https://hub.usesashi.com',
                apiSecretKey: 'test-secret-key',
                getSession: async () => 'test-session',
            });

            app.use('/sashi', middleware);

            // Mock failed ping to hub
            mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

            const response = await request(app)
                .get('/sashi/check_hub_connection');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ connected: false });
        });
    });
});
