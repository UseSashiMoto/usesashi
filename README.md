# Sashi - AI-Powered Admin Tool

Sashi is an advanced admin tool that allows you to label functions in your codebase and perform admin tasks using AI.

## Components

-   **sashi-lib**: Middleware library for integrating Sashi into your codebase
-   **sashi-ui**: AI-powered frontend interface

## Features

-   Label functions in your codebase for AI access
-   Subscribe to functions from external repositories
-   AI-powered bot for executing admin tasks
-   Security option to require confirmation for sensitive functions

## Getting Started

### 1. Install sashi-lib in your project:

```
npm install @sashimo/lib
```

### 2. Set up the middleware

For server-side applications (e.g., Express.js):

```typescript
import express from 'express';
import { createMiddleware } from '@sashimo/lib';

const app = express();

// Initialize Sashi middleware
app.use('/sashi', createMiddleware({
  // Configuration options
  openAIKey: process.env.OPENAI_API_KEY || "",
}));

// Your other routes and middleware
```

### 3. Label and register functions

Import necessary components from sashi-lib:

```typescript
import {
  AIArray,
  AIFunction,
  AIObject,
  registerFunctionIntoAI
} from "@sashimo/lib";
```

Define AI objects and functions:

```typescript
const UserObject = new AIObject("User", "a user in the system", true)
  .field({
    name: "email",
    description: "the email of the user",
    type: "string",
    required: true
  })
  // ... add other fields ...

const GetUserByIdFunction = new AIFunction("get_user_by_id", "get a user by id")
  .args({
    name: "userId",
    description: "a users id",
    type: "number",
    required: true
  })
  .returns(UserObject)
  .implement(async (userId: number) => {
    const user = await getUserById(userId);
    return user;
  });

// Register the function
registerFunctionIntoAI("get_user_by_id", GetUserByIdFunction);
```

### 4. Access the Admin Chat

To interact with your labeled functions using the AI interface, follow these steps:

1. Start your server with the Sashi middleware integrated.

2. The Admin Chat interface is accessible at the route where you mounted the Sashi middleware, followed by `/bot`. For example:

    - If you mounted the middleware at the root: `http://yourwebsite.com/bot`
    - If you mounted it at a specific path: `http://yourwebsite.com/your-path/bot`

3. You can also specify a custom route using the `sashiServerUrl` option when initializing the middleware:

    ```typescript
    app.use('/control-panel', createMiddleware({
      sashiServerUrl: 'http://yourwebsite.com/control-panel',
      // other options...
    }));
    ```

    In this case, the Admin Chat would be accessible at: `http://yourwebsite.com/control-panel/bot`

4. Open a web browser and navigate to the appropriate URL based on your configuration.

5. You'll be presented with the Sashi Admin Chat interface.

6. Use natural language to interact with the AI and execute admin tasks. For example:

    - "Get user with ID 123"
    - "List all users"
    - "Update email for user with ID 456"

7. The AI will interpret your commands and execute the appropriate labeled functions.

8. For functions marked as sensitive, you'll be prompted to confirm the action before it's executed.

Note: Ensure that you have proper authentication and authorization in place to restrict access to the Admin Chat interface in production environments.

## Security

Securing access to your Sashi Admin Chat is crucial, especially in production environments. Sashi works alongside your custom middleware to ensure proper authentication and authorization.

### Session Management

Sashi uses a two-step process for session management:

1. **Custom Middleware**: You implement your own middleware to validate the session token before the Sashi middleware.
2. **getSession Function**: This function, provided to the Sashi middleware, generates a session token for new sessions.

Here's how to implement these security features:

```typescript:apps/sashi-server-one/src/index.ts
import { Request, Response, NextFunction } from 'express';
import { createMiddleware } from '@sashimo/lib';

// Custom middleware to verify the session
const verifySessionMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const sessionToken = req.headers["x-sashi-session-token"];

    if (!sessionToken) {
        return res.status(401).send("Unauthorized");
    }

    // Verify the session token
    if (sessionToken !== "userone-session-token") {
        return res.status(401).send("Unauthorized");
    }

    next();
};

// Use sashi-middleware
app.use(
    "/sashi",
    verifySessionMiddleware,
    createMiddleware({
        openAIKey: process.env.OPENAI_API_KEY || "",
        getSession: async (req, res) => {
            return "userone-session-token";
        }
    })
);
```

### Implementing Session Management

1. **Custom Verification Middleware**:

    - This middleware runs before the Sashi middleware.
    - It checks for the presence of a session token in the request headers.
    - It validates the session token according to your authentication logic.
    - If the token is invalid or missing, it returns a 401 Unauthorized response.

2. **getSession Function**:
    - This function is provided to the Sashi middleware configuration.
    - It generates or retrieves a session token for new sessions.
    - In this example, it returns a static token, but in a real-world scenario, you would generate a unique token for each session.

### Customizing the Implementation

You should adapt the `verifySessionMiddleware` and `getSession` function to fit your application's authentication system:

-   Use your database or a token service to validate and generate real session tokens.
-   Implement proper error handling and logging.
-   Consider using environment variables for sensitive values like secret keys.

## Documentation

For detailed documentation and advanced usage, visit our [documentation site](https://docs.sashi.ai).

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## License

Sashi is released under the [MIT License](LICENSE).
