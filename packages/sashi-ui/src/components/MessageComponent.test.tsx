import { parseMessageContent } from './MessageComponent';

describe('parseMessageContent', () => {
  it('should parse a message with a workflow correctly', () => {
    const messageContent = `Here's a workflow to compare CSV data with user information:

\`\`\`workflow
{
    "type": "workflow",
    "description": "Compare data from a CSV file to a user based on their user ID",
    "actions": [
        {
            "id": "getUserInfo",
            "tool": "get_user_by_id",
            "description": "Get information for the specified user using user ID",
            "parameters": {
                "userId": "userInput.userId"
            },
            "parameterMetadata": {
                "userId": {
                    "type": "number",
                    "description": "a users id",
                    "required": true
                }
            },
            "map": false
        }
    ],
    "ui": {
        "inputComponents": [
            {
                "key": "userInput.userId",
                "label": "User ID to Compare",
                "type": "number",
                "required": true
            },
            {
                "key": "userInput.csvData",
                "label": "CSV File Upload",
                "type": "string",
                "required": true
            }
        ],
        "outputComponents": [
            {
                "actionId": "getUserInfo",
                "component": "dataCard",
                "props": {}
            }
        ]
    }
}
\`\`\`

This workflow provides a form to upload a CSV file and enter a user ID, then retrieves the user info.`;

    const result = parseMessageContent(messageContent);

    // Should have 3 parts: text before, workflow, text after
    expect(result).toHaveLength(3);

    // First part should be text
    expect(result[0]).toEqual({
      type: 'text',
      content: "Here's a workflow to compare CSV data with user information:",
    });

    // Second part should be the workflow
    expect(result[1]).toEqual({
      type: 'workflow',
      content: expect.stringContaining('```workflow'),
      workflow: {
        type: 'workflow',
        description: 'Compare data from a CSV file to a user based on their user ID',
        actions: [
          {
            id: 'getUserInfo',
            tool: 'get_user_by_id',
            description: 'Get information for the specified user using user ID',
            parameters: {
              userId: 'userInput.userId',
            },
            parameterMetadata: {
              userId: {
                type: 'number',
                description: 'a users id',
                required: true,
              },
            },
            map: false,
          },
        ],
        ui: {
          inputComponents: [
            {
              key: 'userInput.userId',
              label: 'User ID to Compare',
              type: 'number',
              required: true,
            },
            {
              key: 'userInput.csvData',
              label: 'CSV File Upload',
              type: 'string',
              required: true,
            },
          ],
          outputComponents: [
            {
              actionId: 'getUserInfo',
              component: 'dataCard',
              props: {},
            },
          ],
        },
      },
    });

    // Third part should be the text after
    expect(result[2]).toEqual({
      type: 'text',
      content: expect.stringContaining('This workflow provides a form'),
    });
  });

  it('should handle workflow with comments in JSON', () => {
    const messageContent = `Here's a workflow with comments:

\`\`\`workflow
{
    "type": "workflow",
    "description": "Compare data from a CSV file to a user based on their user ID",
    "actions": [
        {
            "id": "getUserInfo",
            "tool": "get_user_by_id",
            "description": "Get information for the specified user using user ID",
            "parameters": {
                "userId": "userInput.userId"
            },
            "parameterMetadata": {
                "userId": {
                    "type": "number",
                    "description": "a users id",
                    "required": true
                }
            },
            "map": false
        }
        // Note: CSV upload and comparison logic would normally require additional backend support for file handling and processing the uploaded CSV.
        // This workflow only handles the User ID lookup part, as there's no CSV/file upload endpoint in the provided backend functions.
    ],
    "ui": {
        "inputComponents": [
            {
                "key": "userInput.userId",
                "label": "User ID to Compare",
                "type": "number",
                "required": true
            },
            {
                "key": "userInput.csvData",
                "label": "CSV File Upload",
                "type": "string",
                "required": true
            }
        ],
        "outputComponents": [
            {
                "actionId": "getUserInfo",
                "component": "dataCard",
                "props": {}
            }
            // If backend CSV processing existed, here would be result/output components for the comparison.
        ]
    }
}
\`\`\`

Note: This workflow provides a form to upload a CSV file and enter a user ID, then retrieves the user info. However, the available backend functions do NOT process CSV uploads or compare CSV data to user information. Therefore, the workflow form includes the CSV upload field for your UI requirement, but no backend CSV processing is possible with the current toolset. If you add a backend CSV comparison function in the future, it can be incorporated into the workflow.`;

    const result = parseMessageContent(messageContent);

    // Should have 3 parts: text before, workflow, text after
    expect(result).toHaveLength(3);

    // The workflow should be parsed correctly despite JSON comments
    expect(result[1].type).toBe('workflow');
    expect(result[1].workflow).toBeDefined();
    expect(result[1].workflow.type).toBe('workflow');
    expect(result[1].workflow.actions).toHaveLength(1);
    expect(result[1].workflow.actions[0].id).toBe('getUserInfo');
    expect(result[1].workflow.actions[0].tool).toBe('get_user_by_id');
  });

  it('should handle invalid JSON in workflow block', () => {
    const messageContent = `Here's an invalid workflow:

\`\`\`workflow
{
    "type": "workflow",
    "description": "Invalid workflow" // Missing comma
    "actions": [
        {
            "id": "getUserInfo",
            "tool": "get_user_by_id",
            "parameters": {
                "userId": "userInput.userId"
            }
        }
    ]
}
\`\`\`

This should be treated as text.`;

    const result = parseMessageContent(messageContent);

    // Should have 3 parts, but the workflow part should be treated as text due to invalid JSON
    expect(result).toHaveLength(3);

    // Check that the middle part is correctly identified as text
    const workflowPart = result[1];
    expect(workflowPart).toBeDefined();
    expect(workflowPart.type).toBe('text');
    expect(workflowPart.content).toContain('```workflow');
  });

  it('should handle message with no workflow', () => {
    const messageContent = 'This is a simple text message with no workflow.';

    const result = parseMessageContent(messageContent);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'text',
      content: 'This is a simple text message with no workflow.',
    });
  });

  it('should handle multiple workflows in one message', () => {
    const messageContent = `First workflow:

\`\`\`workflow
{
    "type": "workflow",
    "description": "First workflow",
    "actions": [
        {
            "id": "action1",
            "tool": "get_user_by_id",
            "parameters": {
                "userId": "userInput.userId"
            }
        }
    ],
    "ui": {
        "inputComponents": [
            {
                "key": "userInput.userId",
                "label": "User ID",
                "type": "number",
                "required": true
            }
        ],
        "outputComponents": []
    }
}
\`\`\`

Second workflow:

\`\`\`workflow
{
    "type": "workflow",
    "description": "Second workflow",
    "actions": [
        {
            "id": "action2",
            "tool": "send_email",
            "parameters": {
                "email": "userInput.email"
            }
        }
    ],
    "ui": {
        "inputComponents": [
            {
                "key": "userInput.email",
                "label": "Email",
                "type": "string",
                "required": true
            }
        ],
        "outputComponents": []
    }
}
\`\`\`

End of message.`;

    const result = parseMessageContent(messageContent);

    // Should have 5 parts: text, workflow1, text, workflow2, text
    expect(result).toHaveLength(5);
    expect(result[0].type).toBe('text');
    expect(result[1].type).toBe('workflow');
    expect(result[2].type).toBe('text');
    expect(result[3].type).toBe('workflow');
    expect(result[4].type).toBe('text');

    // Check first workflow
    expect(result[1].workflow.description).toBe('First workflow');
    expect(result[1].workflow.actions[0].id).toBe('action1');

    // Check second workflow
    expect(result[3].workflow.description).toBe('Second workflow');
    expect(result[3].workflow.actions[0].id).toBe('action2');
  });

  it('should validate workflow structure correctly', () => {
    const messageContent = `Valid workflow:

\`\`\`workflow
{
    "type": "workflow",
    "description": "Compare data from a CSV file to a user based on their user ID",
    "actions": [
        {
            "id": "getUserInfo",
            "tool": "get_user_by_id",
            "description": "Get information for the specified user using user ID",
            "parameters": {
                "userId": "userInput.userId"
            },
            "parameterMetadata": {
                "userId": {
                    "type": "number",
                    "description": "a users id",
                    "required": true
                }
            },
            "map": false
        }
    ],
    "ui": {
        "inputComponents": [
            {
                "key": "userInput.userId",
                "label": "User ID to Compare",
                "type": "number",
                "required": true
            },
            {
                "key": "userInput.csvData",
                "label": "CSV File Upload",
                "type": "string",
                "required": true
            }
        ],
        "outputComponents": [
            {
                "actionId": "getUserInfo",
                "component": "dataCard",
                "props": {}
            }
        ]
    }
}
\`\`\``;

    const result = parseMessageContent(messageContent);

    expect(result).toHaveLength(2); // text + workflow
    expect(result[1].type).toBe('workflow');

    const workflowPart = result[1];

    if (workflowPart.workflow) {
      const workflow = workflowPart.workflow;

      // Validate workflow structure
      expect(workflow.type).toBe('workflow');
      expect(workflow.description).toBe('Compare data from a CSV file to a user based on their user ID');
      expect(Array.isArray(workflow.actions)).toBe(true);
      expect(workflow.actions).toHaveLength(1);

      // Validate action structure
      const action = workflow.actions[0];
      expect(action.id).toBe('getUserInfo');
      expect(action.tool).toBe('get_user_by_id');
      expect(action.description).toBe('Get information for the specified user using user ID');
      expect(action.parameters.userId).toBe('userInput.userId');
      expect(action.parameterMetadata.userId.type).toBe('number');
      expect(action.parameterMetadata.userId.required).toBe(true);
      expect(action.map).toBe(false);

      // Validate UI structure
      expect(workflow.ui.inputComponents).toHaveLength(2);
      expect(workflow.ui.outputComponents).toHaveLength(1);

      // Validate input components
      const userIdInput = workflow.ui.inputComponents.find((c: any) => c.key === 'userInput.userId');
      expect(userIdInput).toBeDefined();
      expect(userIdInput.label).toBe('User ID to Compare');
      expect(userIdInput.type).toBe('number');
      expect(userIdInput.required).toBe(true);

      const csvInput = workflow.ui.inputComponents.find((c: any) => c.key === 'userInput.csvData');
      expect(csvInput).toBeDefined();
      expect(csvInput.label).toBe('CSV File Upload');
      expect(csvInput.type).toBe('string');
      expect(csvInput.required).toBe(true);

      // Validate output components
      const outputComponent = workflow.ui.outputComponents[0];
      expect(outputComponent.actionId).toBe('getUserInfo');
      expect(outputComponent.component).toBe('dataCard');
      expect(outputComponent.props).toEqual({});
    }
  });
});
