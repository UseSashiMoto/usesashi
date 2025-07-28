import { describe, expect, it, jest, test } from '@jest/globals';
import axios from 'axios';
import express from 'express';
import fetchMock from 'jest-fetch-mock';
import supertest from 'supertest';
import { createMiddleware } from './middleware';

jest.mock('@openai/agents', () => ({
    Agent: jest.fn().mockImplementation((config: any) => ({
        name: config.name,
        instructions: config.instructions,
        functions: config.functions,
        tools: config.tools
    })),
    run: jest.fn().mockImplementation((agent, inquiry) => {
        return {
            finalOutput: 'This is a simple response from the agent.'
        };
    }),
    tool: jest.fn().mockImplementation((config: any) => ({
        name: config.name,
        description: config.description,
        parameters: config.parameters,
        execute: config.execute
    })),
    user: jest.fn().mockImplementation((message: unknown) => {
        return {
            content: message as string,
            role: 'user'
        }
    }),
    assistant: jest.fn().mockImplementation((args: unknown) => {
        return {
            content: args as string,
            role: 'assistant'
        }
    }),
    handoff: jest.fn(),
    setDefaultOpenAIKey: jest.fn().mockImplementation((key: unknown) => {
        // Mock successful configuration
        if (!key || (typeof key === 'string' && key.trim() === '')) {
            throw new Error('Invalid API key');
        }
        return true;
    })
}));

// Create a controllable mock for SashiAgent
const mockProcessRequest = jest.fn();

// Mock SashiAgent
jest.mock('./sashiagent', () => ({
    getSashiAgent: jest.fn(() => ({
        processRequest: mockProcessRequest
    }))
}));

fetchMock.enableMocks(); // Enable fetch mocks

jest.mock('axios');
jest.mock('openai')

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Get reference to the mocked run function after the mock is defined
const { run: mockedRun } = require('@openai/agents');

describe('Chat Endpoint', () => {
    let app: express.Application;
    let request: any;
    //let mockFunctionRegistry: Map<string, any>;

    // Mock console methods to prevent test output noise
    beforeAll(() => {
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    beforeAll(() => {
        // Verify zod version compatibility
        const zodPkg = require('zod/package.json');
        const currentVersion = zodPkg.version;
        const maxVersion = '3.25.67';

        const isCompatible = (current: string, max: string) => {
            const [curMajor, curMinor, curPatch] = current.split('.').map(Number);
            const [maxMajor, maxMinor, maxPatch] = max.split('.').map(Number);

            if (!curMajor || !curMinor || !curPatch || !maxMajor || !maxMinor || !maxPatch) {
                throw new Error('Invalid version format');
            }

            if (curMajor > maxMajor) return false;
            if (curMajor < maxMajor) return true;
            if (curMinor > maxMinor) return false;
            if (curMinor < maxMinor) return true;
            return curPatch <= maxPatch;
        };

        if (!isCompatible(currentVersion, maxVersion)) {
            console.warn(`Warning: Tests running with zod version ${currentVersion}, but library requires version <= ${maxVersion}`);
        }
    });

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Reset function registry mock
        //mockFunctionRegistry = new Map();
        //(getFunctionRegistry as jest.Mock).mockReturnValue(mockFunctionRegistry);

        // Clear all mocks before each test
        jest.clearAllMocks();

        // Set up default SashiAgent mock behavior
        mockProcessRequest.mockImplementation((inquiry: unknown) => {
            // For health check requests
            if (inquiry === 'test connection') {
                return Promise.resolve({
                    type: 'general',
                    content: 'Test connection successful'
                } as any);
            }
            // Default successful response
            return Promise.resolve({
                type: 'general',
                content: 'This is a simple response from the agent.'
            } as any);
        });

        // Mock axios.post
        mockedAxios.post.mockResolvedValue({
            data: {
                choices: [
                    {
                        message: {
                            content: 'Hello, how can I help?',
                            role: 'assistant',
                            refusal: null,
                        },
                    },
                ],
            },
        });

        // Clear the run mock for each test  
        mockedRun.mockClear();



        const router = createMiddleware({
            openAIKey: process.env.OPENAI_API_KEY as string,
            sashiServerUrl: 'https://example.com',
            apiSecretKey: 'test-secret-key',
        });

        app.use(router);

        request = supertest(app);

        // Reset and mock fetch
        fetchMock.resetMocks();
        fetchMock.mockResponse(
            JSON.stringify({
                choices: [
                    {
                        message: {
                            content: 'Hello, how can I help?',
                            role: 'assistant',
                            refusal: null,
                        },
                    },
                ],
            })
        );
    });

    describe('/chat/message', () => {
        test('should process a chat message successfully when useCloud is false', async () => {
            const response = await request
                .post('/chat')
                .set('x-sashi-session-token', 'test-session-token')
                .send({
                    type: '/chat/message',
                    inquiry: 'Hello',
                    previous: [],
                });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                output: {
                    content: 'This is a simple response from the agent.',
                    "type": "general",
                },
            });

            // Verify that SashiAgent processRequest was called
            expect(mockProcessRequest).toHaveBeenCalled();
        });


        it('should handle errors in message processing', async () => {
            // Override the default mock to return an error response
            mockProcessRequest.mockImplementationOnce(() => {
                return Promise.resolve({
                    type: 'general',
                    content: 'I encountered an error while processing your request: Chat error. Please try again or rephrase your request.'
                });
            });

            const response = await request
                .post('/chat')
                .set('x-sashi-session-token', 'test-session-token')
                .send({
                    type: '/chat/message',
                    inquiry: 'Hello',
                    previous: [],
                });

            expect(response.status).toBe(200);

            expect(response.body).toEqual({
                output: {
                    type: 'general',
                    content: "I encountered an error while processing your request: Chat error. Please try again or rephrase your request.",
                },
            });


        });




    });

    // Adjust the rest of your test cases similarly
});
