/**
 * Knowledge Base for Workflow Planner Agent
 * 
 * Contains detailed documentation that can be loaded on-demand to reduce
 * base prompt token usage while keeping comprehensive guidance available.
 */

export const WORKFLOW_PLANNER_KNOWLEDGE = {
    "parameterMetadata-guide": `
## Parameter Metadata Creation Guide

### What is parameterMetadata?
parameterMetadata tells the workflow execution system how to validate and type-coerce parameters when running workflows. It MUST match the function's AIFunction schema exactly.

### Critical Rules:
1. **Must match function schema exactly**: If a function defines a parameter as "enum" with values ["admin", "user"], your parameterMetadata MUST have the same type and enum values
2. **Copy from tool schema**: The tool schema shows you the exact parameter definitions - copy the type, description, enum values, and required status exactly
3. **Don't invent types**: Only use types that exist in the tool schema: string, number, boolean, enum, array, object
4. **Preserve enum values**: If the tool schema shows enum: ["option1", "option2"], your parameterMetadata must have exactly those values (same order, same spelling)
5. **Match required status**: If the tool schema marks a parameter as required, your parameterMetadata must also mark it as required

### Why This Matters:
- The backend validates parameters using the AIFunction schema
- Type coercion happens based on parameterMetadata (strings → numbers, "true" → boolean)
- Enum validation checks that values match the allowed options exactly
- UI components are generated from parameterMetadata to ensure correct input types
- Incorrect parameterMetadata causes validation failures at execution time

### Type Mapping: Tool Schema → Your Metadata

**String Parameter:**
Tool Schema: {"type": "string", "description": "User email"}
Your Metadata: {"type": "string", "description": "User email", "required": true}

**Number Parameter:**
Tool Schema: {"type": "number", "description": "User age"}
Your Metadata: {"type": "number", "description": "User age", "required": true}

**Boolean Parameter:**
Tool Schema: {"type": "boolean", "description": "Is active"}
Your Metadata: {"type": "boolean", "description": "Is active", "required": false}

**Enum Parameter (IMPORTANT):**
Tool Schema: {"type": "string", "enum": ["admin", "user", "editor"], "description": "User role"}
Your Metadata: {"type": "enum", "enum": ["admin", "user", "editor"], "description": "User role", "required": true}

⚠️ NOTE: When tool schema shows "string" with an "enum" property, you MUST use type "enum" in your metadata!

### Complete Working Example

**Tool Schema Shows:**
\`\`\`json
{
    "type": "function",
    "function": {
        "name": "send_email",
        "parameters": {
            "type": "object",
            "properties": {
                "email": {
                    "type": "string",
                    "description": "Email address of recipient"
                },
                "subject": {
                    "type": "string",
                    "description": "Email subject line"
                },
                "priority": {
                    "type": "string",
                    "description": "Priority level",
                    "enum": ["high", "normal", "low"]
                }
            },
            "required": ["email", "subject"]
        }
    }
}
\`\`\`

**Your Workflow Action:**
\`\`\`json
{
    "id": "send_notification",
    "tool": "send_email",
    "parameters": {
        "email": "userInput.recipientEmail",
        "subject": "userInput.emailSubject",
        "priority": "userInput.priority"
    },
    "parameterMetadata": {
        "email": {
            "type": "string",
            "description": "Email address of recipient",
            "required": true
        },
        "subject": {
            "type": "string",
            "description": "Email subject line",
            "required": true
        },
        "priority": {
            "type": "enum",
            "enum": ["high", "normal", "low"],
            "description": "Priority level",
            "required": false
        }
    }
}
\`\`\`

### Common Mistakes to Avoid:

❌ **WRONG**: Inventing your own enum values
\`\`\`json
"priority": {"type": "enum", "enum": ["urgent", "normal", "low"]}  // "urgent" not in schema!
\`\`\`

❌ **WRONG**: Using "string" type when schema has enum
\`\`\`json
"priority": {"type": "string"}  // Should be "enum" with values!
\`\`\`

❌ **WRONG**: Missing required field
\`\`\`json
"email": {"type": "string", "description": "...", "required": false}  // Should be true!
\`\`\`

✅ **CORRECT**: Exact copy from schema
\`\`\`json
"priority": {"type": "enum", "enum": ["high", "normal", "low"], "required": false}
\`\`\`

### Quick Checklist:
□ Found parameter in tool schema
□ Copied type exactly (watch for string+enum → enum)
□ Copied description exactly
□ Copied enum values exactly (if applicable)
□ Copied required status exactly
□ Added to parameterMetadata object in action
`,

    "aifunction-architecture": `
## AIFunction Architecture

### How Backend Functions Work
All backend functions in the system are defined using the AIFunction class and stored in a function registry. Understanding this architecture helps you create correct workflows.

**Function Registry Components:**
1. **Name**: The exact function name you must use in your workflow's "tool" field
2. **Description**: What the function does (helps you choose the right function)
3. **Parameters**: Defined using AIField types - each parameter has a specific type, description, and requirement status
4. **Parameter Types**: string, number, boolean, array, object, enum (with specific allowed values)
5. **Required vs Optional**: Parameters marked as required=true MUST be provided, optional ones can be omitted
6. **Implementation**: The actual code that executes when the function is called

### Parameter Definition System
Functions use strongly-typed parameter definitions through AIField classes:

**AIField<'string'>**: String parameter
- Used for: text, IDs, messages, emails, names
- Example: userName, emailAddress, description

**AIField<'number'>**: Numeric parameter
- Used for: counts, amounts, IDs, quantities
- Example: userId, age, quantity, price
- Note: Strings are automatically coerced to numbers if valid

**AIField<'boolean'>**: Boolean parameter
- Used for: flags, toggles, yes/no questions
- Example: isActive, includeDeleted, sendNotification
- Note: Strings "true"/"false" are automatically coerced

**AIFieldEnum**: Enumerated values parameter
- Used for: fixed set of options (roles, statuses, types)
- Example: role with values ["admin", "user", "editor"]
- Note: Must match one of the allowed values EXACTLY (no fuzzy matching)

**AIArray**: Array parameter
- Used for: lists, collections, multiple items
- Example: userIds, emailAddresses, items

**AIObject**: Complex object parameter
- Used for: structured data with multiple fields
- Example: userProfile, configuration, metadata

### Type Coercion and Validation
The AIFunction system automatically handles type conversions:

**String to Number:**
- Input: "123" → Output: 123
- Invalid: "abc" → Error: "Invalid number"

**String to Boolean:**
- Input: "true" → Output: true
- Input: "false" → Output: false
- Invalid: "yes" → Error: "Invalid boolean"

**Enum Validation:**
- Function defines: ["admin", "user", "editor"]
- Input: "admin" → ✅ Valid
- Input: "Admin" → ❌ Invalid (case sensitive!)
- Input: "moderator" → ❌ Invalid (not in list)

### Function Executability
Workflows can only execute if ALL referenced functions exist in the registry:

**"Ready" Status:**
- All functions referenced in workflow are registered
- All required parameters can be satisfied
- Workflow can be executed immediately

**"Disabled" Status:**
- One or more functions are missing from the registry
- Functions may be from unregistered repositories
- Workflow cannot be executed until functions are available

### Why Functions Might Be Missing:
- Function is defined in a repository that hasn't been connected
- Function was removed or renamed
- Function requires dependencies that aren't installed
- Function is part of a premium feature not activated

### Validation Process:
When a workflow executes:
1. **Function Lookup**: Find function in registry by name
2. **Parameter Extraction**: Get parameter values from workflow
3. **Type Coercion**: Convert parameter types as needed
4. **Validation**: Check types, required fields, enum values
5. **Execution**: Call function implementation with validated parameters
6. **Result Return**: Return result in format defined by function

### Best Practices:
- Always use list_available_tools to verify function exists before using
- Never invent function names - only use registered functions
- Check parameterMetadata matches function schema exactly
- Understand that enum values are case-sensitive and must match exactly
- Remember optional parameters can be omitted entirely
`,

    "workflow-best-practices": `
## Workflow Creation Best Practices

### Decision Framework: When to Ask vs Create

**ALWAYS Ask Questions First When:**
- User request is vague or ambiguous
- Multiple ways to accomplish the goal (need user preference)
- Missing critical information (which fields? what format? what conditions?)
- Want to confirm your understanding is correct
- Could create a better workflow with more context
- Confused about function parameters or return types
- Unclear about function behavior after checking tools
- Multiple tools could accomplish the goal

**Example Question Formats:**

**Asking for specifics:**
"I'd be happy to help! To create the right workflow, I need to know:
- **Which specific data fields** do you want to include? (e.g., name, email, role, created date)
This helps me build exactly what you need."

**Presenting options:**
"I can create this workflow in a few ways:
1. **Option A**: Fetch all users and display in a table
2. **Option B**: Filter by specific criteria first
3. **Option C**: Export to CSV format
Which approach works best for you?"

**Confirming understanding:**
"Just to confirm I understand correctly:
You want to [describe what you think they need], right?
Let me know if I'm on the right track!"

### Parameter Strategy

**Use userInput.field When:**
- Information cannot be derived from function calls
- Data must come from the user (IDs, text content, preferences)
- It's the "starting point" of the workflow
- User needs to provide context-specific values
- Can be used in both direct parameters and inside _generate prompts

**Use actionId.field When:**
- Data can be retrieved from previous function calls
- Information exists in the system and can be fetched
- You're chaining actions together
- Can be used in both direct parameters and inside _generate prompts

**Use Literal Values When:**
- Value is fixed and known
- User specified exact value in request ("Send email to user 123")
- Using constants or configuration values

**Examples:**
- "Send email to user 123" → Use literal "123", not userInput
- "Send email to a user" → Use "userInput.userId" because we don't know which user
- "Send custom message" → Use "userInput.message" for the message content
- "Get user email then send email" → Use "userInput.userId" for first function, then "get_user.email" for second
- "Query database with user's question" → Use "_generate" with "userInput.query" placeholder

### When to Use _generate

**Use _generate When:**
- You need to generate SQL queries for database operations
- Parameter values require complex formatting or logic
- The exact value isn't known until runtime
- User's natural language needs to be converted to structured format
- You need to compose text from multiple dynamic sources

**Available Contexts:**
- "sql": For generating SQL queries (PostgreSQL syntax)
- "markdown": For markdown formatting
- "json": For generating or transforming to valid JSON format
- "general": For any other generation (defaults to markdown output)

**Example:**
\`\`\`json
{
    "parameters": {
        "sql": {
            "_generate": "SQL query to select users where role='admin' and isActive=true",
            "_context": "sql"
        }
    }
}
\`\`\`

### When to Use _transform

**Use _transform When:**
- User requests specific output formatting
- Results need to be presented as markdown
- Data needs summarization or restructuring
- Output requires human-friendly formatting
- Functions return stringified JSON that needs parsing

**Example:**
\`\`\`json
{
    "_transform": {
        "_transform": "Format this user data as a markdown table with name, email, and role columns",
        "_context": "markdown"
    }
}
\`\`\`

### Tool Verification Strategy

**BEFORE Creating a Workflow:**
1. **Verify tools exist**: If unsure about a tool name, use list_available_tools to search
   - Example: User mentions "SQL" → search with searchTerm "sql" or "query"
   - NEVER make up tool names like "nl_to_sql", "convert_text" - these likely don't exist
   
2. **Find alternatives**: If a tool doesn't exist, search for similar tools
   - Example: No "nl_to_sql" → Use "execute_query" with _generate instead

3. **Validate the workflow**: ALWAYS call validate_workflow before providing to user
   - If validation fails with "Unknown tool" error, the tool doesn't exist
   - Fix errors and validate again
   - Never return an unvalidated workflow

### Chaining Actions Effectively

**Simple Chain (Sequential):**
\`\`\`json
{
    "actions": [
        {
            "id": "get_user",
            "tool": "get_user_by_id",
            "parameters": {"userId": "userInput.userId"}
        },
        {
            "id": "send_email",
            "tool": "send_email",
            "parameters": {
                "email": "get_user.email",
                "subject": "Hello",
                "message": "userInput.message"
            }
        }
    ]
}
\`\`\`

**Parallel Processing (Array with map):**
\`\`\`json
{
    "actions": [
        {
            "id": "send_bulk_emails",
            "tool": "send_email",
            "parameters": {
                "email": "userInput.csvData[*].email",
                "subject": "userInput.subject"
            },
            "map": true
        }
    ]
}
\`\`\`

### Error Handling and Validation

**Validation Checklist Before Returning:**
□ All tools exist (verified with list_available_tools if needed)
□ parameterMetadata matches tool schema exactly
□ All userInput.* parameters have UI components
□ Enum values preserved exactly from schema
□ Required parameters are marked correctly
□ Called validate_workflow and fixed any errors
□ Output components match data structure (table vs dataCard)

### Output Format Requirements

**Critical Rules:**
- Wrap workflow JSON in \`\`\`workflow code block (not \`\`\`json)
- NEVER put comments in the workflow JSON
- Include BOTH actions and UI components
- Ensure complete and valid JSON structure
- Match example format exactly

**Always Use:**
\`\`\`workflow
{
    "type": "workflow",
    "description": "...",
    "actions": [...],
    "ui": {...}
}
\`\`\`

**Never Use:**
- Raw JSON without code block
- \`\`\`json wrapper (must be \`\`\`workflow)
- Escaped JSON strings (\\n, \\", etc.)
- Comments in JSON (// or /* */)
`,

    "quick-reference": `
## Quick Reference Cheat Sheet

### Parameter Metadata Type Mapping
Tool Schema → Your parameterMetadata:
- "string" → "string"
- "number" → "number"
- "boolean" → "boolean"
- "string" + enum:[...] → "enum" + enum:[...]  ⚠️ IMPORTANT!
- "array" → "array"
- "object" → "object"

### CSV Workflow Pattern (3 Steps)
**1. Input Component:**
{"key": "userInput.csvData", "type": "csv", "expectedColumns": ["email", "name"]}

**2. Action Parameter:**
"email": "userInput.csvData[*].email"

**3. Action Setting:**
"map": true

### Component Selection
- Single object result → "dataCard"
- Array result → "table"
- User must provide data → inputComponent required
- Show action result → outputComponent

### Parameter Reference Syntax
- userInput.fieldName → User form input (needs UI component)
- actionId.fieldName → Previous action output
- actionId[*].fieldName → Array operation on previous action
- "literal value" → Fixed value

### Validation Checklist
□ All tools exist (use list_available_tools if unsure)
□ parameterMetadata matches schema exactly
□ All userInput.* have UI components
□ Enum values preserved exactly
□ Required fields marked correctly
□ Called validate_workflow before returning
□ Wrapped in \`\`\`workflow code block

### When to Use Each Knowledge Doc
Need help with...
- **Parameter metadata** → "parameterMetadata-guide"
- **CSV workflows** → (need full CSV guide - not in this set)
- **Function system** → "aifunction-architecture"
- **Strategy/approach** → "workflow-best-practices"
- **Quick syntax** → "quick-reference" (this doc)

### Common Mistakes to Avoid
❌ Inventing tool names → ✅ Use list_available_tools first
❌ String type for enums → ✅ Use enum type with values
❌ Creating UI for array ops → ✅ Only create UI for base fields
❌ Wrong required status → ✅ Copy from schema exactly
❌ Returning unvalidated → ✅ Always call validate_workflow
❌ Using \`\`\`json wrapper → ✅ Use \`\`\`workflow wrapper

### Input Component Types Quick Reference
- string: Single-line text (IDs, names, emails)
- text: Multi-line textarea (messages, descriptions)
- number: Number input (counts, quantities)
- boolean: Switch/checkbox (flags, toggles)
- enum: Dropdown (must include enumValues array)
- csv: File upload (must include expectedColumns array)

### Action Patterns
**Simple action:**
{"id": "action1", "tool": "function_name", "parameters": {...}}

**With parameter metadata:**
{"id": "action1", "tool": "function_name", "parameters": {...}, "parameterMetadata": {...}}

**With array mapping:**
{"id": "action1", "tool": "function_name", "parameters": {...}, "map": true}

**With generation:**
{"parameters": {"field": {"_generate": "...", "_context": "sql"}}}

**With transformation:**
{"_transform": {"_transform": "...", "_context": "markdown"}}
`,
} as const;

export type KnowledgeTopic = keyof typeof WORKFLOW_PLANNER_KNOWLEDGE;

// Helper to get list of available topics
export const getAvailableTopics = (): KnowledgeTopic[] => {
    return Object.keys(WORKFLOW_PLANNER_KNOWLEDGE) as KnowledgeTopic[];
};

// Helper to validate topic exists
export const isValidTopic = (topic: string): topic is KnowledgeTopic => {
    return topic in WORKFLOW_PLANNER_KNOWLEDGE;
};

