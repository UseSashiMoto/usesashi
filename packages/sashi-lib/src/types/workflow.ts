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
    errors?: WorkflowStepError[];
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
export function createWorkflowExecutionSuccess(
    results: WorkflowResult[],
    errors?: WorkflowStepError[]
): WorkflowExecutionSuccess {
    return {
        success: true,
        results,
        errors
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

