require('jest-fetch-mock').enableMocks();

// Mock langfuse to avoid dynamic import issues in tests
jest.mock('langfuse', () => ({
    observeOpenAI: jest.fn((openai) => openai), // Return the OpenAI instance unchanged for tests
}));