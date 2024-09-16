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
