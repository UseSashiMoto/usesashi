# 🧪 Sashi Integration Test App

A comprehensive testing environment for all Sashi packages, demonstrating real-world usage patterns and providing a unified development experience.

## 🚀 Quick Deploy

Deploy this integration test to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FUseSashiMoto%2Fusesashi%2Ftree%2Fmain%2Fexamples%2Fsashi-integration-test&env=OPENAI_API_KEY&envDescription=Required%20environment%20variables%20for%20Sashi%20integration&envLink=https%3A%2F%2Fgithub.com%2FUseSashiMoto%2Fusesashi%2Fblob%2Fmain%2Fexamples%2Fsashi-integration-test%2F.env.example)

### Required Environment Variables for Vercel

After deployment, configure these in your Vercel dashboard:

| Variable         | Description                                    | Required |
| ---------------- | ---------------------------------------------- | -------- |
| `OPENAI_API_KEY` | Your OpenAI API key for AI agent functionality | ✅       |

## 🎯 Purpose

This integration test app serves as:

- **Comprehensive demo** of all Sashi packages working together
- **Development environment** for testing new features
- **Reference implementation** for developers
- **Integration testing** platform for CI/CD
- **Documentation** through working examples

## 🏗️ Architecture

### Packages Demonstrated

- **@sashimo/lib** - Core middleware and AI function system
- **@sashimo/ui** - React dashboard components (served by middleware)
- **@sashimo/cli** - Command-line tools (used for setup)

### Service Areas Covered

- **User Management** - CRUD operations, roles, preferences
- **File Operations** - Upload, storage, metadata, search
- **Email Services** - Templates, sending, logging, analytics
- **Analytics** - Event tracking, metrics, conversion funnels
- **Payment Processing** - Transactions, subscriptions, refunds
- **Content Management** - Articles, publishing, search, SEO

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Yarn (recommended) or npm
- OpenAI API key

### 1. Install Dependencies

```bash
yarn install
```

### 2. Environment Setup

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
# Required: OPENAI_API_KEY
# Optional: HUB_URL, HUB_API_SECRET_KEY
```

### 3. Seed Test Data

```bash
yarn seed
```

### 4. Start Development Server

```bash
# Basic development
yarn dev

# With ngrok tunnel (for external testing)
yarn dev:all
```

### 5. Access the Application

- **Server**: http://localhost:3010
- **Sashi Bot**: http://localhost:3010/sashi/bot
- **Health Check**: http://localhost:3010/health
- **API Docs**: http://localhost:3010/docs

## 🔧 Available Scripts

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `yarn dev`              | Start development server with hot reload |
| `yarn dev:all`          | Start server + ngrok tunnel              |
| `yarn dev:ngrok`        | Start ngrok tunnel only                  |
| `yarn build`            | Compile TypeScript to JavaScript         |
| `yarn start`            | Start compiled production server         |
| `yarn serve`            | Alias for start                          |
| `yarn test`             | Run test suite                           |
| `yarn test:integration` | Run integration tests only               |
| `yarn seed`             | Populate database with test data         |

## 🔑 Authentication

The app supports multiple authentication methods for testing:

### Session Tokens (Header: `x-sashi-session-token`)

- `userone-session-token` - Regular user
- `usertwo-session-token` - Regular user
- `admin-session-token` - Admin user
- `demo-session-token` - Demo user

### Bearer Tokens (Header: `Authorization: Bearer <token>`)

Use `yarn generate:token` to create JWT-style tokens.

### Testing Authentication

```bash
# Test with curl
curl -H "x-sashi-session-token: admin-session-token" \\
     http://localhost:3010/sashi/health

# Test with Bearer token
curl -H "Authorization: Bearer <your-jwt-token>" \\
     http://localhost:3010/sashi/health
```

## 📊 Available AI Functions

### User Management

- `get_all_users` - Retrieve all users
- `get_user_by_id` - Get specific user
- `create_user` - Create new user account
- `update_user` - Update user information
- `deactivate_user` - Deactivate user account
- `get_users_by_role` - Filter users by role
- `get_active_users` - Get only active users

### File Operations

- `get_all_files` - List all files
- `get_file_by_id` - Get file details
- `search_files` - Search files by criteria
- `upload_file` - Upload new file (simulated)
- `delete_file` - Remove file
- `get_file_stats` - File system statistics
- `update_file_metadata` - Update file properties

### Email Services

- `send_email` - Send custom email
- `send_template_email` - Use email templates
- `get_email_templates` - List available templates
- `get_email_logs` - View sending history
- `get_email_stats` - Email analytics

### Analytics

- `track_event` - Record analytics event
- `get_dashboard_metrics` - Key performance metrics
- `get_user_engagement` - Engagement over time
- `get_recent_events` - Latest events
- `get_analytics_summary` - Comprehensive summary
- `get_conversion_funnel` - Funnel analysis

### Payment Processing

- `process_payment` - Process one-time payment
- `get_user_transactions` - Transaction history
- `add_payment_method` - Add payment method
- `get_user_payment_methods` - List payment methods
- `create_subscription` - Create subscription
- `get_user_subscriptions` - List subscriptions
- `refund_transaction` - Process refund

### Content Management

- `create_content` - Create new content
- `get_all_content` - List content items
- `get_content_by_id` - Get specific content
- `update_content` - Update content
- `publish_content` - Publish draft content
- `search_content` - Search content
- `get_content_stats` - Content analytics

## 🧪 Testing Scenarios

### Basic Workflow Testing

1. **User Management Flow**

    ```
    Ask: "Show me all users"
    Then: "Create a new user named Test User with email test@example.com"
    Then: "Update user ID 5 to change their role to moderator"
    ```

2. **Content Publishing Flow**

    ```
    Ask: "Create a new blog post titled 'Hello World' about getting started"
    Then: "Publish the content I just created"
    Then: "Show me content statistics"
    ```

3. **Analytics Flow**
    ```
    Ask: "Track a page_view event for user_123"
    Then: "Show me dashboard metrics"
    Then: "Get user engagement data for the last 30 days"
    ```

### ⚡ Workflow-Optimized Functions

This app includes workflow-optimized versions of common functions that work seamlessly with Sashi's workflow system:

**Analytics Functions:**

- `get_dashboard_metrics` - All metrics (no parameters)
- `get_dashboard_metrics_by_category` - Filtered by category
- `get_user_engagement` - Last 30 days (no parameters)
- `get_user_engagement_custom` - Custom day range
- `get_recent_events` - 50 most recent events (no parameters)
- `get_recent_events_custom` - Custom limit
- `get_events_by_type` - Filter by event type
- `get_events_by_user` - Filter by user ID

**Content Functions:**

- `get_all_content` - All content (no parameters)
- `get_published_content` - Only published content
- `get_draft_content` - Only draft content
- `get_content_by_type` - Filtered by type

**🔧 Why These Exist:**
These provide convenient preset variations for common use cases, reducing the need to specify parameters for basic operations.

**✅ Optional Parameters Now Work in Workflows!**
The core AIFunction library has been updated to properly handle optional parameters in workflows. Functions like `get_dashboard_metrics(category?)` now work correctly with empty parameters `{}`.

**🤖 For AI Agents Creating Workflows:**

- Both parameter-free functions AND functions with optional parameters work in workflows
- Use `get_dashboard_metrics` with or without the optional `category` parameter
- Use `get_recent_events` with or without optional `limit`, `eventType`, `userId` parameters
- Preset functions like `get_published_content` provide convenient shortcuts

### Advanced Workflow Testing

4. **E-commerce Simulation**

    ```
    Ask: "Process a $29.99 payment for user_123 using payment method pm_001"
    Then: "Create a monthly subscription for user_123 with the pro plan"
    Then: "Show me all transactions for user_123"
    ```

5. **Content & Email Flow**
    ```
    Ask: "Search for content about 'getting started'"
    Then: "Send a welcome email to new@user.com using the welcome template"
    Then: "Show me email sending statistics"
    ```

## 🐛 Debugging

### Health Check

```bash
curl http://localhost:3010/health
```

### View Registered Functions

The Sashi middleware automatically lists available functions. Check server logs or ask the AI: "What functions are available?"

### Enable Debug Mode

```bash
# In .env file
DEBUG=true

# Or start with debug
DEBUG=true yarn dev
```

### Common Issues

1. **OpenAI API Key Missing**

    ```
    Error: OpenAI API key not provided
    Solution: Add OPENAI_API_KEY to .env file
    ```

2. **Port Already in Use**

    ```
    Error: Port 3010 already in use
    Solution: Change PORT in .env or kill existing process
    ```

3. **TypeScript Errors**
    ```
    Solution: Run yarn build to check for compilation errors
    ```

## 🔄 Integration with Existing Apps

This app demonstrates how to integrate Sashi into existing applications:

### Express.js Integration

```typescript
import { createMiddleware } from "@sashimo/lib"
import "./services/user_service" // Register your functions

app.use(
    "/admin",
    createMiddleware({
        openAIKey: process.env.OPENAI_API_KEY,
        // ... other options
    })
)
```

### Authentication Integration

```typescript
const verifyAuth = (req, res, next) => {
    // Your auth logic
    req.user = getUserFromToken(req.headers.authorization)
    next()
}

app.use(
    "/admin",
    verifyAuth,
    createMiddleware({
        getSession: (req) => req.user.id,
        // ... other options
    })
)
```

## 📚 Additional Resources

- [Sashi Documentation](https://docs.usesashi.com)
- [AI Function Reference](../packages/sashi-lib/README.md)
- [UI Components](../packages/sashi-ui/README.md)
- [CLI Usage](../packages/sashi-cli/README.md)

## 🤝 Contributing

This integration test app helps validate:

- New feature development
- Breaking change detection
- Documentation accuracy
- Real-world usage patterns

When adding new features to Sashi packages, update this app to demonstrate the new functionality.

## 📝 License

MIT License - see root LICENSE file for details.

---

<p align="center">
  <strong>Built with ❤️ for the Sashi ecosystem</strong>
</p>
