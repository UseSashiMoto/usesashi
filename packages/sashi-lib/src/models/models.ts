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
        parameters: Record<string, any>
    }[]
    options: {
        execute_immediately: boolean
        generate_ui: boolean
    }
}

export interface WorkflowResult {
    actionId: string;
    result: Record<string, any>;
    uiElement: WorkflowUIElement;
}

export type WorkflowEntryType = 'form' | 'button';

export interface WorkflowEntryMetadata {
    entryType: WorkflowEntryType; // how the user will trigger the workflow
    description?: string; // summary of interaction (optional)
    updateInterval?: string; // for auto_update only (e.g., '10s', '30s')
    fields?: {
        key: string;
        label?: string;
        type?: 'string' | 'number' | 'boolean' | 'date';
        required?: boolean;
    }[]; // Only for 'form'
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
        type: 'card' | 'table' | 'badge' | 'text' | 'graph';
        title: string;
        content: string;
        timestamp: string;
        config?: Record<string, any>; // Configuration for visual elements like charts
    };
}