/**
 * Workflow execution response types - shared across packages
 */

export interface WorkflowStepError {
    actionId: string;
    error: string;
}

export interface WorkflowUIElement {
    type: 'result';
    actionId: string;
    tool: string;
    content: {
        type: string;
        title: string;
        content: string;
        timestamp: string;
        config?: Record<string, any>;
    };
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

/**
 * Usage Examples:
 * 
 * // In your service or component:
 * import { WorkflowExecutionResponse, isWorkflowExecutionSuccess, isWorkflowExecutionError } from '@sashimo/lib';
 * 
 * async function executeWorkflow(apiUrl: string, workflow: any): Promise<WorkflowExecutionResponse> {
 *     const response = await axios.post(`${apiUrl}/workflow/execute`, { workflow });
 *     return response.data;
 * }
 * 
 * // Using the response:
 * const result = await executeWorkflow(apiUrl, workflow);
 * 
 * if (isWorkflowExecutionSuccess(result)) {
 *     console.log('Success:', result.results);
 *     // TypeScript knows result.results exists here
 * } else if (isWorkflowExecutionError(result)) {
 *     console.error('Error:', result.error, result.details);
 *     // TypeScript knows result.error and result.details exist here
 * }
 * 
 * // Or using the success property directly:
 * if (result.success) {
 *     // Handle success case
 * } else {
 *     // Handle error case
 * }
 */ 