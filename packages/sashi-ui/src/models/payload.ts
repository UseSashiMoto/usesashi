export interface ResultTool {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
  confirmed?: boolean;
}

export interface PayloadObject {
  tools?: ResultTool[];
  inquiry?: string;
  previous: any;
  type: string;
}

export interface GeneralResponse {
  type: 'general'
  content: string
}

export interface WorkflowResponse {
  type: 'workflow'
  actions: {
    id: string
    tool: string
    description: string
    parameters: Record<string, any>
  }[]
  options: {
    execute_immediately: boolean
    generate_ui: boolean
  }
}

export interface WorkflowUIElement {
  type: string;
  actionId: string;
  tool: string;
  content: {
    type: string;
    title: string;
    content: string;
    timestamp: string;
  };
}

export interface WorkflowResult {
  actionId: string;
  result: Record<string, any>;
  uiElement: WorkflowUIElement;
}

export type WorkflowEntryType = 'form' | 'button' | 'auto_update';

export interface UIWorkflowDefinition {
  workflow: WorkflowResponse;
  entry: WorkflowEntryMetadata;
  outputUI?: {
    layout?: 'card' | 'table' | 'badge';
    config?: Record<string, any>; // Optional: charts, colors, etc.
  };
}


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
