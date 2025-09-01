# 🌟 Sashi - Your Magical AI-Powered Admin Companion! 🤖

<h3 align="center" style="color: rgb(12, 80, 255);">Transforming admin tasks into a delightful experience! ✨</h3>

## 🚀 Welcome to the Enchanted World of Sashi

Sashi is the core TypeScript/JavaScript library that powers the Sashi workflow system. It runs inside your app or service and transforms complex admin tasks into simple conversations. With its AI-powered interface, you can perform admin tasks with the ease of a magical spell. 🪄

## ✨ Core Features

- 🔹 **Function Registration Interface**: Declaratively expose your backend functions
- 🔹 **Workflow Execution Runtime**: Run complex workflows with simple commands
- 🔹 **UI Metadata Hooks**: Auto-generate beautiful interfaces
- 🔹 **SashiHub Integration**: Connect with the external SashiHub API
- 🔹 **AI-Powered Chat**: Execute admin tasks with natural language
- 🔹 **Secure & Reliable**: Built-in support for sensitive function confirmation

## 🧩 Core Responsibilities

### 1. Function Registration

- Provides a `registerFunction()` API to declare named functions, their parameters, and return types
- Supports:
    - Zod-based parameter schemas
    - Sync and async functions
    - Visualization functions (with metadata)
    - Repository-scoped functions

### 2. Function Metadata

Functions are registered with:

- Name/ID
- Description (used for AI prompt/context)
- Input parameter schema (Zod)
- Return value type (for UI rendering)
- Optional visibility/config flags (e.g., hidden, inactive)
- Automatically generates metadata used by the AI layer and/or workflow editor

### 3. Workflow Execution

- Accepts a serialized workflow object (steps + parameters) and executes them in sequence
- Handles:
    - Parameter chaining
    - Type conversion
    - Error catching and reporting
    - Array mapping ([*] style execution)
    - Optionally runs in debug mode for step-by-step inspection

### 4. UI Metadata & Type Hints

- Includes utility to infer UI types from data (e.g., table, badge, graph)
- Used by the LLM and front-end UI generator to create input/output forms

### 5. Communication with SashiHub (sashihub)

- Sends workflow save/load requests to sashihub via authenticated API calls
- Relies on the developer to provide an x-api-token
- Supports repository metadata sync via forward-call or metadata endpoints

## 🔒 Assumptions and Boundaries

- sashilib is frontend-safe if used in limited exposure contexts
- It does not persist workflows itself — all workflow state lives in sashihub
- It does not handle user auth or rate limiting — this is up to the surrounding app or sashihub

## 🛠️ Use Cases

- Register custom backend logic to be used in workflows
- Create a shared interface for internal tools or ops automation
- Power AI-driven workflows with securely validated parameters
- Chain local and remote function calls in one workflow

## 📦 Installation

```bash
npm install @sashimo/lib
```

> **Important**: This library requires `zod` version 3.25.67 or lower. Installing with a higher version may cause compatibility issues.

## 🔧 Basic Usage

```typescript
import { createMiddleware, AIFunction } from "@usesashi/sashi-lib"

// Create a function
const getUsers = new AIFunction("get_users", "Get all users")
    .args()
    .returns({
        name: "users",
        type: "array",
        description: "Array of user objects",
    })
    .implement(async () => {
        return [
            { email: "user1@example.com", name: "User 1" },
            { email: "user2@example.com", name: "User 2" },
        ]
    })

// Create middleware
const router = createMiddleware({
    openAIKey: process.env.OPENAI_API_KEY,
    sashiServerUrl: "https://your-server.com",
    apiSecretKey: "your-secret-key",
})

// Use in Express app
app.use(router)
```

## 🏷️ Advanced Examples

### Basic Example

```typescript
import {
    AIArray,
    AIFunction,
    AIObject,
    registerFunctionIntoAI,
} from "@sashimo/lib"

const UserObject = new AIObject("User", "a user in the system", true).field({
    name: "email",
    description: "the email of the user",
    type: "string",
    required: true,
})

const GetUserByIdFunction = new AIFunction("get_user_by_id", "get a user by id")
    .args({
        name: "userId",
        description: "a user's id",
        type: "number",
        required: true,
    })
    .returns(UserObject)
    .implement(async (userId: number) => {
        const user = await getUserById(userId)
        return user
    })

registerFunctionIntoAI("get_user_by_id", GetUserByIdFunction)
```

### Advanced Example: Handling Multiple Objects

```typescript
const ProductObject = new AIObject(
    "Product",
    "a product in the inventory",
    true
)
    .field({
        name: "productId",
        description: "the unique identifier for a product",
        type: "number",
        required: true,
    })
    .field({
        name: "productName",
        description: "the name of the product",
        type: "string",
        required: true,
    })

const GetProductsFunction = new AIFunction(
    "get_products",
    "retrieve a list of products"
)
    .returns(new AIArray(ProductObject))
    .implement(async () => {
        const products = await getAllProducts()
        return products
    })

registerFunctionIntoAI("get_products", GetProductsFunction)
```

### Example: Using Enums

```typescript
import { AIFieldEnum, AIFunction, registerFunctionIntoAI } from "@sashimo/lib"

// Create a function that changes a user's role using an enum
const ChangeUserRoleFunction = new AIFunction(
    "change_user_type",
    "change a user type"
)
    .args(
        {
            name: "userId",
            description: "a users id",
            type: "string",
            required: true,
        },
        new AIFieldEnum(
            "type",
            "the type to change the user to",
            ["CASE_MANAGER", "COMMUNITY_ENGAGEMENT"],
            true
        )
    )
    .returns({
        name: "userid",
        description: "the user id",
        type: "string",
    })
    .implement(async (userId: string, role: string) => {
        // Implementation to change the user's role
        console.log("Changing role for user", userId, "to", role)
        return userId
    })

registerFunctionIntoAI("change_user_type", ChangeUserRoleFunction)
```

This example shows how to:

- Use `AIFieldEnum` to create a dropdown selector in the UI
- Define allowed values for the enum parameter
- Handle enum validation automatically
- Provide clear descriptions for the UI and AI

## 🛡️ Security

Protect your magical realm with robust security:

```typescript
import { Request, Response, NextFunction } from "express"
import { createMiddleware } from "@sashimo/lib"

const verifySessionMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const sessionToken = req.headers["x-sashi-session-token"]

    if (!sessionToken) {
        return res.status(401).send("Unauthorized")
    }

    if (sessionToken !== "userone-session-token") {
        return res.status(401).send("Unauthorized")
    }

    next()
}

app.use(
    "/sashi",
    verifySessionMiddleware,
    createMiddleware({
        openAIKey: process.env.OPENAI_API_KEY || "",
        getSession: async (req, res) => {
            return "userone-session-token"
        },
    })
)
```

## 🔍 API Reference

### Middleware Options

```typescript
interface MiddlewareOptions {
    openAIKey: string
    sashiServerUrl?: string // where the sashi server is hosted if you can't find it automatically
    apiSecretKey?: string // used to validate requests from and to the hub
    addStdLib?: boolean // add the standard library to the hub
    langFuseInfo?: {
        publicKey: string
        secretKey: string
        baseUrl: string
    }
    getSession?: (req: Request, res: Response) => Promise<string> // function to get the session id for a request
}
```

## 📚 Documentation

For more spells and incantations, visit our [Sashi documentation](https://docs.sashi.ai).

## 🤝 Join the Sashi Fellowship

Are you ready to make admin tasks a breeze? Join us on this magical journey! Check out our [Contributing Guide](https://github.com/sashimo/sashi/blob/main/CONTRIBUTING.md).

## ⚖️ License

Sashi is released under the [MIT License](https://github.com/sashimo/sashi/blob/main/LICENSE).

## 🔄 Workflow System

This update introduces a powerful workflow system that enables users to create automated sequences of your registered functions.

### 📊 How Workflows Work

Once you register your functions with Sashi, they automatically become available for use in workflows. Users can then:

1. **Create sequences of actions** using your registered functions
2. **Pass data between steps** - Output from one function becomes input to another
3. **Save and reuse workflows** for common tasks
4. **Execute workflows** with a single click instead of multiple manual steps

```mermaid
graph TD
    A[Register Functions] --> B[Functions Available in Workflow System]
    B --> C[Users Create Workflows]
    C --> D[Workflows Executed When Needed]
    D --> E[Results Displayed to User]

    A1[Developer] --> A
    C1[End User] --> C

    style A fill:#a4c2f4
    style B fill:#b6d7a8
    style C fill:#f9d77e
    style D fill:#d5a6bd
    style E fill:#ea9999
    style A1,C1 fill:#d9d9d9
```

### 🔗 Function Integration in Workflows

Your registered functions become building blocks that users can connect together:

```mermaid
graph LR
    A[Function: Get Users] --> B[Function: Filter Active Users]
    B --> C[Function: Send Notification]

    A1[Output: User List] --> B1[Input: Users]
    B2[Output: Filtered Users] --> C1[Input: Recipients]

    style A,B,C fill:#a4c2f4
    style A1,B1,B2,C1 fill:#d5a6bd
```

### 🌐 Data Flow Between Systems

The workflow system handles all the data flow between your registered functions and external systems without you needing to implement any additional code:

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Sashi as Sashi System
    participant User as User
    participant Ext as External Services

    Dev->>Sashi: Register functions
    User->>Sashi: Create workflows using functions
    User->>Sashi: Execute workflow
    Sashi->>Ext: Call external APIs if needed
    Ext-->>Sashi: Return results
    Sashi->>Sashi: Process data between steps
    Sashi-->>User: Display final results
```

### 📝 What You Need To Do

As a developer, you only need to:

1. **Register your functions** using the AIFunction system (as shown in previous examples)
2. **Ensure proper input/output typing** so the workflow system knows what data can be passed between steps
3. **Document your functions well** so users understand what each function does

The workflow storage, execution, and visualization are all handled automatically by the Sashi system.

For more information on how users can use the workflows you enable, direct them to our [Workflow Documentation](https://docs.sashi.ai/workflows).

## Default Functions

Sashi includes a set of built-in utility functions that are hidden from the UI by default but always available for AI processing. These functions are automatically included in the tools schema and split into multiple messages if they exceed 8000 characters to prevent token limits.

### Automatic Loading

Default functions are automatically available to the AI without any manual loading:

```typescript
import express from "express"
import { createMiddleware } from "@sashimo/lib"

const app = express()

app.use(
    "/sashi",
    createMiddleware({
        openAIKey: process.env.OPENAI_API_KEY || "",
        // Default functions are automatically available to AI
        // but hidden from the UI dropdown
    })
)
```

### Manual Loading (Optional)

If you want to load specific categories of default functions, you can still do so:

```typescript
import express from "express"
import { createMiddleware, loadDefaultFunctionsOnDemand } from "@sashimo/lib"

const app = express()

// Load specific categories (optional - they're available anyway)
loadDefaultFunctionsOnDemand(["math", "text"])

app.use(
    "/sashi",
    createMiddleware({
        openAIKey: process.env.OPENAI_API_KEY || "",
    })
)
```

### Available Categories

- `math` - Basic math operations (add, subtract, multiply, divide, round)
- `data` - Data manipulation (extract, replace, split, join, filter)
- `datetime` - Date and time operations (format_date, add_days)
- `system` - System utilities (get_current_time, generate_uuid)
- `text` - Text processing (to_uppercase, to_lowercase, trim)

### How It Works

1. **Always Available**: Default functions are always included in the tools schema sent to the AI
2. **Smart Splitting**: If the schema exceeds 8000 characters, it's automatically split into multiple system messages
3. **UI Hidden**: Functions don't appear in the UI dropdown to keep it clean
4. **Full Access**: AI can use all default functions in workflows and processing

### Making Functions Visible

If you want to make specific default functions visible in the UI, you can create custom wrapper functions:

```typescript
import { AIFunction, registerFunctionIntoAI } from "@sashimo/lib"

// Create a visible wrapper for a hidden function
const VisibleAddFunction = new AIFunction(
    "add_numbers",
    "add two or more numbers together"
)
    .args({
        name: "numbers",
        description: "array of numbers to add together",
        type: "array",
        required: true,
    })
    .returns({
        name: "result",
        description: "the sum of the numbers",
        type: "number",
    })
    .implement(async (numbers: number[]) => {
        // Call the hidden function
        const result = await callFunctionFromRegistry("add", numbers)
        return result.result
    })

registerFunctionIntoAI("add_numbers", VisibleAddFunction)
```

---

<p align="center" style="color: rgb(12, 80, 255);">
  Crafted with 💖 by the Sashimotors
</p>
