import { WorkflowResponse } from '../models/payload';

export interface WorkflowClassificationResult {
    entryType: 'form' | 'button' | 'label';
    payload?: any;
}

export interface WorkflowCharacteristics {
    isDataQuery: boolean;
    isMutation: boolean;
    isDisplayOnly: boolean;
    requiresExecution: boolean;
    hasResults: boolean;
}

/**
 * Helper function to detect placeholder values that indicate user input is needed
 */
export const isPlaceholderValue = (value: string): boolean => {
    const placeholderPatterns = [
        /^<.*>$/, // <userID>, <placeholder>, etc.
        /^TODO/i, // TODO: something
        /^PLACEHOLDER/i, // PLACEHOLDER value
        /^FILL_IN/i, // FILL_IN value
        /^ENTER_/i, // ENTER_VALUE
        /^\{\{.*\}\}$/, // {{placeholder}}
        /^\$\{.*\}$/, // ${placeholder}
    ];

    return placeholderPatterns.some(pattern => pattern.test(value.trim()));
};

/**
 * Helper function to detect if execution result indicates an error
 */
export const isErrorResult = (result: any): boolean => {
    if (!result || !result.result) return false;

    const resultValue = result.result.value || result.result;
    if (typeof resultValue === 'string') {
        return resultValue.includes('There was an issue') ||
            resultValue.includes('Error') ||
            resultValue.includes('Failed') ||
            resultValue.includes('Expected') ||
            resultValue.toLowerCase().includes('error');
    }

    return false;
};

/**
 * Analyze workflow characteristics to determine the best UI type
 */
export const analyzeWorkflowCharacteristics = (workflow: WorkflowResponse): WorkflowCharacteristics => {
    const actionNames = workflow.actions.map(action => action.tool.toLowerCase());
    const actionDescriptions = workflow.actions.map(action => action.description?.toLowerCase() || '');

    // Keywords that suggest data queries/display
    const queryKeywords = ['get', 'fetch', 'list', 'show', 'display', 'view', 'search', 'find', 'retrieve'];
    const mutationKeywords = ['create', 'update', 'delete', 'add', 'remove', 'modify', 'save', 'execute', 'run'];

    const hasQueryKeywords = [...actionNames, ...actionDescriptions].some(text =>
        queryKeywords.some(keyword => text.includes(keyword))
    );

    const hasMutationKeywords = [...actionNames, ...actionDescriptions].some(text =>
        mutationKeywords.some(keyword => text.includes(keyword))
    );

    // Check if all parameters are already set (no user input needed)
    const hasUnsetParameters = workflow.actions.some(action =>
        Object.values(action.parameters || {}).some(value =>
            typeof value === 'string' && (value.includes('TODO') || value.includes('PLACEHOLDER') || value === '')
        )
    );

    return {
        isDataQuery: hasQueryKeywords && !hasMutationKeywords,
        isMutation: hasMutationKeywords,
        isDisplayOnly: !!(workflow.executionResults && workflow.executionResults.length > 0 && hasQueryKeywords),
        requiresExecution: hasUnsetParameters || hasMutationKeywords,
        hasResults: !!(workflow.executionResults && workflow.executionResults.length > 0)
    };
};

/**
 * Main function to detect if workflow needs user input and determine the entry type
 */
export const detectWorkflowEntryType = (workflow: WorkflowResponse): WorkflowClassificationResult => {
    const userInputKeys = new Set<string>();
    const formFields: any[] = [];

    // Check for user input parameters across all actions
    workflow.actions.forEach((action) => {
        for (const [paramKey, paramValue] of Object.entries(action.parameters || {})) {
            // Check for explicit userInput. prefix
            if (typeof paramValue === 'string' && paramValue.startsWith('userInput.')) {
                const inputKey = paramValue.split('.')[1];
                userInputKeys.add(inputKey);

                // Create form field definition
                formFields.push({
                    key: inputKey,
                    label: inputKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                    type: 'string', // Default to string, could be enhanced with type detection
                    required: true
                });
            }

            // Check for placeholder values that indicate user input is needed
            else if (typeof paramValue === 'string' && isPlaceholderValue(paramValue)) {
                userInputKeys.add(paramKey);

                // Get metadata for this parameter if available
                const paramMetadata = (action as any).parameterMetadata?.[paramKey];

                formFields.push({
                    key: paramKey,
                    label: paramMetadata?.description || paramKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                    type: paramMetadata?.type || 'string',
                    required: paramMetadata?.required !== false // Default to true unless explicitly false
                });
            }
        }

        // Also check parameterMetadata for required parameters that might need user input
        if ((action as any).parameterMetadata) {
            for (const [paramKey, metadata] of Object.entries((action as any).parameterMetadata || {})) {
                const paramValue = action.parameters?.[paramKey];
                const metadataTyped = metadata as any;

                // If the parameter is required but missing or has a placeholder value
                if (metadataTyped.required && (
                    paramValue === undefined ||
                    paramValue === null ||
                    paramValue === '' ||
                    (typeof paramValue === 'string' && isPlaceholderValue(paramValue))
                )) {
                    userInputKeys.add(paramKey);

                    // Only add if not already added
                    if (!formFields.some(field => field.key === paramKey)) {
                        formFields.push({
                            key: paramKey,
                            label: metadataTyped.description || paramKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                            type: metadataTyped.type || 'string',
                            required: true
                        });
                    }
                }
            }
        }
    });

    // If we found user input requirements, it's a form
    if (userInputKeys.size > 0) {
        return {
            entryType: 'form',
            payload: {
                fields: formFields
            }
        };
    }

    // Analyze workflow characteristics to determine the best UI type
    const workflowCharacteristics = analyzeWorkflowCharacteristics(workflow);

    // Check if workflow has successful execution results (not error results)
    const hasSuccessfulResults = workflow.executionResults &&
        workflow.executionResults.length > 0 &&
        !workflow.executionResults.every(result => isErrorResult(result));

    // If workflow has successful execution results and appears to be data-focused, show as display
    if (hasSuccessfulResults) {
        if (workflowCharacteristics.isDataQuery || workflowCharacteristics.isDisplayOnly) {
            return {
                entryType: 'label' // Display-only workflow
            };
        }
    }

    // If it's clearly a mutation/action workflow, use button
    if (workflowCharacteristics.isMutation || workflowCharacteristics.requiresExecution) {
        return {
            entryType: 'button'
        };
    }

    // Default to button for simple execution workflows
    return {
        entryType: 'button'
    };
};

/**
 * Helper function to explain why a workflow was classified a certain way
 */
export const getClassificationExplanation = (classification: WorkflowClassificationResult, characteristics: WorkflowCharacteristics): string => {
    if (classification.entryType === 'form') {
        return 'This workflow requires user input parameters. Fill out the form to provide the necessary data.';
    } else if (classification.entryType === 'label') {
        if (characteristics.isDataQuery) {
            return 'This workflow fetches and displays data. It appears to be a query/read operation.';
        } else if (characteristics.hasResults) {
            return 'This workflow has been executed and contains results to display.';
        }
        return 'This workflow is designed to display information without requiring user interaction.';
    } else if (classification.entryType === 'button') {
        if (characteristics.isMutation) {
            return 'This workflow performs actions/mutations. Click the button to execute it.';
        } else if (characteristics.requiresExecution) {
            return 'This workflow needs to be executed to generate results.';
        }
        return 'This workflow can be executed with a simple button click.';
    }
    return 'Classification completed using AI analysis of workflow structure.';
};

/**
 * Extract workflow from nested structure (handles cases where workflow is under 'output' key)
 */
export const extractWorkflowFromNested = (workflowData: any): WorkflowResponse | null => {
    // If it's already a proper workflow
    if (workflowData && workflowData.actions && Array.isArray(workflowData.actions)) {
        return workflowData as WorkflowResponse;
    }

    // Handle cases where workflow might be nested under "output" key
    if (workflowData && typeof workflowData === 'object' && 'output' in workflowData && !workflowData.actions) {
        const extracted = workflowData.output;
        if (extracted && extracted.actions && Array.isArray(extracted.actions)) {
            return extracted as WorkflowResponse;
        }
    }

    return null;
}; 