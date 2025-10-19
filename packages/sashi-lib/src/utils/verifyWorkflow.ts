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

                // Allow placeholders like "userInput.*" or "actionId.field"
                // Also allows {{}} wrapped syntax for backward compatibility
                if (typeof value === "string" && (value.startsWith("userInput.") || value.includes(".") || value.includes("{{"))) {
                    return; // skip type validation for placeholders
                }

                // Allow _generate objects for dynamic parameter generation
                if (typeof value === "object" && value !== null && "_generate" in value) {
                    return; // skip type validation for _generate objects - will be generated at runtime
                }

                // Allow _transform objects for output transformation
                if (typeof value === "object" && value !== null && "_transform" in value) {
                    return; // skip type validation for _transform objects - will be transformed at runtime
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

    // 3. Validate action parameter references
    const actionMap = new Map<string, any>();
    workflow.actions.forEach((action: any) => {
        actionMap.set(action.id, action);
    });

    workflow.actions.forEach((action: any, index: number) => {
        // Skip if action doesn't have an id (already validated earlier)
        if (!action.id || typeof action.id !== 'string') {
            return;
        }

        const actionPrefix = `Action #${index + 1} (${action.id})`;

        if (action.parameters) {
            for (const [paramName, paramValue] of Object.entries(action.parameters)) {
                if (typeof paramValue === 'string') {
                    // Match pattern: actionId.field (but not userInput.field)
                    const actionRefMatch = paramValue.match(/^([a-zA-Z0-9_]+)\.(.+)$/);

                    if (actionRefMatch && !paramValue.startsWith('userInput.')) {
                        const [, referencedActionId, fieldPath] = actionRefMatch;

                        // Ensure we have both parts of the reference
                        if (!referencedActionId || !fieldPath) {
                            continue;
                        }

                        // Check if referenced action exists
                        const referencedAction = actionMap.get(referencedActionId);
                        if (!referencedAction) {
                            errors.push(`${actionPrefix}: Parameter "${paramName}" references non-existent action "${referencedActionId}".`);
                            continue;
                        }

                        // Check if referenced action comes before current action
                        const referencedIndex = workflow.actions.indexOf(referencedAction);
                        if (referencedIndex >= index) {
                            errors.push(`${actionPrefix}: Parameter "${paramName}" cannot reference action "${referencedActionId}" that comes after it.`);
                            continue;
                        }

                        // Check if field exists in return type
                        const referencedFn = registry.get(referencedAction.tool);
                        if (referencedFn) {
                            const returnType = referencedFn.getReturnType();
                            if (returnType) {
                                const fieldExists = checkFieldExists(returnType, fieldPath);
                                if (!fieldExists) {
                                    const availableFields = getAvailableFields(returnType);
                                    const suggestion = availableFields.length > 0
                                        ? ` Available fields: ${availableFields.join(', ')}`
                                        : '';
                                    errors.push(`${actionPrefix}: Parameter "${paramName}" references field "${fieldPath}" that does not exist in action "${referencedActionId}" return type.${suggestion}`);
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    // 4. Validate UI input components (including array types)
    if (workflow.ui && workflow.ui.inputComponents) {
        workflow.ui.inputComponents.forEach((component: any, index: number) => {
            const componentPrefix = `inputComponent[${index}]`;

            // Validate required properties
            if (!component.key || typeof component.key !== 'string') {
                errors.push(`${componentPrefix}: Missing or invalid 'key' field (required string)`);
            }

            if (!component.label || typeof component.label !== 'string') {
                errors.push(`${componentPrefix}: Missing or invalid 'label' field (required string)`);
            }

            if (!component.type || typeof component.type !== 'string') {
                errors.push(`${componentPrefix}: Missing or invalid 'type' field (required string)`);
            } else {
                // Validate type is one of the supported types
                const validTypes = ['string', 'number', 'boolean', 'enum', 'text', 'csv', 'array'];
                if (!validTypes.includes(component.type)) {
                    errors.push(`${componentPrefix}: Invalid type '${component.type}'. Valid types are: ${validTypes.join(', ')}`);
                }

                // Additional validation for enum type
                if (component.type === 'enum') {
                    if (!component.enumValues || !Array.isArray(component.enumValues) || component.enumValues.length === 0) {
                        errors.push(`${componentPrefix}: type 'enum' requires a non-empty 'enumValues' array`);
                    }
                }

                // Additional validation for array type
                if (component.type === 'array') {
                    if (!component.subFields || !Array.isArray(component.subFields) || component.subFields.length === 0) {
                        errors.push(`${componentPrefix}: type 'array' requires a non-empty 'subFields' array`);
                    } else {
                        // Recursively validate subFields
                        const validateSubFields = (subFields: any[], prefix: string) => {
                            subFields.forEach((subField: any, subIndex: number) => {
                                const subFieldPrefix = `${prefix}.subFields[${subIndex}]`;

                                // Validate required properties
                                if (!subField.key || typeof subField.key !== 'string') {
                                    errors.push(`${subFieldPrefix}: Missing or invalid 'key' field (required string)`);
                                }

                                if (!subField.label || typeof subField.label !== 'string') {
                                    errors.push(`${subFieldPrefix}: Missing or invalid 'label' field (required string)`);
                                }

                                if (!subField.type || typeof subField.type !== 'string') {
                                    errors.push(`${subFieldPrefix}: Missing or invalid 'type' field (required string)`);
                                } else {
                                    if (!validTypes.includes(subField.type)) {
                                        errors.push(`${subFieldPrefix}: Invalid type '${subField.type}'. Valid types are: ${validTypes.join(', ')}`);
                                    }

                                    // Validate enum subField
                                    if (subField.type === 'enum') {
                                        if (!subField.enumValues || !Array.isArray(subField.enumValues) || subField.enumValues.length === 0) {
                                            errors.push(`${subFieldPrefix}: type 'enum' requires a non-empty 'enumValues' array`);
                                        }
                                    }

                                    // Recursive validation for nested arrays
                                    if (subField.type === 'array') {
                                        if (!subField.subFields || !Array.isArray(subField.subFields) || subField.subFields.length === 0) {
                                            errors.push(`${subFieldPrefix}: type 'array' requires a non-empty 'subFields' array`);
                                        } else {
                                            validateSubFields(subField.subFields, subFieldPrefix);
                                        }
                                    }
                                }
                            });
                        };

                        validateSubFields(component.subFields, componentPrefix);
                    }
                }
            }
        });
    }

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

function checkFieldExists(returnType: any, fieldPath: string): boolean {
    // Handle simple field access (e.g., "surveyId")
    if (!fieldPath.includes('.') && !fieldPath.includes('[')) {
        if (returnType instanceof AIObject) {
            const fields = returnType.getFields();
            return fields.some((f: any) => {
                if (f instanceof AIObject || f instanceof AIFieldEnum) {
                    return f.getName() === fieldPath;
                }
                return f.name === fieldPath;
            });
        }
    }
    // For nested paths, allow for now (more complex validation)
    return true;
}

function getAvailableFields(returnType: any): string[] {
    if (returnType instanceof AIObject) {
        const fields = returnType.getFields();
        return fields.map((f: any) => {
            if (f instanceof AIObject || f instanceof AIFieldEnum) {
                return f.getName();
            }
            return f.name;
        }).filter(Boolean);
    }
    return [];
} 