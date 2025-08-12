// Mock database for testing

export const db = {
    apiToken: {
        findFirst: jest.fn(),
    },
    userSubscriptions: {
        findFirst: jest.fn(),
    },
    workflowAuditLog: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
    },
    gitHubConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
    },
    sashiRepo: {
        findUnique: jest.fn(),
    },
    repoSubscription: {
        create: jest.fn(),
        deleteMany: jest.fn(),
    },
    waitlistUser: {
        create: jest.fn(),
    },
    middlewareConnection: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
    },
    $queryRaw: jest.fn(),
};
