import { ChatCompletionMessageToolCall } from 'openai/resources';
import { z } from 'zod';
import { RepoFunctionMetadata, RepoMetadata } from './models/repo-metadata';

export interface ConfirmableToolCall extends ChatCompletionMessageToolCall {
    needsConfirm?: boolean; // Optional flag for confirmation
}

type AllowedTypes =
    | 'string'
    | 'number'
    | 'boolean'
    | 'array'
    | 'enum'
    | 'object'
    | AIField<string | number | boolean>[];

export type AIField<T> = {
    name: string;
    type: T;
    description: string;
    required?: boolean;
};

export type AINumber = AIField<'number'>;
export type AIString = AIField<'string'>;
export type AIBoolean = AIField<'boolean'>;
export type AIEnum = AIField<'enum'> & {
    values: string[]; // The possible values for the enum
};

// Define an Enum Field class
export class AIFieldEnum {
    private _name: string;
    private _type: 'enum';
    private _description: string;
    private _values: string[];
    private _required: boolean;

    constructor(
        name: string,
        description: string,
        values: string[],
        required: boolean = true
    ) {
        this._name = name;
        this._type = 'enum';
        this._description = description;
        this._values = values;
        this._required = required;
    }

    // Method to generate the description of the enum field
    description() {
        return {
            type: 'string',
            description: this._description,
            enum: this._values,
            required: this._required
        };
    }

    getName() {
        return this._name;
    }

    getRequired() {
        return this._required;
    }

    getValues() {
        return this._values;
    }

    getType() {
        return this._type;
    }

    getDescription() {
        return this._description;
    }
}

export class AIArray {
    _name: string;
    _type: 'array';
    _description: string;
    _itemType: AIField<any> | AIObject; // Define the type of items in the array
    _required: boolean;

    constructor(
        name: string,
        description: string,
        itemType: AIField<any> | AIObject,
        required: boolean = true
    ) {
        this._name = name;
        this._type = 'array';
        this._description = description;
        this._itemType = itemType; // Define what kind of items the array will hold
        this._required = required;
    }

    getName() {
        return this._name;
    }

    getRequired() {
        return this._required;
    }

    getItemType() {
        return this._itemType;
    }

    description() {
        return {
            type: 'array',
            description: this.description,
            items:
                this._itemType instanceof AIObject
                    ? this._itemType.description()
                    : {
                        type: this._itemType.type,
                        description: this._itemType.description,
                    },
        };
    }
}

export class AIObject {
    private _name: string;
    private _description: string;
    private _fields: (AIField<AllowedTypes> | AIObject | AIFieldEnum)[];
    private _required: boolean;

    constructor(name: string, description: string, required: boolean) {
        this._name = name;
        this._description = description;
        this._fields = [];
        this._required = required;
    }

    field<T extends AllowedTypes>(field: AIField<T> | AIObject | AIFieldEnum) {
        this._fields.push(field);
        return this;
    }

    getName(): string {
        return this._name;
    }

    getDescription(): string {
        return this._description;
    }

    getFields(): (
        | AIField<AllowedTypes>
        | AIObject
        | AIField<AllowedTypes>[]
        | AIObject[]
        | AIFieldEnum
    )[] {
        return this._fields;
    }

    validateAIField = (
        field: AIField<AllowedTypes>
    ):
        | z.ZodString
        | z.ZodNumber
        | z.ZodBoolean
        | z.ZodArray<z.ZodTypeAny, 'many'>
        | z.ZodEffects<z.ZodString, any, any>
        | z.ZodUnion<[z.ZodEffects<z.ZodString, any, any>, z.ZodNumber]> // This handles the case of number transformation
        | z.ZodUnion<[z.ZodEffects<z.ZodString, any, any>, z.ZodBoolean]> // This handles the case of boolean transformation
        | z.ZodUnion<
            [
                z.ZodEffects<z.ZodString, any, any>,
                z.ZodArray<z.ZodTypeAny, 'many'>,
            ]
        > // For array transformations
        | z.ZodNull
        | z.ZodEnum<[string]>
        | z.ZodEnum<[string, ...string[]]>
        | z.ZodAny => {
        switch (field.type) {
            case 'string':
                return z.string();

            case 'number':
                return z
                    .string()
                    .transform((val) => {
                        const parsed = Number(val);
                        if (isNaN(parsed)) {
                            throw new Error('Invalid number');
                        }
                        return parsed;
                    })
                    .or(z.number()); // Support both strings and numbers

            case 'boolean':
                return z
                    .string()
                    .transform((val) => {
                        if (val === 'true') return true;
                        if (val === 'false') return false;
                        throw new Error('Invalid boolean');
                    })
                    .or(z.boolean()); // Support both strings and booleans

            case 'array':
                return z
                    .string()
                    .transform((val) => {
                        try {
                            const parsed = JSON.parse(val);
                            if (Array.isArray(parsed)) return parsed;
                            throw new Error('Invalid array');
                        } catch (error) {
                            throw new Error('Invalid array');
                        }
                    })
                    .or(z.array(z.any())); // Support both strings (for stringified arrays) and arrays
            case 'object':
                return z.any();
            case 'enum':
                if ((field as AIEnum).values.length) {
                    return z.enum(
                        (field as AIEnum).values as [string, ...string[]]
                    );
                }

                throw new Error('Enum values is not supported');
            default:
                throw new Error('Unsupported type');
        }
    };
    description(): Record<string, any> {
        return {
            type: 'object',
            name: this._name,
            description: this._description,
            properties: this._fields.reduce(
                (acc, field) => {
                    if (field instanceof AIObject) {
                        return {
                            ...acc,
                            [field.getName()]: field.description(),
                        };
                    } else if (field instanceof AIFieldEnum) {
                        return {
                            ...acc,
                            [field.getName()]: field.description(),
                        };
                    } else {
                        return {
                            ...acc,
                            [field.name]: {
                                type: field.type,
                                description: field.description,
                            },
                        };
                    }
                },
                {} as Record<string, any>
            ),
            required:
                this._fields
                    .filter((field) => {
                        if (field instanceof AIObject) {
                            return field.getRequired();
                        } else if (field instanceof AIFieldEnum) {
                            return field.getRequired();
                        } else {
                            return field.required;
                        }
                    })
                    .map((field) => {
                        if (field instanceof AIObject) {
                            return field.getName();
                        } else if (field instanceof AIFieldEnum) {
                            return field.getName();
                        } else {
                            return field.name;
                        }
                    }) ?? [],
        };
    }
    getRequired() {
        return this._required;
    }
}

export class AIFunction {
    private _repo?: string;
    private _name: string;

    private _description: string;
    private _params: (AIField<any> | AIObject | AIArray | AIFieldEnum)[];
    private _returnType?: AIField<any> | AIObject | AIArray;
    private _implementation: Function;
    private _needsConfirm: boolean;
    private _isHidden: boolean;

    constructor(
        name: string,
        description: string,
        repo?: string,
        needsConfirm: boolean = false,
        isHidden: boolean = false
    ) {
        this._name = name;
        this._description = description;
        this._params = [];
        this._implementation = () => { };
        this._repo = repo;
        this._needsConfirm = needsConfirm;
        this._isHidden = isHidden;
    }

    args(...params: (AIField<any> | AIObject | AIArray | AIFieldEnum)[]) {
        this._params.push(...params);
        return this;
    }

    returns(returnType: AIField<any> | AIObject | AIArray) {
        this._returnType = returnType;
        return this;
    }

    confirmation(needsConfirm: boolean) {
        this._needsConfirm = needsConfirm;
        return this;
    }

    implement(fn: (...args: any[]) => any) {
        this._implementation = fn;
        return this;
    }

    getName(): string {
        return this._name;
    }

    getDescription(): string {
        return this._description;
    }

    getParams(): (AIField<any> | AIObject | AIArray | AIFieldEnum)[] {
        return this._params;
    }

    getRepo(): string | undefined {
        return this._repo;
    }

    getNeedsConfirm(): boolean {
        return this._needsConfirm;
    }

    isHidden(): boolean {
        return this._isHidden;
    }

    validateAIField = (
        param: AIField<any> | AIObject | AIArray | AIFieldEnum
    ):
        | z.ZodString
        | z.ZodNumber
        | z.ZodBoolean
        | z.ZodEnum<[string, ...string[]]>
        | z.ZodArray<z.ZodTypeAny>
        | z.ZodNull
        | z.ZodAny
        | z.ZodOptional<any> => {

        let schema: any;

        if (param instanceof AIArray) {
            schema = z.array(this.validateAIField(param.getItemType()));
        } else if (param instanceof AIObject) {
            schema = z.any();
        } else if (param instanceof AIFieldEnum) {
            // Handle enum fields
            const values = param.getValues();
            if (values.length === 0) {
                throw new Error('Enum must have at least one value');
            }
            // Ensure we have at least one value plus rest spread
            // Explicitly type check the array to ensure it meets Zod's requirements
            const enumValues = values as [string, ...string[]];
            schema = z.enum(enumValues);
        } else {
            switch (param.type) {
                case 'string':
                    schema = z.string();
                    break;
                case 'number':
                    schema = z.number();
                    break;
                case 'boolean':
                    schema = z.boolean();
                    break;
                case 'array':
                    schema = z.array(z.any()); // Adjust based on the specific type of array elements
                    break;
                case 'object':
                    schema = z.any();
                    break;
                case 'enum':
                    const enumValues = (param as AIEnum).values;
                    if (!enumValues?.length) {
                        throw new Error('Enum must have at least one value');
                    }
                    // Explicitly type check the array to ensure it meets Zod's requirements
                    schema = z.enum(enumValues as [string, ...string[]]);
                    break;
                default:
                    schema = z.null();
            }
        }

        // Make the schema optional if the parameter is not required
        const isRequired = this.getParameterRequired(param);
        return isRequired ? schema : z.optional(schema);
    };

    // Helper method to determine if a parameter is required
    private getParameterRequired(param: AIField<any> | AIObject | AIArray | AIFieldEnum): boolean {
        if (param instanceof AIArray) {
            return param.getRequired();
        } else if (param instanceof AIObject) {
            return param.getRequired();
        } else if (param instanceof AIFieldEnum) {
            return param.getRequired();
        } else {
            return param.required ?? true; // Default to required if not specified
        }
    }

    description() {
        return {
            type: 'function',
            function: {
                name: this._name,
                description: this._description,
                parameters: {
                    type: 'object',
                    properties: this._params.reduce((acc, param) => {
                        if (param instanceof AIArray) {
                            return {
                                ...acc,
                                [param.getName()]: param.description(),
                            };
                        } else if (param instanceof AIObject) {
                            return {
                                ...acc,
                                [param.getName()]: param.description(),
                            };
                        } else if (param instanceof AIFieldEnum) {
                            return {
                                ...acc,
                                [param.getName()]: param.description(),
                            };
                        } else {
                            return {
                                ...acc,
                                [param.name]: {
                                    type: param.type,
                                    description: param.description,
                                },
                            };
                        }
                    }, {}),
                    // Only include actually required parameters
                    required: this._params
                        .filter((param) => this.getParameterRequired(param))
                        .map((param) => {
                            if (param instanceof AIArray) {
                                return param.getName();
                            } else if (param instanceof AIObject) {
                                return param.getName();
                            } else if (param instanceof AIFieldEnum) {
                                return param.getName();
                            } else {
                                return param.name;
                            }
                        }),
                },
                returns: {
                    type: 'object',
                    description: 'The return value of this function',
                    properties: this._returnType ? {
                        ...(this._returnType instanceof AIArray ? {
                            type: 'array',
                            items: this._returnType.description()
                        } : this._returnType instanceof AIObject ? {
                            type: 'object',
                            properties: this._returnType.description()
                        } : this._returnType instanceof AIFieldEnum ? {
                            type: 'string',
                            enum: this._returnType.description().enum
                        } : {
                            type: this._returnType.type,
                            description: this._returnType.description
                        })
                    } : undefined
                }
            },
        };
    }

    // Add this helper function before the execute method
    private coerceToType(value: any, expectedType: z.ZodTypeAny): any {
        // Special handling for string type
        if (expectedType instanceof z.ZodString && value !== undefined && value !== null) {
            // Convert numbers, booleans, and other primitives to strings
            return String(value);
        }

        if (expectedType instanceof z.ZodNumber && value !== undefined && value !== null) {
            //check if value is a string that can be converted to a number
            const parsed = Number(value);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }
        return value;
    }

    async execute(...args: any[]) {
        try {
            // Handle the case where fewer arguments are provided than parameters
            // Fill missing optional parameters with undefined
            const paddedArgs = [...args];
            while (paddedArgs.length < this._params.length) {
                const param = this._params[paddedArgs.length];
                if (param && !this.getParameterRequired(param)) {
                    paddedArgs.push(undefined);
                } else {
                    break; // Stop if we encounter a required parameter
                }
            }

            // Create validation schema for provided arguments only
            const paramSchemas = this._params.slice(0, paddedArgs.length).map(this.validateAIField);

            if (paramSchemas.length === 0) {
                // No parameters expected or provided
                const result = await this._implementation();
                if (this._returnType) {
                    const returnTypeSchema = this.validateAIField(this._returnType);
                    return returnTypeSchema.parse(result);
                }
                return result;
            }

            // Coerce args to expected types before validation
            const coercedArgs = paddedArgs.slice(0, paramSchemas.length).map((arg, index) => {
                const expectedType = this._params[index];
                if (!expectedType) {
                    return arg;
                }
                return this.coerceToType(arg, this.validateAIField(expectedType));
            });

            // Validate arguments
            const parsedArgs = z
                .tuple(paramSchemas as [z.ZodTypeAny, ...z.ZodTypeAny[]])
                .parse(coercedArgs);

            // Filter out undefined optional parameters when calling the implementation
            const filteredArgs = parsedArgs.filter((arg, index) => {
                if (arg === undefined) {
                    const param = this._params[index];
                    return param && this.getParameterRequired(param);
                }
                return true;
            });

            const result = await this._implementation(...filteredArgs);
            if (this._returnType) {
                const returnTypeSchema = this.validateAIField(this._returnType);
                return returnTypeSchema.parse(result);
            }
            return result;

        } catch (e) {
            if (e instanceof z.ZodError) {
                // Enhanced error formatting
                const errorDetails = e.errors
                    .map((error) => {
                        const path = error.path.join(' > ') || error.path[0]?.toString() || 'unknown';
                        const paramIndex = parseInt(path);
                        const param = this._params[paramIndex];
                        const paramName = param instanceof AIArray ? param.getName() :
                            param instanceof AIObject ? param.getName() :
                                param instanceof AIFieldEnum ? param.getName() :
                                    param?.name || path;
                        return `Field "${paramName}": ${error.message}`;
                    })
                    .join('\n');

                return `There was an issue with the parameters you provided for the function "${this._name}":\n${errorDetails}\nPlease check your input and try again.`;
            } else {
                console.error(`Error in function ${this._name}:`, e);
                return `An unexpected error occurred while calling the function "${this._name}". Please try again.`;
            }
        }
    }
}



export interface FunctionMetadata<F extends AIFunction> {
    fn: F;
}

interface RegisteredFunction<F extends AIFunction> extends FunctionMetadata<F> {
    name: string;
}

type FunctionRegistry = Map<string, AIFunction>;
type FunctionAttributes = Map<
    string,
    { active: boolean; isHidden: boolean }
>;

type RepoRegistry = Map<string, RepoMetadata>;

const functionRegistry: FunctionRegistry = new Map();
const functionAttributes: FunctionAttributes = new Map();
const repoRegistry: RepoRegistry = new Map();
let hubUrl: string | undefined = undefined;

export function getFunctionRegistry(): FunctionRegistry {
    return functionRegistry;
}

export function getFunctionAttributes(): FunctionAttributes {
    return functionAttributes;
}

export function getRepoRegistry(): RepoRegistry {
    return repoRegistry;
}

export function setHubUrl(url: string) {
    hubUrl = url;
}

export function registerFunctionIntoAI<F extends AIFunction>(
    name: string,
    fn: F
) {
    functionRegistry.set(fn.getName(), fn);
    functionAttributes.set(fn.getName(), {
        active: true,
        isHidden: fn.isHidden(),
    });
}

export function registerRepoFunctionsIntoAI<F extends AIFunction>(
    fn: RepoFunctionMetadata,
    repoToken: string
) {
    functionRegistry.set(
        fn.name,
        new AIFunction(fn.name, fn.description, repoToken, fn.needConfirmation)
    );
    functionAttributes.set(fn.name, { active: true, isHidden: false });
}

export function registerRepo(repo: RepoMetadata, token: string) {
    console.log('registering repo', repo, token);

    for (const functionMetadata of repo.functions) {
        registerRepoFunctionsIntoAI(functionMetadata, token);
    }

    repoRegistry.set(repo.id, repo);
}

export function toggleFunctionActive(name: string) {
    const functionAtribute = functionAttributes.get(name);
    if (!functionAtribute) {
        throw new Error(`Function ${name} is not registered`);
    }

    functionAttributes.set(name, {
        ...functionAtribute,
        active: !functionAtribute.active,
    });
    console.log('functionAtribute', functionAttributes.get(name));
}

export async function callFunctionFromRegistry<F extends AIFunction>(
    name: string,
    ...args: any[]
): Promise<any> {
    const registeredFunction = functionRegistry.get(name);

    if (!registeredFunction) {
        throw new Error(`Function ${name} is not registered`);
    }

    // Call the function
    if (getFunctionAttributes().get(name)?.active ?? true) {
        const result = await registeredFunction.execute(...args);
        return result;
    } else {
        return 'This function is not active';
    }
}

export async function callFunctionFromRegistryFromObject<F extends AIFunction>(
    name: string,
    argsObj: Record<string, any>,
    localOnly: boolean = false
): Promise<any> {
    const registeredFunction = functionRegistry.get(name);

    if (!registeredFunction) {
        throw new Error(`Function ${name} is not registered`);
    }

    if (!!localOnly && !!registeredFunction.getRepo()) {
        throw new Error(`Function ${name} is not local`);
    }

    const args = registeredFunction.getParams().map((param) => {
        if (param instanceof AIObject) {
            // Handle AIObject by using getName
            return argsObj[param.getName()];
        } else if (param instanceof AIArray) {
            // Handle AIArray by using getName
            return argsObj[param.getName()];
        } else if (param instanceof AIFieldEnum) {
            // Handle AIFieldEnum by using getName
            return argsObj[param.getName()];
        } else if ('name' in param) {
            // For AIField, which has a name property
            return argsObj[param.name];
        } else {
            // If none of the conditions match, throw an error
            throw new Error(`Parameter ${param} is missing a valid name`);
        }
    });
    // Call the function
    if (getFunctionAttributes().get(name)?.active ?? true) {
        const result = await registeredFunction.execute(...args);
        return result;
    } else {
        return 'This function is not active';
    }
}

export function generateToolSchemas() {
    const registry = getFunctionRegistry();

    const tools = Array.from(registry.values()).map((fn) => fn.description());

    console.log('generatedtools', tools);

    return { tools };
}

export function generateFilteredToolSchemas(filterFn?: (fn: AIFunction) => boolean, includeHiddenFunctions: boolean = true) {
    const registry = getFunctionRegistry();

    let functions = Array.from(registry.values());

    // Apply filter if provided
    if (filterFn) {
        functions = functions.filter(filterFn);
    }

    // Always include hidden functions (default functions) in tools schema
    // Only filter them out if explicitly requested not to include them
    if (!includeHiddenFunctions) {
        functions = functions.filter(fn => {
            const functionAttribute = getFunctionAttributes().get(fn.getName());
            return !functionAttribute?.isHidden;
        });
    }

    // Limit the number of functions to prevent token overflow
    const maxFunctions = 200; // Increased limit since we're including all functions
    if (functions.length > maxFunctions) {
        console.warn(`Too many functions (${functions.length}), limiting to ${maxFunctions} most relevant ones`);
        functions = functions.slice(0, maxFunctions);
    }

    const tools = functions.map((fn) => fn.description());

    console.log(`generated ${tools.length} filtered tools (including hidden functions)`);

    return { tools };
}

export function generateSplitToolSchemas(maxChars: number = 8000) {
    const registry = getFunctionRegistry();
    const functions = Array.from(registry.values());
    const tools = functions.map((fn) => fn.description());

    const toolsSchema = { tools };
    const schemaString = JSON.stringify(toolsSchema, null, 2);

    console.log(`Total tools schema size: ${schemaString.length} characters`);

    // If schema is small enough, return as single message
    if (schemaString.length <= maxChars) {
        return [{ tools }];
    }

    // Split into multiple chunks
    const chunks: Array<{ tools: any[] }> = [];
    let currentChunk: any[] = [];
    let currentSize = 0;

    for (const tool of tools) {
        const toolString = JSON.stringify(tool, null, 2);

        // If adding this tool would exceed the limit, start a new chunk
        if (currentSize + toolString.length > maxChars && currentChunk.length > 0) {
            chunks.push({ tools: currentChunk });
            currentChunk = [tool];
            currentSize = toolString.length;
        } else {
            currentChunk.push(tool);
            currentSize += toolString.length;
        }
    }

    // Add the last chunk if it has tools
    if (currentChunk.length > 0) {
        chunks.push({ tools: currentChunk });
    }

    console.log(`Split tools schema into ${chunks.length} chunks`);
    return chunks;
}

