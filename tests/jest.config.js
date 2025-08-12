module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>'],
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    collectCoverageFrom: [
        '**/*.ts',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/dist/**',
        '!**/*.config.js',
    ],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    moduleNameMapping: {
        '^@repo/db$': '<rootDir>/__mocks__/@repo/db.ts',
    },
    testTimeout: 10000,
    verbose: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
};
