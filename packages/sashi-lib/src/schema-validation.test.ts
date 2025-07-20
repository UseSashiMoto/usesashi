
/**
 * Test suite demonstrating the OpenAI Function Schema validation issue
 * 
 * The problem: OpenAI's function calling API requires all schema properties to have a 'type' field.
 * When using z.any(), Zod doesn't generate a 'type' field, causing OpenAI to reject the schema.
 */
describe('OpenAI Function Schema Validation', () => {
    // Helper function to simulate OpenAI's schema validation
    const validateOpenAISchema = (schema: any): { valid: boolean; error?: string } => {
        try {
            // Simulate OpenAI's validation logic
            const checkProperty = (prop: any, path: string): void => {
                if (typeof prop === 'object' && prop !== null) {
                    if (!prop.type) {
                        throw new Error(`In context=('properties', '${path}'), schema must have a 'type' key.`);
                    }
                    if (prop.properties) {
                        Object.keys(prop.properties).forEach(key => {
                            checkProperty(prop.properties[key], key);
                        });
                    }
                }
            };

            if (schema.properties) {
                Object.keys(schema.properties).forEach(key => {
                    checkProperty(schema.properties[key], key);
                });
            }
            return { valid: true };
        } catch (error) {
            return { valid: false, error: (error as Error).message };
        }
    };

    describe('Problem: z.any() Schema Validation', () => {
        it('should fail with z.any() because it produces no type field', () => {
            // This is the problematic schema from the SashiAgent
            const jsonSchema = {
                type: 'object',
                properties: {
                    userRequest: { type: 'string' },
                    responseType: { type: 'string', enum: ['simple', 'workflow'] },
                    content: { type: 'string' },
                    workflow: {} // z.any() produces an empty schema without 'type'
                },
                required: ['userRequest', 'responseType', 'content']
            };

            const validation = validateOpenAISchema(jsonSchema);
            expect(validation.valid).toBe(false);
            expect(validation.error).toContain("schema must have a 'type' key");
        });
    });

    describe('Solution: z.object({}).passthrough()', () => {
        it('should pass with z.object({}).passthrough() schema', () => {
            const jsonSchema = {
                type: 'object',
                properties: {
                    userRequest: { type: 'string' },
                    responseType: { type: 'string', enum: ['simple', 'workflow'] },
                    content: { type: 'string' },
                    workflow: {
                        type: 'object',
                        additionalProperties: true // passthrough() allows additional properties
                    }
                },
                required: ['userRequest', 'responseType', 'content']
            };

            const validation = validateOpenAISchema(jsonSchema);
            expect(validation.valid).toBe(true);
            expect(validation.error).toBeUndefined();
        });
    });
}); 