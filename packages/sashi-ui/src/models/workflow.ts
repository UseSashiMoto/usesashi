export interface WorkflowStep {
    name: string;
    description: string;
    functionName: string;
    inputs?: Record<string, any>;
    outputs?: Record<string, any>;
}

export interface Workflow {
    id: string;
    name: string;
    description: string;
    steps: WorkflowStep[];
    createdAt: string;
    updatedAt: string;
} 