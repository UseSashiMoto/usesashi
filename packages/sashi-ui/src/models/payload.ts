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
    parameters: Record<string, any>
  }[]
  options: {
    execute_immediately: boolean
    generate_ui: boolean
  }
}

