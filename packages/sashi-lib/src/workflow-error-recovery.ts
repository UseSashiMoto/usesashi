import { getFunctionRegistry } from './ai-function-loader';
import { getAIBot } from './aibot';

interface WorkflowAction {
    id: string;
    tool: string;
    parameters: Record<string, any>;
    description?: string;
}

interface ErrorRecoveryResult {
    strategy: 'alternative_function' | 'parameter_fix' | 'data_transform' | 'workflow_adaptation';
    suggestions: {
        newFunction?: string;
        newParameters?: Record<string, any>;
        reasoning: string;
        confidence: number;
    }[];
    canContinue: boolean;
}

export class AIWorkflowErrorRecovery {
    private aiBot = getAIBot();
    private functionRegistry = getFunctionRegistry();

    async analyzeAndRecover(
        error: Error,
        failedAction: WorkflowAction,
        actionResults: Record<string, any>,
        workflowGoal: string
    ): Promise<ErrorRecoveryResult> {

        const availableFunctions = Array.from(this.functionRegistry.keys());

        const recoveryPrompt = `
        WORKFLOW ERROR RECOVERY ANALYSIS
        
        🎯 Original Goal: "${workflowGoal}"
        
        ❌ Failed Action: "${failedAction.tool}" (${failedAction.description})
        📝 Error Message: "${error.message}"
        🔧 Parameters Used: ${JSON.stringify(failedAction.parameters, null, 2)}
        
        📊 Available Data Context:
        ${JSON.stringify(actionResults, null, 2)}
        
        🛠️ Available Functions:
        ${availableFunctions.join(', ')}
        
        RECOVERY TASK:
        Analyze this error and suggest intelligent recovery strategies. Focus on:
        
        1. **Function Alternatives**: What other functions could accomplish the same goal?
        2. **Parameter Fixes**: How can we adjust parameters based on the error?
        3. **Data Issues**: Is the data format causing problems?
        4. **Workflow Adaptation**: How can we modify the approach while keeping the goal?
        
        COMMON ERROR PATTERNS:
        - "Field not found" → Try different field names or data structure
        - "Invalid format" → Use data transformation functions first
        - "Empty data" → Check previous step outputs or use different data source
        - "Type mismatch" → Add data conversion steps
        
        Respond with JSON:
        {
            "strategy": "alternative_function|parameter_fix|data_transform|workflow_adaptation",
            "suggestions": [
                {
                    "newFunction": "function_name",
                    "newParameters": {...},
                    "reasoning": "Why this approach should work",
                    "confidence": 0.9
                }
            ],
            "canContinue": true
        }
        `;

        try {
            const response = await this.aiBot.chatCompletion({
                messages: [
                    { role: 'system', content: 'You are a workflow error recovery specialist. Analyze errors and suggest intelligent solutions.' },
                    { role: 'user', content: recoveryPrompt }
                ],
                temperature: 0.3
            });

            const recovery = JSON.parse(response?.message?.content || '{}') as ErrorRecoveryResult;
            return recovery;

        } catch (aiError) {
            console.error('AI Error Recovery failed:', aiError);
            return this.fallbackRecovery(error, failedAction, actionResults);
        }
    }

    private fallbackRecovery(
        error: Error,
        failedAction: WorkflowAction,
        actionResults: Record<string, any>
    ): ErrorRecoveryResult {
        // Basic heuristic recovery when AI fails
        const suggestions = [];

        // Common field name fixes
        if (error.message.includes('field') || error.message.includes('Field')) {
            suggestions.push({
                newFunction: failedAction.tool,
                newParameters: this.suggestFieldNameFixes(failedAction.parameters),
                reasoning: "Trying common field name variations",
                confidence: 0.7
            });
        }

        // Function alternatives for common cases
        if (failedAction.tool === 'parseCSV' && error.message.includes('format')) {
            suggestions.push({
                newFunction: 'createReport',
                newParameters: {
                    data: 'Raw data could not be parsed. Please check CSV format.',
                    title: 'Data Format Issue'
                },
                reasoning: "Providing user feedback about data format",
                confidence: 0.8
            });
        }

        return {
            strategy: 'parameter_fix',
            suggestions,
            canContinue: true
        };
    }

    private suggestFieldNameFixes(originalParams: Record<string, any>): Record<string, any> {
        const fixedParams = { ...originalParams };

        // Try common field name variations
        for (const [key, value] of Object.entries(fixedParams)) {
            if (key === 'field' && typeof value === 'string') {
                // Try lowercase version
                fixedParams[key] = value.toLowerCase();
                break;
            }
        }

        return fixedParams;
    }

    async executeRecovery(
        recovery: ErrorRecoveryResult,
        originalAction: WorkflowAction,
        actionResults: Record<string, any>
    ): Promise<any> {

        for (const suggestion of recovery.suggestions) {
            if (suggestion.confidence < 0.5) continue;

            try {
                console.log(`🔄 Trying recovery: ${suggestion.reasoning}`);

                const functionName = suggestion.newFunction || originalAction.tool;
                const registeredFunction = this.functionRegistry.get(functionName);

                if (!registeredFunction) {
                    console.log(`❌ Function ${functionName} not available`);
                    continue;
                }

                // Execute the recovery suggestion
                const result = await this.callFunction(functionName, suggestion.newParameters || {});

                console.log(`✅ Recovery successful with ${functionName}`);
                return result;

            } catch (recoveryError) {
                console.log(`❌ Recovery attempt failed: ${recoveryError.message}`);
                continue;
            }
        }

        throw new Error('All recovery attempts failed');
    }

    private async callFunction(functionName: string, parameters: Record<string, any>): Promise<any> {
        // This would integrate with your existing function calling system
        // For now, just a placeholder
        console.log(`Calling ${functionName} with:`, parameters);
        return { recovered: true, function: functionName, parameters };
    }
}

// Export for use in middleware
export const createWorkflowErrorRecovery = () => new AIWorkflowErrorRecovery(); 