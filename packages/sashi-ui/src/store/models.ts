export interface VisualizationContent {
  type: string;
  data: any;
}
export type MessageItem = {
  id: string;
  created_at: string;
  role: 'assistant' | 'user';
  content: string | VisualizationContent;
};

export type FunctionMetadata = {
  name: string;
  description: string;
  needConfirmation: boolean;
  active: boolean;
};

export type Metadata = {
  name: string;
  description: string;
  functions: FunctionMetadata[];
};
