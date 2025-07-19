import {
    AIArray,
    AIFieldEnum, AIFunction, AIObject, getFunctionRegistry
} from "../ai-function-loader";

/**
 * Very‐lightweight static validator for workflow JSON structures.
 * Returns an object with `valid` boolean and array of human-readable `errors`.
 *
 * NOTE: This performs *static* checks only – it does not execute any tools.
 */
export interface VerificationResult {
    valid: boolean;
    errors: string[];
}

export function verifyWorkflow(workflow: any): VerificationResult {
    const errors: string[] = [];

    if (!workflow || workflow.type !== "workflow") {
        errors.push("Root object must have type=\"workflow\".");
        return { valid: false, errors };
    }

    if (!Array.isArray(workflow.actions) || workflow.actions.length === 0) {
        errors.push("Workflow must contain a non-empty actions array.");
        return { valid: false, errors };
    }

    // Ensure action ids are unique
    const seenIds = new Set<string>();
    for (const action of workflow.actions) {
        if (!action.id || typeof action.id !== "string") {
            errors.push("Each action must have a string id.");
            continue;
        }
        if (seenIds.has(action.id)) {
            errors.push(`Duplicate action id: ${action.id}`);
        }
        seenIds.add(action.id);
    }

    const registry = getFunctionRegistry();

    workflow.actions.forEach((action: any, index: number) => {
        const actionPrefix = `Action #${index + 1} (${action.id ?? "<no id>"})`;

        // 1. Tool existence
        const fn = registry.get(action.tool);
        if (!fn) {
            errors.push(`${actionPrefix}: Unknown tool \"${action.tool}\".`);
            return; // Skip deeper checks if tool missing
        }

        // 2. Parameter validation
        const paramsDef = fn.getParams();
        paramsDef.forEach((paramDef: any) => {
            const paramName = getParamName(paramDef);
            const required = isParamRequired(paramDef);
            const provided = action.parameters && Object.prototype.hasOwnProperty.call(action.parameters, paramName);

            if (required && !provided) {
                errors.push(`${actionPrefix}: Missing required parameter \"${paramName}\" for tool \"${action.tool}\".`);
                return;
            }

            if (provided) {
                const value = action.parameters[paramName];

                // Allow placeholders like "userInput.*" or "<prev>.field"
                if (typeof value === "string" && (value.startsWith("userInput.") || value.includes("."))) {
                    return; // skip type validation for placeholders
                }

                try {
                    const schema = (fn as AIFunction).validateAIField(paramDef);
                    schema.parse(value);
                } catch (e: any) {
                    errors.push(
                        `${actionPrefix}: Parameter \"${paramName}\" failed validation – ${e.message ?? e}`,
                    );
                }
            }
        });
    });

    return {
        valid: errors.length === 0,
        errors,
    };
}

function getParamName(param: any): string {
    if (param instanceof AIObject || param instanceof AIArray || param instanceof AIFieldEnum) {
        return param.getName();
    }
    return param.name;
}

function isParamRequired(param: any): boolean {
    if (param instanceof AIObject || param instanceof AIArray || param instanceof AIFieldEnum) {
        return param.getRequired();
    }
    return param.required;
} 