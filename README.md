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

1. Install sashi-lib in your project:

    ```
    npm install @sashimo/lib
    ```

2. Import necessary components from sashi-lib:

    ```typescript
    import {
      AIArray,
      AIFunction,
      AIObject,
      registerFunctionIntoAI
    } from "@sashimo/lib";
    ```

3. Define AI objects and functions:

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

4. Use the Sashi UI to interact with your labeled functions using the AI interface.

## Documentation

For detailed documentation and advanced usage, visit our [documentation site](https://docs.sashi.ai).

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## License

Sashi is released under the [MIT License](LICENSE).
