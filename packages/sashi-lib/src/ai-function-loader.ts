import {z} from "zod"

type AllowedTypes =
    | "string"
    | "number"
    | "boolean"
    | "array"
    | AIField<string | number | boolean>[]

export type AIField<T> = {
    name: string
    type: T
    description: string
    required?: boolean
}

export type AINumber = AIField<"number">
export type AIString = AIField<"string">
export type AIBoolean = AIField<"boolean">

export class AIArray {
    _name: string
    _type: "array"
    _description: string
    _itemType: AIField<any> | AIObject // Define the type of items in the array
    _required: boolean

    constructor(
        name: string,
        description: string,
        itemType: AIField<any> | AIObject,
        required: boolean = true
    ) {
        this._name = name
        this._type = "array"
        this._description = description
        this._itemType = itemType // Define what kind of items the array will hold
        this._required = required
    }

    getName() {
        return this._name
    }

    getRequired() {
        return this._required
    }

    getItemType() {
        return this._itemType
    }

    description() {
        return {
            type: "array",
            description: this.description,
            items:
                this._itemType instanceof AIObject
                    ? this._itemType.description()
                    : {
                          type: this._itemType.type,
                          description: this._itemType.description
                      }
        }
    }
}

export class AIObject {
    private _name: string
    private _description: string
    private _fields: (AIField<AllowedTypes> | AIObject)[]
    private _required: boolean

    constructor(name: string, description: string, required: boolean) {
        this._name = name
        this._description = description
        this._fields = []
        this._required = required
    }

    field<T extends AllowedTypes>(field: AIField<T> | AIObject) {
        this._fields.push(field)
        return this
    }

    getName(): string {
        return this._name
    }

    getDescription(): string {
        return this._description
    }

    getFields(): (
        | AIField<AllowedTypes>
        | AIObject
        | AIField<AllowedTypes>[]
        | AIObject[]
    )[] {
        return this._fields
    }

    validateAIField = (
        field: AIField<AllowedTypes>
    ):
        | z.ZodString
        | z.ZodNumber
        | z.ZodBoolean
        | z.ZodArray<z.ZodTypeAny, "many">
        | z.ZodEffects<z.ZodString, any, any>
        | z.ZodUnion<[z.ZodEffects<z.ZodString, any, any>, z.ZodNumber]> // This handles the case of number transformation
        | z.ZodUnion<[z.ZodEffects<z.ZodString, any, any>, z.ZodBoolean]> // This handles the case of boolean transformation
        | z.ZodUnion<
              [
                  z.ZodEffects<z.ZodString, any, any>,
                  z.ZodArray<z.ZodTypeAny, "many">
              ]
          > // For array transformations
        | z.ZodNull => {
        switch (field.type) {
            case "string":
                return z.string()

            case "number":
                return z
                    .string()
                    .transform((val) => {
                        const parsed = Number(val)
                        if (isNaN(parsed)) {
                            throw new Error("Invalid number")
                        }
                        return parsed
                    })
                    .or(z.number()) // Support both strings and numbers

            case "boolean":
                return z
                    .string()
                    .transform((val) => {
                        if (val === "true") return true
                        if (val === "false") return false
                        throw new Error("Invalid boolean")
                    })
                    .or(z.boolean()) // Support both strings and booleans

            case "array":
                return z
                    .string()
                    .transform((val) => {
                        try {
                            const parsed = JSON.parse(val)
                            if (Array.isArray(parsed)) return parsed
                            throw new Error("Invalid array")
                        } catch (error) {
                            throw new Error("Invalid array")
                        }
                    })
                    .or(z.array(z.any())) // Support both strings (for stringified arrays) and arrays

            default:
                throw new Error("Unsupported type")
        }
    }
    description(): Record<string, any> {
        return {
            type: "object",
            name: this._name,
            description: this._description,
            properties: this._fields.reduce(
                (acc, field) => {
                    if (field instanceof AIObject) {
                        return {
                            ...acc,
                            [field.getName()]: field.description()
                        }
                    } else {
                        return {
                            ...acc,
                            [field.name]: {
                                type: field.type,
                                description: field.description
                            }
                        }
                    }
                },
                {} as Record<string, any>
            )
        }
    }
    getRequired() {
        return this._required
    }
}

export class AIFunction {
    private _repo: string
    private _name: string

    private _description: string
    private _params: (AIField<any> | AIObject | AIArray)[]
    private _returnType?: AIField<any> | AIObject | AIArray
    private _implementation: Function

    constructor(name: string, description: string) {
        this._name = name
        this._description = description
        this._params = []
        this._implementation = () => {}
    }

    args(...params: (AIField<any> | AIObject | AIArray)[]) {
        this._params = params
        return this
    }

    returns(returnType: AIField<any> | AIObject | AIArray) {
        this._returnType = returnType
        return this
    }

    implement(fn: (...args: any[]) => any) {
        this._implementation = fn
        return this
    }

    getName(): string {
        return this._name
    }

    getDescription(): string {
        return this._description
    }

    getParams(): (AIField<any> | AIObject | AIArray)[] {
        return this._params
    }

    getRepo(): string {
        return this._repo
    }

    validateAIField = (
        param: AIField<any> | AIObject | AIArray
    ):
        | z.ZodString
        | z.ZodNumber
        | z.ZodBoolean
        | z.ZodArray<z.ZodTypeAny>
        | z.ZodNull
        | z.ZodAny => {
        if (param instanceof AIArray) {
            return z.array(this.validateAIField(param.getItemType()))
        } else if (param instanceof AIObject) {
            return z.any()
        } else {
            switch (param.type) {
                case "string":
                    return z.string()
                case "number":
                    return z.number()
                case "boolean":
                    return z.boolean()
                case "array":
                    return z.array(z.any()) // Adjust based on the specific type of array elements
                default:
                    return z.null()
            }
        }
    }

    description() {
        return {
            type: "function",
            function: {
                name: this._name,
                description: this._description,
                parameters: {
                    type: "object",
                    properties: this._params.reduce((acc, param) => {
                        if (param instanceof AIArray) {
                            return {
                                ...acc,
                                [param.getName()]: param.description()
                            }
                        } else if (param instanceof AIObject) {
                            return {
                                ...acc,
                                [param.getName()]: param.description()
                            }
                        } else {
                            return {
                                ...acc,
                                [param.name]: {
                                    type: param.type,
                                    description: param.description
                                }
                            }
                        }
                    }, {}),
                    required: this._params
                        .filter((param) => {
                            if (param instanceof AIArray) {
                                return param.getRequired()
                            } else if (param instanceof AIObject) {
                                return param.getRequired()
                            } else {
                                return param.required
                            }
                        })
                        .map((param) => {
                            if (param instanceof AIArray) {
                                return param.getName()
                            } else if (param instanceof AIObject) {
                                return param.getName()
                            } else {
                                return param.name
                            }
                        })
                }
            }
        }
    }

    async execute(...args: any[]) {
        const parsedArgs = z
            .tuple(
                this._params.map(this.validateAIField) as [
                    z.ZodTypeAny,
                    ...z.ZodTypeAny[]
                ]
            )
            .parse(args)

        try {
            const result = await this._implementation(...parsedArgs)
            if (this._returnType) {
                const returnTypeSchema = this.validateAIField(this._returnType)
                return returnTypeSchema.parse(result)
            }
            return result
        } catch (e) {
            return "there was a error calling this function"
        }
    }
}

export interface FunctionMetadata<F extends AIFunction> {
    fn: F
}

interface RegisteredFunction<F extends AIFunction> extends FunctionMetadata<F> {
    name: string
}

type FunctionRegistry = Map<string, AIFunction>

const functionRegistry: FunctionRegistry = new Map()

export function getFunctionRegistry(): FunctionRegistry {
    return functionRegistry
}

export function registerFunctionIntoAI<F extends AIFunction>(
    name: string,
    fn: F
) {
    functionRegistry.set(fn.getName(), fn)
}

export async function callFunctionFromRegistry<F extends AIFunction>(
    name: string,
    ...args: any[]
): Promise<any> {
    const registeredFunction = functionRegistry.get(name)

    if (!registeredFunction) {
        throw new Error(`Function ${name} is not registered`)
    }

    // Call the function
    const result = await registeredFunction.execute(...args)

    return result
}

export async function callFunctionFromRegistryFromObject<F extends AIFunction>(
    name: string,
    argsObj: Record<string, any>
): Promise<any> {
    const registeredFunction = functionRegistry.get(name)

    if (!registeredFunction) {
        throw new Error(`Function ${name} is not registered`)
    }

    const args = registeredFunction.getParams().map((param) => {
        if (param instanceof AIObject) {
            // Handle AIObject by using getName
            return argsObj[param.getName()]
        } else if (param instanceof AIArray) {
            // Handle AIArray by using getName
            return argsObj[param.getName()]
        } else if ("name" in param) {
            // For AIField, which has a name property
            return argsObj[param.name]
        } else {
            // If none of the conditions match, throw an error
            throw new Error(`Parameter ${param} is missing a valid name`)
        }
    })
    // Call the function
    const result = await registeredFunction.execute(...args)

    return result ?? "This function is not available"
}
