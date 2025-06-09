export interface GeneralResponse {
    type: 'general'
    content: string
}

export interface WorkflowResponse {
    type: 'workflow'
    actions: {
        id: string
        description: string
        tool: string
        map?: boolean
        parameters: Record<string, any>
        parameterMetadata?: {
            [key: string]: {
                type: string
                description?: string
                enum?: string[]
                required?: boolean
            }
        }
    }[]
}

export interface WorkflowResult {
    actionId: string;
    result: Record<string, any>;
    uiElement: WorkflowUIElement;
}

export type WorkflowEntryType = 'form' | 'button';

// Type-specific payloads
export interface FormPayload {
    fields: {
        key: string;
        label?: string;
        type?: 'string' | 'number' | 'boolean' | 'date' | 'enum';
        required?: boolean;
        enumValues?: string[]; // Available options for enum type
    }[];
}

export interface WorkflowEntryMetadata {
    entryType: WorkflowEntryType; // how the user will trigger the workflow
    description?: string; // summary of interaction (optional)
    updateInterval?: string; // for auto_update only (e.g., '10s', '30s')
    payload?: FormPayload;
}

export interface UIWorkflowDefinition {
    workflow: WorkflowResponse;
    entry: WorkflowEntryMetadata;
    outputUI?: {
        layout?: 'card' | 'table' | 'badge';
        config?: Record<string, any>; // Optional: charts, colors, etc.
    };
}

export interface WorkflowUIElement {
    type: string;
    actionId: string;
    tool: string;
    content: {
        type: 'card' | 'table' | 'badge' | 'text' | 'textarea' | 'graph';
        title: string;
        content: string;
        timestamp: string;
        config?: Record<string, any>; // Configuration for visual elements like charts
    };
}