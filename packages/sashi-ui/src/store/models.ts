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

export type RepoMetadata = {
  id: string;
  name: string;
  url: string;
};

export type VisualizationMetadata = {
  id: string;
  name: string;
  description: string;
  active: boolean;
};

export type Metadata = {
  hubUrl?: string
  name: string;
  description: string;
  functions: FunctionMetadata[];
  repos: RepoMetadata[];
  visualizations: VisualizationMetadata[];
};
