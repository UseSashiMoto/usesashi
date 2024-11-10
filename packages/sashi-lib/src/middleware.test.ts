import { describe, expect, it, jest, test } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';
import { getFunctionRegistry } from './ai-function-loader';
import { AIBot } from './aibot';
import { createMiddleware } from './middleware';

// Create a mock instance of AIBot
const aiBotMockInstance: Partial<jest.Mocked<AIBot>> = {
    chatCompletion: jest.fn(),
    shouldShowVisualization: jest.fn(),
};

// Mock the AIBot class to return the mock instance
jest.mock('./aibot', () => ({
    AIBot: jest.fn().mockImplementation(() => aiBotMockInstance),
}));

jest.mock('./ai-function-loader', () => ({
    getFunctionRegistry: jest.fn(),
    callFunctionFromRegistryFromObject: jest.fn(),
    getFunctionAttributes: jest.fn().mockReturnValue(new Map()),
    VisualizationFunction: jest.fn(),
}));

describe('Chat Endpoint', () => {
    let app: express.Application;
    let request: any;
    let mockFunctionRegistry: Map<string, any>;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Reset function registry mock
        mockFunctionRegistry = new Map();
        (getFunctionRegistry as jest.Mock).mockReturnValue(mockFunctionRegistry);

        // Clear all mocks before each test
        jest.clearAllMocks();

        const router = createMiddleware({
            openAIKey: 'test-key',
        });

        app.use(router);

        request = supertest(app);
    });

    describe('/chat/message', () => {
        test('should process a chat message successfully', async () => {
            const mockMessage = {
                content: 'Hello, how can I help?',
                role: 'assistant',
                refusal: null,
            };

            aiBotMockInstance.chatCompletion?.mockResolvedValue({
                message: {
                    content: 'Hello, how can I help?',
                    role: 'assistant',
                    refusal: null
                },
                finish_reason: 'stop',
                index: 0,
                logprobs: null,
            });

            const response = await request.post('/chat').send({
                type: '/chat/message',
                inquiry: 'Hello',
                previous: [],
            });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                output: mockMessage,
            });
        });

        it('should handle errors in message processing', async () => {
            aiBotMockInstance.chatCompletion?.mockRejectedValue(new Error('Chat error'));

            const response = await request.post('/chat').send({
                type: '/chat/message',
                inquiry: 'Hello',
                previous: [],
            });

            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                message: 'Error processing request',
                error: 'Chat error',
            });
        });
    });

    describe('/chat/function', () => {
        it('should process function calls without confirmation', async () => {
            const mockFunction = {
                getNeedsConfirm: jest.fn().mockReturnValue(false),
                execute: jest.fn(),
                getName: jest.fn().mockReturnValue('testFunction'),
                getDescription: jest.fn().mockReturnValue('Test function description'),
            };
            mockFunctionRegistry.set('testFunction', mockFunction);

            aiBotMockInstance.chatCompletion?.mockResolvedValue({
                message: {
                    content: 'Function executed',
                    role: 'assistant',
                    refusal: null,
                },
                finish_reason: 'stop',
                index: 0,
                logprobs: null,
            });
            aiBotMockInstance.shouldShowVisualization?.mockResolvedValue([]);

            const response = await request.post('/chat').send({
                type: '/chat/function',
                tools: [
                    {
                        id: 'test-id',
                        function: {
                            name: 'testFunction',
                            arguments: '{}',
                        },
                    },
                ],
                previous: [],
            });

            expect(response.status).toBe(200);
            expect(response.body).toEqual(
                expect.objectContaining({
                    output: expect.any(Object),
                    visualization: [],
                })
            );
        });

        it('should handle functions requiring confirmation', async () => {
            const mockFunction = {
                getNeedsConfirm: jest.fn().mockReturnValue(true),
                getName: jest.fn().mockReturnValue('testFunction'),
                getDescription: jest.fn().mockReturnValue('Test function description'),
            };
            mockFunctionRegistry.set('testFunction', mockFunction);

            aiBotMockInstance.chatCompletion?.mockResolvedValue({
                message: {
                    content: 'Confirmation required',
                    role: 'assistant',
                    refusal: null,
                },
                finish_reason: 'stop',
                index: 0,
                logprobs: null,
            });
            aiBotMockInstance.shouldShowVisualization?.mockResolvedValue([]);

            const response = await request.post('/chat').send({
                type: '/chat/function',
                tools: [
                    {
                        id: 'test-id',
                        function: {
                            name: 'testFunction',
                            arguments: '{}',
                        },
                        confirmed: false,
                    },
                ],
                previous: [],
            });

            expect(response.status).toBe(200);
            expect(response.body).toEqual(
                expect.objectContaining({
                    output: expect.objectContaining({
                        content: expect.any(String),
                    }),
                })
            );
        });

        it('should handle invalid function calls', async () => {
            const response = await request.post('/chat').send({
                type: '/chat/function',
                tools: [
                    {
                        id: 'test-id',
                        function: {
                            name: '',
                            arguments: '{}',
                        },
                    },
                ],
                previous: [],
            });

            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                message: 'Error processing request',
                error: 'Missing function name in tool call.',
            });
        });
    });
});