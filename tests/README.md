# Conditional Subscription Limits Tests

This directory contains comprehensive tests for the conditional subscription enforcement feature that only applies subscription limits when using the managed hub service.

## Test Files

### 1. `conditional-subscription-limits.test.ts`

Tests for the **hub server endpoints** including:

- Workflow saving limits (3 workflows for free users)
- Execution limits (10/month for free users)
- GitHub integration limits (Pro-only for managed hub)
- Detection methods (environment variable, headers, domain)
- Error handling and edge cases

### 2. `middleware-conditional-limits.test.ts`

Tests for the **middleware library** including:

- Hub forwarding behavior
- Conditional subscription checks
- Error handling when hub is unreachable
- Self-hosted vs managed hub scenarios

## Test Scenarios Covered

### ✅ Subscription Enforcement Cases

#### **Managed Hub Service (Limits Applied)**

- ✅ Pro users get unlimited access to all features
- ✅ Free users hit workflow limit (3 saved workflows)
- ✅ Free users hit execution limit (10/month)
- ✅ Free users blocked from GitHub integration
- ✅ Trialing users treated as Pro users

#### **Self-Hosted Instances (No Limits)**

- ✅ All users get unlimited workflows
- ✅ All users get unlimited executions
- ✅ All users get full GitHub access
- ✅ No subscription checks performed

### ✅ Detection Methods

- ✅ Environment variable: `ENFORCE_SUBSCRIPTION_LIMITS=true`
- ✅ Request header: `x-managed-hub: true`
- ✅ Domain matching: `hub.usesashi.com`, `usesashi.com`, `sashi.ai`

### ✅ Error Handling

- ✅ Invalid API tokens
- ✅ Missing hub configuration
- ✅ Hub connection failures
- ✅ Database errors
- ✅ Session retrieval errors
- ✅ Network timeouts

### ✅ Edge Cases

- ✅ Multiple subscription records (uses latest)
- ✅ Case-insensitive domain matching
- ✅ Graceful degradation on technical failures
- ✅ Proper error response formats

## Running the Tests

### Prerequisites

```bash
cd tests
npm install
```

### Run All Tests

```bash
npm test
```

### Run Specific Test Files

```bash
# Hub server tests only
npm run test:hub

# Middleware tests only
npm run test:middleware
```

### Watch Mode (for development)

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

## Test Environment Variables

The tests automatically handle environment variables:

```bash
# Managed hub mode (enforces subscription limits)
ENFORCE_SUBSCRIPTION_LIMITS=true

# Self-hosted mode (no subscription limits)
# Default when ENFORCE_SUBSCRIPTION_LIMITS is not set
```

## Mock Data Structure

### User with Active Subscription (Pro)

```typescript
{
  id: 'sub-1',
  user_id: 'user-1',
  status: 'active', // or 'trialing'
  created_at: new Date()
}
```

### User without Subscription (Free)

```typescript
null // No subscription record found
```

### API Token

```typescript
{
  id: 'api-token-1',
  token: 'test-api-token',
  userId: 'user-1'
}
```

## Expected Error Responses

### Workflow Limit Reached

```json
{
    "error": "WORKFLOW_LIMIT_REACHED",
    "message": "Free plan allows up to 3 saved workflows. Upgrade to pro for unlimited workflows.",
    "limit": 3,
    "current": 3,
    "requiresUpgrade": true
}
```

### Execution Limit Reached

```json
{
    "error": "EXECUTION_LIMIT_REACHED",
    "message": "Free plan allows up to 10 executions per month. Upgrade to pro for unlimited executions.",
    "limit": 10,
    "current": 10,
    "requiresUpgrade": true
}
```

### GitHub Integration Pro Required

```json
{
    "error": "GITHUB_INTEGRATION_REQUIRES_PRO",
    "message": "GitHub integration is only available for Pro users. Upgrade to pro to connect your repositories.",
    "requiresUpgrade": true
}
```

### Hub Configuration Missing

```json
{
    "error": "Hub not configured",
    "message": "Workflow saving requires hub configuration or local implementation",
    "code": "NO_HUB_CONFIG"
}
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Conditional Subscription Tests
  run: |
      cd tests
      npm install
      npm run test:coverage
```

## Troubleshooting

### Common Issues

1. **Tests failing with database connection errors**
    - Make sure `@repo/db` is properly mocked
    - Check that the mock is in `__mocks__/@repo/db.ts`

2. **Fetch is not defined errors**
    - The global fetch mock should be set up in `jest.setup.js`
    - Make sure you're using Node 18+ or have a fetch polyfill

3. **Import path errors**
    - Update the import paths in test files to match your actual file structure
    - Check that the middleware export path is correct

4. **Environment variable leaks between tests**
    - Each test should clean up environment variables in `afterEach`
    - Use the provided Jest setup file

## Adding New Tests

When adding new conditional subscription features:

1. **Add the feature detection logic** to the `shouldEnforceSubscriptionLimits` helper
2. **Add tests for both scenarios**:
    - Managed hub (with limits)
    - Self-hosted (without limits)
3. **Test error cases** and edge conditions
4. **Update this README** with the new test scenarios

This ensures your subscription limits only apply when intended and your self-hosted users maintain full functionality! 🎯
