import { db } from '@repo/db';
import { Express } from 'express';
import request from 'supertest';

// Mock the database
jest.mock('@repo/db', () => ({
    db: {
        apiToken: {
            findFirst: jest.fn(),
        },
        userSubscriptions: {
            findFirst: jest.fn(),
        },
        workflowAuditLog: {
            count: jest.fn(),
        },
        gitHubConfig: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn(),
        },
    },
}));

// Mock workflowStorage
jest.mock('../db-helpers/workflow-storage', () => ({
    workflowStorage: {
        getAll: jest.fn(),
        save: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
    },
}));

import { workflowStorage } from '../db-helpers/workflow-storage';
import { app } from '../index'; // Your main app file

describe('Conditional Subscription Limits Tests', () => {
    let mockApp: Express;

    beforeEach(() => {
        jest.clearAllMocks();
        mockApp = app;

        // Default user mock
        (db.apiToken.findFirst as jest.Mock).mockResolvedValue({
            id: 'api-token-1',
            token: 'test-api-token',
            userId: 'user-1',
        });
    });

    describe('Helper Function: shouldEnforceSubscriptionLimits', () => {
        describe('Workflow Saving Endpoint - POST /workflows', () => {
            const validWorkflow = {
                id: 'workflow-1',
                name: 'Test Workflow',
                description: 'Test workflow description',
                actions: [],
            };

            describe('When subscription limits should be enforced (managed hub)', () => {
                beforeEach(() => {
                    // Set environment to enforce limits
                    process.env.ENFORCE_SUBSCRIPTION_LIMITS = 'true';
                });

                afterEach(() => {
                    delete process.env.ENFORCE_SUBSCRIPTION_LIMITS;
                });

                it('should allow workflow saving for Pro users', async () => {
                    // Mock Pro subscription
                    (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue({
                        id: 'sub-1',
                        user_id: 'user-1',
                        status: 'active',
                        created_at: new Date(),
                    });

                    (workflowStorage.save as jest.Mock).mockResolvedValue({
                        ...validWorkflow,
                        userId: 'user-1',
                        timestamp: Date.now(),
                    });

                    const response = await request(mockApp)
                        .post('/workflows')
                        .set('x-api-token', 'test-api-token')
                        .send(validWorkflow);

                    expect(response.status).toBe(201);
                    expect(workflowStorage.save).toHaveBeenCalled();
                });

                it('should reject workflow saving for free users at limit', async () => {
                    // Mock no active subscription (free user)
                    (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue(null);

                    // Mock 3 existing workflows (at free limit)
                    (workflowStorage.getAll as jest.Mock).mockResolvedValue([
                        { id: 'wf-1' },
                        { id: 'wf-2' },
                        { id: 'wf-3' },
                    ]);

                    const response = await request(mockApp)
                        .post('/workflows')
                        .set('x-api-token', 'test-api-token')
                        .send(validWorkflow);

                    expect(response.status).toBe(403);
                    expect(response.body).toEqual({
                        error: 'WORKFLOW_LIMIT_REACHED',
                        message: 'Free plan allows up to 3 saved workflows. Upgrade to pro for unlimited workflows.',
                        limit: 3,
                        current: 3,
                        requiresUpgrade: true,
                    });
                    expect(workflowStorage.save).not.toHaveBeenCalled();
                });

                it('should allow workflow saving for free users under limit', async () => {
                    // Mock no active subscription (free user)
                    (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue(null);

                    // Mock 2 existing workflows (under free limit)
                    (workflowStorage.getAll as jest.Mock).mockResolvedValue([
                        { id: 'wf-1' },
                        { id: 'wf-2' },
                    ]);

                    (workflowStorage.save as jest.Mock).mockResolvedValue({
                        ...validWorkflow,
                        userId: 'user-1',
                        timestamp: Date.now(),
                    });

                    const response = await request(mockApp)
                        .post('/workflows')
                        .set('x-api-token', 'test-api-token')
                        .send(validWorkflow);

                    expect(response.status).toBe(201);
                    expect(workflowStorage.save).toHaveBeenCalled();
                });
            });

            describe('When subscription limits should NOT be enforced (self-hosted)', () => {
                it('should allow unlimited workflow saving without subscription checks', async () => {
                    // No environment variable set, no managed hub headers

                    // Mock no active subscription (would normally be restricted)
                    (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue(null);

                    // Mock 5 existing workflows (over free limit, but should be allowed)
                    (workflowStorage.getAll as jest.Mock).mockResolvedValue([
                        { id: 'wf-1' },
                        { id: 'wf-2' },
                        { id: 'wf-3' },
                        { id: 'wf-4' },
                        { id: 'wf-5' },
                    ]);

                    (workflowStorage.save as jest.Mock).mockResolvedValue({
                        ...validWorkflow,
                        userId: 'user-1',
                        timestamp: Date.now(),
                    });

                    const response = await request(mockApp)
                        .post('/workflows')
                        .set('x-api-token', 'test-api-token')
                        .send(validWorkflow);

                    expect(response.status).toBe(201);
                    expect(workflowStorage.save).toHaveBeenCalled();
                    // Should not check subscription at all
                    expect(db.userSubscriptions.findFirst).not.toHaveBeenCalled();
                });

                it('should allow workflow saving with managed hub header but from allowed domain', async () => {
                    // Mock as coming from managed hub domain
                    const response = await request(mockApp)
                        .post('/workflows')
                        .set('x-api-token', 'test-api-token')
                        .set('origin', 'https://app.mycompany.com') // Not a managed hub domain
                        .send(validWorkflow);

                    // Should not enforce subscription limits for non-managed domains
                    expect(db.userSubscriptions.findFirst).not.toHaveBeenCalled();
                });
            });

            describe('Detection methods for managed hub', () => {
                beforeEach(() => {
                    (workflowStorage.save as jest.Mock).mockResolvedValue({
                        ...validWorkflow,
                        userId: 'user-1',
                        timestamp: Date.now(),
                    });
                });

                it('should enforce limits with x-managed-hub header', async () => {
                    // Mock Pro subscription to pass the check
                    (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue({
                        id: 'sub-1',
                        user_id: 'user-1',
                        status: 'active',
                    });

                    const response = await request(mockApp)
                        .post('/workflows')
                        .set('x-api-token', 'test-api-token')
                        .set('x-managed-hub', 'true')
                        .send(validWorkflow);

                    expect(response.status).toBe(201);
                    expect(db.userSubscriptions.findFirst).toHaveBeenCalled();
                });

                it('should enforce limits with managed hub domain origin', async () => {
                    // Mock Pro subscription to pass the check
                    (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue({
                        id: 'sub-1',
                        user_id: 'user-1',
                        status: 'active',
                    });

                    const response = await request(mockApp)
                        .post('/workflows')
                        .set('x-api-token', 'test-api-token')
                        .set('origin', 'https://hub.usesashi.com')
                        .send(validWorkflow);

                    expect(response.status).toBe(201);
                    expect(db.userSubscriptions.findFirst).toHaveBeenCalled();
                });
            });
        });

        describe('Execution Limits - POST /check-execution-limit', () => {
            describe('When subscription limits should be enforced (managed hub)', () => {
                beforeEach(() => {
                    process.env.ENFORCE_SUBSCRIPTION_LIMITS = 'true';
                });

                afterEach(() => {
                    delete process.env.ENFORCE_SUBSCRIPTION_LIMITS;
                });

                it('should allow execution for Pro users', async () => {
                    (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue({
                        id: 'sub-1',
                        user_id: 'user-1',
                        status: 'active',
                    });

                    const response = await request(mockApp)
                        .post('/check-execution-limit')
                        .set('x-api-token', 'test-api-token')
                        .send({});

                    expect(response.status).toBe(200);
                    expect(response.body).toEqual({ allowed: true });
                });

                it('should reject execution for free users at monthly limit', async () => {
                    // Mock no active subscription (free user)
                    (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue(null);

                    // Mock 10 executions this month (at free limit)
                    (db.workflowAuditLog.count as jest.Mock).mockResolvedValue(10);

                    const response = await request(mockApp)
                        .post('/check-execution-limit')
                        .set('x-api-token', 'test-api-token')
                        .send({});

                    expect(response.status).toBe(403);
                    expect(response.body).toEqual({
                        error: 'EXECUTION_LIMIT_REACHED',
                        message: 'Free plan allows up to 10 executions per month. Upgrade to pro for unlimited executions.',
                        limit: 10,
                        current: 10,
                        requiresUpgrade: true,
                    });
                });

                it('should allow execution for free users under monthly limit', async () => {
                    // Mock no active subscription (free user)
                    (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue(null);

                    // Mock 5 executions this month (under free limit)
                    (db.workflowAuditLog.count as jest.Mock).mockResolvedValue(5);

                    const response = await request(mockApp)
                        .post('/check-execution-limit')
                        .set('x-api-token', 'test-api-token')
                        .send({});

                    expect(response.status).toBe(200);
                    expect(response.body).toEqual({ allowed: true });
                });
            });

            describe('When subscription limits should NOT be enforced (self-hosted)', () => {
                it('should allow unlimited executions without subscription checks', async () => {
                    // No environment variable set, no managed hub headers

                    const response = await request(mockApp)
                        .post('/check-execution-limit')
                        .set('x-api-token', 'test-api-token')
                        .send({});

                    expect(response.status).toBe(200);
                    expect(response.body).toEqual({ allowed: true });
                    // Should not check subscription or execution count
                    expect(db.userSubscriptions.findFirst).not.toHaveBeenCalled();
                    expect(db.workflowAuditLog.count).not.toHaveBeenCalled();
                });
            });
        });

        describe('GitHub Integration - GET /github/config', () => {
            describe('When subscription limits should be enforced (managed hub)', () => {
                beforeEach(() => {
                    process.env.ENFORCE_SUBSCRIPTION_LIMITS = 'true';
                });

                afterEach(() => {
                    delete process.env.ENFORCE_SUBSCRIPTION_LIMITS;
                });

                it('should allow GitHub access for Pro users', async () => {
                    (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue({
                        id: 'sub-1',
                        user_id: 'user-1',
                        status: 'active',
                    });

                    (db.gitHubConfig.findUnique as jest.Mock).mockResolvedValue({
                        userId: 'user-1',
                        owner: 'test-owner',
                        repo: 'test-repo',
                        repoName: 'test-repo',
                        defaultBranch: 'main',
                        token: 'github-token',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });

                    const response = await request(mockApp)
                        .get('/github/config')
                        .set('x-api-token', 'test-api-token');

                    expect(response.status).toBe(200);
                    expect(response.body.owner).toBe('test-owner');
                    expect(response.body.repo).toBe('test-repo');
                });

                it('should reject GitHub access for free users', async () => {
                    // Mock no active subscription (free user)
                    (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue(null);

                    const response = await request(mockApp)
                        .get('/github/config')
                        .set('x-api-token', 'test-api-token');

                    expect(response.status).toBe(403);
                    expect(response.body).toEqual({
                        error: 'GITHUB_INTEGRATION_REQUIRES_PRO',
                        message: 'GitHub integration is only available for Pro users. Upgrade to pro to connect your repositories.',
                        requiresUpgrade: true,
                    });
                    expect(db.gitHubConfig.findUnique).not.toHaveBeenCalled();
                });
            });

            describe('When subscription limits should NOT be enforced (self-hosted)', () => {
                it('should allow GitHub access without subscription checks', async () => {
                    // No environment variable set, no managed hub headers

                    (db.gitHubConfig.findUnique as jest.Mock).mockResolvedValue({
                        userId: 'user-1',
                        owner: 'test-owner',
                        repo: 'test-repo',
                        repoName: 'test-repo',
                        defaultBranch: 'main',
                        token: 'github-token',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });

                    const response = await request(mockApp)
                        .get('/github/config')
                        .set('x-api-token', 'test-api-token');

                    expect(response.status).toBe(200);
                    expect(response.body.owner).toBe('test-owner');
                    // Should not check subscription at all
                    expect(db.userSubscriptions.findFirst).not.toHaveBeenCalled();
                });
            });
        });

        describe('Error Cases - No Hub or API Secret', () => {
            describe('Workflow endpoints when hub not configured', () => {
                it('should handle missing hub configuration gracefully', async () => {
                    // This test would be for middleware that checks hub connectivity
                    // In your current implementation, workflow saving doesn't directly depend on hub
                    // But you might want to test cases where hubUrl is undefined

                    const validWorkflow = {
                        id: 'workflow-1',
                        name: 'Test Workflow',
                        description: 'Test workflow description',
                        actions: [],
                    };

                    // Mock successful save for self-hosted scenario
                    (workflowStorage.save as jest.Mock).mockResolvedValue({
                        ...validWorkflow,
                        userId: 'user-1',
                        timestamp: Date.now(),
                    });

                    const response = await request(mockApp)
                        .post('/workflows')
                        .set('x-api-token', 'test-api-token')
                        .send(validWorkflow);

                    // Should still work for self-hosted instances
                    expect(response.status).toBe(201);
                });
            });

            describe('Authentication errors', () => {
                it('should reject requests with invalid API token', async () => {
                    (db.apiToken.findFirst as jest.Mock).mockResolvedValue(null);

                    const response = await request(mockApp)
                        .post('/workflows')
                        .set('x-api-token', 'invalid-token')
                        .send({});

                    expect(response.status).toBe(401);
                });

                it('should reject requests without API token', async () => {
                    const response = await request(mockApp)
                        .post('/workflows')
                        .send({});

                    expect(response.status).toBe(401);
                });
            });

            describe('Database errors', () => {
                it('should handle database errors gracefully', async () => {
                    (db.apiToken.findFirst as jest.Mock).mockRejectedValue(new Error('Database connection error'));

                    const response = await request(mockApp)
                        .post('/workflows')
                        .set('x-api-token', 'test-api-token')
                        .send({});

                    expect(response.status).toBe(500);
                });

                it('should handle subscription check errors gracefully', async () => {
                    process.env.ENFORCE_SUBSCRIPTION_LIMITS = 'true';

                    (db.userSubscriptions.findFirst as jest.Mock).mockRejectedValue(new Error('Subscription query failed'));

                    const response = await request(mockApp)
                        .post('/check-execution-limit')
                        .set('x-api-token', 'test-api-token')
                        .send({});

                    expect(response.status).toBe(500);

                    delete process.env.ENFORCE_SUBSCRIPTION_LIMITS;
                });
            });
        });

        describe('Edge Cases', () => {
            it('should handle trialing subscription status as active', async () => {
                process.env.ENFORCE_SUBSCRIPTION_LIMITS = 'true';

                // Mock trialing subscription (should be treated as Pro)
                (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue({
                    id: 'sub-1',
                    user_id: 'user-1',
                    status: 'trialing', // Trialing status
                    created_at: new Date(),
                });

                const response = await request(mockApp)
                    .post('/check-execution-limit')
                    .set('x-api-token', 'test-api-token')
                    .send({});

                expect(response.status).toBe(200);
                expect(response.body).toEqual({ allowed: true });

                delete process.env.ENFORCE_SUBSCRIPTION_LIMITS;
            });

            it('should handle multiple subscription records correctly', async () => {
                process.env.ENFORCE_SUBSCRIPTION_LIMITS = 'true';

                // Mock latest subscription being active (should use the most recent one)
                (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue({
                    id: 'sub-2',
                    user_id: 'user-1',
                    status: 'active',
                    created_at: new Date(),
                });

                const response = await request(mockApp)
                    .post('/check-execution-limit')
                    .set('x-api-token', 'test-api-token')
                    .send({});

                expect(response.status).toBe(200);
                expect(db.userSubscriptions.findFirst).toHaveBeenCalledWith({
                    where: {
                        user_id: 'user-1',
                        status: { in: ['active', 'trialing'] }
                    },
                    orderBy: { created_at: 'desc' }
                });

                delete process.env.ENFORCE_SUBSCRIPTION_LIMITS;
            });

            it('should handle case-insensitive domain matching', async () => {
                // Mock Pro subscription to pass the check
                (db.userSubscriptions.findFirst as jest.Mock).mockResolvedValue({
                    id: 'sub-1',
                    user_id: 'user-1',
                    status: 'active',
                });

                const response = await request(mockApp)
                    .post('/check-execution-limit')
                    .set('x-api-token', 'test-api-token')
                    .set('origin', 'https://HUB.USESASHI.COM') // Different case
                    .send({});

                expect(response.status).toBe(200);
                // Should enforce subscription limits even with different case
                expect(db.userSubscriptions.findFirst).toHaveBeenCalled();
            });
        });
    });
});
