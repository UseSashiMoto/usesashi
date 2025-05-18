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
  executionResults?: WorkflowResult[]
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
    config?: {
      chartType?: 'line' | 'bar' | 'pie' | 'area' | 'radar' | 'radial' | 'scatter';
      xAxis?: string;
      yAxis?: string;
      labels?: string[];
      colors?: string[];
      [key: string]: any;
    };
  };
}

export interface WorkflowResult {
  actionId: string;
  result: Record<string, any>;
  uiElement: WorkflowUIElement;
}

export type WorkflowEntryType = 'form' | 'button' | 'auto_update' | 'label';

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

export interface AutoUpdatePayload {
  updateInterval: string; // e.g., '10s', '30s'
}

export interface LabelPayload {
  isError?: boolean;
  message?: string;
}

export interface ButtonPayload {
  // Future button-specific properties could go here
  icon?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
}

export interface WorkflowAction {
  label: string;
  isPrimary?: boolean;
  onClick?: () => void;
}

export interface WorkflowEntryMetadata {
  entryType: WorkflowEntryType; // how the user will trigger the workflow
  description?: string; // summary of interaction (optional)
  payload?: FormPayload | AutoUpdatePayload | LabelPayload | ButtonPayload;
}

export interface UIWorkflowDefinition {
  workflow: WorkflowResponse;
  entry: WorkflowEntryMetadata;
  outputUI?: {
    layout?: 'card' | 'table' | 'badge';
    config?: Record<string, any>; // Optional: charts, colors, etc.
  };
}
