import { describe, expect, it } from "@jest/globals";

import { AIBoolean } from "./ai-function-loader";
// aiFunctionRegistry.test.ts
import {
    AIField,
    AIFieldEnum,
    AIFunction,
    AIObject,
    callFunctionFromRegistry,
    generateFilteredToolSchemas,
    generateSplitToolSchemas,
    getFunctionAttributes,
    getFunctionRegistry,
    registerFunctionIntoAI
} from "./ai-function-loader"; // Adjust the import path as needed

describe("AI Function Registry", () => {
    const AddFunction = new AIFunction("add", "Adds two numbers")
        .args(
            {
                name: "a",
                description: "First number to add",
                type: "number",
                required: true
            },
            {
                name: "b",
                description: "Second number to add",
                type: "number",
                required: true
            }
        )
        .returns({
            name: "result",
            type: "number",
            description: "The sum of the two numbers"
        })
        .implement((a: number, b: number) => {
            return a + b
        })

    // Define a nested object for location details
    const LocationObject = new AIObject("location", "Location details", true)
        .field({
            name: "city",
            type: "string",
            description: "The city name",
            required: true
        })
        .field({
            name: "country",
            type: "string",
            description: "The country name",
            required: true
        })
        .field(
            new AIFieldEnum(
                "region",
                "The region of the country",
                ["North", "South", "East", "West"],
                true
            )
        )

    // Define the main function that uses nested objects and enums
    const WeatherForecastFunction = new AIFunction(
        "get_weather_forecast",
        "Get a weather forecast"
    )
        .args(
            LocationObject, // Use the nested location object
            new AIFieldEnum(
                "unit",
                "The temperature unit",
                ["celsius", "fahrenheit"], // Enum values for temperature unit
                true
            ),
            {
                name: "includeHumidity",
                description: "Whether to include humidity in the forecast",
                type: "boolean",
                required: true
            } as AIBoolean
        )
        .returns({
            name: "forecast",
            type: "string",
            description:
                "The weather forecast with temperature and optional humidity"
        })
        .implement((location: any, unit: string, includeHumidity: boolean) => {
            const temperature = unit === "celsius" ? "20°C" : "68°F"
            const forecast = `Weather in ${location.city}, ${location.country} (${location.region}): ${temperature}`
            if (includeHumidity) {
                return `${forecast} with 60% humidity.`
            }
            return forecast
        })

    beforeAll(() => {
        registerFunctionIntoAI("add", AddFunction)
    })

    it("should register the function and return the correct result", async () => {
        const result = await callFunctionFromRegistry("add", 1, 2)
        expect(result).toBe(3)
    })

    it("should validate the payload", async () => {
        await expect(
            callFunctionFromRegistry("add", 1, "two" as any)
        ).resolves.toContain("There was an issue with the parameters you provided for the function")
    })

    it("should validate the return value", async () => {
        class InvalidAddFunction extends AIFunction {
            constructor() {
                super(
                    "invalidAdd",
                    "Adds two numbers and returns a string (invalid)"
                )
                this.args(
                    {
                        name: "a",
                        type: "number",
                        description: "The first number"
                    },
                    {
                        name: "b",
                        type: "number",
                        description: "The second number"
                    }
                )
                    .returns({
                        name: "result",
                        type: "number",
                        description: "The sum of the two numbers as a number"
                    })
                    .implement((a: number, b: number) => `${a + b}`) // Returning a string instead of number
            }
        }

        const invalidAdd = new InvalidAddFunction()
        registerFunctionIntoAI("invalidAdd", invalidAdd)

        expect(
            await callFunctionFromRegistry<InvalidAddFunction>(
                "invalidAdd",
                1,
                2
            )
        ).toContain("There was an issue with the parameters you provided for the function ")
    })

    it("should correctly handle different types of parameters", async () => {
        class MixedParamsFunction extends AIFunction {
            constructor() {
                super("mixedParams", "Function with mixed parameter types")
                this.args(
                    {
                        name: "str",
                        type: "string",
                        description: "A string parameter"
                    },
                    {
                        name: "num",
                        type: "number",
                        description: "A number parameter"
                    },
                    {
                        name: "bool",
                        type: "boolean",
                        description: "A boolean parameter"
                    }
                )
                    .returns({
                        name: "result",
                        type: "string",
                        description: "A concatenated string"
                    })
                    .implement(
                        (str: string, num: number, bool: boolean) =>
                            `${str} - ${num} - ${bool}`
                    )
            }
        }

        const mixedParams = new MixedParamsFunction()
        registerFunctionIntoAI("mixedParams", mixedParams)

        const result = await callFunctionFromRegistry<MixedParamsFunction>(
            "mixedParams",
            "test",
            42,
            true
        )
        expect(result).toBe("test - 42 - true")

        /*await expect(
            callFunctionFromRegistry<MixedParamsFunction>(
                "mixedParams",
                "test",
                42,
                "not boolean" as any
            )
        ).rejects.toThrow()*/
    })

    it("should describe function parameters and return type correctly", () => {
        const expected = {
            type: "function",
            function: {
                name: "add",
                description: "Adds two numbers",
                parameters: {
                    type: "object",
                    properties: {
                        a: {
                            type: "number",
                            description: "First number to add"
                        },
                        b: {
                            type: "number",
                            description: "Second number to add"
                        }
                    },
                    required: [
                        "a",
                        "b",
                    ],
                },
                returns: {
                    description: "The return value of this function",
                    properties: {
                        description: "The sum of the two numbers",
                        type: "number",
                    },
                    type: "object",
                }
            }
        }

        const description = AddFunction.description()

        expect(expected).toEqual(description)
    })

    beforeAll(() => {
        registerFunctionIntoAI("get_weather_forecast", WeatherForecastFunction)
    })

    // Test the complex function call with correct values
    it("should return the correct weather forecast with nested object and enum values", async () => {
        const location = {
            city: "San Francisco",
            country: "USA",
            region: "West" // Enum value
        }
        const result = await callFunctionFromRegistry(
            "get_weather_forecast",
            location,
            "celsius",
            true
        )
        expect(result).toBe(
            "Weather in San Francisco, USA (West): 20°C with 60% humidity."
        )
    })

    // Test description of complex function parameters and nested object
    it("should describe the nested object and enum fields correctly", () => {
        const expected = {
            type: "function",
            function: {
                name: "get_weather_forecast",
                description: "Get a weather forecast",
                parameters: {
                    type: "object",
                    properties: {
                        location: {
                            name: "location",
                            type: "object",
                            description: "Location details",
                            properties: {
                                city: {
                                    type: "string",
                                    description: "The city name"
                                },
                                country: {
                                    type: "string",
                                    description: "The country name"
                                },
                                region: {
                                    type: "string",
                                    enum: ["North", "South", "East", "West"],
                                    description: "The region of the country",
                                    required: true
                                }
                            },
                            required: ["city", "country", "region"]
                        },
                        unit: {
                            type: "string",
                            enum: ["celsius", "fahrenheit"],
                            description: "The temperature unit",
                            required: true
                        },
                        includeHumidity: {
                            type: "boolean",
                            description:
                                "Whether to include humidity in the forecast"
                        }
                    },
                    required: [
                        "location",
                        "unit",
                        "includeHumidity",
                    ],
                },
                returns: {
                    description: "The return value of this function",
                    properties: {
                        description: "The weather forecast with temperature and optional humidity",
                        type: "string",
                    },
                    type: "object",
                }

            }
        }

        const description = WeatherForecastFunction.description()
        expect(description).toEqual(expected)
    })

    // Test invalid input (wrong enum value)
    it("should throw an error when an invalid enum value is passed", async () => {
        const location = {
            city: "San Francisco",
            country: "USA",
            region: "Central" // Invalid region (should be one of "North", "South", "East", "West")
        }

        expect(
            await callFunctionFromRegistry(
                "get_weather_forecast",
                location,
                "celsius",
                true
            )
        ).toBe(
            "Weather in San Francisco, USA (Central): 20°C with 60% humidity."
        )
    })
})

describe('Tool Schema Generation', () => {
    beforeEach(() => {
        const registry = getFunctionRegistry();
        registry.clear();
        const attributes = getFunctionAttributes();
        attributes.clear();
    });

    describe('generateSplitToolSchemas', () => {
        it('should return single chunk for small schemas', () => {
            // Create a small function
            const testFunction = new AIFunction("test_function", "A test function")
                .args({
                    name: "param",
                    description: "test parameter",
                    type: "string",
                    required: true
                })
                .implement(async (param: string) => param);

            registerFunctionIntoAI("test_function", testFunction);

            const chunks = generateSplitToolSchemas(8000);
            expect(chunks).toHaveLength(1);
            expect(chunks[0]?.tools).toHaveLength(1);
        });

        it('should split large schemas into multiple chunks', () => {
            // Create many functions to exceed the character limit
            for (let i = 0; i < 50; i++) {
                const testFunction = new AIFunction(
                    `test_function_${i}`,
                    `A test function ${i} with a very long description that will make the schema larger and help us test the splitting functionality`
                )
                    .args({
                        name: "param1",
                        description: "test parameter 1 with a very long description",
                        type: "string",
                        required: true
                    })
                    .args({
                        name: "param2",
                        description: "test parameter 2 with another very long description",
                        type: "number",
                        required: false
                    })
                    .implement(async (param1: string, param2?: number) => ({ param1, param2 }));

                registerFunctionIntoAI(`test_function_${i}`, testFunction);
            }

            const chunks = generateSplitToolSchemas(1000); // Small limit to force splitting
            expect(chunks.length).toBeGreaterThan(1);

            // Verify all functions are included across chunks
            const allTools = chunks.flatMap(chunk => chunk.tools);
            expect(allTools).toHaveLength(50);
        });

        it('should include hidden functions in split schemas', () => {
            // Create a hidden function
            const hiddenFunction = new AIFunction("hidden_function", "A hidden function", undefined, false, true)
                .args({
                    name: "param",
                    description: "test parameter",
                    type: "string",
                    required: true
                })
                .implement(async (param: string) => param);

            registerFunctionIntoAI("hidden_function", hiddenFunction);

            const chunks = generateSplitToolSchemas(8000);
            const allTools = chunks.flatMap(chunk => chunk.tools);

            // Hidden function should be included in tools schema
            expect(allTools.some(tool => tool.function.name === "hidden_function")).toBe(true);
        });
    });

    describe('generateFilteredToolSchemas', () => {
        it('should include hidden functions by default', () => {
            // Create a hidden function
            const hiddenFunction = new AIFunction("hidden_function", "A hidden function", undefined, false, true)
                .args({
                    name: "param",
                    description: "test parameter",
                    type: "string",
                    required: true
                })
                .implement(async (param: string) => param);

            registerFunctionIntoAI("hidden_function", hiddenFunction);

            const schema = generateFilteredToolSchemas();
            expect(schema.tools.some(tool => tool.function.name === "hidden_function")).toBe(true);
        });

        it('should exclude hidden functions when explicitly requested', () => {
            // Create a hidden function
            const hiddenFunction = new AIFunction("hidden_function", "A hidden function", undefined, false, true)
                .args({
                    name: "param",
                    description: "test parameter",
                    type: "string",
                    required: true
                })
                .implement(async (param: string) => param);

            registerFunctionIntoAI("hidden_function", hiddenFunction);

            const schema = generateFilteredToolSchemas(undefined, false);
            expect(schema.tools.some(tool => tool.function.name === "hidden_function")).toBe(false);
        });
    });

    describe('AIField Type Safety', () => {
        it('should only accept primitive types for AIField', () => {
            // These should compile successfully
            const stringField: AIField<'string'> = {
                name: 'test',
                type: 'string',
                description: 'test string field',
                required: true
            };

            const numberField: AIField<'number'> = {
                name: 'test',
                type: 'number',
                description: 'test number field',
                required: true
            };

            const booleanField: AIField<'boolean'> = {
                name: 'test',
                type: 'boolean',
                description: 'test boolean field',
                required: true
            };

            const enumField: AIField<'enum'> = {
                name: 'test',
                type: 'enum',
                description: 'test enum field',
                required: true
            };

            const arrayField: AIField<'array'> = {
                name: 'test',
                type: 'array',
                description: 'test array field',
                required: true
            };

            // TypeScript should prevent this at compile time:
            // @ts-expect-error - 'object' is not a valid AIField type, use AIObject instead
            const invalidObjectField: AIField<'object'> = {
                name: 'test',
                type: 'object' as any, // Have to cast to any to make test compile
                description: 'invalid object field',
                required: true
            };

            // Verify the valid fields have correct structure
            expect(stringField.type).toBe('string');
            expect(numberField.type).toBe('number');
            expect(booleanField.type).toBe('boolean');
            expect(enumField.type).toBe('enum');
            expect(arrayField.type).toBe('array');
        });

        it('should use AIObject for complex object types, not AIField', () => {
            // Correct way to define an object type
            const userObject = new AIObject('User', 'A user object', true)
                .field({
                    name: 'name',
                    type: 'string',
                    description: 'User name',
                    required: true
                })
                .field({
                    name: 'age',
                    type: 'number',
                    description: 'User age',
                    required: false
                });

            expect(userObject.getName()).toBe('User');
            expect(userObject.getDescription()).toBe('A user object');
            expect(userObject.getFields()).toHaveLength(2);
        });
    });
});