/**
 * Workflow execution response types - shared across packages
 */

export interface WorkflowStepError {
  actionId: string;
  error: string;
}



export interface WorkflowResult {
  actionId: string;
  result: Record<string, any> | { value: any };
  uiElement: WorkflowUIElement;
}

export interface WorkflowExecutionSuccess {
  success: true;
  results: WorkflowResult[];
}

export interface WorkflowExecutionError {
  success: false;
  error: string;
  details: string;
  stepErrors?: WorkflowStepError[];
}

export type WorkflowExecutionResponse = WorkflowExecutionSuccess | WorkflowExecutionError;

/**
* Type guards for workflow execution responses
*/
export function isWorkflowExecutionSuccess(response: WorkflowExecutionResponse): response is WorkflowExecutionSuccess {
  return response.success === true;
}

export function isWorkflowExecutionError(response: WorkflowExecutionResponse): response is WorkflowExecutionError {
  return response.success === false;
}

/**
* Helper function to create a successful workflow execution response
*/
export function createWorkflowExecutionSuccess(results: WorkflowResult[]): WorkflowExecutionSuccess {
  return {
    success: true,
    results
  };
}

/**
* Helper function to create an error workflow execution response
*/
export function createWorkflowExecutionError(
  error: string,
  details: string,
  stepErrors?: WorkflowStepError[]
): WorkflowExecutionError {
  return {
    success: false,
    error,
    details,
    stepErrors
  };
}

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

  executionResults?: WorkflowResult[]
  ui?: WorkflowUI // New UI format for SashiAgent
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

// New UI format for SashiAgent
export interface WorkflowUIComponent {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'text';
  required: boolean;
  enumValues?: string[];
}

export interface WorkflowOutputComponent {
  actionId: string;
  component: 'table' | 'dataCard';
  props?: Record<string, any>;
}

export interface WorkflowUI {
  inputComponents: WorkflowUIComponent[];
  outputComponents: WorkflowOutputComponent[];
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

export type SavedWorkflow = {
  id: string;
  name: string;
  description?: string;
  workflow: UIWorkflowDefinition;
  timestamp: number;
  userId: string;
  favorited?: boolean;
  results?: WorkflowResult[];
};
