
export const HEADER_API_TOKEN = 'x-api-token';
export const HEADER_REPO_TOKEN = 'x-repo-token';
export const HEADER_SESSION_TOKEN = 'x-sashi-session-token';

export const OUTPUT_TYPE_RULES = {
    badge: {
        type: 'badge',
        useWhen: 'Simple key-value pairs with 3 or fewer items',
        example: '{ status: "active", type: "user" }'
    },
    card: {
        type: 'card',
        useWhen: 'Single object with multiple fields',
        example: '{ id: 1, name: "John", email: "john@example.com", role: "admin" }'
    },
    table: {
        type: 'table',
        useWhen: 'Arrays of objects or tabular data',
        example: '[{ id: 1, name: "John" }, { id: 2, name: "Jane" }]'
    },
    textarea: {
        type: 'textarea',
        useWhen: 'Large text content or complex JSON structures',
        example: 'Long text or nested JSON objects'
    },
    text: {
        type: 'text',
        useWhen: 'Simple string output',
        example: '"Operation completed successfully"'
    }
} as const;
