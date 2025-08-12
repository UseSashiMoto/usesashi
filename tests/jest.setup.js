// Jest setup file for conditional subscription limits tests

// Mock console.error to avoid noise in test output
const originalConsoleError = console.error;
beforeEach(() => {
    console.error = jest.fn();
});

afterEach(() => {
    console.error = originalConsoleError;
});

// Setup global test environment
process.env.NODE_ENV = 'test';

// Mock fetch globally
global.fetch = jest.fn();

// Reset environment variables after each test
afterEach(() => {
    delete process.env.ENFORCE_SUBSCRIPTION_LIMITS;
});
