module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    testMatch: [
        '**/__tests__/**/*.ts',
        '**/?(*.)+(spec|test).ts'
    ],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/test-cli.ts',
        '!src/index.ts' // Exclude the complex version with dependency issues
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    testTimeout: 60000, // Increased timeout for E2E tests
    // Separate configuration for E2E tests
    projects: [
        {
            displayName: 'unit',
            preset: 'ts-jest',
            testEnvironment: 'node',
            transform: {
                '^.+\\.ts$': 'ts-jest',
            },
            testMatch: [
                '<rootDir>/tests/setup.test.ts',
                '<rootDir>/tests/init.test.ts', 
                '<rootDir>/tests/check.test.ts',
                '<rootDir>/tests/integration.test.ts'
            ],
            setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
        },
        {
            displayName: 'e2e',
            preset: 'ts-jest',
            testEnvironment: 'node',
            transform: {
                '^.+\\.ts$': 'ts-jest',
            },
            testMatch: [
                '<rootDir>/tests/e2e.test.ts',
                '<rootDir>/tests/workflow-validation.test.ts'
            ],
            setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
        }
    ]
}; 