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
    handoff: jest.fn()
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

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Reset function registry mock
        //mockFunctionRegistry = new Map();
        //(getFunctionRegistry as jest.Mock).mockReturnValue(mockFunctionRegistry);

        // Clear all mocks before each test
        jest.clearAllMocks();

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

            // Verify that OpenAI SDK was called
            expect(mockedRun).toHaveBeenCalled();
        });


        it('should handle errors in message processing', async () => {
            (mockedAxios.post as any).mockRejectedValueOnce(new Error('Chat error'));
            mockedRun.mockRejectedValueOnce(new Error('Chat error'));

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
