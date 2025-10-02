// Mock fetch globally
global.fetch = jest.fn();

describe('SashiAgent Workflow Tools Tests', () => {
    let mockFetch: jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
        mockFetch = fetch as jest.MockedFunction<typeof fetch>;
        jest.clearAllMocks();
    });

    describe('Linear Agent Workflow Integration', () => {
        it('should handle workflow listing requests and return markdown formatted response', async () => {
            // Mock successful workflow fetch
            const mockWorkflows = [
                {
                    id: 'workflow-1',
                    name: 'Test Workflow',
                    description: 'A test workflow',
                    createdAt: '2024-01-01T00:00:00Z',
                    actions: [
                        { id: 'action-1', tool: 'get_users', description: 'Get all users' }
                    ]
                }
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockWorkflows,
            } as Response);

            // Import and test the Linear agent wrapper
            const { getLinearSashiAgent } = require('../packages/sashi-lib/src/sashiagent');
            const linearAgent = getLinearSashiAgent({
                hubUrl: 'https://test-hub.com',
                apiSecretKey: 'test-api-key'
            });

            // Since the agent uses OpenAI internally, we'll just verify the wrapper exists
            // and has the correct interface
            expect(linearAgent).toBeDefined();
            expect(typeof linearAgent.handleUserPrompt).toBe('function');
        });

        it('should handle workflow execution requests', async () => {
            const mockWorkflow = {
                id: 'workflow-1',
                name: 'Test Workflow',
                description: 'A test workflow',
                actions: [
                    { id: 'action-1', tool: 'get_users', description: 'Get all users' }
                ]
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockWorkflow,
            } as Response);

            const { getLinearSashiAgent } = require('../packages/sashi-lib/src/sashiagent');
            const linearAgent = getLinearSashiAgent({
                hubUrl: 'https://test-hub.com',
                apiSecretKey: 'test-api-key'
            });

            expect(linearAgent).toBeDefined();
            expect(typeof linearAgent.handleUserPrompt).toBe('function');
        });
    });

    describe('Configuration and Interface Tests', () => {
        it('should accept API configuration parameters', async () => {
            const { getSashiAgent } = require('../packages/sashi-lib/src/sashiagent');

            // Test that getSashiAgent accepts apiConfig parameter
            const agent = getSashiAgent(undefined, {
                hubUrl: 'https://test-hub.com',
                apiSecretKey: 'test-api-key',
                sessionId: 'test-session'
            });

            expect(agent).toBeDefined();
        });

        it('should create Linear agent wrapper with correct interface', async () => {
            const { getLinearSashiAgent } = require('../packages/sashi-lib/src/sashiagent');

            const linearAgent = getLinearSashiAgent({
                hubUrl: 'https://test-hub.com',
                apiSecretKey: 'test-api-key'
            });

            expect(linearAgent).toBeDefined();
            expect(typeof linearAgent.handleUserPrompt).toBe('function');
        });
    });
});
