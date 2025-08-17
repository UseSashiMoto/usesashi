# Creating Workflows with Sashi's AI Chat Bot

This guide explains how to create and manage workflows using Sashi's AI-powered chat interface instead of writing code.

## What are Workflows?

Workflows are sequences of actions that can be executed automatically. With Sashi, you can create workflows by simply having a conversation with the AI assistant.

## Creating a Workflow Through Chat

1. **Start a conversation** with Sashi by opening the chat interface at `/sashi/bot`

2. **Ask Sashi to create a workflow** using natural language. For example:

    ```
    "I want to create a workflow that gets all users, filters for active ones, and sends them a notification"
    ```

3. **Specify details** when Sashi asks follow-up questions about parameters, conditions, or other specifics

4. **Review the workflow** when Sashi presents it to you

5. **Save the workflow** by confirming when Sashi asks if you want to save it

## Example Conversation

```
You: I want to create a workflow to send notifications to active users

Sashi: I can help you create that workflow. Let me break this down into steps:

1. Get all users from the system
2. Filter for just the active users
3. Send notifications to those users

What message would you like to send in the notification?

You: Please update your profile information

Sashi: Thanks! I'll use "Please update your profile information" as the message.

Here's the workflow I've created:
[Workflow visualization appears]

Would you like to save this workflow?

You: Yes, please name it "Profile Update Reminder"

Sashi: Great! I've saved the "Profile Update Reminder" workflow. You can run it anytime from the workflows section or by asking me to run it.
```

## Running Your Workflows

Once created, you can:

1. **Execute a workflow** by asking Sashi:

    ```
    "Run the Profile Update Reminder workflow"
    ```

2. **View your workflows** in the workflow UI or by asking:

    ```
    "Show me my workflows"
    ```

3. **Modify an existing workflow** by asking:

    ```
    "Update the Profile Update Reminder workflow to change the message"
    ```

4. **Delete a workflow** by asking:
    ```
    "Delete the Profile Update Reminder workflow"
    ```

## Tips for Creating Effective Workflows

-   **Be specific** about what you want each step to accomplish
-   **Start simple** and build more complex workflows as you get comfortable
-   **Use descriptive names** for your workflows so they're easy to reference later
-   **Test your workflows** with small data sets before using them on production data

## Need Help?

Just ask Sashi! You can say:

```
"Help me create a workflow"
```

or

```
"What can I do with workflows?"
```

Sashi will guide you through the process and answer any questions you have about creating and managing workflows.
